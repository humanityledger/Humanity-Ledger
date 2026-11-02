/**
 * lib/security/qrLogin.ts — shared pieces of "sign in on a computer with your phone".
 *
 *   computer  POST /api/auth/qr-init        { uuid, pub }            → qr_init_session cookie
 *   phone     POST /api/auth/qr-mobile-link { uuid, desktopPub, ciphertext, claimHash }
 *   computer  GET  /api/auth/qr-poll        (cookie)                 → ciphertext only
 *   computer  POST /api/auth/qr-hydrate     { uuid, claim } (cookie) → HttpOnly session cookies
 *
 * The session token stays on the server until the computer proves it could
 * decrypt the phone's message (its private key plus the PIN on its screen).
 */

import { createHash, timingSafeEqual } from 'crypto';
import { redisClient } from '@/lib/redis/client';

export const QR_UUID_RE = /^[0-9a-z-]{6,64}$/i;
export const QR_TTL_SEC = 300;

export const qrEphKey = (uuid: string) => `qr-ephkey:${uuid}`;
export const qrSessionKey = (uuid: string) => `qr-session:${uuid}`;
export const qrClaimKey = (uuid: string) => `qr-claim:${uuid}`;

export function hashClaim(claim: string): string {
  return createHash('sha256').update(claim).digest('hex');
}

export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === 32 && y.length === 32 && timingSafeEqual(x, y);
}

const isMock = () => !!((redisClient as any)?.__isMock || (redisClient as any)?.__isBuildMock);

/** Set a key only if it does not exist yet. True when this call set it. */
export async function setOnce(key: string, value: string, ttlSec: number): Promise<boolean> {
  const r: any = redisClient;
  if (!r) return false;
  if (isMock()) {
    if (await r.get(key)) return false;
    await r.setex(key, ttlSec, value);
    return true;
  }
  return (await r.set(key, value, 'EX', ttlSec, 'NX')) === 'OK';
}

export async function setFor(key: string, value: string, ttlSec: number): Promise<void> {
  const r: any = redisClient;
  if (!r) return;
  if (isMock()) await r.setex(key, ttlSec, value);
  else await r.set(key, value, 'EX', ttlSec);
}

/** Read a key and delete it, so it can be used once. */
export async function takeOnce(key: string): Promise<string | null> {
  const r: any = redisClient;
  if (!r) return null;
  if (!isMock() && typeof r.getdel === 'function') return (await r.getdel(key)) ?? null;
  const v = await r.get(key);
  if (v != null) await r.del(key);
  return v ?? null;
}

export async function readKey(key: string): Promise<string | null> {
  const r: any = redisClient;
  if (!r) return null;
  return (await r.get(key)) ?? null;
}
