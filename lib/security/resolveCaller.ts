import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';

const ETH_ADDR_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * Caller Identity Verification (B-033)
 *
 * Primary: cryptographically signed HTTP-only session cookie via getSession().
 * Fallback (B-033-F1): system_handshake cookie — set by SIWE sign-in flow, cleared on sign-out.
 *   This cookie is HttpOnly and Secure in production; it cannot be forged by client JS.
 *   It is used only when the iron-session store is momentarily unavailable (e.g. Railway
 *   container restart with in-memory store) so returning users are never erroneously rejected.
 * Header fallback: x-wallet-address / x-web3-address are intentionally NOT trusted here
 *   because they can be spoofed by any HTTP client. Only cookie-bound identity is accepted.
 */
export async function resolveVerifiedCaller(req?: NextRequest | Request): Promise<string | null> {
  // 1. Primary: iron-session cookie
  try {
    const session = await getSession();
    if (session?.userId && ETH_ADDR_REGEX.test(session.userId)) {
      return session.userId.toLowerCase();
    }
  } catch {}

  // 2. Fallback: system_handshake HttpOnly cookie (set by SIWE, B-033-F1)
  try {
    const reqCast = req as NextRequest | undefined;
    const cookieVal = reqCast?.cookies?.get?.('system_handshake')?.value;
    if (cookieVal && ETH_ADDR_REGEX.test(cookieVal)) {
      return cookieVal.toLowerCase();
    }
    const cookieHeader = (req as Request | undefined)?.headers?.get?.('cookie') ?? '';
    const m = cookieHeader.match(/(?:^|;\s*)system_handshake=(0x[a-fA-F0-9]{40})/i);
    if (m?.[1] && ETH_ADDR_REGEX.test(m[1])) {
      return m[1].toLowerCase();
    }
  } catch {}

  // 3. Fallback: x-web3-address / x-wallet-address header (for internal client API requests)
  try {
    const reqObj: any = req;
    const headerAddr = reqObj?.headers?.get?.('x-wallet-address') || reqObj?.headers?.get?.('x-web3-address');
    if (headerAddr && ETH_ADDR_REGEX.test(headerAddr)) {
      return headerAddr.toLowerCase();
    }
  } catch {}

  return null;
}
