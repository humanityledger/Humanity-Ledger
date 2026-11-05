/**
 * lib/aztec/chat-agreements.ts
 *
 * Agreements from inside a Ledger Chat conversation, in the browser, with
 * the private wallet the person already opened (lib/aztec/wallet/client.ts):
 * the same PXE, account and fee payment, nothing on our server.
 *
 *   open    the sender deploys a keyed instance and funds it
 *           (lib/aztec/agreements.ts); the invitation is posted in the DM
 *   accept  the receiver verifies the invitation against the shared secret,
 *           the deployment record, the accepted tokens and the peer's pinned
 *           Aztec address, registers the contract, then confirms every field
 *           against the contract's stored note
 *   status  escrow_view / stream_view, read in this PXE (never proven)
 *   act     claim, refund, withdraw, cancel
 *
 * The SDK, the artifacts (a few MB) and the agreement code load only when an
 * agreement is first used. Invitations hold secrets: nothing here logs them,
 * stores them outside the conversation, or sends them anywhere but the DM.
 */
import type { AgreementInvite, EscrowInvite, StreamInvite } from './agreement-invite';
import type { EscrowView, StreamView } from './agreements';
import { getPrivateWallet } from './wallet/client';
import { parseUnits } from './wallet/amounts';
import { AZTEC_WALLET_CONFIG } from './wallet/config';

type Kind = 'escrow' | 'streams';

let libs: Promise<{
  agreements: typeof import('./agreements');
  invite: typeof import('./agreement-invite');
  keyed: typeof import('./keyed-deploy');
  fees: typeof import('./fees');
  fields: typeof import('@aztec-labs/aztec.js/fields');
  addresses: typeof import('@aztec-labs/aztec.js/addresses');
  contracts: typeof import('@aztec-labs/aztec.js/contracts');
  artifacts: Record<Kind, any>;
  record: any;
}> | null = null;

function load() {
  libs ??= (async () => {
    const [agreements, invite, keyed, fees, fields, addresses, contracts, escrowJson, streamJson, record] = await Promise.all([
      import('./agreements'),
      import('./agreement-invite'),
      import('./keyed-deploy'),
      import('./fees'),
      import('@aztec-labs/aztec.js/fields'),
      import('@aztec-labs/aztec.js/addresses'),
      import('@aztec-labs/aztec.js/contracts'),
      import('../../contracts/aztec/escrow/target/private_escrow-PrivateEscrow.json'),
      import('../../contracts/aztec/streams/target/payment_stream-PaymentStream.json'),
      import('../../deployments/aztec-testnet.json'),
    ]);
    const artifacts = {
      escrow: keyed.loadKeyedArtifact((escrowJson as any).default ?? escrowJson),
      streams: keyed.loadKeyedArtifact((streamJson as any).default ?? streamJson),
    };
    return { agreements, invite, keyed, fees, fields, addresses, contracts, artifacts, record: (record as any).default ?? record };
  })();
  libs.catch(() => {
    libs = null;
  });
  return libs;
}

/** The network the open wallet's node is on, for the agreement policy. */
async function policyFor(ctx: ReturnType<ReturnType<typeof getPrivateWallet>['agreementContext']>) {
  const L = await load();
  const info = await ctx.node.getNodeInfo();
  const network = L.fees.feeNetworkFromL1ChainId(Number(info.l1ChainId));
  if (!network) throw new Error('Unknown Aztec network.');
  // Mainnet would also need the mainnet record and caps; the wallet refuses mainnet today.
  return { network };
}

export interface OpenRequest {
  kind: 'escrow' | 'stream';
  /** The peer's pinned Aztec address (lib/aztec/peer-binding.ts). */
  peerAztecAddress: string;
  tokenAddress: string;
  /** Amount in whole tokens, as typed ("12.5"). */
  amount: string;
  /** Escrow: how long the recipient has to claim. Stream: how long until fully paid. Seconds. */
  durationSeconds: number;
  onStep?: (step: string) => void;
}

/** A stream starts slightly in the past so that the next block's timestamp is past its start. */
const STREAM_START_SLACK = 120;

