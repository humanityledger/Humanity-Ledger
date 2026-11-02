/**
 * lib/security/verifiedCaller.ts
 *
 * Who is calling, for API routes behind the middleware.
 *
 * The middleware verifies the session JWT at the edge and passes the address
 * on in `x-verified-session-address`, but it cannot see logouts: revoked
 * tokens live in Redis (sessionRevocation.ts), which the edge does not read.
 * Routes that trusted the header alone therefore kept accepting a session
 * cookie copied before its owner signed out, for up to 7 days.
 *
 * Here the session comes from getSession(), which checks revocation. The
 * header is used only when the identity came from the email access token
 * (the one source getSession() does not read), and then only if that token
 * has not been revoked either.
 */

import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { isSessionPayload } from '@/lib/security/sessionClaims';
import { getSession } from '@/lib/session';
import { isSessionTokenRevoked } from '@/lib/security/sessionRevocation';

const WALLET_COOKIES = ['hl_session', 'humanity_session', 'ledger_session', 'human_session'];
const EMAIL_COOKIE = 'human.access-token';

export async function getVerifiedCaller(req: Request): Promise<string | null> {
  const session = await getSession();
  if (session?.userId) return session.userId.toLowerCase();

  const fromHeader = req.headers.get('x-verified-session-address');
  if (!fromHeader) return null;

  let jar: Awaited<ReturnType<typeof cookies>>;
  try { jar = await cookies(); } catch { return null; }
  // A wallet session cookie is present but getSession() refused it: revoked
  // or no longer valid. Do not fall back to what the edge read from it.
  if (WALLET_COOKIES.some(name => jar.get(name)?.value)) return null;

  const emailToken = jar.get(EMAIL_COOKIE)?.value;
  if (!emailToken) return null;
  // Verify the token here rather than trusting that the edge did: if the
  // middleware is ever skipped for a request, the header is whatever the
  // client sent, and any cookie value would have unlocked it.
  let tokenUser: string | null = null;
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const { payload } = await jwtVerify(emailToken, new TextEncoder().encode(secret), { algorithms: ['HS256'] });
    const uid = isSessionPayload(payload) ? (payload as Record<string, unknown>).userId : undefined;
    if (typeof uid === 'string' && uid) tokenUser = uid.toLowerCase();
  } catch { return null; }
  if (!tokenUser || tokenUser !== fromHeader.toLowerCase()) return null;
  try {
    if (await isSessionTokenRevoked(emailToken)) return null;
  } catch { /* the revocation store is optional: the token itself was verified above */ }
  return tokenUser;
}
