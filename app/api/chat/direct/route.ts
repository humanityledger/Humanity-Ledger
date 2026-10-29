import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat/direct?since=<timestamp_ms>
 * Poll for new messages addressed to the current user.
 * Returns undelivered messages, then marks them delivered.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const address = auth.walletAddress;

    const sinceParam = req.nextUrl.searchParams.get('since');
    const since = sinceParam ? new Date(parseInt(sinceParam, 10)) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Fetch undelivered messages for me — no time filter so nothing is missed
    const undeliveredMessages = await prisma.directMessage.findMany({
      where: {
        recipient: address,
        delivered: false,
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    // Also fetch recent messages (both delivered and not) in the time window for reconnect sync
    const recentMessages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { recipient: address, createdAt: { gte: since } },
          // Also return messages I sent (so sender sees their own messages in history)
          { sender: address, createdAt: { gte: since } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    // Merge: undelivered + recent, deduplicated by ID
    const allById = new Map<string, typeof undeliveredMessages[0]>();
    for (const m of undeliveredMessages) allById.set(m.id, m);
    for (const m of recentMessages) allById.set(m.id, m);
    const messages = Array.from(allById.values()).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // Mark undelivered ones as delivered now that we're returning them
    const toMarkDelivered = undeliveredMessages.map(m => m.id);
    if (toMarkDelivered.length > 0) {
      await prisma.directMessage.updateMany({
        where: { id: { in: toMarkDelivered } },
        data: { delivered: true, deliveredAt: new Date() },
      }).catch(() => {});
    }

    return NextResponse.json({
      messages: messages.map(m => ({
        id: m.id,
        sender: m.sender,
        recipient: m.recipient,
        content: m.content,
        createdAt: m.createdAt.getTime(),
        delivered: m.delivered,
      })),
    });
  } catch (e) {
    console.error('[chat/direct GET]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/chat/direct — retired 29 October 2026.
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
