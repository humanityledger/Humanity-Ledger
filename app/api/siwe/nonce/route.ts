import { generateNonce } from 'siwe';
import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';
import { checkRateLimit, getClientIP } from '@/lib/security/rateLimiter';
import { sealNonce, NONCE_TTL_SEC } from '@/lib/security/siweNonce';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ip = getClientIP(req);
  
  // Rate limit: max 10 nonces per minute per IP
  const rate = await checkRateLimit(ip, { max: 30, windowSec: 60, prefix: 'rl:siwe_nonce' });
  if (!rate.allowed) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  const nonce = generateNonce(); // Cryptographically secure nonce

  // B-011: Store nonce in Redis with 10-minute TTL, single-use
  try {
    const redis = await getRedisClient();
    await redis.setex(`siwe:nonce:${nonce}`, 600, ip);
  } catch (err) {
    logger.warn({ err }, 'Redis error storing SIWE nonce — falling back to cookie only');
  }

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
