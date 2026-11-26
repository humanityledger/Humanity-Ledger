import { NextRequest, NextResponse } from 'next/server';
import * as prismaModule from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';
import { blockedCounterparties } from '@/lib/chat/blockFirewall';
import { safeRedisGet, safeRedisSet, safeRedisDel } from '@/lib/redis/client';

export const dynamic = 'force-dynamic';

function getQueueReadDb() {
  return Object.prototype.hasOwnProperty.call(prismaModule, 'prismaRead')
    ? (prismaModule as { prismaRead?: typeof prismaModule.prisma }).prismaRead ?? prismaModule.prisma
    : prismaModule.prisma;
}

const EMPTY_QUEUE_TTL_S = 15;
const emptyQueueKey = (addr: string) => `chat:queue:empty:v1:${addr}`;

// GET: Fetch pending messages for the recipient.
// DOES NOT delete them — client must call DELETE with IDs after successful processing.
// This guarantees messages are never lost even if the client disconnects mid-processing.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const address = auth.walletAddress;

    const normalized = address.toLowerCase();
    const useEmptyCache = process.env.NODE_ENV !== 'test';
    if (useEmptyCache) {
      const emptyMarker = await safeRedisGet(emptyQueueKey(normalized));
      if (emptyMarker === '1') {
        return NextResponse.json({ messages: [] });
      }
    }

    let messages: any[] = [];
    try {
      messages = await getQueueReadDb().pendingChatMessage.findMany({
        where: { recipient: normalized },
        orderBy: { createdAt: 'asc' },
        take: 200, // Safety cap
      });

      if (useEmptyCache && messages.length === 0) {
        await safeRedisSet(emptyQueueKey(normalized), '1', 'EX', EMPTY_QUEUE_TTL_S);
      }

      // Bulk retention sweeps are handled asynchronously by scripts/db-maintenance.mjs;
      // only run a rare non-blocking opportunistic clean (0.5%) so reads never queue behind deletes.
      if (messages.length > 0 && Math.random() < 0.005) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        void prismaModule.prisma.pendingChatMessage
          .deleteMany({
            where: { recipient: normalized, createdAt: { lt: sevenDaysAgo } },
          })
          .catch(() => {});
      }
    } catch (dbErr: any) {
      console.warn('[queue GET] Database unavailable, returning empty queue.');
      return NextResponse.json({ messages: [] });
    }

    // Nothing crosses a block, in either direction (lib/chat/blockFirewall.ts).
    if (messages.length > 0) {
      const hidden = await blockedCounterparties(normalized);
      if (hidden.size) messages = messages.filter(m => !hidden.has(String(m.sender ?? '').toLowerCase()));
    }
    return NextResponse.json({ messages });
  } catch (e) {
    console.error('[queue GET]', e);
    return NextResponse.json({ messages: [] });
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
      await prismaModule.prisma.pendingChatMessage.deleteMany({
        where: { recipient: address.toLowerCase() },
      });
      await safeRedisDel(emptyQueueKey(address.toLowerCase()));
    } else {
      // Delete only the specified message IDs (safe: only deletes if recipient matches)
      await prismaModule.prisma.pendingChatMessage.deleteMany({
        where: {
          id: { in: ids },
          recipient: address.toLowerCase(),
        },
      });
      await safeRedisDel(emptyQueueKey(address.toLowerCase()));
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[queue DELETE]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
