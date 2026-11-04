/**
 * scripts/aztec/e2e-escrow-testnet.mts
 *
 * End-to-end run of a keyed PrivateEscrow on Aztec testnet, with throwaway
 * accounts paid by the sponsored FPC and a fresh test token, so it needs no
 * secrets and anyone can reproduce it:
 *
 *   1. deploy two accounts (sender, recipient) and a test Token;
 *   2. mint to the sender and shield into the sender's private balance;
 *   3. deploy a PrivateEscrow instance with public keys derived from a fresh
 *      secret (lib/aztec/keyed-deploy.ts), reusing the class already
 *      published on testnet; both parties register it with that secret;
 *   4. the sender deposits with an authwit for the token pull;
 *   5. the recipient claims with the claim secret;
 *   6. check the balances, and that a second claim is refused.
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

const registry = JSON.parse(fs.readFileSync('deployments/aztec-testnet.json', 'utf8'));
const NODE_URL = process.env.AZTEC_NODE_URL || registry.network.nodeUrl;
const RPC = { maxBatchSize: 3 };
const DOM_SEP__CLAIM_SECRET = 718293041; // contracts/aztec/escrow/src/main.nr
const AMOUNT = 25_000_000n;
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

async function main() {
  const info = await node.getNodeInfo();
  log('node', info.nodeVersion, 'L1', info.l1ChainId, 'rollup', info.rollupVersion);

  const wa = await newWallet();
  const wb = await newWallet();
  const sender = await newAccount(wa, 'sender');
  const recipient = await newAccount(wb, 'recipient');

  // A fresh test token, administered by the throwaway sender.
  const tokenDeploy = await TokenContract.deploy(wa, sender, 'HL e2e test token', 'HLT', 6).send({ from: sender, fee, wait: { timeout: 900 } });
  const tokenAddr: AztecAddress = (tokenDeploy as any).instance?.address ?? (tokenDeploy as any).contract?.address;
  receipt.steps.push({ step: 'deploy test token', detail: tokenAddr.toString() });
  log('token', tokenAddr.toString());
  const tokenInstance = await node.getContract(tokenAddr);
  await wb.registerContract(tokenInstance!, TokenContract.artifact);
  const tokA = TokenContract.at(tokenAddr, wa);
  const tokB = TokenContract.at(tokenAddr, wb);

  await sendAndWait('mint to sender (public)', tokA.methods.mint_to_public(sender, 100_000_000n), { from: sender });
  await sendAndWait('shield into sender private balance', tokA.methods.transfer_to_private(sender, 60_000_000n), { from: sender });
  check('sender private balance is 60', unwrap(await tokA.methods.balance_of_private(sender).simulate({ from: sender })) === 60_000_000n);

  // Keyed escrow instance: fresh secret and salt, universal deployment.
  const artifact = loadKeyedArtifact(JSON.parse(fs.readFileSync(KEYED_ARTIFACT_PATHS.escrow, 'utf8')));
  const secretKey = Fr.random();
  const salt = Fr.random();
  const expected = await computeKeyedInstance(artifact, { secretKey, salt, token: tokenAddr });
  // aztec.js 6.0.0: keys, salt and universal deployment are instantiation
  // options of DeployMethod.create; the class is already published on testnet.
  const deployment = DeployMethod.create(
    wa,
    { artifact, args: [tokenAddr], postDeployCtor: (instance: any, w: any) => Contract.at(instance.address, artifact, w) },
    { salt, publicKeys: expected.publicKeys, universalDeploy: true },
  );
  const escrowDeployed: any = await deployment.send({ from: sender, fee, skipClassPublication: true, wait: { timeout: 900 } } as any);
  if (escrowDeployed.receipt?.txHash) receipt.steps.push({ step: 'deploy keyed PrivateEscrow (tx)', txHash: escrowDeployed.receipt.txHash.toString(), block: Number(escrowDeployed.receipt.blockNumber) });
  const escrowAddr = AztecAddress.fromStringUnsafe((escrowDeployed.instance?.address ?? escrowDeployed.contract?.address).toString());
  check('escrow address is the keyed instance computed locally', escrowAddr.equals(expected.instance.address), escrowAddr.toString());
  receipt.steps.push({ step: 'deploy keyed PrivateEscrow', detail: escrowAddr.toString() });
  const onchain = await node.getContract(escrowAddr);
  check('escrow instance on the node carries its own public keys', !!onchain && onchain.publicKeys.equals(expected.publicKeys));

  // Both parties register the escrow with its secret, so their PXEs can find
  // and spend the escrow's token notes.
  await wa.registerContract(expected.instance, artifact, secretKey);
  await wb.registerContract(expected.instance, artifact, secretKey);
  await wb.registerSender(sender, 'sender');
  const escrowA: any = Contract.at(escrowAddr, artifact, wa);
  const escrowB: any = Contract.at(escrowAddr, artifact, wb);

  // Deposit: the sender authorises the escrow to pull AMOUNT.
  const claimSecret = Fr.random();
  const claimSecretHash = await poseidon2WithSeparator([claimSecret], DOM_SEP__CLAIM_SECRET);
  const escrowId = Fr.random();
  const nonce = Fr.random();
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 2 * 3600);
  const pull = tokA.methods.transfer_in_private(sender, escrowAddr, AMOUNT, nonce);
  let witness: any;
  try {
    witness = await (wa as any).createAuthWit(sender, { caller: escrowAddr, call: await pull.getFunctionCall() });
  } catch (e) {
    log('createAuthWit with { caller, call } failed, trying { caller, action }:', (e as Error).message);
    witness = await (wa as any).createAuthWit(sender, { caller: escrowAddr, action: pull });
  }
  await sendAndWait(
    'deposit into escrow',
    escrowA.methods.deposit(recipient, AMOUNT, deadline, claimSecretHash, escrowId, nonce),
    { from: sender, authWitnesses: [witness] },
  );
  check('sender private balance is 35 after the deposit', unwrap(await tokA.methods.balance_of_private(sender).simulate({ from: sender })) === 35_000_000n);

  // Claim: the recipient reveals the claim secret before the deadline.
  await sendAndWait('claim by recipient', escrowB.methods.claim(escrowId, claimSecret), { from: recipient, additionalScopes: [escrowAddr] });
  const got = unwrap(await tokB.methods.balance_of_private(recipient).simulate({ from: recipient }));
  check('recipient private balance is 25 after the claim', got === AMOUNT, `saw ${got}`);

  // The claim note is consumed, so a second claim cannot even be built.
  let second = 'accepted';
  try {
    await escrowB.methods.claim(escrowId, claimSecret).simulate({ from: recipient, additionalScopes: [escrowAddr] });
  } catch (e) {
    second = (e as Error).message.slice(0, 160);
  }
  check('a second claim of the same escrow is refused', second !== 'accepted', second);

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
console.log(ok ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');
process.exit(ok ? 0 : 1);
