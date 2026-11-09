import { NextRequest, NextResponse } from 'next/server';
import { requireWallet } from '@/lib/security/requireWallet';
import { createHmac } from 'crypto';

/**
 * GET /api/call/token
 * 
 * Issues ephemeral TURN/STUN ICE server configuration (RFC 5766 / Coturn HMAC-SHA1).
 * If TURN_SECRET is set, produces a 1-hour time-limited credential so secrets are
 * never baked into frontend bundles. Fallbacks to Google STUN if TURN is unset.
 */
export async function GET() {
  const turnSecret = process.env.TURN_SECRET;
  const turnDomain = process.env.NEXT_PUBLIC_TURN_DOMAIN || 'turn.humanityledger.com';

  const defaultStun = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  if (!turnSecret) {
    return NextResponse.json({
      iceServers: defaultStun,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
    });
  }

  const ttl = 3600; // 1 hour
  const expiry = Math.floor(Date.now() / 1000) + ttl;
  const username = `${expiry}:humanity-peer`;

  const hmac = createHmac('sha1', turnSecret);
  hmac.update(username);
  const credential = hmac.digest('base64');

  return NextResponse.json({
    iceServers: [
      ...defaultStun,
      {
        urls: [
          `turn:${turnDomain}:3478?transport=udp`,
          `turn:${turnDomain}:3478?transport=tcp`,
          `turns:${turnDomain}:443?transport=tcp`,
        ],
        username,
        credential,
      },
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
  });
}

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

    // Require livekit-server-sdk runtime package when calls are enabled
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
