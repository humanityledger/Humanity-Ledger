import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';

export const dynamic = 'force-dynamic';

const ETH_ADDR_REGEX = /^0x[a-fA-F0-9]{40}$/;

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

// POST: Store a message in the offline queue (sender → recipient)
export async function POST(req: NextRequest) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const address = auth.walletAddress;

    const body = await req.json();
    const { recipient, content } = body;

    if (!recipient || !content) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    if (!ETH_ADDR_REGEX.test(recipient)) {
      return NextResponse.json({ error: 'Invalid recipient address' }, { status: 400 });
    }
    if (typeof content !== 'string' || content.trim().length === 0 || content.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Invalid content (max 10MB)' }, { status: 400 });
    }

    const msg = await prisma.pendingChatMessage.create({
      data: {
        sender: address.toLowerCase(),
        recipient: recipient.toLowerCase(),
        content: content.trim(),
      },
    });

    return NextResponse.json({ success: true, id: msg.id });
  } catch (e) {
    console.error('[queue POST]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
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
