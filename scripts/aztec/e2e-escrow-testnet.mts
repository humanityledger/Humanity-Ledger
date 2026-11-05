/**
 * scripts/aztec/e2e-escrow-testnet.mts
 *
 * End-to-end run of keyed PrivateEscrow and PaymentStream instances on Aztec
 * testnet, with throwaway accounts paid by the sponsored FPC and a fresh test
 * token, so it needs no secrets and anyone can reproduce it:
 *
 *   1. deploy two accounts (sender, recipient) and a test Token; mint and
 *      shield into the sender's private balance;
 *   2. deploy each contract with public keys derived from a fresh secret
 *      (lib/aztec/keyed-deploy.ts), publishing the class if the node does not
 *      have it; both parties register the instance with that secret;
 *   3. escrow 1: deposit with an authwit, claim by the recipient; a second
 *      claim and a refund of it are refused;
 *   4. escrow 2: deposit with a short deadline; a refund before it and a
 *      claim after it are refused; the sender is refunded after it;
 *   5. stream: create, a withdrawal beyond accrual is refused, a withdrawal
 *      within accrual is paid; the sender cancels and gets the unaccrued
 *      rest, after which withdrawing and cancelling again are refused;
 *   6. identity: deploy with a placeholder root, the issuer publishes a real
 *      depth-32 root, a member claims once per scope;
 *   7. identity: a claim against a just-replaced root lands within the grace
 *      period; the issuer rotates in two steps;
 *   8. an escrow opened and accepted through lib/aztec/agreements.ts, the
 *      code the app uses: a tampered invitation is refused, the genuine one
 *      is verified and registered, and the recipient claims;
 *   9. every balance is checked after every step; refusals are checked by
 *      their reason, not only by failing.
 *
 *   node --conditions=browser --import tsx --import ./scripts/aztec/register.mjs scripts/aztec/e2e-escrow-testnet.mts
 *
 * Prints every transaction hash and writes them to e2e-escrow-receipt.json
 * (and the GitHub step summary). The escrow secret and the claim secret are
 * never printed. Test network only.
 */
import fs from 'node:fs';
import { createAztecNodeClient, waitForTx } from '@aztec-labs/aztec.js/node';
import { Fr, Fq } from '@aztec-labs/aztec.js/fields';
import { AztecAddress } from '@aztec-labs/aztec.js/addresses';
import { Contract, DeployMethod, getContractInstanceFromInstantiationParams, NO_WAIT } from '@aztec-labs/aztec.js/contracts';
import { SponsoredFeePaymentMethod } from '@aztec-labs/aztec.js/fee';
import { NO_FROM } from '@aztec-labs/aztec.js/account';
import { SponsoredFPCContract } from '@aztec-labs/noir-contracts.js/SponsoredFPC';
import { TokenContract } from '@aztec-labs/noir-contracts.js/Token';
import { openTmpStore } from '@aztec-labs/kv-store/deprecated/indexeddb';
import { EmbeddedWallet } from '@aztec-labs/wallets/embedded';
import { KEYED_ARTIFACT_PATHS, computeKeyedInstance, loadKeyedArtifact } from '../../lib/aztec/keyed-deploy.ts';
import { openEscrow, acceptInvite, confirmAgreement, escrowMismatches, type EscrowView, type StreamView } from '../../lib/aztec/agreements.ts';
import { currentClassIds } from '../../lib/aztec/agreement-invite.ts';

const registry = JSON.parse(fs.readFileSync('deployments/aztec-testnet.json', 'utf8'));
const NODE_URL = process.env.AZTEC_NODE_URL || registry.network.nodeUrl;
const RPC = { maxBatchSize: 3 };
const DOM_SEP__CLAIM_SECRET = 718293041; // contracts/aztec/escrow/src/main.nr
const t0 = Date.now();
const log = (...a: unknown[]) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

