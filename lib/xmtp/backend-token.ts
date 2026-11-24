/**
 * lib/xmtp/backend-token.ts: short-lived tokens that let a signed-in Ledger Chat user reach our own
 * XMTP backend (docs/xmtp/SELF_HOSTED_MIGRATION.md, phase M2).
 *
 * The self-hosted backend checks JWTs against a JWKS URL ([auth] jwks_url, audiences, issuers,
 * required_scopes; ES256 supported). This file signs them on our server after the SIWE session is
 * verified, and serves the public key set.
 *
 * Privacy: the backend never learns the wallet. `sub` is HMAC-SHA256(pepper, wallet), stable for one
 * wallet so the backend can rate-limit per caller, and useless to link across services. The token
 * grants reaching the backend only: it does not prove membership of any conversation (MLS does).
 *
 * Keys live in the server environment: XMTP_BACKEND_JWT_PRIVATE_JWK (an ES256 private JWK with a
 * `kid`) and XMTP_BACKEND_SUB_PEPPER (32+ bytes). Nothing is issued while either is missing.
 */
import { SignJWT, importJWK, type JWK } from 'jose';

export const TOKEN_TTL_S = 10 * 60;
export const TOKEN_ISSUER = 'https://ledgerchat.org';
export const TOKEN_AUDIENCE = 'xmtp-backend';
export const TOKEN_SCOPE = 'xmtp';

export interface BackendTokenKeys {
  privateJwk: JWK & { kid: string };
  pepper: string;
}

/** The keys from the environment, or null when the self-hosted backend is not configured. */
export function backendTokenKeys(env: Record<string, string | undefined> = {
  XMTP_BACKEND_JWT_PRIVATE_JWK: process.env.XMTP_BACKEND_JWT_PRIVATE_JWK,
  XMTP_BACKEND_SUB_PEPPER: process.env.XMTP_BACKEND_SUB_PEPPER,
}): BackendTokenKeys | null {
  const raw = env.XMTP_BACKEND_JWT_PRIVATE_JWK;
  const pepper = env.XMTP_BACKEND_SUB_PEPPER;
  if (!raw || !pepper || pepper.length < 32) return null;
  let jwk: JWK;
  try {
    jwk = JSON.parse(raw);
  } catch {
    return null;
  }
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.d || typeof jwk.kid !== 'string' || !jwk.kid) return null;
  return { privateJwk: jwk as JWK & { kid: string }, pepper };
}

/** The public half of the signing key, as the backend's JWKS expects it. Never the private part. */
export function publicJwks(keys: BackendTokenKeys): { keys: JWK[] } {
  const { kty, crv, x, y, kid } = keys.privateJwk;
  return { keys: [{ kty, crv, x, y, kid, alg: 'ES256', use: 'sig' }] };
}

/** A pseudonymous, stable subject for one wallet. */
export async function subjectFor(wallet: string, pepper: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(wallet.trim().toLowerCase())));
  return 'u_' + Array.from(mac.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * A credential in the shape the browser SDK 8 takes: the header value ("Bearer " and the token)
 * and its expiry in Unix seconds.
 */
export async function issueBackendCredential(wallet: string, keys: BackendTokenKeys, now: number = Date.now()): Promise<{ headerValue: string; expiresAt: number }> {
  const iat = Math.floor(now / 1000);
  const exp = iat + TOKEN_TTL_S;
  const key = await importJWK(keys.privateJwk, 'ES256');
  const token = await new SignJWT({ scope: TOKEN_SCOPE })
    .setProtectedHeader({ alg: 'ES256', kid: keys.privateJwk.kid, typ: 'JWT' })
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setSubject(await subjectFor(wallet, keys.pepper))
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(key);
  return { headerValue: `Bearer ${token}`, expiresAt: exp };
}
