/**
 * lib/pricing/known-price.ts — the one rule for a missing price (F-09b).
 *
 * A price is known when it is a finite number above zero. Anything else (absent, zero, NaN, a string
 * that does not parse) is "unavailable": the value is null and is said to be unavailable, never shown
 * as 0 and never replaced by an invented number. A zero balance is worth exactly 0 whatever the price.
 */

export function knownPrice(v: unknown): number | null {
  const n = typeof v === 'string' ? Number.parseFloat(v) : typeof v === 'number' ? v : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** A USD amount reported by a provider: finite and not negative, else unknown. */
export function knownUsd(v: unknown): number | null {
  const n = typeof v === 'string' ? Number.parseFloat(v) : typeof v === 'number' ? v : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** balance × price, or null when the price is unavailable (0 when there is nothing to value). */
export function valueOrNull(balance: number, price: number | null): number | null {
  if (!Number.isFinite(balance) || balance < 0) return null;
  if (balance === 0) return 0;
  return price === null ? null : balance * price;
}

export type PriceStatus = 'priced' | 'unavailable';

export const priceStatus = (price: number | null): PriceStatus => (price === null ? 'unavailable' : 'priced');

/** Sum of the values that are known, with how many were left out. `partial` makes the gap visible. */
export function sumKnown<T>(items: readonly T[], value: (t: T) => number | null | undefined): { total: number; unpriced: number; partial: boolean } {
  let total = 0;
  let unpriced = 0;
  for (const it of items) {
    const v = value(it);
    if (typeof v === 'number' && Number.isFinite(v)) total += v;
    else unpriced++;
  }
  return { total, unpriced, partial: unpriced > 0 };
}
