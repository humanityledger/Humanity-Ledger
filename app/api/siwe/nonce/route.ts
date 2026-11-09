import { generateNonce } from 'siwe';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIP } from '@/lib/security/rateLimiter';
import { sealNonce, NONCE_TTL_SEC } from '@/lib/security/siweNonce';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ip = getClientIP(req);
  
  // Rate limit: max 30 nonces per minute per IP
  const rate = await checkRateLimit(ip, { max: 30, windowSec: 60, prefix: 'rl:siwe_nonce' });
  if (!rate.allowed) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  const nonce = generateNonce(); // Cryptographically secure nonce

  // Single use is enforced at /api/siwe/verify (in memory, and in Redis with
  // SET NX on the nonce once it is used). Issuing needs no Redis write: the
  // cookie below is MAC-sealed with its issue time, so only nonces this
  // server issued in the last 10 minutes are accepted.

  const res = new NextResponse(nonce, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });

  // SameSite=None is required so the cookie survives the iOS Safari ↔ wallet
  // app deep-link round-trip. When a user opens MetaMask from Safari, then
  // returns to Safari to complete the sign-in, Safari classifies the outgoing
  // POST as a cross-site request and strips SameSite=Lax cookies — the nonce
  // cookie never reaches /api/siwe/verify, causing "No nonce in session" for
  // every mobile user. SameSite=None; Secure is the correct fix.
  // In development (HTTP) we fall back to Lax because Secure cannot be set.
  const isProd = process.env.NODE_ENV === 'production';
  res.cookies.set('siwe-nonce', sealNonce(nonce), {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: NONCE_TTL_SEC, // 10 minutes TTL
  });

  return res;
}
