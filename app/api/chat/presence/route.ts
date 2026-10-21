import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';

export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/presence
 * A-025: Presence uses the session address ONLY (not the `address` from the request body).
 * A-025: Peer presence is only returned to accepted contacts (403 for non-contacts).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    // A-025: Always use the session address — never the `address` field from the body
    const callerAddress = auth.walletAddress;

    const body = await req.json().catch(() => ({}));
    const { peerAddress } = body;

    // Update MY lastActiveAt — using the verified session address only
    await prisma.userMetrics.upsert({
      where: { userAddress: callerAddress },
      update: { lastActiveAt: new Date() },
      create: { userAddress: callerAddress, lastActiveAt: new Date() },
    }).catch(() => {}); // Non-fatal: if table doesn't exist yet

    // Fetch peer's lastActiveAt — only if peerAddress is a known contact
    if (peerAddress && /^0x[a-fA-F0-9]{40}$/.test(peerAddress)) {
      const normalizedPeer = peerAddress.toLowerCase();

      // A-025: Verify the caller is an accepted contact of the peer before revealing presence
      const isContact = await prisma.chatContact.findUnique({
        where: { owner_peer: { owner: callerAddress, peer: normalizedPeer } },
        select: { owner: true },
      }).catch(() => null);

      if (!isContact) {
        // Peer not in caller's contact list — 403 to prevent presence probing
        return NextResponse.json(
          { error: 'Forbidden: Can only check presence of accepted contacts' },
          { status: 403 }
        );
      }

      const peer = await prisma.userMetrics.findUnique({
        where: { userAddress: normalizedPeer },
        select: { lastActiveAt: true },
      }).catch(() => null);

      return NextResponse.json({ lastActiveAt: peer?.lastActiveAt?.getTime() || null });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
