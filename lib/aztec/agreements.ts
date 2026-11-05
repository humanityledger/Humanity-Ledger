/**
 * lib/aztec/agreements.ts
 *
 * Opening and accepting a private agreement (escrow or payment stream)
 * between the two parties of a Ledger Chat conversation, one keyed contract
 * instance per agreement:
 *
 *   sender                                   recipient
 *   ──────                                   ─────────
 *   openEscrow / openStream
 *     fresh secret and salt
 *     keyed universal deployment
 *     register the instance with the secret
 *     deposit / create_stream (authwit)
 *     → invitation (JSON), sent over XMTP ──► acceptInvite
 *                                              verifyAgreementInvite
 *                                              (address and class recomputed
 *                                              from the secret, current class,
 *                                              accepted token, addressee, peer)
 *                                              register the instance with the
 *                                              secret
 *
 * The same functions drive the testnet run in scripts/aztec/e2e-escrow-testnet.mts,
 * so the code the app uses is the code that is exercised on the network.
 *
 * Wallet and interaction objects are typed loosely on purpose: they come from
 * @aztec-labs/aztec.js and @aztec-labs/wallets 6.0.0, whose shapes this module
 * only touches through registerContract, createAuthWit and send.
 */
import { Fr } from '@aztec-labs/aztec.js/fields';
import { AztecAddress } from '@aztec-labs/aztec.js/addresses';
import { Contract, DeployMethod } from '@aztec-labs/aztec.js/contracts';
import { randomField } from './random';
import { checkAgreementPolicy, type PolicyInput } from './agreement-policy';
import { computeKeyedInstance, type KeyedContract, type loadKeyedArtifact } from './keyed-deploy';
import {
  verifyAgreementInvite,
  type EscrowInvite,
  type StreamInvite,
  type VerifyOptions,
  type AgreementInvite,
} from './agreement-invite';

type Artifact = ReturnType<typeof loadKeyedArtifact>;
type AnyWallet = any;
type AnyInteraction = any;
type SendOptions = Record<string, unknown>;

/** Separator of the escrow claim secret hash (contracts/aztec/escrow/src/main.nr). */
export const DOM_SEP__CLAIM_SECRET = 718293041;

export interface Party {
  wallet: AnyWallet;
  /** The party's Aztec account address. */
  address: AztecAddress;
}

export interface OpenCommon {
  sender: Party;
  recipient: AztecAddress;
  token: AztecAddress;
  tokenSymbol: string;
  /** The token contract bound to the sender's wallet (TokenContract.at(token, wallet)). */
  tokenContract: AnyInteraction;
  artifact: Artifact;
  /** Options merged into every send: at least the fee payment method. */
  send: SendOptions;
  /** True when the node already has the contract class, so deployment skips publishing it. */
  classPublished: boolean;
  /** Network policy (lib/aztec/agreement-policy.ts); required in practice on mainnet. */
  policy?: AgreementPolicy;
}

/** The parts of a policy check that do not depend on the agreement itself. */
export type AgreementPolicy = Omit<PolicyInput, 'classId' | 'token' | 'amount'>;

function enforcePolicy(policy: AgreementPolicy | undefined, classId: string, token: string, amount: bigint) {
  if (!policy) return;
  const r = checkAgreementPolicy({ ...policy, classId, token, amount });
  if (!r.ok) throw new Error(`agreement refused by policy: ${r.reasons.join('; ')}`);
}

export interface Opened<I extends AgreementInvite> {
  invite: I;
  /** The invitation as sent over XMTP. Contains secrets: never log it. */
  raw: string;
  contract: AnyInteraction;
  txHashes: { deploy?: string; fund?: string };
  /** Blocks the deploy and funding transactions landed in, when the receipt reports them. */
  blocks: { deploy?: number; fund?: number };
}

