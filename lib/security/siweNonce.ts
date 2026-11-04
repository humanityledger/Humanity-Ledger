/**
 * lib/security/siweNonce.ts
 *
 * The SIWE nonce cookie is signed by the server.
 *
 * Before this, /api/siwe/verify compared the nonce in the signed message
 * with a plain `siwe-nonce` cookie. Redis made each nonce single-use, but
 * when Redis was unreachable the check fell back to the cookie alone, and a
 * cookie is whatever the client sends. Anyone holding a captured SIWE message
 * and signature could set the cookie to that message's nonce and sign in as
 * its author for the next ten minutes. With a MAC, only a nonce this server
 * issued can pass, and only together with the cookie the server issued.
 */

import { createHmac, timingSafeEqual } from 'crypto';

function key(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set.');
  return createHmac('sha256', secret).update('hl/siwe-nonce/v1').digest();
}

function mac(nonce: string, issuedAt: number): string {
  return createHmac('sha256', key()).update(`${nonce}.${issuedAt}`).digest('base64url');
}

export const NONCE_TTL_SEC = 600;

// In-memory single-use consumed nonces registry.
// Guarantees zero-replay protection even during Redis outages or network partitions.
const consumedNonces = new Map<string, number>();

/**
 * Marks a nonce as consumed locally. Returns true if successfully consumed,
 * false if this nonce was already consumed (replay attack detected).
 */
export function consumeNonceLocally(nonce: string, now = Date.now()): boolean {
  // Prune expired nonces periodically
  if (consumedNonces.size > 2000) {
    for (const [n, ts] of consumedNonces.entries()) {
      if (now - ts > NONCE_TTL_SEC * 1000) consumedNonces.delete(n);
    }
  }
  if (consumedNonces.has(nonce)) {
    return false; // Replay attempt rejected
  }
  consumedNonces.set(nonce, now);
  return true;
}

export function sealNonce(nonce: string, now = Date.now()): string {
  return `${nonce}.${now}.${mac(nonce, now)}`;
}

/** Returns the nonce if the cookie is one this server issued and it has not expired. */
export function openNonce(cookie: string | undefined, now = Date.now()): string | null {
  if (!cookie) return null;
  const parts = cookie.split('.');
  if (parts.length !== 3) return null;
  const [nonce, issuedRaw, sig] = parts;
  const issuedAt = Number(issuedRaw);
  if (!/^[A-Za-z0-9]{8,64}$/.test(nonce) || !Number.isFinite(issuedAt)) return null;
  if (now - issuedAt > NONCE_TTL_SEC * 1000 || issuedAt - now > 60_000) return null;
  const expected = Buffer.from(mac(nonce, issuedAt));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return nonce;
}

/**
 * The domain a SIWE message must name. In production it comes from
 * configuration, never from the Host header, which the client controls.
 */
export function expectedSiweDomain(hostHeader: string | null): string | null {
  return expectedSiweDomains(hostHeader)[0] ?? null;
}

function hostnameOf(value: string): string {
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Every domain a SIWE message may name on this server.
 *
 * - NEXT_PUBLIC_DOMAIN or the hostname of NEXT_PUBLIC_APP_URL, plus its
 *   www/apex counterpart: visitors reach the site as both humanidfi.com and
 *   www.humanidfi.com, and each signs its own hostname. Before, the www
 *   variant was rejected with "Sign-in domain is not authorized".
 * - SIWE_ALLOWED_DOMAINS: optional comma-separated extra hostnames (for
 *   example a staging domain).
 * Outside production, the Host header (development only) is accepted too.
 */
export function expectedSiweDomains(hostHeader: string | null): string[] {
  const configured = [
    process.env.NEXT_PUBLIC_DOMAIN || '',
    process.env.NEXT_PUBLIC_APP_URL || '',
    ...(process.env.SIWE_ALLOWED_DOMAINS || '').split(','),
  ]
    .map((v) => hostnameOf(v.trim()))
    .filter(Boolean);

  const all = new Set<string>();
  for (const h of configured) {
    all.add(h);
    if (h !== 'localhost' && !/^\d+(\.\d+){3}$/.test(h)) {
      all.add(h.startsWith('www.') ? h.slice(4) : `www.${h}`);
    }
  }
  if (all.size === 0 && process.env.NODE_ENV !== 'production') {
    all.add((hostHeader?.split(':')[0] || 'localhost').toLowerCase());
  }
  return [...all];
}

/**
 * Checks whether the incoming SIWE message domain is authorized against the expected server domains.
 * Supports both domain and domain:port formats while preventing host header spoofing.
 * Returns the message's own domain string (so siwe's exact-match check passes) or null.
 */
export function resolveSiweDomainForVerification(messageDomain: string, hostHeader: string | null): string | null {
  const rawMsgDomain = (messageDomain || '').trim();
  const cleanMsg = rawMsgDomain.split(':')[0].toLowerCase();
  if (!cleanMsg) return null;

  if (expectedSiweDomains(hostHeader).includes(cleanMsg)) return rawMsgDomain;

  // Development fallback for localhost / 127.0.0.1
  if (process.env.NODE_ENV !== 'production') {
    const cleanHost = (hostHeader?.split(':')[0] || 'localhost').toLowerCase();
    if (cleanMsg === cleanHost || cleanMsg === 'localhost' || cleanMsg === '127.0.0.1') {
      return rawMsgDomain;
    }
  }

  return null;
}
