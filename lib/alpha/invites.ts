/**
 * Closed alpha, wave 1: invitation codes (master prompt Phase 2; operator decisions OD-4 and OD-5,
 * docs/alpha/OPERATOR_DECISIONS.md).
 *
 * A code is 16 Crockford base32 characters (80 random bits), shown as XXXX-XXXX-XXXX-XXXX. The
 * server keeps only HMAC-SHA256(pepper, code), the pepper being ALPHA_INVITE_PEPPER, so a copy of
 * the database does not reveal a usable code. Nothing here records an IP, a user agent or any
 * other tracking data.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_LENGTH = 16;
/** OD-4 as amended on 19/11/2026: at most 50 testers, for messaging and payments. */
export const MAX_TESTERS = 50;

/** A new code from 10 random bytes (80 bits), grouped by four. */
export function newInviteCode(randomBytes: (n: number) => Uint8Array): string {
  const bytes = randomBytes(10);
  if (bytes.length !== 10) throw new Error('need 10 random bytes');
  let bits = 0n;
  for (const b of bytes) bits = (bits << 8n) | BigInt(b);
  let out = '';
  for (let i = CODE_LENGTH - 1; i >= 0; i--) out += CROCKFORD[Number((bits >> BigInt(i * 5)) & 31n)];
  return out.match(/.{4}/g)!.join('-');
}

/**
 * The canonical form of what a person typed: upper case, no separators, and Crockford's
 * look-alikes mapped (O→0, I and L→1). Null when it cannot be a code.
 */
export function normalizeInviteCode(input: string): string | null {
  if (typeof input !== 'string') return null;
  const s = input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (s.length !== CODE_LENGTH) return null;
  for (const c of s) if (!CROCKFORD.includes(c)) return null;
  return s;
}

export function hashInviteCode(code: string, pepper: string): string {
  if (!pepper || pepper.length < 32) throw new Error('ALPHA_INVITE_PEPPER must be at least 32 characters');
  return createHmac('sha256', pepper).update(code).digest('hex');
}

export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/** ALPHA_ADMINS: comma-separated Ethereum addresses (OD-4: only Stefan's wallet invites). */
export function parseAlphaAdmins(raw: string | undefined): Set<string> {
  return new Set(
    String(raw ?? '')
      .split(',')
      .map((a) => a.trim().toLowerCase())
      .filter((a) => /^0x[0-9a-f]{40}$/.test(a)),
  );
}
