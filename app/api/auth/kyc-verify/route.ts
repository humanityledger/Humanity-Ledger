import { NextRequest, NextResponse } from 'next/server';
import { verifyMessage } from 'viem';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/security/rateLimiter';

/**
 * POST /api/auth/kyc-verify
 *
 * Records that the signed-in wallet completed the on-device liveness check
 * and signed the attestation message.
 *
 * Security (2026-10-28): this used to set isZkVerified = true and add 100 to
 * humanityScore on every call. The only inputs are a message the caller
 * writes and signs with their own wallet, so anyone could mark themselves a
 * verified human (the badge other people see next to a name) and raise their
 * score without limit. A liveness result computed in the browser proves
 * nothing to the server. Verified status now comes only from a provider the
 * server can check (the Sumsub webhook).
 */
export async function POST(req: NextRequest) {
  try {
    const { getSession } = await import('@/lib/session');
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'UNAUTHORIZED: Cryptographic session required.' }, { status: 401 });
    }

    const rl = await checkRateLimit(session.userId, { max: 5, windowSec: 3600, prefix: 'rl:kyc-verify' });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const { address, signature, message } = body ?? {};
    if (typeof address !== 'string' || typeof signature !== 'string' || typeof message !== 'string' || message.length > 2_000) {
      return NextResponse.json({ error: 'Missing cryptographic verification data' }, { status: 400 });
    }
    if (address.toLowerCase() !== session.userId.toLowerCase()) {
      return NextResponse.json({ error: 'FORBIDDEN: Address mismatch with session.' }, { status: 403 });
    }
    if (!message.startsWith('System KYC Attestation') || !message.includes(`Identity: ${address}`)) {
      return NextResponse.json({ error: 'FORBIDDEN: Invalid attestation message.' }, { status: 403 });
    }

    const isValid = await verifyMessage({ address: address as `0x${string}`, message, signature: signature as `0x${string}` });
    if (!isValid) {
      return NextResponse.json({ error: 'Cryptographic binding failed' }, { status: 401 });
    }

    const normalizedAddress = address.toLowerCase();
    await prisma.user.upsert({
      where: { walletAddress: normalizedAddress },
      update: { lastActive: new Date() },
      create: { walletAddress: normalizedAddress, tier: 'INITIATE', lastActive: new Date() },
    });

    return NextResponse.json({
      success: true,
      status: 'ATTESTED',
      user: { address: normalizedAddress },
    });
  } catch (error: any) {
    console.error('[KYC:Fatal]', error?.message);
    return NextResponse.json({ error: 'Identity Engine Failure' }, { status: 500 });
  }
}
