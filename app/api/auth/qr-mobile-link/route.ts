import { NextRequest, NextResponse } from 'next/server';
import { mintJWT } from '@/lib/jwt';
import { safeRedisSet } from '@/lib/redis/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uuid, encryptedPayload, iv, tag, mobilePub, isServerMint } = body;

    if (!uuid || typeof uuid !== 'string' || uuid.length < 8) {
      return NextResponse.json({ error: 'Missing or invalid uuid' }, { status: 400 });
    }
    if (!mobilePub) {
      return NextResponse.json({ error: 'Missing mobilePub' }, { status: 400 });
    }
    if (!isServerMint && (!encryptedPayload || !iv)) {
      return NextResponse.json({ error: 'Missing encrypted payload fields' }, { status: 400 });
    }

    const humanSession = req.cookies.get('human_session')?.value || req.cookies.get('ledger_session')?.value;

    if (!humanSession) {
      return NextResponse.json(
        { error: 'Session unauthenticated. Sign the cryptographic message in your wallet first.' },
        { status: 401 }
      );
    }

    let walletAddress: string | null = null;

    try {
      const { verifyJWT } = await import('@/lib/jwt');
      const payload = await verifyJWT(humanSession);
      walletAddress = (payload.sub as string) || (payload.address as string) || null;
      if (!walletAddress) {
        throw new Error('JWT payload missing address');
      }
    } catch (err: any) {
      return NextResponse.json({ error: 'Invalid or expired session. Please reconnect.' }, { status: 401 });
    }

    const { prisma } = await import('@/lib/prisma');
    const existingUser = await prisma.user.upsert({
      where: { walletAddress: walletAddress.toLowerCase() },
      update: { lastActive: new Date() },
      create: {
        walletAddress: walletAddress.toLowerCase(),
        tier: 'INITIATE',
        lastActive: new Date()
      }
    });

    const crypto = await import('crypto');
    const cryptographicNonce = crypto.randomBytes(32).toString('hex');

    const jwt = await mintJWT({
      sub: walletAddress,
      address: walletAddress,
      clearance: 'Private',
      tier: existingUser?.tier || 'FREE',
      kycStatus: 'UNVERIFIED',
      humanityScore: existingUser?.humanityScore || 0,
      iss: 'humanity-ledger',
      source: 'qr-mobile-handshake',
      nonce: cryptographicNonce,
      issuedAt: new Date().toISOString()
    });

    let sessionPayload: string;

    if (!isServerMint && encryptedPayload && iv) {
      sessionPayload = JSON.stringify({
        serverSignedJwt: jwt,
        encryptedPayload,
        iv,
        tag: tag || null,
        mobilePub,
      });
    } else {
      return NextResponse.json(
        { error: 'Insecure handshake mode rejected. Please update your mobile app.' },
        { status: 403 }
      );
    }

    await safeRedisSet(`qr-session:${uuid}`, sessionPayload, 'EX', 300);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const cookieDomain = (process.env.NODE_ENV === 'production' && appUrl)
        ? (() => { try { return new URL(appUrl).hostname; } catch { return undefined; } })()
        : undefined;
    const response = NextResponse.json({ success: true });
    response.cookies.set('human_session', jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 604800,
      path: '/',
      domain: cookieDomain,
    });

    return response;

  } catch (e: any) {
    console.error('[QRMobileLink] Error:', e?.message);
    return NextResponse.json({ error: 'Server error during mobile QR link' }, { status: 500 });
  }
}
