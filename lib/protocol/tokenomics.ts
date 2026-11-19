/**
 * lib/protocol/tokenomics.ts
 *
 * WITHDRAWN on 19 November 2026 (operator decision PA-1, docs/alpha/OPERATOR_DECISIONS.md). HLC is
 * a test token with no monetary value, used only to test private payments in the closed alpha. It
 * is never sold, offered, airdropped or launched, and no launch is planned. The former HLC model
 * (fixed supply, allocations, fair launch, fee buyback and burn, staking, vesting, launch
 * conditions) was removed from the code, the pages and the docs; it remains only in git history.
 * Real payments are planned in cUSDC, issued by human.tech, not by Humanity Ledger
 * (lib/payments/assets.ts).
 *
 * What is left is the agreement-fee arithmetic, which existing callers and tests use. The protocol
 * charges no fee in the alpha (OD-7); the reference for any future fee contract is `protocolFee`
 * in lib/protocol/fees.ts.
 */

export const MODEL_STATUS = 'withdrawn' as const;

export const BPS = 10_000n;

/**
 * Agreement fee: ceiling division so splitting a payment never pays less; a minimum per agreement.
 * Kept for existing callers; the reference for the fee contract is `protocolFee` in lib/protocol/fees.ts,
 * which is u128-safe and refuses fees above a share of the amount (T-5).
 */
export function agreementFee(amount: bigint, feeBps: bigint, minFee: bigint): bigint {
  if (amount <= 0n || feeBps < 0n || minFee < 0n) throw new Error('invalid fee input');
  const proportional = (amount * feeBps + BPS - 1n) / BPS;
  return proportional > minFee ? proportional : minFee;
}
