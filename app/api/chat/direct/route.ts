import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

import { resolveVerifiedCaller } from '@/lib/security/resolveCaller';

const ETH_ADDR_REGEX = /^0x[a-fA-F0-9]{40}$/;

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat/direct?since=<timestamp_ms>
 * Poll for new messages addressed to the current user.
 * Returns undelivered messages, then marks them delivered.
 */
export async function GET(req: NextRequest) {
  try {
    let address = await resolveVerifiedCaller(req);
    if (!address) {
      const headerAddr = req.headers.get('x-web3-address') || req.headers.get('x-verified-session-address');
      const searchAddr = req.nextUrl.searchParams.get('address');
      const candidate = headerAddr || searchAddr;
      if (candidate && ETH_ADDR_REGEX.test(candidate)) {
        address = candidate.toLowerCase();
      }
    }
    if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sinceParam = req.nextUrl.searchParams.get('since');
    const since = sinceParam ? new Date(parseInt(sinceParam, 10)) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Fetch both undelivered AND recent delivered (last 7 days) for reconnect sync
    const messages = await prisma.directMessage.findMany({
      where: {
        recipient: address,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    // Mark undelivered ones as delivered
    const undeliveredIds = messages.filter(m => !m.delivered && m.recipient === address).map(m => m.id);
    if (undeliveredIds.length > 0) {
      await prisma.directMessage.updateMany({
        where: { id: { in: undeliveredIds } },
        data: { delivered: true, deliveredAt: new Date() },
      });
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

/**
 * POST /api/chat/direct
 * Send a direct message to another user (DB-backed, no XMTP required).
 * Body: { recipient: string, content: string }
 */
export async function POST(req: NextRequest) {
  try {
    let address = await resolveVerifiedCaller(req);
    if (!address) {
      // Fallback for wallet-connect users who don't have a session cookie
      const headerAddr = req.headers.get('x-web3-address') || req.headers.get('x-verified-session-address');
      if (headerAddr && ETH_ADDR_REGEX.test(headerAddr)) {
        address = headerAddr.toLowerCase();
      }
    }
    if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { recipient, content } = body;

    if (!recipient || !content) {
      return NextResponse.json({ error: 'recipient and content are required' }, { status: 400 });
    }
    if (!/^0x[0-9a-fA-F]{40}$/i.test(recipient)) {
      return NextResponse.json({ error: 'Invalid recipient address' }, { status: 400 });
    }
    if (typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content cannot be empty' }, { status: 400 });
    }
    if (content.length > 65536) {
      return NextResponse.json({ error: 'Content too long (max 64KB)' }, { status: 400 });
    }

    const msg = await prisma.directMessage.create({
      data: {
        sender: address,
        recipient: recipient.toLowerCase(),
        content: content.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      id: msg.id,
      createdAt: msg.createdAt.getTime(),
    });
  } catch (e) {
    console.error('[chat/direct POST]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