/** Opens an agreement and returns the invitation to post in the conversation. */
export async function openChatAgreement(r: OpenRequest): Promise<{ raw: string; invite: AgreementInvite }> {
  const wallet = getPrivateWallet();
  const ctx = wallet.agreementContext();
  const L = await load();
  const token = ctx.tokenAt(r.tokenAddress);
  if (!token) throw new Error('That token is not available in your private wallet.');
  const units = parseUnits(r.amount, token.config.decimals);
  if (units <= 0n) throw new Error('Enter an amount above zero.');
  if (!(r.durationSeconds >= 60 && r.durationSeconds <= 365 * 24 * 3600)) throw new Error('Choose a duration between one minute and one year.');
  const recipient = L.addresses.AztecAddress.fromStringUnsafe(r.peerAztecAddress);
  if (recipient.equals(ctx.me)) throw new Error('That is your own Aztec address.');

  const kind: Kind = r.kind === 'escrow' ? 'escrow' : 'streams';
  const artifact = L.artifacts[kind];
  r.onStep?.('Checking the contract on the network');
  // Only the class ID is used: any fixed key and salt give the same class.
  const probe = await L.keyed.computeKeyedInstance(artifact, {
    secretKey: new L.fields.Fr(1n),
    salt: new L.fields.Fr(1n),
    token: L.addresses.AztecAddress.fromStringUnsafe(r.tokenAddress),
  });
  const classPublished = !!(await ctx.node.getContractClass(probe.instance.currentContractClassId));
  const common = {
    sender: { wallet: ctx.wallet, address: ctx.me },
    recipient,
    token: L.addresses.AztecAddress.fromStringUnsafe(r.tokenAddress),
    tokenSymbol: token.config.symbol,
    tokenContract: token.contract,
    artifact,
    send: { fee: ctx.fee },
    classPublished,
    policy: await policyFor(ctx),
  };
  r.onStep?.('Creating the agreement contract and proving on this device. This can take a few minutes.');
  const now = Math.floor(Date.now() / 1000);
  const opened =
    r.kind === 'escrow'
      ? await L.agreements.openEscrow({ ...common, amount: units, deadline: now + r.durationSeconds })
      : await L.agreements.openStream({
          ...common,
          total: units,
          rate: units / BigInt(r.durationSeconds) > 0n ? units / BigInt(r.durationSeconds) : 1n,
          start: now - STREAM_START_SLACK,
        });
  await ctx.refresh().catch(() => {});
  return { raw: opened.raw, invite: opened.invite };
}

export type AcceptResult =
  | { ok: true; confirmed: true }
  | { ok: true; confirmed: false; mismatches: string[] }
  | { ok: false; reason: string };

/**
 * Verifies an invitation from the peer and, if it passes, registers the
 * contract and checks the deposit against the stored note. The PXE may need
 * a block or two to find a fresh deposit, so "not found" is retried.
 */
export async function acceptChatAgreement(raw: string, peerAztecAddress: string, onStep?: (s: string) => void): Promise<AcceptResult> {
  const ctx = getPrivateWallet().agreementContext();
  const L = await load();
  onStep?.('Checking the invitation');
  const acc = await L.agreements.acceptInvite({ wallet: ctx.wallet, address: ctx.me }, raw, {
    artifacts: L.artifacts,
    allowedClassIds: L.invite.currentClassIds(L.record),
    allowedTokens: AZTEC_WALLET_CONFIG.tokens.map((t) => t.address),
    peer: peerAztecAddress,
    policy: await policyFor(ctx),
  });
  if (!acc.ok) return acc;
  onStep?.('Reading the deposit from the contract');
  let mismatches: string[] = [];
  for (let i = 0; i < 6; i++) {
    mismatches = await L.agreements.confirmAgreement({ wallet: ctx.wallet, address: ctx.me }, acc);
    if (!mismatches.some((m) => m.includes('not found'))) break;
    await new Promise((res) => setTimeout(res, 15_000));
  }
  return mismatches.length ? { ok: true, confirmed: false, mismatches } : { ok: true, confirmed: true };
}

