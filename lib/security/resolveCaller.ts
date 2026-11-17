import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';

const ETH_ADDR_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * Caller Identity Verification (B-033)
 *
 * The caller is the wallet of the signed session cookie (getSession: hl_session and its legacy
 * names, JWT-verified, revocation checked) and nothing else.
 *
 * Internal audit IA-03 (18 November 2026) removed two fallbacks that let anyone act as any wallet:
 *   - the `system_handshake` cookie. It is not HttpOnly and not signed: it holds a bare address,
 *     and any HTTP client can send `Cookie: system_handshake=0x<anyone>`. On /api/chat/stories,
 *     a public path that the middleware lets through without a session, that alone read, posted
 *     and deleted stories as the named wallet. Behind the middleware, a token that verifies there
 *     but that getSession refuses (revoked by logout) reached the same fallback.
 *   - the x-wallet-address / x-web3-address headers. The middleware strips them on every /api
 *     request, so this branch was dead, but it contradicted this file's own contract.
 * Revocation lookups fail open when Redis is down (lib/security/sessionRevocation.ts), so a signed
 * session never needs a fallback to stay usable.
 */
export async function resolveVerifiedCaller(req?: NextRequest | Request): Promise<string | null> {
  try {
    const session = await getSession(req);
    if (session?.userId && ETH_ADDR_REGEX.test(session.userId)) {
      return session.userId.toLowerCase();
    }
    const wallet = session?.walletAddress;
    if (wallet && ETH_ADDR_REGEX.test(wallet)) return wallet.toLowerCase();
  } catch {
    /* no session */
  }
  return null;
}
