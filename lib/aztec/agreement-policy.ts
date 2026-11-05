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
  contracts: Array<{ classId: string; tracksCurrentArtifact?: boolean }>;
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
}

export type PolicyResult = { ok: true } | { ok: false; reasons: string[] };

export function checkAgreementPolicy(p: PolicyInput): PolicyResult {
  if (p.network === 'testnet' || p.network === 'local') return { ok: true };
  const reasons: string[] = [];
  const rec = p.mainnetRecord;
  if (!rec) {
    reasons.push('no mainnet deployment record');
  } else {
    const current = rec.contracts.filter((c) => c.tracksCurrentArtifact).map((c) => c.classId.toLowerCase());
    if (!current.includes(p.classId.toLowerCase())) reasons.push('contract class is not a recorded mainnet deployment');
    if (!rec.audit && !p.acknowledgedUnaudited) reasons.push('contracts are unaudited and the user has not acknowledged it');
  }
  const cap = p.caps?.[p.token.toLowerCase()];
  if (cap === undefined) reasons.push('no amount cap configured for this token on mainnet');
  else if (p.amount > cap) reasons.push(`amount exceeds the mainnet cap of ${cap} base units`);
  if (p.amount <= 0n) reasons.push('amount must be positive');
  return reasons.length ? { ok: false, reasons } : { ok: true };
}
