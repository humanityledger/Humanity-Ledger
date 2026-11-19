/**
 * The only constructors of DisplayName, TokenSymbol and Amount (see types.ts). Anything that
 * reaches an activity goes through here, so the island can never show a message body, a long
 * string or a control character.
 */
import type { Amount, DisplayName, TokenSymbol } from './types';

export const DISPLAY_NAME_MAX = 32;

/**
 * A name for an activity: the contact's name, @username or short address, as the caller resolved
 * it. One line, at most 32 characters (cut with an ellipsis), no control or bidi-override
 * characters. Empty input becomes "Unknown".
 */
export function toDisplayName(raw: string | null | undefined): DisplayName {
  // C0/C1 controls, line and paragraph separators, bidi overrides and isolates become spaces.
  const unsafe = (c: number) => c <= 0x1f || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029 || (c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069);
  const clean = Array.from(String(raw ?? ''), (ch) => (unsafe(ch.codePointAt(0) ?? 0) ? ' ' : ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  const name = clean || 'Unknown';
  const chars = Array.from(name);
  return (chars.length > DISPLAY_NAME_MAX ? `${chars.slice(0, DISPLAY_NAME_MAX - 1).join('')}…` : name) as DisplayName;
}

/** A token symbol, or null when it is not 1 to 8 upper-case letters or digits. */
export function toTokenSymbol(raw: string | null | undefined): TokenSymbol | null {
  const s = String(raw ?? '').trim().toUpperCase();
  return /^[A-Z0-9]{1,8}$/.test(s) ? (s as TokenSymbol) : null;
}

/**
 * An amount, or null when it is not a plain positive decimal (at most 18 decimals) with a valid
 * symbol. Trailing zeros after the point are dropped: "12.50" -> "12.5".
 */
export function toAmount(value: string | number | null | undefined, symbol: string | null | undefined): Amount | null {
  const sym = toTokenSymbol(symbol);
  const v = String(value ?? '').trim();
  if (!sym || !/^\d{1,30}(\.\d{1,18})?$/.test(v)) return null;
  const [int, frac = ''] = v.split('.');
  const intPart = int.replace(/^0+(?=\d)/, '');
  const fracPart = frac.replace(/0+$/, '');
  if (/^0+$/.test(intPart) && !fracPart) return null; // zero is not a payment
  return { value: fracPart ? `${intPart}.${fracPart}` : intPart, symbol: sym };
}

/** "12.5 HLC", with thin grouping for the integer part (1,234.5 HLC). */
export function formatAmount(a: Amount): string {
  const [int, frac] = a.value.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${frac ? `${grouped}.${frac}` : grouped} ${a.symbol}`;
}

/** 0:42, 12:05, 1:02:09 */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** "4 minutes 12 seconds", for screen readers. */
export function spokenDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const part = (n: number, w: string) => (n ? `${n} ${w}${n === 1 ? '' : 's'}` : '');
  return [part(h, 'hour'), part(m, 'minute'), part(s, 'second')].filter(Boolean).join(' ') || '0 seconds';
}
