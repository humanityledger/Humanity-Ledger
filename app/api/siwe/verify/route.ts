import { NextRequest, NextResponse } from 'next/server';
import { SiweMessage, SiweErrorType } from 'siwe';
import { prisma } from '@/lib/prisma';
import { getRedisClient } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { openNonce, resolveSiweDomainForVerification, consumeNonceLocally, NONCE_TTL_SEC } from '@/lib/security/siweNonce';
import { verifyContractWalletSiwe } from '@/lib/security/siweContractWallet';

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
      logger.warn('[SIWE] Nonce replay detected locally');
      return NextResponse.json({ ok: false, error: 'Nonce expired or already used.' }, { status: 401 });
    }

    // 2. Distributed single-use check across replicas. The nonce cookie is
    //    MAC-sealed, so the server already knows it issued this nonce; Redis
    //    only has to record that it has now been used. SET NX succeeds once.
    //    Before, verify required the nonce to have been *stored* in Redis when
    //    it was issued: whenever that write failed (Redis connecting after a
    //    cold start, a blip, or the in-memory fallback on another replica),
    //    every sign-in failed with "Nonce expired or already used".
    try {
      const redis = await getRedisClient();
      const firstUse = await redis.set(`siwe:used:${nonce}`, '1', 'EX', NONCE_TTL_SEC, 'NX');
      if (firstUse === null) {
        logger.warn('[SIWE] Nonce replay detected in Redis');
        return NextResponse.json({ ok: false, error: 'Nonce expired or already used.' }, { status: 401 });
      }
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
    let { data: fields, error: siweErr } = await siweMessage.verify(
      { signature, nonce, domain },
      { suppressExceptions: true },
    );

    // Smart-contract wallets (Safe, Coinbase Smart Wallet, Argent...) sign with
    // ERC-1271 / ERC-6492, which the EOA check above cannot verify. Only when
    // everything but the signature matched, ask the wallet's own chain.
    if (siweErr && (siweErr as any)?.type === SiweErrorType.INVALID_SIGNATURE) {
      const ok = await verifyContractWalletSiwe({
        chainId: siweMessage.chainId,
        address: siweMessage.address,
        message: typeof message === 'string' ? message : siweMessage.prepareMessage(),
        signature,
      });
      if (ok) {
        fields = siweMessage;
        siweErr = undefined as any;
      }
    }

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
            type === SiweErrorType.DOMAIN_MISMATCH
              ? 'Domain mismatch between the signed message and this server.'
              : type === SiweErrorType.NONCE_MISMATCH
                ? 'Nonce mismatch — request a new sign-in.'
                : type === SiweErrorType.EXPIRED_MESSAGE
                  ? 'Signature challenge expired — request a new sign-in.'
                  : type === SiweErrorType.NOT_YET_VALID_MESSAGE
                    ? 'Signature not yet valid — check your device clock.'
                    : 'Invalid signature.',
          detail: type ?? 'unknown',
        },
        { status: 401 },
      );
    }

    // Any EVM chain id is accepted. An EOA signature does not depend on the
    // chain, and the wallet modal offers chains (BNB, Linea, Avalanche,
    // zkSync, World Chain, ...) that an older allow-list here rejected with
    // "Unsupported chain", so wallets on those networks could not sign in.
    if (!Number.isSafeInteger(fields.chainId) || fields.chainId <= 0) {
      return NextResponse.json({ ok: false, error: 'The signed message has no valid chain id.' }, { status: 401 });
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
