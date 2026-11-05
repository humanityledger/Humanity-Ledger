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
}

export interface Opened<I extends AgreementInvite> {
  invite: I;
  /** The invitation as sent over XMTP. Contains secrets: never log it. */
  raw: string;
  contract: AnyInteraction;
  txHashes: { deploy?: string; fund?: string };
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

/** Keyed universal deployment of a fresh instance, registered with its secret in the sender's wallet. */
async function deployKeyed(c: OpenCommon) {
  const secretKey = randomField();
  const salt = randomField();
  const expected = await computeKeyedInstance(c.artifact, { secretKey, salt, token: c.token });
  const deployment = DeployMethod.create(
    c.sender.wallet,
    { artifact: c.artifact, args: [c.token], postDeployCtor: (instance: any, w: any) => Contract.at(instance.address, c.artifact, w) },
    { salt, publicKeys: expected.publicKeys, universalDeploy: true },
  );
  const res: any = await deployment.send({ from: c.sender.address, skipClassPublication: c.classPublished, wait: { timeout: 900 }, ...c.send } as any);
  const address = AztecAddress.fromStringUnsafe((res.instance?.address ?? res.contract?.address).toString());
  if (!address.equals(expected.instance.address)) throw new Error('deployed address differs from the keyed instance computed locally');
  await c.sender.wallet.registerContract(expected.instance, c.artifact, secretKey);
  return { secretKey, salt, expected, address, deployTx: res.receipt?.txHash?.toString() as string | undefined };
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
  const d = await deployKeyed(c);
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
  return { invite, raw: JSON.stringify(invite), contract, txHashes: { deploy: d.deployTx, fund: sent?.receipt?.txHash?.toString() ?? sent?.txHash?.toString() } };
}

/** Opens a payment stream: its own keyed PaymentStream instance, funded with `total`. */
export async function openStream(
  c: OpenCommon & { total: bigint; rate: bigint; start: number },
): Promise<Opened<StreamInvite>> {
  const d = await deployKeyed(c);
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
  return { invite, raw: JSON.stringify(invite), contract, txHashes: { deploy: d.deployTx, fund: sent?.receipt?.txHash?.toString() ?? sent?.txHash?.toString() } };
}

export type Accepted =
  | { ok: true; invite: AgreementInvite; kind: KeyedContract; contract: AnyInteraction }
  | { ok: false; reason: string };

/**
 * Verifies a received invitation and, only if it passes, registers the
 * instance with its secret in the recipient's wallet. The recipient's token
 * notes and the contract's notes then become visible to the recipient's PXE.
 */
export async function acceptInvite(recipient: Party, raw: string, opts: Omit<VerifyOptions, 'me'>): Promise<Accepted> {
  const v = await verifyAgreementInvite(raw, { ...opts, me: recipient.address.toString() });
  if (!v.ok) return v;
  const inv = v.invite;
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
