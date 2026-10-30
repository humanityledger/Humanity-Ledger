import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('hl_session')?.value
      ?? cookieStore.get('humanity_session')?.value
      ?? cookieStore.get('ledger_session')?.value
      ?? cookieStore.get('human_session')?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    let sessionId;
    try {
      const { verifyJWT } = await import('@/lib/jwt');
      const payload = await verifyJWT(token);
      sessionId = (payload.sessionId ?? payload.sid) as string;
    } catch {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const session = await prisma.humanitySession.findUnique({
      where: { sessionId },
      include: { identity: true }
    });

    if (!session || session.expiresAt < new Date() || session.revokedAt) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Update lastSeenAt asynchronously
    prisma.humanitySession.update({
      where: { sessionId },
      data: { lastSeenAt: new Date() }
    }).catch(() => {});

    return NextResponse.json({
      authenticated: true,
      identity: {
        id: session.identity.id,
        address: session.identity.walletAddress,
        permissions: session.identity.permissions,
        type: session.identity.walletType,
        verified: session.identity.verificationStatus
      },
      session: {
        id: session.sessionId,
        method: session.authenticationMethod,
        expiresAt: session.expiresAt
      }
    });

  } catch (error: any) {
    console.error('[SIWE-SESSION] Error:', error.message);
    return NextResponse.json({ authenticated: false, error: 'Internal server error' }, { status: 500 });
  }
}
