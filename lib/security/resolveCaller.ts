import { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';

const ETH_ADDR_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * Caller Identity Verification (B-033)
 * 
 * Closes all impersonation & spoofing vectors:
 * Identity is resolved ONLY from the cryptographically signed HTTP-only session cookie.
 * No incoming request headers are ever trusted for identity resolution.
 */
export async function resolveVerifiedCaller(req?: NextRequest | Request): Promise<string | null> {
  try {
    const session = await getSession();
    if (session?.userId && ETH_ADDR_REGEX.test(session.userId)) {
      return session.userId.toLowerCase();
    }
  } catch {}

  return null;
}