const receipt: { network: string; startedAt: string; steps: Array<{ step: string; txHash?: string; block?: number; detail?: string }>; checks: Array<{ check: string; ok: boolean; detail?: string }> } = {
  network: NODE_URL,
  startedAt: new Date().toISOString(),
  steps: [],
  checks: [],
};
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  receipt.checks.push({ check: label, ok, detail: detail || undefined });
};
const unwrap = (r: any): bigint => {
  const v = r && typeof r === 'object' && 'result' in r ? r.result : r;
  return BigInt(typeof v === 'object' && v && 'toBigInt' in v ? v.toBigInt() : v);
};

async function poseidon2WithSeparator(inputs: Fr[], sep: number): Promise<Fr> {
  const mods: string[] = ['@aztec-labs/foundation/crypto/poseidon', '@aztec-labs/foundation/crypto'];
  for (const m of mods) {
    try {
      const mod: any = await import(m);
      if (mod.poseidon2HashWithSeparator) return await mod.poseidon2HashWithSeparator(inputs, sep);
    } catch {
      /* try the next export path */
    }
  }
  throw new Error('poseidon2HashWithSeparator not found in @aztec-labs/foundation');
}

const node = createAztecNodeClient(NODE_URL, RPC);
const fpc = await getContractInstanceFromInstantiationParams(SponsoredFPCContract.artifact, { salt: new Fr(0) });
const fee = { paymentMethod: new SponsoredFeePaymentMethod(fpc.address) };

async function newWallet() {
  const w = await EmbeddedWallet.create(NODE_URL, {
    ephemeral: true,
    nodeClientOptions: RPC,
    pxe: { store: await openTmpStore(true) },
    walletDb: { store: await openTmpStore(true) },
  });
  await w.registerContract(fpc, SponsoredFPCContract.artifact);
  return w;
}

async function newAccount(w: any, alias: string) {
  const m = await w.createSchnorrAccount(Fr.random(), Fr.random(), Fq.random(), alias);
  const sent = await (await m.getDeployMethod()).send({ from: NO_FROM, fee, wait: NO_WAIT });
  const r = await waitForTx(node, sent.txHash, { timeout: 900, interval: 2 });
  receipt.steps.push({ step: `deploy account ${alias}`, txHash: sent.txHash.toString(), block: Number(r.blockNumber) });
  log(`${alias} deployed ${m.address}`);
  return m.address as AztecAddress;
}

async function sendAndWait(step: string, interaction: any, opts: Record<string, unknown>) {
  const sent = await interaction.send({ fee, wait: NO_WAIT, ...opts });
  const r = await waitForTx(node, sent.txHash, { timeout: 900, interval: 2 });
  receipt.steps.push({ step, txHash: sent.txHash.toString(), block: Number(r.blockNumber) });
  log(step, sent.txHash.toString(), 'block', Number(r.blockNumber));
  return sent.txHash.toString();
}

