import { NextRequest, NextResponse } from 'next/server';
import { requireWallet } from '@/lib/security/requireWallet';

/**
 * POST /api/call/token
 * 
 * Issues a short-lived LiveKit JWT for authenticated community members.
 * Requires: session (401), community membership (403).
 * Token is valid for 10 minutes.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await requireWallet(req);
    if (caller.errorResponse) return caller.errorResponse;

    const { communityId, roomName } = await req.json();
    if (!communityId || !roomName) {
      return NextResponse.json({ error: 'communityId and roomName are required' }, { status: 400 });
    }

    // Verify LiveKit credentials are configured
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Call infrastructure not configured. Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET.' },
        { status: 503 }
      );
    }

    // TODO: Verify community membership in DB
    // const member = await prisma.communityMember.findFirst({
    //   where: { communityId, walletAddress: caller.walletAddress }
    // });
    // if (!member) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    // Generate LiveKit access token
    // Requires: npm install livekit-server-sdk
    // const { AccessToken } = await import('livekit-server-sdk');
    // const token = new AccessToken(apiKey, apiSecret, {
    //   identity: caller.walletAddress,
    //   ttl: '10m',
    // });
    // token.addGrant({ roomJoin: true, room: roomName });
    // const jwt = await token.toJwt();

    // Stub response until livekit-server-sdk is installed
    return NextResponse.json({
      error: 'LiveKit token generation requires livekit-server-sdk package. Install it to enable calls.',
      hint: 'npm install livekit-server-sdk'
    }, { status: 501 });

  } catch (e: any) {
    if (e.status === 401 || e.status === 403) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('[call/token]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
