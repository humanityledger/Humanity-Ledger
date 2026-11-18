/**
 * lib/chat/usernames.ts — Ledger Chat usernames and profile links.
 *
 * A username is how people find each other without sharing a wallet address, as in Signal:
 *
 *   - One per account. Unique in the world: the database holds the canonical form under a unique
 *     index, so two accounts can never save the same name, even when they try at the same instant.
 *   - Canonical form = lowercase ASCII. Only a–z, 0–9 and "_", plus an optional ".digits" ending
 *     (stefan, stefan_c, stefan.01). ASCII only, so no look-alike letters from other scripts can
 *     imitate someone else's name.
 *   - Found by exact name only. Nobody can list the directory by typing a few letters.
 *   - A profile link (and its QR code) carries a random token, not the name. Resetting the link
 *     makes every old link and QR code stop working; the username stays.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 32;

/** nickname: starts with a letter, then letters, digits or "_"; optional ".NN" (2 to 9 digits). */
const USERNAME_RE = /^[a-z][a-z0-9_]{2,31}(\.[0-9]{2,9})?$/;

/** Names nobody can take: they would let someone pass for the service, its staff or a network. */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  'admin', 'administrator', 'root', 'system', 'support', 'help', 'helpdesk', 'security', 'staff', 'team',
  'official', 'verified', 'moderator', 'mod', 'abuse', 'legal', 'privacy', 'compliance', 'billing', 'payments',
  'ledger', 'ledgerchat', 'ledger_chat', 'humanity', 'humanityledger', 'humanity_ledger', 'hl', 'hlc',
  'aztec', 'aztecnetwork', 'aztec_network', 'aztecprotocol', 'ethereum', 'xmtp', 'signal', 'whatsapp', 'telegram',
  'wallet', 'treasury', 'multisig', 'bridge', 'portal', 'claude', 'anthropic', 'null', 'undefined', 'everyone', 'here',
]);

export type UsernameProblem = 'empty' | 'short' | 'long' | 'start' | 'chars' | 'ending' | 'address' | 'reserved';

export const USERNAME_PROBLEM_TEXT: Record<UsernameProblem, string> = {
  empty: 'Choose a username.',
  short: `At least ${USERNAME_MIN} characters.`,
  long: `At most ${USERNAME_MAX} characters.`,
  start: 'Start with a letter.',
  chars: 'Use only letters a to z, numbers and "_". Add a dot only before a number at the end, like name.01.',
  ending: 'After the dot, use 2 to 9 numbers, like name.01.',
  address: 'A username cannot look like a wallet address.',
  reserved: 'This name is reserved.',
};

/** What a person typed, without "@", spaces at the ends, compatibility forms or capitals. */
export function canonicalUsername(input: string): string {
  return input.normalize('NFKC').trim().replace(/^@+/, '').toLowerCase();
}

/** The first thing wrong with a username, or null when it can be saved (if nobody has it). */
export function usernameProblem(input: string): UsernameProblem | null {
  const u = canonicalUsername(input);
  if (!u) return 'empty';
  if (/^0x[0-9a-f]*$/.test(u)) return 'address';
  if (u.length > USERNAME_MAX) return 'long';
  if (!/^[a-z]/.test(u)) return 'start';
  const base = u.split('.')[0];
  if (base.length < USERNAME_MIN) return 'short';
  if (!/^[a-z0-9_.]+$/.test(u)) return 'chars';
  if (u.includes('.') && !/\.[0-9]{2,9}$/.test(u)) return u.split('.').length > 2 ? 'chars' : 'ending';
  if (!USERNAME_RE.test(u)) return 'chars';
  if (RESERVED_USERNAMES.has(base) || RESERVED_USERNAMES.has(u)) return 'reserved';
  return null;
}

/** True when the text is a username to look up (not an address, a link or free text). */
export function looksLikeUsername(input: string): boolean {
  return usernameProblem(input) === null || (usernameProblem(input) === 'reserved');
}

/**
 * Names to offer when the one asked for is taken: the same name with a two-digit ending, the
 * way Signal offers name.01. Deterministic, so the list does not jump while the person types.
 */
export function usernameSuggestions(input: string, count = 3): string[] {
  const base = canonicalUsername(input).split('.')[0].replace(/[^a-z0-9_]/g, '').slice(0, USERNAME_MAX - 3);
  if (!/^[a-z]/.test(base) || base.length < USERNAME_MIN) return [];
  const out: string[] = [];
  let seed = 0;
  for (const ch of base) seed = (seed * 31 + ch.charCodeAt(0)) % 9973;
  for (let i = 0; out.length < count && i < 97; i++) {
    const n = ((seed + i * 37) % 98) + 1;
    const s = `${base}.${String(n).padStart(2, '0')}`;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

// ─── Profile links ────────────────────────────────────────────────────────────

/** 16 random bytes, base64url: 22 characters, 128 bits. */
export function newLinkToken(random: (n: number) => Uint8Array): string {
  const b = random(16);
  let bin = '';
  b.forEach((x) => (bin += String.fromCharCode(x)));
  const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(b).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const LINK_TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;

/**
 * The link people share. The token sits after "#": browsers never send that part to a server,
 * so it does not end up in access logs, analytics or a link preview fetch.
 */
export function profileLink(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/u#${token}`;
}

/** The token of a Ledger Chat profile link, from a scanned or pasted text; null otherwise. */
export function parseProfileLink(text: string): string | null {
  const t = text.trim();
  const m = t.match(/^https:\/\/(?:www\.)?ledgerchat\.org\/u#([A-Za-z0-9_-]{22})$/) || t.match(/^\/u#([A-Za-z0-9_-]{22})$/);
  if (m) return m[1];
  // Same link on another origin of this app (preview deployments, localhost) only in development.
  const dev = t.match(/^https?:\/\/[^/\s]+\/u#([A-Za-z0-9_-]{22})$/);
  if (dev && typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') return dev[1];
  return null;
}

// ─── QR colours ───────────────────────────────────────────────────────────────

/** Card colours for the profile QR code. The code itself is always dark on white, so it scans. */
export const QR_COLORS = [
  { id: 'ink', name: 'Ink', card: '#15171C', text: '#FFFFFF' },
  { id: 'violet', name: 'Violet', card: '#5200FF', text: '#FFFFFF' },
  { id: 'blue', name: 'Blue', card: '#2754D6', text: '#FFFFFF' },
  { id: 'teal', name: 'Teal', card: '#0E7C86', text: '#FFFFFF' },
  { id: 'green', name: 'Green', card: '#0A7A55', text: '#FFFFFF' },
  { id: 'amber', name: 'Amber', card: '#B54708', text: '#FFFFFF' },
  { id: 'rose', name: 'Rose', card: '#C01048', text: '#FFFFFF' },
  { id: 'mist', name: 'Mist', card: '#E4E7EC', text: '#15171C' },
] as const;
export type QrColorId = (typeof QR_COLORS)[number]['id'];
export const qrColor = (id: string | null | undefined) => QR_COLORS.find((c) => c.id === id) ?? QR_COLORS[0];