// The export path of poseidon2HashWithSeparator differs between foundation
// builds; the specifier is a variable so that type checking does not depend on
// it. Node resolves it; a browser bundle should import it statically instead.
async function poseidon2WithSeparator(inputs: Fr[], sep: number): Promise<Fr> {
  for (const m of ['@aztec-labs/foundation/crypto/poseidon', '@aztec-labs/foundation/crypto']) {
    try {
      const mod: any = await import(m);
      if (mod.poseidon2HashWithSeparator) return await mod.poseidon2HashWithSeparator(inputs, sep);
    } catch {
      /* next export path */
    }
  }
  throw new Error('poseidon2HashWithSeparator not found in @aztec-labs/foundation');
}

export const claimSecretHash = (claimSecret: Fr) => poseidon2WithSeparator([claimSecret], DOM_SEP__CLAIM_SECRET);

const blockOf = (sent: any): number | undefined => {
  const b = sent?.receipt?.blockNumber ?? sent?.blockNumber;
  return b === undefined || b === null ? undefined : Number(b);
};

/** Keyed universal deployment of a fresh instance, registered with its secret in the sender's wallet. */
async function deployKeyed(c: OpenCommon, amount: bigint) {
  const secretKey = randomField();
  const salt = randomField();
  const expected = await computeKeyedInstance(c.artifact, { secretKey, salt, token: c.token });
  // Before anything is sent: on mainnet the policy can refuse the class, the token or the amount.
  enforcePolicy(c.policy, expected.instance.currentContractClassId.toString(), c.token.toString(), amount);
  const deployment = DeployMethod.create(
    c.sender.wallet,
    { artifact: c.artifact, args: [c.token], postDeployCtor: (instance: any, w: any) => Contract.at(instance.address, c.artifact, w) },
    { salt, publicKeys: expected.publicKeys, universalDeploy: true },
  );
  const res: any = await deployment.send({ from: c.sender.address, skipClassPublication: c.classPublished, wait: { timeout: 900 }, ...c.send } as any);
  const address = AztecAddress.fromStringUnsafe((res.instance?.address ?? res.contract?.address).toString());
  if (!address.equals(expected.instance.address)) throw new Error('deployed address differs from the keyed instance computed locally');
  await c.sender.wallet.registerContract(expected.instance, c.artifact, secretKey);
  return { secretKey, salt, expected, address, deployTx: res.receipt?.txHash?.toString() as string | undefined, deployBlock: blockOf(res) };
}

async function authwit(c: OpenCommon, caller: AztecAddress, amount: bigint) {
  const nonce = randomField();
  const pull = c.tokenContract.methods.transfer_in_private(c.sender.address, caller, amount, nonce);
  let witness: any;
  try {
    witness = await c.sender.wallet.createAuthWit(c.sender.address, { caller, call: await pull.getFunctionCall() });
  } catch {
    witness = await c.sender.wallet.createAuthWit(c.sender.address, { caller, action: pull });
  }
  return { nonce, witness };
}

/** Opens an escrow: its own keyed PrivateEscrow instance, funded with `amount`. */
export async function openEscrow(c: OpenCommon & { amount: bigint; deadline: number }): Promise<Opened<EscrowInvite>> {
  const d = await deployKeyed(c, c.amount);
  const contract = Contract.at(d.address, c.artifact, c.sender.wallet) as AnyInteraction;
  const claimSecret = randomField();
  const escrowId = randomField();
  const w = await authwit(c, d.address, c.amount);
  const sent = await contract.methods
    .deposit(c.recipient, c.amount, BigInt(c.deadline), await claimSecretHash(claimSecret), escrowId, w.nonce)
    .send({ from: c.sender.address, authWitnesses: [w.witness], wait: { timeout: 900 }, ...c.send });
  const invite: EscrowInvite = {
    type: 'hl.escrow_invite',
    version: 1,
    instanceAddress: d.address.toString(),
    classId: d.expected.instance.currentContractClassId.toString(),
    salt: d.salt.toString(),
    contractSecret: d.secretKey.toString(),
    token: c.token.toString(),
    tokenSymbol: c.tokenSymbol,
    sender: c.sender.address.toString(),
    recipient: c.recipient.toString(),
    escrowId: escrowId.toString(),
    claimSecret: claimSecret.toString(),
    amount: c.amount.toString(),
    deadline: c.deadline,
  };
  return { invite, raw: JSON.stringify(invite), contract, txHashes: { deploy: d.deployTx, fund: sent?.receipt?.txHash?.toString() ?? sent?.txHash?.toString() }, blocks: { deploy: d.deployBlock, fund: blockOf(sent) } };
}

