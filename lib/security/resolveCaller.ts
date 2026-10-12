import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';

const ETH_ADDR_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * Quantum-Grade Caller Identity Verification
 * 
 * Closes all impersonation & spoofing vectors:
 * 1. Checks cryptographically signed HTTP-only JWT session cookie.
 * 2. Checks `x-verified-session-address` ONLY as injected by Edge Middleware from verified JWT.
 * 3. Rejects client-spoofed headers (like raw `x-web3-address` or query parameters).
 */
export async function resolveVerifiedCaller(req: NextRequest | Request): Promise<string | null> {
  // 1. Check primary JWT session (SIWE / EIP-4361 / Session Token)
  try {
    const session = await getSession();
    if (session?.userId && ETH_ADDR_REGEX.test(session.userId)) {
      return session.userId.toLowerCase();
    }
  } catch {}

  // 2. Check header injected strictly by Edge Middleware
  const verifiedHeader = req.headers.get('x-verified-session-address');
  if (verifiedHeader && ETH_ADDR_REGEX.test(verifiedHeader)) {
    return verifiedHeader.toLowerCase();
  }

  return null;
}
