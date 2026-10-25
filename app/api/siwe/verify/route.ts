import { NextRequest, NextResponse } from 'next/server';
import { SiweMessage } from 'siwe';
import { prisma } from '@/lib/prisma';
import { getRedisClient } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { openNonce, resolveSiweDomainForVerification, consumeNonceLocally } from '@/lib/security/siweNonce';

export async function POST(req: NextRequest) {
  try {
    const { message, signature } = await req.json();
    // The cookie is MAC-sealed by /api/siwe/nonce (lib/security/siweNonce.ts),
    // so a client cannot choose the nonce it is checked against.
    const nonce = openNonce(req.cookies.get('siwe-nonce')?.value);

    if (!nonce) {
      return NextResponse.json({ ok: false, error: 'No nonce in session. Request a new nonce.' }, { status: 400 });
    }

    // Single-use nonce enforcement:
    // 1. In-memory local consume check (prevents replay during Redis outages)
    if (!consumeNonceLocally(nonce)) {
      logger.warn({ nonce }, '[SIWE] Nonce replay detected locally');
      return NextResponse.json({ ok: false, error: 'Nonce expired or already used.' }, { status: 401 });
    }

    // 2. Distributed Redis check (prevents replay across multiple replicas)
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
      logger.warn({ err }, 'Redis nonce check failed — local in-memory registry protected nonce');
    }

    // Cryptographic signature verification
    const siweMessage = new SiweMessage(message);
    const domain = resolveSiweDomainForVerification(siweMessage.domain, req.headers.get('host'));
    if (!domain) {
      logger.error({ received: siweMessage.domain, host: req.headers.get('host') }, '[SIWE] Domain verification rejected');
      return NextResponse.json({ ok: false, error: 'Sign-in domain is not authorized on this server.' }, { status: 401 });
    }
    
    // `suppressExceptions` ensures verification results are captured gracefully
    const { data: fields, error: siweErr } = await siweMessage.verify(
      { signature, nonce, domain },
      { suppressExceptions: true },
    );

    if (siweErr) {
      logger.error(
        { type: (siweErr as any)?.type, expected: (siweErr as any)?.expected, received: (siweErr as any)?.received },
        '[SIWE] Verification rejected',
      );
    }

    if (siweErr || !fields) {
      const type = (siweErr as any)?.type;
      return NextResponse.json(
        {
          ok: false,
          error:
            type === 'Domain does not match provided domain'
              ? 'Domain mismatch between the signed message and this server.'
              : type === 'Nonce does not match provided nonce'
                ? 'Nonce mismatch — request a new sign-in.'
                : 'Invalid signature.',
          detail: type ?? 'unknown',
        },
        { status: 401 },
      );
    }
    
    // Supported chains (Ethereum mainnet=1, Polygon=137, Arbitrum=42161, Optimism=10, Base=8453, Sepolia=11155111, Base Sepolia=84532)
    const ALLOWED_CHAINS = [1, 10, 137, 8453, 42161, 11155111, 84532];
    if (fields.chainId && !ALLOWED_CHAINS.includes(fields.chainId)) {
      return NextResponse.json({ ok: false, error: 'Unsupported chain. Please connect to Ethereum or Base.' }, { status: 401 });
    }

    if (fields.nonce !== nonce) {
      return NextResponse.json({ ok: false, error: 'Nonce mismatch — replay attack rejected.' }, { status: 401 });
    }

    // Temporal validations with 60s clock skew tolerance
    const now = Date.now();
    const CLOCK_TOLERANCE_MS = 60 * 1000;

    const issuedAt = fields.issuedAt ? new Date(fields.issuedAt).getTime() : 0;
    if (issuedAt && issuedAt - now > CLOCK_TOLERANCE_MS) {
      return NextResponse.json({ ok: false, error: 'Message issued in future — check your device clock.' }, { status: 401 });
    }
    if (issuedAt && now - issuedAt > 10 * 60 * 1000) {
      return NextResponse.json({ ok: false, error: 'Signature challenge expired — request a new sign-in.' }, { status: 401 });
    }

    if (fields.expirationTime) {
      const exp = new Date(fields.expirationTime).getTime();
      if (now - exp > CLOCK_TOLERANCE_MS) {
        return NextResponse.json({ ok: false, error: 'Signature challenge expired.' }, { status: 401 });
      }
    }

    if (fields.notBefore) {
      const notBefore = new Date(fields.notBefore).getTime();
      if (notBefore - now > CLOCK_TOLERANCE_MS) {
        return NextResponse.json({ ok: false, error: 'Signature not yet valid.' }, { status: 401 });
      }
    }

    const normalizedAddress = fields.address.toLowerCase();

    // Upsert System User
    let user: any = null;
    try {
      user = await prisma.user.upsert({
        where:  { walletAddress: normalizedAddress },
        update:  { lastActive: new Date() },
        create:  { walletAddress: normalizedAddress, lastActive: new Date() },
      });
    } catch (dbErr) {
      logger.warn({ dbErr }, '[SIWE] Database sync warning — continuing with authenticated cryptographic session');
    }

    // Mint Sovereign System JWT
    const { mintJWT } = await import('@/lib/jwt');
    const sessionToken = await mintJWT({
      sub: normalizedAddress,
      address: normalizedAddress,
      walletAddress: normalizedAddress,
      chainId: fields.chainId || 1,
      domain: fields.domain,
      clearance: 'Private',
      tier: user?.tier || 'FREE',
    });

    const res = NextResponse.json({
      ok: true,
      address: fields.address,
      chainId: fields.chainId,
    });

    const isProd = process.env.NODE_ENV === 'production';
    const httpOnlyCookieOptions = {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax' as const, // Lax prevents session loss on mobile wallet return/deep-link
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    };

    const clientReadableCookieOptions = {
      httpOnly: false,
      secure: isProd,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    };

    // B-007: Primary session cookie hl_session + legacy compatibility
    res.cookies.set('hl_session', sessionToken, httpOnlyCookieOptions);
    res.cookies.set('human_session', sessionToken, httpOnlyCookieOptions);
    res.cookies.set('ledger_session', sessionToken, httpOnlyCookieOptions);

    // Client-side synchronization cookies
    res.cookies.set('system_handshake', normalizedAddress, clientReadableCookieOptions);
    res.cookies.set('wallet-auth', fields.address, clientReadableCookieOptions);

    // Consume nonce cookie immediately
    res.cookies.delete('siwe-nonce');

    logger.info({ address: fields.address }, '[SIWE] Verified and session issued');
    return res;
  } catch (e: any) {
    logger.error({ e }, '[SIWE] Verify error');
    return NextResponse.json({ ok: false, error: 'Verification failed.' }, { status: 400 });
  }
}