/** Opens a payment stream: its own keyed PaymentStream instance, funded with `total`. */
export async function openStream(
  c: OpenCommon & { total: bigint; rate: bigint; start: number },
): Promise<Opened<StreamInvite>> {
  const d = await deployKeyed(c, c.total);
  const contract = Contract.at(d.address, c.artifact, c.sender.wallet) as AnyInteraction;
  const streamSalt = randomField();
  const w = await authwit(c, d.address, c.total);
  const sent = await contract.methods
    .create_stream(c.recipient, c.total, c.rate, BigInt(c.start), streamSalt, w.nonce)
    .send({ from: c.sender.address, authWitnesses: [w.witness], wait: { timeout: 900 }, ...c.send });
  const invite: StreamInvite = {
    type: 'hl.stream_invite',
    version: 1,
    instanceAddress: d.address.toString(),
    classId: d.expected.instance.currentContractClassId.toString(),
    salt: d.salt.toString(),
    contractSecret: d.secretKey.toString(),
    token: c.token.toString(),
    tokenSymbol: c.tokenSymbol,
    sender: c.sender.address.toString(),
    recipient: c.recipient.toString(),
    streamSalt: streamSalt.toString(),
    total: c.total.toString(),
    rate: c.rate.toString(),
    start: c.start,
  };
  return { invite, raw: JSON.stringify(invite), contract, txHashes: { deploy: d.deployTx, fund: sent?.receipt?.txHash?.toString() ?? sent?.txHash?.toString() }, blocks: { deploy: d.deployBlock, fund: blockOf(sent) } };
}

export type Accepted =
  | { ok: true; invite: AgreementInvite; kind: KeyedContract; contract: AnyInteraction }
  | { ok: false; reason: string };

/**
 * Verifies a received invitation and, only if it passes, registers the
 * instance with its secret in the recipient's wallet. The recipient's token
 * notes and the contract's notes then become visible to the recipient's PXE.
 */
export async function acceptInvite(
  recipient: Party,
  raw: string,
  opts: Omit<VerifyOptions, 'me'> & { policy?: AgreementPolicy },
): Promise<Accepted> {
  const v = await verifyAgreementInvite(raw, { ...opts, me: recipient.address.toString() });
  if (!v.ok) return v;
  const inv = v.invite;
  if (opts.policy) {
    const r = checkAgreementPolicy({
      ...opts.policy,
      classId: inv.classId,
      token: inv.token,
      amount: BigInt(inv.type === 'hl.escrow_invite' ? inv.amount : inv.total),
    });
    if (!r.ok) return { ok: false, reason: `refused by policy: ${r.reasons.join('; ')}` };
  }
  const kind: KeyedContract = inv.type === 'hl.escrow_invite' ? 'escrow' : 'streams';
  const artifact = opts.artifacts[kind];
  const { instance } = await computeKeyedInstance(artifact, {
    secretKey: Fr.fromString(inv.contractSecret),
    salt: Fr.fromString(inv.salt),
    token: AztecAddress.fromStringUnsafe(inv.token),
  });
  await recipient.wallet.registerContract(instance, artifact, Fr.fromString(inv.contractSecret));
  await recipient.wallet.registerSender?.(AztecAddress.fromStringUnsafe(inv.sender), 'agreement peer');
  return { ok: true, invite: inv, kind, contract: Contract.at(instance.address, artifact, recipient.wallet) };
}

// ─── Confirming an agreement against the contract's own notes ─────────────────
//
// verifyAgreementInvite proves that the invitation names a genuine instance
// of the audited class. It cannot prove that the deposit behind it matches
// the invitation's amount, deadline or claim secret: those fields are the
// sender's word. escrow_view and stream_view (utility functions, run in the
// receiver's PXE) return what the contract actually stored, and the
// functions below compare it with the invitation. A client shows an
// agreement as confirmed only when the list of mismatches is empty.

