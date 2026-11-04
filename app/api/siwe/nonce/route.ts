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

  res.cookies.set('siwe-nonce', sealNonce(nonce), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: NONCE_TTL_SEC, // 10 minutes TTL
  });

  return res;
}
