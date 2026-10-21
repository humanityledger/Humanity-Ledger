import { NextRequest, NextResponse } from 'next/server';
import { SiweMessage } from 'siwe';
import { prisma } from '@/lib/prisma';
import { getRedisClient } from '@/lib/redis';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const { message, signature } = await req.json();
    const nonce = req.cookies.get('siwe-nonce')?.value;

    if (!nonce) {
      return NextResponse.json({ ok: false, error: 'No nonce in session. Request a new nonce.' }, { status: 400 });
    }

    // B-011: Verify nonce in Redis and enforce single-use
    try {
      const redis = await getRedisClient();
      const nonceKey = `siwe:nonce:${nonce}`;
      const stored = await redis.get(nonceKey);
      if (!stored) {
        logger.warn({ nonce }, 'SIWE nonce missing or already consumed in Redis');
        return NextResponse.json({ ok: false, error: 'Nonce expired or already used.' }, { status: 401 });
      }
      // Single-use: delete immediately
      await redis.del(nonceKey);
    } catch (err) {
      logger.warn({ err }, 'Redis nonce check failed — continuing with cookie validation');
    }

    // Cryptographic signature verification
    const siweMessage = new SiweMessage(message);
    const domain = process.env.NEXT_PUBLIC_DOMAIN || req.headers.get('host')?.split(':')[0] || 'localhost';
    
    const { data: fields, error: siweErr } = await siweMessage.verify({
      signature,
      nonce,
      domain,
    });

    if (siweErr || !fields) {
      logger.error({ siweErr }, '[SIWE] Signature verification failed');
      return NextResponse.json({ ok: false, error: 'Invalid signature or nonce mismatch.' }, { status: 401 });
    }
    
    // Supported chains (Ethereum mainnet=1, Base=8453, Sepolia=11155111, Base Sepolia=84532)
    const ALLOWED_CHAINS = [1, 8453, 11155111, 84532];
    if (!ALLOWED_CHAINS.includes(fields.chainId)) {
      return NextResponse.json({ ok: false, error: 'Unsupported chain. Use Ethereum or Base.' }, { status: 401 });
    }

    if (fields.nonce !== nonce) {
      return NextResponse.json({ ok: false, error: 'Nonce mismatch — replay attack rejected.' }, { status: 401 });
    }

    // Nonce TTL: reject if issued more than 10 minutes ago
    const issuedAt = fields.issuedAt ? new Date(fields.issuedAt).getTime() : 0;
    if (issuedAt && Date.now() - issuedAt > 10 * 60 * 1000) {
      return NextResponse.json({ error: 'Nonce expired' }, { status: 401 });
    }

    // Upsert System User
    let user;
    try {
      user = await prisma.user.upsert({
        where:  { walletAddress: fields.address.toLowerCase() },
        update:  { lastActive: new Date() },
        create:  { walletAddress: fields.address.toLowerCase(), lastActive: new Date() },
      });
    } catch (dbErr) {
      logger.error({ dbErr }, '[SIWE] DB upsert failed');
      return NextResponse.json({ ok: false, error: 'Database synchronization failed.' }, { status: 500 });
    }

    // Mint System JWT
    const { mintJWT } = await import('@/lib/jwt');
    const sessionToken = await mintJWT({
      sub: fields.address.toLowerCase(),
      address: fields.address.toLowerCase(),
      walletAddress: fields.address.toLowerCase(),
      chainId: fields.chainId,
      domain: fields.domain,
      clearance: 'Private',
      tier: user?.tier || 'FREE',
    });

    const res = NextResponse.json({
      ok: true,
      address: fields.address,
      chainId: fields.chainId,
    });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    };

    // B-007: Single primary session cookie hl_session + legacy compatibility
    res.cookies.set('hl_session', sessionToken, cookieOptions);
    res.cookies.set('human_session', sessionToken, cookieOptions);
    res.cookies.delete('siwe-nonce');

    logger.info({ address: fields.address }, '[SIWE] Verified and session issued');
    return res;
  } catch (e: any) {
    logger.error({ e }, '[SIWE] Verify error');
    return NextResponse.json({ ok: false, error: 'Verification failed.' }, { status: 400 });
  }
}
