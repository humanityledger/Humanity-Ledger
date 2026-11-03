/**
 * lib/ui/format.ts
 *
 * Small, pure formatting helpers shared by Ledger Chat and Studio, so the
 * same number or address reads the same way on every screen.
 */

const enPlural = new Intl.PluralRules('en');

/** "1 member", "2 members", "0 members". */
export function countLabel(n: number, one: string, other: string): string {
  const safe = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  return `${safe.toLocaleString('en-US')} ${enPlural.select(safe) === 'one' ? one : other}`;
}

/** 0x2551…bda9 — six characters, an ellipsis, the last four. Anything else is returned trimmed. */
export function shortAddress(address: string | null | undefined): string {
  const a = (address || '').trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) return `${a.slice(0, 6)}…${a.slice(-4)}`;
  if (a.length > 16) return `${a.slice(0, 8)}…${a.slice(-4)}`;
  return a;
}

/** The invite link for a community on whatever origin the app is served from. */
export function communityInviteUrl(joinCode: string | null | undefined, origin?: string): string | null {
  const code = (joinCode || '').trim();
  if (!code || !/^[A-Za-z0-9_-]{3,64}$/.test(code)) return null;
  const configured = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
  const base = origin ?? (configured || (typeof window !== 'undefined' ? window.location.origin : ''));
  return `${base}/join/${encodeURIComponent(code)}`;
}
