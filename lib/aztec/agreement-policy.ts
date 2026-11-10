/**
 * lib/aztec/agreement-policy.ts
 *
 * Whether the client may open or accept an agreement of a given size on a
 * given network. On the test network everything is allowed: the tokens have
 * no value. On Aztec Alpha (mainnet) tokens are real, Aztec itself says to
 * deposit only what one can afford to lose, and our contracts have no
 * external audit. So on Alpha:
 *
 *   - the contract class must be a current entry of deployments/aztec-mainnet.json
 *     (an instance we deployed and recorded with its transaction and block);
 *   - without an audit recorded there, the user must have acknowledged that
 *     the contracts are unaudited;
 *   - the amount must not exceed the operator's per-token cap, in base units;
 *     a token without a cap is refused.
 *
 * This is client policy, not a contract rule: it keeps the app from leading
 * users into amounts the code has not earned, and it is shown to the user as
 * the list of reasons, never silently.
 */
import type { FeeNetwork } from './fees';

export interface MainnetRecord {
  audit: null | { report: string; date: string };
  contracts: Array<{ classId: string; tracksCurrentArtifact?: boolean; status?: string }>;
}

export interface PolicyInput {
  network: FeeNetwork;
  classId: string;
  token: string;
  /** Amount in the token's base units (escrow amount or stream total). */
  amount: bigint;
  /** deployments/aztec-mainnet.json, required on mainnet. */
  mainnetRecord?: MainnetRecord;
  /** Per-token caps in base units, keyed by lowercase token address. */
  caps?: Readonly<Record<string, bigint>>;
  /** The user confirmed they understand the contracts are unaudited. */
  acknowledgedUnaudited?: boolean;
  /** The user confirmed that the fee payer is public, so their transactions are linkable (G2). */
  acknowledgedPublicFeePayer?: boolean;
  /** The counterparty's address carries a verified G7 binding (peer-binding.ts peerBindingStatus). */
  peerVerified?: boolean;
}

export type PolicyResult = { ok: true } | { ok: false; reasons: string[] };

const HEX32 = /^0x[0-9a-f]{64}$/;

/**
 * G5 at runtime: the part of deployments/aztec-mainnet.json that may authorise
 * anything. The record is refused whole if it does not name the pinned Alpha
 * network; an entry counts only with a deployment transaction and block, a
 * current class, not do-not-use, and keys when it holds tokens. An audit counts
 * only with a report and a date. The offline checks live in
 * test/unit/aztec/deployments-registry.test.ts; this is the same rule, fail-closed, in the client.
 */
export function authorizedMainnetRecord(
  raw: unknown,
  pinned: { l1ChainId: number; rollupVersion: number },
): (MainnetRecord & { contracts: Array<MainnetRecord['contracts'][number] & { name: string }> }) | undefined {
  const r = raw as any;
  if (!r || typeof r !== 'object' || !Array.isArray(r.contracts)) return undefined;
  if (r.network?.l1ChainId !== pinned.l1ChainId || r.network?.rollupVersion !== pinned.rollupVersion) return undefined;
  const audit =
    r.audit && typeof r.audit.report === 'string' && r.audit.report.trim() && typeof r.audit.date === 'string' && r.audit.date.trim()
      ? { report: r.audit.report, date: r.audit.date }
      : null;
  const contracts = r.contracts
    .filter(
      (c: any) =>
        c &&
        typeof c.name === 'string' &&
        HEX32.test(String(c.address)) &&
        HEX32.test(String(c.classId)) &&
        HEX32.test(String(c.deployTx)) &&
        Number.isInteger(c.deployBlock) &&
        c.deployBlock > 0 &&
        c.tracksCurrentArtifact === true &&
        c.status !== 'do-not-use' &&
        (!c.holdsPrivateBalance || c.keyed === true),
    )
    .map((c: any) => ({ name: c.name, classId: c.classId, tracksCurrentArtifact: true, status: c.status }));
  return { audit, contracts };
}

export interface ContextInput {
  /** Network of the node, from its L1 chain ID (undefined when unknown). */
  nodeNetwork: FeeNetwork | undefined;
  /** Network this build was configured for (AZTEC_WALLET_CONFIG.network). */
  buildNetwork: 'testnet' | 'mainnet';
  alphaEnabled: boolean;
  /** Address pinned for the DM peer in the binding store. */
  pinnedAddress?: string;
  /** Address the caller wants to transact with. */
  claimedAddress: string;
}

const CANONICAL_ADDRESS = /^0x[0-9a-f]{64}$/;

/** Canonical form of a 32-byte Aztec address; undefined when malformed (lowercase hex equality = field equality). */
export const canonicalAztecAddress = (a: string | undefined): string | undefined => {
  const v = a?.toLowerCase();
  return v && CANONICAL_ADDRESS.test(v) ? v : undefined;
};

/** Pre-conditions for opening or accepting an agreement, independent of its size. Fail-closed. */
export function checkAgreementContext(c: ContextInput): PolicyResult {
  const reasons: string[] = [];
  if (!c.nodeNetwork) reasons.push('unknown Aztec network');
  else if ((c.nodeNetwork === 'mainnet') !== (c.buildNetwork === 'mainnet')) reasons.push('the Aztec node is on a different network than this app');
  if ((c.nodeNetwork === 'mainnet' || c.buildNetwork === 'mainnet') && !c.alphaEnabled) reasons.push('Aztec Alpha is not enabled in this app');
  const pinned = canonicalAztecAddress(c.pinnedAddress);
  const claimed = canonicalAztecAddress(c.claimedAddress);
  if (!pinned || !claimed || pinned !== claimed) reasons.push('this is not the Aztec address saved for this person');
  return reasons.length ? { ok: false, reasons } : { ok: true };
}

export function checkAgreementPolicy(p: PolicyInput): PolicyResult {
  if (p.network === 'testnet' || p.network === 'local') return { ok: true };
  const reasons: string[] = [];
  const rec = p.mainnetRecord;
  if (!rec) {
    reasons.push('no mainnet deployment record');
  } else {
    // A do-not-use entry (e.g. a keyless instance) never authorises its class, even if flagged current.
    const current = rec.contracts.filter((c) => c.tracksCurrentArtifact && c.status !== 'do-not-use').map((c) => c.classId.toLowerCase());
    if (!current.includes(p.classId.toLowerCase())) reasons.push('contract class is not a recorded mainnet deployment');
    if (!rec.audit && !p.acknowledgedUnaudited) reasons.push('contracts are unaudited and the user has not acknowledged it');
  }
  if (!p.acknowledgedPublicFeePayer) reasons.push('the fee payer is public and the user has not acknowledged it');
  if (!p.peerVerified) reasons.push("the counterparty's Aztec address has no verified proof of control (G7)");
  const cap = p.caps?.[p.token.toLowerCase()];
  if (cap === undefined) reasons.push('no amount cap configured for this token on mainnet');
  else if (p.amount > cap) reasons.push(`amount exceeds the mainnet cap of ${cap} base units`);
  if (p.amount <= 0n) reasons.push('amount must be positive');
  return reasons.length ? { ok: false, reasons } : { ok: true };
}
