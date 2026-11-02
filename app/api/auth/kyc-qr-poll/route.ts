import { NextRequest, NextResponse } from 'next/server';
import { safeRedisGet, safeRedisSet } from '@/lib/redis/client';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/auth/kyc-qr-poll?uuid={uuid}&walletAddress={addr}
 *
 * Long-poll endpoint called by the PC every 2s to check if the
 * mobile device has completed the biometric KYC.
 *
 * Flow:
 *   PENDING  mobile hasn't completed yet
 *   SUCCESS + ciphertext  mobile completed, desktop decrypts and hydrates
 *   BURNED   already consumed (replay protection)
 *   EXPIRED  TTL hit, session is gone
 */
export async function GET(req: NextRequest) {
  try {
    const uuid = req.nextUrl.searchParams.get('uuid');

    const { getSession } = await import('@/lib/session');
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.userId) {
        return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }
    const walletAddress = sessionCookie.userId;

    if (!uuid) {
      return NextResponse.json({ error: 'Session UUID required' }, { status: 400 });
    }

    const raw = await safeRedisGet(`kyc-session:${uuid}`);

    // Session expired or never existed
    if (!raw) {
      return NextResponse.json({ status: 'EXPIRED' });
    }

    // Already consumed (burn-after-read replay protection)
    if (raw === 'BURNED') {
      return NextResponse.json({ status: 'BURNED' }, { status: 403 });
    }

    // Parse stored session
    let session: Record<string, any>;
    try {
      session = JSON.parse(raw);
    } catch {
      return NextResponse.json({ status: 'PENDING' });
    }

    // Still waiting for mobile
    if (session.status === 'PENDING') {
      return NextResponse.json({ status: 'PENDING' });
    }

    //  Mobile has completed KYC 
    if (session.status === 'VERIFIED') {
      const { livenessScore, spoofType, encryptedPayload, ekey } = session;

      // Validate liveness score meets threshold
      if (!livenessScore || livenessScore < 72) {
        return NextResponse.json({ status: 'PENDING' }); // still processing
      }

      // Burn-after-read: mark as consumed immediately
      await safeRedisSet(`kyc-session:${uuid}`, 'BURNED', 'EX', 30);

      // [SECURITY 2026-10-28] Completing this flow no longer marks the account as
      // a verified human, adds to humanityScore or issues a new session. The
      // liveness score is reported by the phone itself (kyc-qr-session takes it
      // from the request body), so anyone could post a perfect score and get
      // the "verified" badge. Verified status comes only from a provider the
      // server can check (webhooks/sumsub).
      if (walletAddress) {
        await prisma.user.upsert({
          where: { walletAddress: walletAddress.toLowerCase() },
          update: { lastActive: new Date() },
          create: { walletAddress: walletAddress.toLowerCase(), tier: 'INITIATE', lastActive: new Date() },
        }).catch(() => {});
      }

      return NextResponse.json({
        status: 'SUCCESS',
        livenessScore,
        encryptedPayload,
        ekey,
      });
    }

    return NextResponse.json({ status: 'PENDING' });
  } catch (err: any) {
    console.error('[KYC:Poll] Error:', err);
    return NextResponse.json({ error: 'Polling fault' }, { status: 500 });
  }
}
