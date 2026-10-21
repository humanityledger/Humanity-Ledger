import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';
import { safeRedisGet, safeRedisSet } from '@/lib/redis';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/presence
 * G-004: Presence in Redis (TTL 120s), zero PostgreSQL writes.
 * A-025: Presence uses the session address ONLY.
 * A-025: Peer presence is only returned to accepted contacts (403 for non-contacts).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const callerAddress = auth.walletAddress.toLowerCase();

    const body = await req.json().catch(() => ({}));
    const { peerAddress } = body;

    // G-004: Store presence in Redis with 120s TTL (eliminates Postgres write bottleneck)
    const now = Date.now();
    await safeRedisSet(`presence:${callerAddress}`, String(now), 'EX', 120);

    // Fetch peer presence if requested
    if (peerAddress && /^0x[a-fA-F0-9]{40}$/.test(peerAddress)) {
      const normalizedPeer = peerAddress.toLowerCase();

      // Verify contact relationship
      const isContact = await prisma.chatContact.findUnique({
        where: { owner_peer: { owner: callerAddress, peer: normalizedPeer } },
        select: { owner: true },
      }).catch(() => null);

      if (!isContact) {
        return NextResponse.json(
          { error: 'Forbidden: Can only check presence of accepted contacts' },
          { status: 403 }
        );
      }

      // Check Redis for peer presence
      const peerActiveStr = await safeRedisGet(`presence:${normalizedPeer}`);
      const lastActiveAt = peerActiveStr && peerActiveStr !== 'TIMEOUT' ? Number(peerActiveStr) : null;

      return NextResponse.json({ lastActiveAt });
    }

    return NextResponse.json({ success: true, lastActiveAt: now });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
