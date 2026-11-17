/**
 * components/zk/wallet/walletLogic.ts — the wallet screen's rules, without React.
 *
 * Kept apart so they are tested directly (test/unit/aztec/wallet-ui-logic.test.ts):
 * what an amount or a recipient may be, how many fees the Fee Juice covers, and
 * how the activity list is filtered and grouped by day.
 */

import type { Activity } from '@/lib/aztec/wallet/history';
import { AZTEC_WALLET_CONFIG } from '@/lib/aztec/wallet/config';
import { formatUnits, parseUnits } from '@/lib/aztec/wallet/amounts';

/** Same pattern as lib/aztec/wallet/client.ts: 0x and 64 hex characters. */
export const isAztecAddressText = (v: string) => /^0x[0-9a-fA-F]{64}$/.test(v.trim());

/** Keeps digits and one decimal point, and at most `decimals` digits after it. */
export function cleanAmount(raw: string, decimals: number): string {
  let s = raw.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const dot = s.indexOf('.');
  if (dot >= 0) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '').slice(0, decimals);
  if (/^0\d/.test(s)) s = s.replace(/^0+(?=\d)/, '');
  return s.slice(0, 32);
}

/**
 * Why an amount cannot be used, in one short sentence, or null when it can.
 * Empty input is not an error (the button is simply disabled).
 */
export function amountProblem(value: string, decimals: number, max: bigint): string | null {
  if (!value) return null;
  let units: bigint;
  try {
    units = parseUnits(value, decimals);
  } catch (e) {
    return e instanceof Error ? e.message : 'Enter an amount such as 10 or 0.5.';
  }
  if (units > max) return 'More than you have';
  return null;
}

/** Why a recipient cannot be paid, or null. */
export function recipientProblem(to: string, own?: string): string | null {
  if (!to) return null;
  if (!isAztecAddressText(to)) return 'An Aztec address is 0x and 64 characters';
  if (own && to.toLowerCase() === own.toLowerCase()) return 'This is your own address';
  return null;
}

/**
 * How many transactions the Fee Juice balance covers at least, using the most a
 * transaction can cost (minForTx). Null when either number is unknown.
 */
export function feeRunway(balance: bigint | undefined, minForTx: bigint | undefined): number | null {
  if (balance === undefined || minForTx === undefined || minForTx <= 0n) return null;
  const n = balance / minForTx;
  return n > 999n ? 999 : Number(n);
}

/** Money that came in to this wallet (shielding moves your own money into private notes). */
export const isInbound = (a: Activity) => a.kind === 'receive' || a.kind === 'faucet' || a.kind === 'issue';
export const isInFlight = (a: Activity) => a.status === 'proving' || a.status === 'pending';


export type ActivityFilter = 'all' | 'in' | 'out' | 'pending';

export function filterActivity(items: Activity[], f: ActivityFilter): Activity[] {
  if (f === 'in') return items.filter((a) => isInbound(a));
  if (f === 'out') return items.filter((a) => a.kind === 'send' || a.kind === 'unshield');
  if (f === 'pending') return items.filter((a) => isInFlight(a) || a.status === 'failed');
  return items;
}

/** "Today", "Yesterday", or "12 Nov 2026", for the day an entry was created (local time). */
export function dayLabel(ms: number, now = Date.now()): string {
  const d = new Date(ms);
  const today = new Date(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

/** Entries grouped by day, newest day first, newest entry first within a day. */
export function groupByDay(items: Activity[], now = Date.now()): Array<{ day: string; items: Activity[] }> {
  const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt);
  const out: Array<{ day: string; items: Activity[] }> = [];
  for (const a of sorted) {
    const day = dayLabel(a.createdAt, now);
    const last = out[out.length - 1];
    if (last && last.day === day) last.items.push(a);
    else out.push({ day, items: [a] });
  }
  return out;
}


/** "12.5 HLC" for an activity entry, or '' when it moved no token. */
export function activityAmount(a: Activity): string {
  if (!a.amount || !a.token) return '';
  const t = AZTEC_WALLET_CONFIG.tokens.find((x) => x.key === a.token);
  try {
    return `${formatUnits(BigInt(a.amount), t?.decimals ?? 18)} ${t?.symbol ?? a.token}`;
  } catch {
    return '';
  }
}
