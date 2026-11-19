/**
 * Closed alpha gate (master prompt Phase 2). On Aztec Alpha, with no external audit recorded,
 * an agreement may be OPENED only when every condition below holds. Exits (claim, refund,
 * withdraw, cancel) are never gated: a revoked tester keeps them.
 *
 *   1. deployments/aztec-mainnet.json has closedAlpha.enabled === true;
 *   2. now is before closedAlpha.until (OD-9: 8 weeks from the first deployment);
 *   3. the agreement's class is in closedAlpha.classes AND is a recorded mainnet deployment;
 *   4. the account is an active AlphaMember (an invitation redeemed, not revoked);
 *   5. the account acknowledged the risk (unaudited contracts, value at risk).
 *
 * It does not touch `audit`: an audit, if one is ever recorded, is a separate path.
 */
import { distributorProblem } from './rules.mjs';

export interface ClosedAlphaEntry {
  enabled: boolean;
  /** Who distributes HLC (lib/alpha/rules.mjs). null until counsel decides. */
  distributor?: unknown;
  until: string | null;
  scope?: 'value' | 'app';
  maxTesters?: number;
  classes: string[];
}

export interface ClosedAlphaInput {
  entry: ClosedAlphaEntry | null | undefined;
  now: Date;
  classId: string;
  /** Class ids recorded as mainnet deployments (deployments/aztec-mainnet.json contracts). */
  deployedClasses: string[];
  member: { active: boolean; riskAcknowledged: boolean } | null;
}

export type ClosedAlphaResult = { ok: true } | { ok: false; reasons: string[] };

export const CLOSED_ALPHA_REASONS = {
  off: 'The closed alpha is not open.',
  ended: 'The closed alpha has ended.',
  noEnd: 'The closed alpha has no end date.',
  class: 'This contract is not part of the closed alpha.',
  notDeployed: 'This contract has no recorded deployment on Aztec Alpha.',
  member: 'This account has no closed alpha invitation.',
  revoked: 'This account’s closed alpha access was revoked. Existing agreements can still be settled.',
  ack: 'Confirm that you understand the risks of the closed alpha first.',
} as const;

export function closedAlphaDecision(i: ClosedAlphaInput): ClosedAlphaResult {
  const reasons: string[] = [];
  const e = i.entry;
  if (!e || e.enabled !== true) return { ok: false, reasons: [CLOSED_ALPHA_REASONS.off] };
  const until = e.until ? Date.parse(e.until) : NaN;
  if (!Number.isFinite(until)) reasons.push(CLOSED_ALPHA_REASONS.noEnd);
  else if (i.now.getTime() >= until) reasons.push(CLOSED_ALPHA_REASONS.ended);
  const id = i.classId.toLowerCase();
  if (!(e.classes ?? []).some((c) => c.toLowerCase() === id)) reasons.push(CLOSED_ALPHA_REASONS.class);
  if (!i.deployedClasses.some((c) => c.toLowerCase() === id)) reasons.push(CLOSED_ALPHA_REASONS.notDeployed);
  if (!i.member) reasons.push(CLOSED_ALPHA_REASONS.member);
  else if (!i.member.active) reasons.push(CLOSED_ALPHA_REASONS.revoked);
  else if (!i.member.riskAcknowledged) reasons.push(CLOSED_ALPHA_REASONS.ack);
  return reasons.length ? { ok: false, reasons } : { ok: true };
}

/**
 * Package 3: may HLC be distributed to testers at all (codes created, codes redeemed, HLC issued)?
 * Only when closedAlpha.distributor records who distributes it and on what basis.
 */
export function distributionDecision(entry: ClosedAlphaEntry | null | undefined): ClosedAlphaResult {
  const problem = distributorProblem(entry?.distributor ?? null);
  return problem ? { ok: false, reasons: [problem] } : { ok: true };
}
