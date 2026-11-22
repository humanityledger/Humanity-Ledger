/**
 * lib/payments/request-draft.ts: the checks behind "Request a payment" and "Pay" on a request.
 * Pure functions, so the composer, the card and the payment form agree.
 */

/** Base units as a plain decimal string ("12.5"), with no thousand separators: the payment form parses it. */
export function plainUnits(units: bigint, decimals: number): string {
  if (units < 0n) throw new Error('negative amount');
  const base = 10n ** BigInt(decimals);
  const whole = (units / base).toString();
  const frac = (units % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
}

/** Validity choices offered by the composer. */
export const REQUEST_VALIDITY = [
  { label: '1 day', ms: 86400_000 },
  { label: '7 days', ms: 7 * 86400_000 },
  { label: '30 days', ms: 30 * 86400_000 },
] as const;

/**
 * Why a request for this amount cannot be sent, or null. A request above the cap per payment could
 * never be paid, so it is refused here rather than at the payer's end.
 */
export function requestDraftProblem(p: { units: bigint | null; cap: bigint | null | undefined; alpha: boolean }): string | null {
  if (p.units === null) return 'Enter an amount such as 10 or 0.5.';
  if (p.units <= 0n) return 'Ask for an amount above zero.';
  if (p.alpha) {
    if (typeof p.cap !== 'bigint' || p.cap <= 0n) return 'No limit per payment is set for this token yet, so it cannot be requested.';
    if (p.units > p.cap) return 'That is above the limit per payment for this token.';
  }
  return null;
}

/** What the "Pay" button opens: the request it pays, the wallet token and the exact amount. */
export interface PayPrefill {
  requestId: string;
  token: 'USDC' | 'DAI' | 'ETH' | 'CUSDC';
  amount: string;
}

export const PAY_REQUEST_EVENT = 'hl:pay-request';

export function isPayPrefill(v: unknown): v is PayPrefill {
  const p = v as Partial<PayPrefill> | null;
  return !!p
    && typeof p.requestId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(p.requestId)
    && (p.token === 'USDC' || p.token === 'DAI' || p.token === 'ETH' || p.token === 'CUSDC')
    && typeof p.amount === 'string' && /^[0-9]+(\.[0-9]+)?$/.test(p.amount);
}
