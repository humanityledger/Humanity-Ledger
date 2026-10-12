import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveVerifiedCaller } from '@/lib/security/resolveCaller';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const address = await resolveVerifiedCaller(req);
    if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const normalized = address.toLowerCase();
    const messages = await prisma.pendingChatMessage.findMany({
      where: { recipient: normalized },
      orderBy: { createdAt: 'asc' }
    });
    if (messages.length > 0) {
      await prisma.pendingChatMessage.deleteMany({ where: { recipient: normalized } });
    }
    return NextResponse.json({ messages });
  } catch (e) {
    console.error('[queue GET]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const address = await resolveVerifiedCaller(req);
    if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { recipient, content } = await req.json();
    if (!recipient || !content) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const ETH_ADDR_REGEX = /^0x[a-fA-F0-9]{40}$/;
    if (!ETH_ADDR_REGEX.test(recipient)) {
      return NextResponse.json({ error: 'Invalid recipient address' }, { status: 400 });
    }
    if (typeof content !== 'string' || content.trim().length === 0 || content.length > 65536) {
      return NextResponse.json({ error: 'Invalid content (max 64KB)' }, { status: 400 });
    }

    const msg = await prisma.pendingChatMessage.create({
      data: {
        sender: address.toLowerCase(),
        recipient: recipient.toLowerCase(),
        content: content.trim()
      }
    });
    return NextResponse.json({ success: true, id: msg.id });
  } catch (e) {
    console.error('[queue POST]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