type Decoded = unknown;

const big = (x: Decoded): bigint => {
  if (typeof x === 'bigint') return x;
  if (typeof x === 'number' || typeof x === 'boolean') return BigInt(x);
  if (typeof x === 'string') return BigInt(x);
  const o = x as { toBigInt?: () => bigint; toString?: () => string } | null;
  if (o?.toBigInt) return o.toBigInt();
  if (o && typeof (o as any).inner !== 'undefined') return big((o as any).inner);
  if (o?.toString) return BigInt(o.toString());
  throw new Error('unexpected value in view result');
};
const sameValue = (a: Decoded, b: Decoded) => big(a) === big(b);

export interface EscrowView {
  found: boolean;
  settled: boolean;
  note: { escrow_id: Decoded; sender: Decoded; recipient: Decoded; amount: Decoded; deadline: Decoded; claim_secret_hash: Decoded };
}

export interface StreamView {
  found: boolean;
  live: boolean;
  available: Decoded;
  note: { sender: Decoded; recipient: Decoded; total: Decoded; rate: Decoded; start: Decoded; withdrawn: Decoded; salt: Decoded; index: Decoded };
}

/** Fields of the invitation that the stored escrow note contradicts; empty when they agree. */
export function escrowMismatches(view: EscrowView, invite: EscrowInvite, claimSecretHashValue: Decoded): string[] {
  if (!view.found) return ['escrow not found in your notes'];
  const out: string[] = [];
  const n = view.note;
  if (!sameValue(n.escrow_id, invite.escrowId)) out.push('escrowId');
  if (!sameValue(n.sender, invite.sender)) out.push('sender');
  if (!sameValue(n.recipient, invite.recipient)) out.push('recipient');
  if (!sameValue(n.amount, invite.amount)) out.push('amount');
  if (!sameValue(n.deadline, invite.deadline)) out.push('deadline');
  if (!sameValue(n.claim_secret_hash, claimSecretHashValue)) out.push('claimSecret');
  if (view.settled) out.push('already settled');
  return out;
}

/** Fields of the invitation that the stored stream state contradicts; empty when they agree. */
export function streamMismatches(view: StreamView, invite: StreamInvite): string[] {
  if (!view.found) return ['stream not found in your notes'];
  const out: string[] = [];
  const n = view.note;
  if (!sameValue(n.salt, invite.streamSalt)) out.push('streamSalt');
  if (!sameValue(n.sender, invite.sender)) out.push('sender');
  if (!sameValue(n.recipient, invite.recipient)) out.push('recipient');
  if (!sameValue(n.total, invite.total)) out.push('total');
  if (!sameValue(n.rate, invite.rate)) out.push('rate');
  if (!sameValue(n.start, invite.start)) out.push('start');
  if (!view.live) out.push('stream no longer live');
  return out;
}

/**
 * Reads the accepted agreement from the contract (utility call, local to the
 * receiver's PXE) and returns the fields that contradict the invitation.
 * Call it after acceptInvite; the PXE may need a block or two to discover
 * the notes, so "not found" right after a deposit can be transient.
 */
// simulate() returns the value, or { result, ... } when metadata is requested.
const unwrap = <T>(r: any): T => (r && typeof r === 'object' && 'result' in r && !('found' in r) ? r.result : r) as T;

export async function confirmAgreement(me: Party, accepted: Extract<Accepted, { ok: true }>): Promise<string[]> {
  const inv = accepted.invite;
  if (inv.type === 'hl.escrow_invite') {
    const view = unwrap<EscrowView>(
      await accepted.contract.methods.escrow_view(me.address, Fr.fromString(inv.escrowId)).simulate({ from: me.address }),
    );
    return escrowMismatches(view, inv, await claimSecretHash(Fr.fromString(inv.claimSecret)));
  }
  const view = unwrap<StreamView>(
    await accepted.contract.methods.stream_view(me.address, Fr.fromString(inv.streamSalt)).simulate({ from: me.address }),
  );
  return streamMismatches(view, inv);
}
