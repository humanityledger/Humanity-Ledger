import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';

export const dynamic = 'force-dynamic';

// GET: Fetch pending messages for the recipient.
// DOES NOT delete them — client must call DELETE with IDs after successful processing.
// This guarantees messages are never lost even if the client disconnects mid-processing.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const address = auth.walletAddress;

    const normalized = address.toLowerCase();
    const messages = await prisma.pendingChatMessage.findMany({
      where: { recipient: normalized },
      orderBy: { createdAt: 'asc' },
      take: 200, // Safety cap
    });

    // Auto-clean messages older than 7 days (stale, recipient never came online)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await prisma.pendingChatMessage.deleteMany({
      where: { recipient: normalized, createdAt: { lt: sevenDaysAgo } },
    }).catch(() => {});

    return NextResponse.json({ messages });
  } catch (e) {
    console.error('[queue GET]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/chat/queue — retired 29 October 2026.
//
// Nothing in this repository sends here any more (direct messages travel over
// XMTP; onion deliveries are queued in process by lib/chat/onionQueue.ts). As
// an open endpoint it let any signed-in account write up to 10 MB per message,
// 90 times a minute, into anyone's inbox, stored readable in PostgreSQL. The
// read side stays so rows already stored can still be fetched and cleared.
export async function POST() {
  return NextResponse.json(
    { error: 'Gone', message: 'Direct messages are sent over XMTP. This endpoint no longer accepts messages.' },
    { status: 410 },
  );
}

// DELETE: Acknowledge delivery — called by recipient after successfully processing messages.
// Body: { ids: string[] }
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const address = auth.walletAddress;

    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [];

    if (ids.length === 0) {
      // Delete ALL pending messages for this recipient (bulk ack)
      await prisma.pendingChatMessage.deleteMany({
        where: { recipient: address.toLowerCase() },
      });
    } else {
      // Delete only the specified message IDs (safe: only deletes if recipient matches)
      await prisma.pendingChatMessage.deleteMany({
        where: {
          id: { in: ids },
          recipient: address.toLowerCase(),
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[queue DELETE]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