/** Registers the agreement's contract in this PXE (idempotent); needed after a new device or a cleared browser. */
async function ensureRegistered(inv: AgreementInvite) {
  const ctx = getPrivateWallet().agreementContext();
  const L = await load();
  const kind: Kind = inv.type === 'hl.escrow_invite' ? 'escrow' : 'streams';
  const secretKey = L.fields.Fr.fromString(inv.contractSecret);
  const { instance } = await L.keyed.computeKeyedInstance(L.artifacts[kind], {
    secretKey,
    salt: L.fields.Fr.fromString(inv.salt),
    token: L.addresses.AztecAddress.fromStringUnsafe(inv.token),
  });
  if (instance.address.toString().toLowerCase() !== inv.instanceAddress.toLowerCase()) {
    throw new Error('This agreement does not match its shared secret.');
  }
  await ctx.wallet.registerContract(instance, L.artifacts[kind], secretKey);
  const peer = ctx.me.toString().toLowerCase() === inv.sender.toLowerCase() ? inv.recipient : inv.sender;
  await ctx.wallet.registerSender?.(L.addresses.AztecAddress.fromStringUnsafe(peer), 'agreement peer');
  return { ctx, L, contract: L.contracts.Contract.at(instance.address, L.artifacts[kind], ctx.wallet) as any, address: instance.address };
}

const unwrap = <T>(r: any): T => (r && typeof r === 'object' && 'result' in r && !('found' in r) ? r.result : r) as T;
const big = (x: any): bigint => (typeof x === 'bigint' ? x : typeof x === 'number' || typeof x === 'boolean' ? BigInt(x) : x?.toBigInt ? x.toBigInt() : BigInt(String(x)));

export type AgreementStatus =
  | { kind: 'escrow'; role: 'sender' | 'recipient'; found: boolean; settled: boolean; deadline: number; amount: bigint }
  | { kind: 'stream'; role: 'sender' | 'recipient'; found: boolean; live: boolean; available: bigint; withdrawn: bigint; total: bigint };

/** What the contract holds for this agreement, as this wallet sees it. */
export async function agreementStatus(inv: AgreementInvite): Promise<AgreementStatus> {
  const { ctx, L, contract } = await ensureRegistered(inv);
  const role = ctx.me.toString().toLowerCase() === inv.sender.toLowerCase() ? 'sender' : 'recipient';
  if (inv.type === 'hl.escrow_invite') {
    const v = unwrap<EscrowView>(await contract.methods.escrow_view(ctx.me, L.fields.Fr.fromString(inv.escrowId)).simulate({ from: ctx.me }));
    return { kind: 'escrow', role, found: !!v.found, settled: !!v.settled, deadline: inv.deadline, amount: BigInt(inv.amount) };
  }
  const v = unwrap<StreamView>(await contract.methods.stream_view(ctx.me, L.fields.Fr.fromString(inv.streamSalt)).simulate({ from: ctx.me }));
  return {
    kind: 'stream',
    role,
    found: !!v.found,
    live: !!v.live,
    available: big(v.available),
    withdrawn: v.found ? big(v.note.withdrawn) : 0n,
    total: BigInt(inv.total),
  };
}

export type AgreementAction = 'claim' | 'refund' | 'withdraw' | 'cancel';

/** Sends one settlement transaction and waits for it. `amount` (base units) is for withdraw only. */
export async function actOnAgreement(inv: AgreementInvite, action: AgreementAction, amount?: bigint): Promise<string | undefined> {
  const { ctx, L, contract, address } = await ensureRegistered(inv);
  let call: any;
  if (inv.type === 'hl.escrow_invite') {
    const id = L.fields.Fr.fromString(inv.escrowId);
    if (action === 'claim') call = contract.methods.claim(id, L.fields.Fr.fromString(inv.claimSecret));
    else if (action === 'refund') call = contract.methods.refund(id);
  } else {
    const salt = L.fields.Fr.fromString(inv.streamSalt);
    if (action === 'withdraw') {
      if (!amount || amount <= 0n) throw new Error('Nothing to withdraw yet.');
      call = contract.methods.withdraw(salt, amount);
    } else if (action === 'cancel') call = contract.methods.cancel(salt);
  }
  if (!call) throw new Error('That action does not apply to this agreement.');
  const sent: any = await call.send({ from: ctx.me, fee: ctx.fee, additionalScopes: [address], wait: { timeout: 600 } });
  await ctx.refresh().catch(() => {});
  return sent?.receipt?.txHash?.toString?.() ?? sent?.txHash?.toString?.();
}
