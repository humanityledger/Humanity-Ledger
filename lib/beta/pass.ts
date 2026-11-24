/**
 * lib/beta/pass.ts: the closed cUSDC beta pass. Since 24 November 2026 it no longer gates /chat:
 * the chat is open to everyone and the beta limits cUSDC only (checked by the server before each
 * payment). The pass is kept as a cheap, signed "this wallet is a member" hint.
 *
 * /api/beta/cusdc/status and /api/beta/cusdc/redeem set an HttpOnly cookie holding a short JWT
 * (HS256, JWT_SECRET) whose subject is the member's wallet; they clear it for anyone who is not a
 * member. The middleware checks it against the signed session's wallet. Revoked members keep a
 * pass: they still need the chat to move their own funds out (exits). A pass lasts 12 hours and is
 * renewed whenever /beta or the wallet reads the status.
 */
import { jwtVerify } from 'jose/jwt/verify';

export const BETA_PASS_COOKIE = 'hl_beta_pass';
export const BETA_PASS_TTL_S = 12 * 60 * 60;
const KIND = 'cusdc-beta-pass';

/** The gate is on while the operator's beta switch is on (deployments/aztec-mainnet.json). */
export function betaGateOn(record: unknown): boolean {
  return (record as { cusdcBeta?: { enabled?: unknown } } | null)?.cusdcBeta?.enabled === true;
}

export async function verifyBetaPass(token: string | undefined, wallet: string | null, secret: Uint8Array): Promise<boolean> {
  if (!token || !wallet) return false;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    return payload.kind === KIND && typeof payload.sub === 'string' && payload.sub.toLowerCase() === wallet.toLowerCase();
  } catch {
    return false;
  }
}

export async function signBetaPass(wallet: string, secret: Uint8Array, now: number = Date.now()): Promise<string> {
  const { SignJWT } = await import('jose');
  const iat = Math.floor(now / 1000);
  return new SignJWT({ kind: KIND })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(wallet.toLowerCase())
    .setIssuedAt(iat)
    .setExpirationTime(iat + BETA_PASS_TTL_S)
    .sign(secret);
}

export function betaPassCookieOptions(): { httpOnly: true; secure: boolean; sameSite: 'lax'; path: '/'; maxAge: number } {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: BETA_PASS_TTL_S };
}

/** Sets or clears the pass on a route response, from the member row. */
export async function applyBetaPass(
  res: { cookies: { set(name: string, value: string, opts: object): unknown; delete(name: string): unknown } },
  wallet: string,
  isMember: boolean,
): Promise<void> {
  const raw = process.env.JWT_SECRET;
  if (!isMember || !raw) {
    res.cookies.delete(BETA_PASS_COOKIE);
    return;
  }
  res.cookies.set(BETA_PASS_COOKIE, await signBetaPass(wallet, new TextEncoder().encode(raw)), betaPassCookieOptions());
}