const nowSec = () => Math.floor(Date.now() / 1000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Expects a simulation to be refused; returns the reason. */
async function refused(interaction: any, opts: Record<string, unknown>): Promise<string> {
  try {
    await interaction.simulate(opts);
    return 'accepted';
  } catch (e) {
    return (e as Error).message.replace(/\s+/g, ' ').slice(0, 160);
  }
}

/** Sends a transaction expected to be rejected; returns the reason. */
async function rejectedOnSend(interaction: any, opts: Record<string, unknown>): Promise<string> {
  try {
    const sent = await interaction.send({ fee, wait: NO_WAIT, ...opts });
    const r: any = await waitForTx(node, sent.txHash, { timeout: 900, interval: 2 });
    return `included (status ${r?.status ?? 'unknown'})`;
  } catch (e) {
    return (e as Error).message.replace(/\s+/g, ' ').slice(0, 200);
  }
}

// Utility calls run in the caller's PXE; simulate() returns the decoded value
// (or { result } when metadata is requested).
async function view<T>(interaction: any, from: AztecAddress): Promise<T> {
  const r = await interaction.simulate({ from });
  return (r && typeof r === 'object' && 'result' in r && !('found' in r) ? r.result : r) as T;
}
const big = (x: any): bigint => (typeof x === 'bigint' ? x : typeof x === 'number' || typeof x === 'boolean' ? BigInt(x) : x?.toBigInt ? x.toBigInt() : BigInt(x.toString()));

async function main() {
  const info = await node.getNodeInfo();
  log('node', info.nodeVersion, 'L1', info.l1ChainId, 'rollup', info.rollupVersion);

  const wa = await newWallet();
  const wb = await newWallet();
  const sender = await newAccount(wa, 'sender');
  const recipient = await newAccount(wb, 'recipient');
  await wb.registerSender(sender, 'sender');

  // A fresh test token, administered by the throwaway sender.
  const tokenDeploy = await TokenContract.deploy(wa, sender, 'HL e2e test token', 'HLT', 6).send({ from: sender, fee, wait: { timeout: 900 } });
  const tokenAddr: AztecAddress = (tokenDeploy as any).instance?.address ?? (tokenDeploy as any).contract?.address;
  receipt.steps.push({ step: 'deploy test token', detail: tokenAddr.toString() });
  log('token', tokenAddr.toString());
  await wb.registerContract((await node.getContract(tokenAddr))!, TokenContract.artifact);
  const tokA = TokenContract.at(tokenAddr, wa);
  const tokB = TokenContract.at(tokenAddr, wb);
  const balA = async () => unwrap(await tokA.methods.balance_of_private(sender).simulate({ from: sender }));
  const balB = async () => unwrap(await tokB.methods.balance_of_private(recipient).simulate({ from: recipient }));

  await sendAndWait('mint to sender (public)', tokA.methods.mint_to_public(sender, 100_000_000n), { from: sender });
  await sendAndWait('shield into sender private balance', tokA.methods.transfer_to_private(sender, 90_000_000n), { from: sender });
  check('sender private balance is 90', (await balA()) === 90_000_000n);

  /** Keyed universal deployment; publishes the class first if the node does not have it. */
  async function deployKeyed(c: 'escrow' | 'streams', label: string) {
    const artifact = loadKeyedArtifact(JSON.parse(fs.readFileSync(KEYED_ARTIFACT_PATHS[c], 'utf8')));
    const secretKey = Fr.random();
    const salt = Fr.random();
    const expected = await computeKeyedInstance(artifact, { secretKey, salt, token: tokenAddr });
    const classId = expected.instance.currentContractClassId;
    const published = !!(await node.getContractClass(classId));
    log(label, 'class', classId.toString(), published ? 'already published' : 'publishing with the deployment');
    const deployment = DeployMethod.create(
      wa,
      { artifact, args: [tokenAddr], postDeployCtor: (instance: any, w: any) => Contract.at(instance.address, artifact, w) },
      { salt, publicKeys: expected.publicKeys, universalDeploy: true },
    );
    const res: any = await deployment.send({ from: sender, fee, skipClassPublication: published, wait: { timeout: 900 } } as any);
    const addr = AztecAddress.fromStringUnsafe((res.instance?.address ?? res.contract?.address).toString());
    receipt.steps.push({
      step: `deploy keyed ${label}${published ? '' : ' (and publish its class)'}`,
      txHash: res.receipt?.txHash?.toString(),
      block: res.receipt?.blockNumber ? Number(res.receipt.blockNumber) : undefined,
      detail: `${addr.toString()} class ${classId.toString()}`,
    });
    check(`${label}: address is the keyed instance computed locally`, addr.equals(expected.instance.address), addr.toString());
    const onchain = await node.getContract(addr);
    check(`${label}: the node returns its own public keys`, !!onchain && onchain.publicKeys.equals(expected.publicKeys));
    check(`${label}: the node runs the committed class`, !!onchain && onchain.currentContractClassId.equals(classId));
    // Both parties register the instance with its secret, so their PXEs can
    // find and spend its token notes.
    await wa.registerContract(expected.instance, artifact, secretKey);
    await wb.registerContract(expected.instance, artifact, secretKey);
    return { addr, a: Contract.at(addr, artifact, wa) as any, b: Contract.at(addr, artifact, wb) as any };
  }

  async function authwitFor(caller: AztecAddress, amount: bigint) {
    const nonce = Fr.random();
    const pull = tokA.methods.transfer_in_private(sender, caller, amount, nonce);
    let witness: any;
    try {
      witness = await (wa as any).createAuthWit(sender, { caller, call: await pull.getFunctionCall() });
    } catch {
      witness = await (wa as any).createAuthWit(sender, { caller, action: pull });
    }
    return { nonce, witness };
  }

  // ── PrivateEscrow: one claim before the deadline, one refund after it ──
  const escrow = await deployKeyed('escrow', 'PrivateEscrow');

  const claimSecret = Fr.random();
  const claimHash = await poseidon2WithSeparator([claimSecret], DOM_SEP__CLAIM_SECRET);
  const idClaim = Fr.random();
  const w1 = await authwitFor(escrow.addr, 25_000_000n);
  await sendAndWait('escrow 1: deposit 25 (deadline +2 h)',
    escrow.a.methods.deposit(recipient, 25_000_000n, BigInt(nowSec() + 7200), claimHash, idClaim, w1.nonce),
    { from: sender, authWitnesses: [w1.witness] });

  const idRefund = Fr.random();
  const claimSecret2 = Fr.random();
  const refundDeadline = nowSec() + 420;
  const w2 = await authwitFor(escrow.addr, 10_000_000n);
  await sendAndWait('escrow 2: deposit 10 (deadline +7 min)',
    escrow.a.methods.deposit(recipient, 10_000_000n, BigInt(refundDeadline), await poseidon2WithSeparator([claimSecret2], DOM_SEP__CLAIM_SECRET), idRefund, w2.nonce),
    { from: sender, authWitnesses: [w2.witness] });
  check('sender private balance is 55 after both deposits', (await balA()) === 55_000_000n);
  // escrow_view: the terms as the contract stored them, for each party.
  const ev = async (c: any, owner: AztecAddress, id: Fr) => view<EscrowView>(c.methods.escrow_view(owner, id), owner);
  const rv1 = await ev(escrow.b, recipient, idClaim);
  check('escrow_view: the recipient reads the stored amount, deadline and claim hash',
    rv1.found && !rv1.settled && big(rv1.note.amount) === 25_000_000n && big(rv1.note.claim_secret_hash) === claimHash.toBigInt(),
    `found ${rv1.found}, amount ${big(rv1.note.amount)}`);
  const sv1 = await ev(escrow.a, sender, idClaim);
  check('escrow_view: the sender reads its refund copy', sv1.found && !sv1.settled && big(sv1.note.recipient) === recipient.toBigInt());
  const early = await refused(escrow.a.methods.refund(idRefund), { from: sender, additionalScopes: [escrow.addr] });
  check('escrow 2: refund before the deadline is refused', early.includes('deadline not reached'), early);

  await sendAndWait('escrow 1: claim by the recipient', escrow.b.methods.claim(idClaim, claimSecret), { from: recipient, additionalScopes: [escrow.addr] });
  check('recipient private balance is 25 after the claim', (await balB()) === 25_000_000n);
  const again = await refused(escrow.b.methods.claim(idClaim, claimSecret), { from: recipient, additionalScopes: [escrow.addr] });
  check('escrow 1: a second claim is refused', again.includes('escrow not found'), again);
  const lateRefund = await refused(escrow.a.methods.refund(idClaim), { from: sender, additionalScopes: [escrow.addr] });
  check('escrow 1: a refund before its deadline is refused', lateRefund.includes('deadline not reached'), lateRefund);
  const sv1b = await ev(escrow.a, sender, idClaim);
  check('escrow_view: after the claim, the sender sees escrow 1 as settled', sv1b.found && sv1b.settled);

  // ── PaymentStream: accrual-bounded withdrawal ──
  const stream = await deployKeyed('streams', 'PaymentStream');
  const streamSalt = Fr.random();
  const start = BigInt(nowSec() - 900);
  const w3 = await authwitFor(stream.addr, 20_000_000n);
  await sendAndWait('stream: create 20 at 10,000 units/s, started 15 min ago',
    stream.a.methods.create_stream(recipient, 20_000_000n, 10_000n, start, streamSalt, w3.nonce),
    { from: sender, authWitnesses: [w3.witness] });
  check('sender private balance is 35 after the stream', (await balA()) === 35_000_000n);
  // A second stream in the same instance keeps funds in the contract, so that
  // after stream 1 is cancelled only the state nullifier can stop it.
  const streamSalt2 = Fr.random();
  const w4 = await authwitFor(stream.addr, 5_000_000n);
  await sendAndWait('stream 2: create 5 in the same instance',
    stream.a.methods.create_stream(recipient, 5_000_000n, 1n, BigInt(nowSec() - 60), streamSalt2, w4.nonce),
    { from: sender, authWitnesses: [w4.witness] });
  check('sender private balance is 30 after stream 2', (await balA()) === 30_000_000n);
  const tooMuch = await refused(stream.b.methods.withdraw(streamSalt, 20_000_000n), { from: recipient, additionalScopes: [stream.addr] });
  check('stream: withdrawing the whole total early is refused', tooMuch.includes('insufficient accrued balance'), tooMuch);
  await sendAndWait('stream: withdraw 5 (within accrual)', stream.b.methods.withdraw(streamSalt, 5_000_000n), { from: recipient, additionalScopes: [stream.addr] });
  check('recipient private balance is 30 after the withdrawal', (await balB()) === 30_000_000n);
  // stream_view (SEC-S13): the sender now holds copies at index 0 and 1 and
  // the view returns the live one.
  const sw = async (c: any, owner: AztecAddress) => view<StreamView>(c.methods.stream_view(owner, streamSalt), owner);
  const sView = await sw(stream.a, sender);
  check('stream_view: the sender sees the live state (index 1, 5 withdrawn), not its stale copy',
    sView.found && sView.live && big(sView.note.index) === 1n && big(sView.note.withdrawn) === 5_000_000n,
    `live ${sView.live}, index ${big(sView.note.index)}`);
  const rView = await sw(stream.b, recipient);
  check('stream_view: the recipient sees the same state and a positive available amount', rView.live && big(rView.note.index) === 1n && big(rView.available) > 0n);

  // ── Escrow 2: refund once the deadline has passed ──
  const waitS = refundDeadline + 150 - nowSec();
  if (waitS > 0) {
    log(`waiting ${waitS}s for escrow 2's deadline to pass`);
    await sleep(waitS * 1000);
  }
  // AZ-12: the right claim secret, after the deadline, so the refusal can
  // only come from the deadline check.
  const lateClaim = await refused(escrow.b.methods.claim(idRefund, claimSecret2), { from: recipient, additionalScopes: [escrow.addr] });
  check('escrow 2: a claim with the right secret after the deadline is refused by the deadline', lateClaim.includes('escrow expired'), lateClaim);
  await sendAndWait('escrow 2: refund to the sender after the deadline', escrow.a.methods.refund(idRefund), { from: sender, additionalScopes: [escrow.addr] });
  check('sender private balance is 40 after the refund', (await balA()) === 40_000_000n);

  // ── PaymentStream: sender cancel (SEC-S12) ──
  await sendAndWait('stream: cancel by the sender', stream.a.methods.cancel(streamSalt), { from: sender, additionalScopes: [stream.addr] });
  const sAfter = await balA();
  const rAfter = await balB();
  check('stream cancel: nothing is created or lost (sender + recipient + 5 in stream 2 = 90)', sAfter + rAfter + 5_000_000n === 90_000_000n, `sender ${sAfter}, recipient ${rAfter}`);
  check('stream cancel: the recipient is paid what accrued beyond the 5 withdrawn', rAfter > 30_000_000n && rAfter <= 45_000_000n, `recipient ${rAfter}`);
  check('stream cancel: the sender gets the unaccrued rest back', sAfter > 40_000_000n, `sender ${sAfter}`);
  // Stream 2 still funds the contract, so these two can only be stopped by
  // the shared state nullifier (SEC-S12). They are sent, so the node decides.
  const afterCancel = await rejectedOnSend(stream.b.methods.withdraw(streamSalt, 1n), { from: recipient, additionalScopes: [stream.addr] });
  check('stream: a withdrawal after the cancel is rejected (state nullifier)', !afterCancel.startsWith('included'), afterCancel);
  const staleCancel = await rejectedOnSend(stream.a.methods.cancel(streamSalt), { from: sender, additionalScopes: [stream.addr] });
  // Rejected either by the state nullifier or, if stream 2 holds less than the
  // stale copy asks for, by the contract balance; the TXE test
  // a_cancel_from_a_stale_copy_fails_with_funds_left covers the nullifier case.
  check('stream: a cancel from the stale copy is rejected', !staleCancel.startsWith('included'), staleCancel);
  check('stream: nothing moved after the rejected transactions', (await balA()) === sAfter && (await balB()) === rAfter);
  const rDone = await sw(stream.b, recipient);
  check('stream_view: after the cancel the recipient sees the stream as not live', rDone.found && !rDone.live && big(rDone.available) === 0n);

  // ── IdentityCredential: a real root, a real claim ──
  const ID_COMMIT = 120938471, ID_LEAF = 238471092, MERKLE = 349582103, SANCTIONS = 461728390;
  const SPAIN = 724;
  const idSecret = Fr.random();
  const idSalt = Fr.random();
  const expiry = BigInt(nowSec() + 30 * 24 * 3600);
  const commitment = await poseidon2WithSeparator([recipient.toField(), idSecret], ID_COMMIT);
  let node_ = await poseidon2WithSeparator([commitment, new Fr(SPAIN), new Fr(expiry), idSalt], ID_LEAF);
  for (let i = 0; i < 32; i++) node_ = await poseidon2WithSeparator([node_, Fr.ZERO], MERKLE);
  const realRoot = node_;
  const list = Array.from({ length: 16 }, (_, i) => (i === 0 ? new Fr(250) : Fr.ZERO));
  const sanctionRoot = await poseidon2WithSeparator(list, SANCTIONS);
  const idArtifact = loadKeyedArtifact(JSON.parse(fs.readFileSync('contracts/aztec/identity/target/identity_credential-IdentityCredential.json', 'utf8')));
  const idDeploy: any = await Contract.deploy(wa, idArtifact, [new Fr(0x12345678), sanctionRoot, sender]).send({ from: sender, fee, wait: { timeout: 900 } } as any);
  const idAddr = AztecAddress.fromStringUnsafe((idDeploy.instance?.address ?? idDeploy.contract?.address).toString());
  receipt.steps.push({ step: 'deploy IdentityCredential with a placeholder root', txHash: idDeploy.receipt?.txHash?.toString(), block: idDeploy.receipt?.blockNumber ? Number(idDeploy.receipt.blockNumber) : undefined, detail: idAddr.toString() });
  log('IdentityCredential', idAddr.toString(), 'class', (await node.getContract(idAddr))!.currentContractClassId.toString());
  await wb.registerContract((await node.getContract(idAddr))!, idArtifact);
  const idA: any = Contract.at(idAddr, idArtifact, wa);
  const idB: any = Contract.at(idAddr, idArtifact, wb);
  const claimArgs = (scope: number) => [new Fr(scope), realRoot, idSecret, SPAIN, expiry, idSalt, 0, Array(32).fill(Fr.ZERO), list];
  const beforeRoot = await refused(idB.methods.verify_and_claim(...claimArgs(1)), { from: recipient });
  check('identity: no claim against the placeholder root', beforeRoot !== 'accepted', beforeRoot);
  await sendAndWait('identity: the issuer publishes the real root', idA.methods.update_root(realRoot), { from: sender });
  await sendAndWait('identity: the member claims in scope 1', idB.methods.verify_and_claim(...claimArgs(1)), { from: recipient });
  const twice = await refused(idB.methods.verify_and_claim(...claimArgs(1)), { from: recipient });
  check('identity: a second claim in the same scope is refused', twice !== 'accepted', twice);
  const notIssuer = await refused(idB.methods.update_root(Fr.random()), { from: recipient });
  check('identity: only the issuer can change the root', notIssuer.includes('only issuer'), notIssuer);

  // SEC-I8: a claim proven against the root an update just replaced still lands.
  await sendAndWait('identity: the issuer replaces the root', idA.methods.update_root(Fr.random()), { from: sender });
  await sendAndWait('identity: a claim against the replaced root lands within the grace period', idB.methods.verify_and_claim(...claimArgs(2)), { from: recipient });
  // SEC-I9: two-step issuer rotation.
  await sendAndWait('identity: the issuer proposes a new issuer', idA.methods.propose_issuer(recipient), { from: sender });
  await sendAndWait('identity: the proposed issuer accepts', idB.methods.accept_issuer(), { from: recipient });
  const oldIssuer = await refused(idA.methods.update_root(Fr.random()), { from: sender });
  check('identity: the previous issuer can no longer change the root', oldIssuer.includes('only issuer'), oldIssuer);

  // ── An agreement through lib/aztec/agreements.ts, as the app opens it ──
  const record = JSON.parse(fs.readFileSync('deployments/aztec-testnet.json', 'utf8'));
  const escrowArtifact = loadKeyedArtifact(JSON.parse(fs.readFileSync(KEYED_ARTIFACT_PATHS.escrow, 'utf8')));
  const streamArtifact = loadKeyedArtifact(JSON.parse(fs.readFileSync(KEYED_ARTIFACT_PATHS.streams, 'utf8')));
  const escrowClass = (await computeKeyedInstance(escrowArtifact, { secretKey: Fr.random(), salt: Fr.random(), token: tokenAddr })).instance.currentContractClassId;
  const opened = await openEscrow({
    sender: { wallet: wa, address: sender },
    recipient,
    token: tokenAddr,
    tokenSymbol: 'HLT',
    tokenContract: tokA,
    artifact: escrowArtifact,
    send: { fee },
    classPublished: !!(await node.getContractClass(escrowClass)),
    amount: 3_000_000n,
    deadline: nowSec() + 7200,
  });
  receipt.steps.push({ step: 'agreement: openEscrow, keyed deploy', txHash: opened.txHashes.deploy, block: opened.blocks.deploy, detail: opened.invite.instanceAddress });
  receipt.steps.push({ step: 'agreement: openEscrow, deposit 3', txHash: opened.txHashes.fund, block: opened.blocks.fund });
  log('agreement escrow', opened.invite.instanceAddress, 'deploy', opened.txHashes.deploy, 'deposit', opened.txHashes.fund);
  // The run tests the committed artifact, whose class the deployment record
  // lists only after this run; it is accepted alongside the record's current classes.
  const streamClass = (await computeKeyedInstance(streamArtifact, { secretKey: Fr.random(), salt: Fr.random(), token: tokenAddr })).instance.currentContractClassId;
  const recorded = currentClassIds(record);
  const verifyOpts = {
    artifacts: { escrow: escrowArtifact, streams: streamArtifact },
    allowedClassIds: { escrow: [...recorded.escrow, escrowClass.toString()], streams: [...recorded.streams, streamClass.toString()] },
    allowedTokens: [tokenAddr.toString()],
    peer: sender.toString(),
  };
  const tampered = JSON.stringify({ ...opened.invite, instanceAddress: stream.addr.toString() });
  const bad = await acceptInvite({ wallet: wb, address: recipient }, tampered, verifyOpts);
  check('agreement: a tampered invitation is refused before anything is registered', !bad.ok && bad.reason === 'address does not match the shared secret', bad.ok ? 'accepted' : bad.reason);
  const acc = await acceptInvite({ wallet: wb, address: recipient }, opened.raw, verifyOpts);
  check('agreement: the genuine invitation is verified and registered', acc.ok, acc.ok ? acc.invite.instanceAddress : acc.reason);
  if (acc.ok && acc.invite.type === 'hl.escrow_invite') {
    // The receiver confirms the invitation against the stored note; the
    // recipient's PXE may need a moment to discover it.
    let mismatches: string[] = ['not checked'];
    for (let i = 0; i < 6; i++) {
      mismatches = await confirmAgreement({ wallet: wb, address: recipient }, acc);
      if (!mismatches.includes('escrow not found in your notes')) break;
      await sleep(20_000);
    }
    check('agreement: the stored escrow note confirms every field of the invitation', mismatches.length === 0, mismatches.join(', ') || 'all fields match');
    const stored = await view<EscrowView>(acc.contract.methods.escrow_view(recipient, Fr.fromString(acc.invite.escrowId)), recipient);
    const lie = escrowMismatches(stored, { ...acc.invite, amount: '30000000' }, await poseidon2WithSeparator([Fr.fromString(acc.invite.claimSecret)], DOM_SEP__CLAIM_SECRET));
    check('agreement: an invitation that overstates the amount is caught by the stored note', lie.length === 1 && lie[0] === 'amount', lie.join(', '));
    const before = await balB();
    await sendAndWait('agreement: the recipient claims with the secret from the invitation',
      acc.contract.methods.claim(Fr.fromString(acc.invite.escrowId), Fr.fromString(acc.invite.claimSecret)),
      { from: recipient, additionalScopes: [AztecAddress.fromStringUnsafe(acc.invite.instanceAddress)] });
    check('agreement: the recipient received 3', (await balB()) - before === 3_000_000n);
  }

  await wa.stop();
  await wb.stop();
}

let failed = false;
try {
  await main();
} catch (e) {
  failed = true;
  console.error('ERROR', e instanceof Error ? e.stack : e);
  receipt.checks.push({ check: 'run completed', ok: false, detail: e instanceof Error ? e.message.slice(0, 300) : String(e) });
}
const ok = !failed && receipt.checks.every((c) => c.ok);
fs.writeFileSync('e2e-escrow-receipt.json', JSON.stringify({ ...receipt, ok }, null, 2) + '\n');
const summary = process.env.GITHUB_STEP_SUMMARY;
if (summary) {
  const lines = [
    '### Keyed PrivateEscrow on Aztec testnet',
    '',
    '| Step | Transaction | Block |',
    '| --- | --- | --- |',
    ...receipt.steps.map((s) => `| ${s.step} | ${s.txHash ? `\`${s.txHash}\`` : s.detail ?? ''} | ${s.block ?? ''} |`),
    '',
    ...receipt.checks.map((c) => `- ${c.ok ? 'PASS' : 'FAIL'} ${c.check}${c.detail ? ` (${c.detail})` : ''}`),
  ];
  fs.appendFileSync(summary, lines.join('\n') + '\n');
}
console.log('RECEIPT ' + JSON.stringify(receipt.steps));
console.log(ok ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');
process.exit(ok ? 0 : 1);
