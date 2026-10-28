/**
 * lib/security/sessionRevocation.ts
 *
 * Server-side revocation of session JWTs, shared by every server instance.
 *
 * Why this exists: logout used to call revokeToken() from jwt-blacklist.ts,
 * which kept revoked tokens in one process's memory and was never consulted
 * by anything (isTokenRevoked had no callers). A session cookie copied before
 * logout therefore stayed valid for its full 7 days.
 *
 * Here a revoked token's SHA-256 fingerprint is stored in Redis until the
 * token would have expired anyway, and getSession() refuses it. If Redis is
 * unreachable the check fails open (the cookie itself is still deleted by
 * logout); a short in-process cache keeps the per-request cost to roughly
 * one Redis read per token every 15 seconds per instance.
 */

import { createHash } from 'crypto';
import { decodeJwt } from 'jose';
import { safeRedisGet, safeRedisSet } from '@/lib/redis/client';

const PREFIX = 'jwt:revoked:';
const DEFAULT_TTL_SEC = 7 * 24 * 60 * 60; // longest session lifetime we issue
const NEGATIVE_CACHE_MS = 15_000;

const revokedHere = new Map<string, number>();   // fingerprint -> expires at (ms)
const notRevokedCache = new Map<string, number>(); // fingerprint -> checked at (ms)

export function tokenFingerprint(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Seconds until the token's own `exp`, or the default when it has none. */
function remainingLifetimeSec(token: string, now = Date.now()): number {
  try {
    const { exp } = decodeJwt(token);
    if (typeof exp === 'number') return Math.max(60, Math.ceil(exp - now / 1000));
  } catch { /* not a JWT we can read: use the default */ }
  return DEFAULT_TTL_SEC;
}

/** Revoke one session token everywhere, until it would have expired. */
export async function revokeSessionToken(token: string | undefined | null): Promise<void> {
  if (!token) return;
  const fp = tokenFingerprint(token);
  const ttl = remainingLifetimeSec(token);
  revokedHere.set(fp, Date.now() + ttl * 1000);
  notRevokedCache.delete(fp);
  await safeRedisSet(PREFIX + fp, '1', 'EX', ttl);
  prune();
}

/** True when the token was revoked by a logout on any instance. */
export async function isSessionTokenRevoked(token: string): Promise<boolean> {
  const fp = tokenFingerprint(token);
  const now = Date.now();
  const localExp = revokedHere.get(fp);
  if (localExp && localExp > now) return true;
  const checkedAt = notRevokedCache.get(fp);
  if (checkedAt && now - checkedAt < NEGATIVE_CACHE_MS) return false;
  const v = await safeRedisGet(PREFIX + fp);
  if (v === '1') {
    revokedHere.set(fp, now + NEGATIVE_CACHE_MS * 40);
    return true;
  }
  // 'TIMEOUT' (Redis down) fails open; the cookie is already gone from the browser.
  notRevokedCache.set(fp, now);
  prune();
  return false;
}

function prune() {
  const now = Date.now();
  if (revokedHere.size > 50_000) for (const [k, exp] of revokedHere) if (exp <= now) revokedHere.delete(k);
  if (notRevokedCache.size > 50_000) for (const [k, t] of notRevokedCache) if (now - t > NEGATIVE_CACHE_MS) notRevokedCache.delete(k);
}

/** Test helper: forget all in-process state. */
export function __resetRevocationCacheForTests() {
  revokedHere.clear();
  notRevokedCache.clear();
}
