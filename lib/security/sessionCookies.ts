/**
 * lib/security/sessionCookies.ts
 *
 * The one list of cookies that carry a signed-in session, and the one way to
 * end them. Both logout endpoints use this.
 *
 * Why: /api/auth/logout (the endpoint the Disconnect button calls) cleared
 * ledger_session and human_session but not hl_session, which /api/siwe/verify
 * issues as the PRIMARY session cookie and which middleware and getSession()
 * read first. After "logging out" the browser kept a valid 7-day session.
 * Two hand-written lists had drifted apart; now there is one.
 */

import type { NextRequest, NextResponse } from 'next/server';
import { revokeSessionToken } from './sessionRevocation';

/** Cookies whose value is a session JWT. */
export const SESSION_TOKEN_COOKIES = [
  'hl_session',
  'hl_refresh',
  'ledger_session',
  'human_session',
  'humanity_session',
  'human.access-token',
  'human.refresh-token',
  'auth_token',
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
  'human.session-token',
] as const;

/** Other cookies tied to a session that should go with it. */
export const SESSION_SIDE_COOKIES = [
  'siwe-nonce',
  'wallet-auth',
  'system_handshake',
  'next-auth.callback-url',
  '__Secure-next-auth.callback-url',
  'next-auth.csrf-token',
] as const;

/**
 * Revoke every session token the request carries, server-side, so a copy of
 * the cookie taken before logout stops working too.
 */
export async function revokeRequestSessions(req: NextRequest): Promise<number> {
  const seen = new Set<string>();
  for (const name of SESSION_TOKEN_COOKIES) {
    const v = req.cookies.get(name)?.value;
    if (v && !seen.has(v)) seen.add(v);
  }
  await Promise.all([...seen].map(t => revokeSessionToken(t)));
  return seen.size;
}

/**
 * Expire every session cookie on the response, in every attribute variant it
 * may have been set with (SameSite Strict/Lax, HttpOnly or not, host-only or
 * on the production parent domain). A browser only deletes a cookie when the
 * deletion matches how it was set, so all variants are sent.
 */
export function expireSessionCookies(res: NextResponse, host: string | null): void {
  const isProd = process.env.NODE_ENV === 'production';
  const secure = isProd ? '; Secure' : '';
  const expired = 'Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0';
  const domains = [''];
  if (isProd && (host || '').includes('humanidfi.com')) domains.push('; Domain=humanidfi.com');

  for (const name of [...SESSION_TOKEN_COOKIES, ...SESSION_SIDE_COOKIES]) {
    // __Secure- cookies must be cleared with Secure even outside production.
    const sec = name.startsWith('__Secure-') ? '; Secure' : secure;
    for (const domain of domains) {
      for (const sameSite of ['Strict', 'Lax']) {
        res.headers.append('Set-Cookie', `${name}=; Path=/; ${expired}; HttpOnly${sec}; SameSite=${sameSite}${domain}`);
        res.headers.append('Set-Cookie', `${name}=; Path=/; ${expired}${sec}; SameSite=${sameSite}${domain}`);
      }
    }
  }
}
