/**
 * lib/protocol/fees.ts — Phase 0 protocol fee arithmetic (docs/TOKENOMICS.md, "Fee arithmetic").
 *
 *   fee = max(minFee, ceil(amount × feeBps / 10,000))
 *
 * State: real only in tests. No contract charges a fee today; this module is the reference the fee
 * contract must match (docs/protocol/FEE_CONTRACT_SPEC.md). Every function is pure and works in
 * bigint base units of the token (HLC: 6 decimals).
 *
 * Two properties carried over to the contract:
 *  - Ceiling division: splitting a payment into parts never pays less in total.
 *  - u128-safe evaluation: aztec-nr token amounts are u128, and amount × feeBps can exceed 2^128.
 *    `ceilBps` splits the amount by BPS first, so no intermediate value exceeds the amount plus
 *    10,000 × 10,000. The contract must use the same formula; the tests check it against the
 *    direct formula for every input they try.
 */

export const BPS = 10_000n;
/** Largest u128, the type of token amounts in aztec-nr. */
export const U128_MAX = (1n << 128n) - 1n;

export interface FeeSchedule {
  /** Proportional fee in basis points (0 to 10,000). */
  feeBps: bigint;
  /** Minimum fee per agreement, in base units. */
  minFee: bigint;
  /**
   * Largest share of the amount the fee may take, in basis points. An agreement whose fee would be
   * larger is refused instead of charged (finding T-5, docs/security/AUDIT_2026-11-13.md: a 500 unit
   * minimum on a 10 unit payment would take 50 times the payment).
   */
  maxFeeShareBps: bigint;
}

export type FeeQuote =
  | { ok: true; fee: bigint; net: bigint }
  | { ok: false; reason: 'invalid-amount' | 'invalid-schedule' | 'fee-exceeds-share' };

/** ceil(amount × bps / BPS) without forming amount × bps. Requires 0 <= bps <= BPS. */
export function ceilBps(amount: bigint, bps: bigint): bigint {
  const q = amount / BPS;
  const r = amount % BPS;
  // amount × bps / BPS = q × bps + r × bps / BPS, and r × bps < BPS × BPS.
  return q * bps + (r * bps + BPS - 1n) / BPS;
}

export function validSchedule(s: FeeSchedule): boolean {
  return (
    s.feeBps >= 0n && s.feeBps <= BPS &&
    s.minFee >= 0n && s.minFee <= U128_MAX &&
    s.maxFeeShareBps >= 0n && s.maxFeeShareBps <= BPS
  );
}

/**
 * The fee for one agreement, and what is left for the recipient. Refuses, rather than charges,
 * when the fee would take more than `maxFeeShareBps` of the amount.
 */
export function protocolFee(amount: bigint, s: FeeSchedule): FeeQuote {
  if (amount <= 0n || amount > U128_MAX) return { ok: false, reason: 'invalid-amount' };
  if (!validSchedule(s)) return { ok: false, reason: 'invalid-schedule' };
  const proportional = ceilBps(amount, s.feeBps);
  const fee = proportional > s.minFee ? proportional : s.minFee;
  // fee <= amount × maxFeeShareBps / BPS, compared without division: fee × BPS <= amount × share.
  if (fee * BPS > amount * s.maxFeeShareBps) return { ok: false, reason: 'fee-exceeds-share' };
  return { ok: true, fee, net: amount - fee };
}

/**
 * The smallest amount an agreement can carry under a schedule: below it the minimum fee takes more
 * than the allowed share. Shown to the person before they enter an amount.
 */
export function minimumAmount(s: FeeSchedule): bigint | null {
  if (!validSchedule(s) || s.maxFeeShareBps === 0n) return null;
  // Smallest amount with minFee × BPS <= amount × share, then checked against the proportional part.
  let amount = (s.minFee * BPS + s.maxFeeShareBps - 1n) / s.maxFeeShareBps;
  if (amount < 1n) amount = 1n;
  for (let i = 0; i < 4; i++) {
    const q = protocolFee(amount, s);
    if (q.ok) return amount;
    amount += 1n;
  }
  // The proportional fee alone exceeds the share (feeBps > maxFeeShareBps): no amount qualifies.
  return s.feeBps > s.maxFeeShareBps ? null : amount;
}
