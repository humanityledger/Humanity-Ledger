/**
 * lib/payments/personal-limits.ts — limits a person sets on their own spending (items 67 and 68).
 *
 *  - Receive-only: this device does not send private payments at all. Receiving, requesting and
 *    viewing still work. For a shared computer, or for someone who only gets paid.
 *  - Per-payment limit, per token: a payment above it is refused before any proof is made.
 *
 * These live in this browser only and protect against mistakes and casual misuse of an unlocked
 * device. They are not a security boundary against someone who controls the device: that person
 * can change them. The contracts' own caps (closed beta) still apply on top.
 */

import { parseUnits, formatUnits } from '@/lib/aztec/wallet/amounts';

export const LIMITS_KEY = 'hl.payments.limits.v1';

export interface PersonalLimits {
  receiveOnly: boolean;
  /** Token key → maximum per payment, in base units as a decimal string. */
  perPayment: Record<string, string>;
}

const EMPTY: PersonalLimits = { receiveOnly: false, perPayment: {} };

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const browserStore = (): Store | undefined => (typeof window === 'undefined' ? undefined : window.localStorage);

export function loadLimits(store: Store | undefined = browserStore()): PersonalLimits {
  try {
    const raw = store?.getItem(LIMITS_KEY);
    if (!raw) return { ...EMPTY, perPayment: {} };
    const j = JSON.parse(raw);
    const perPayment: Record<string, string> = {};
    for (const [k, v] of Object.entries(j?.perPayment ?? {})) if (typeof v === 'string' && /^\d+$/.test(v)) perPayment[k] = v;
    return { receiveOnly: j?.receiveOnly === true, perPayment };
  } catch {
    return { ...EMPTY, perPayment: {} };
  }
}

export function saveLimits(limits: PersonalLimits, store: Store | undefined = browserStore()): void {
  store?.setItem(LIMITS_KEY, JSON.stringify(limits));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(LIMITS_EVENT));
}

export const LIMITS_EVENT = 'hl:payment-limits';

export const RECEIVE_ONLY_MESSAGE = 'This device is set to receive only. Turn it off in Settings, Payments, to send.';

/** Why a payment of `units` (base units) in `token` is refused by the person's own limits, or null. */
export function personalLimitProblem(token: { key: string; symbol: string; decimals: number }, units: bigint, limits: PersonalLimits = loadLimits()): string | null {
  if (limits.receiveOnly) return RECEIVE_ONLY_MESSAGE;
  const cap = limits.perPayment[token.key];
  if (cap !== undefined && units > BigInt(cap)) {
    return `Above your limit of ${formatUnits(BigInt(cap), token.decimals, token.decimals)} ${token.symbol} per payment. Change it in Settings, Payments.`;
  }
  return null;
}

/** Parses a decimal limit typed by the person; null clears it. Throws on a bad number. */
export function limitUnits(text: string, decimals: number): string | null {
  const t = text.trim();
  if (!t) return null;
  const u = parseUnits(t, decimals);
  if (u <= 0n) throw new Error('A limit must be more than zero.');
  return u.toString();
}
