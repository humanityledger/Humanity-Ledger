import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Primary: JWT cookie session
    let address: string | null = null;
    try {
      const session = await require('@/lib/session').getSession();
      address = session?.userId ?? null;
    } catch {}
    // Secondary fallback: x-web3-address header (used by XMTP client background sync)
    if (!address) {
      const headerAddr = req.headers.get('x-web3-address');
      if (headerAddr && /^0x[0-9a-fA-F]{40}$/.test(headerAddr)) {
        address = headerAddr.toLowerCase();
      }
    }
    if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const normalized = address.toLowerCase();
    const messages = await prisma.pendingChatMessage.findMany({
      where: { recipient: normalized },
      orderBy: { createdAt: 'asc' }
    });
    // Delete them after fetching
    if (messages.length > 0) {
      await prisma.pendingChatMessage.deleteMany({
        where: { recipient: normalized }
      });
    }
    return NextResponse.json({ messages });
  } catch (e) {
    console.error('[queue GET]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let address: string | null = null;
    try {
      const session = await require('@/lib/session').getSession();
      address = session?.userId ?? null;
    } catch {}
    if (!address) {
      const headerAddr = req.headers.get('x-web3-address');
      if (headerAddr && /^0x[0-9a-fA-F]{40}$/.test(headerAddr)) {
        address = headerAddr.toLowerCase();
      }
    }
    if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { recipient, content } = await req.json();
    if (!recipient || !content) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const msg = await prisma.pendingChatMessage.create({
      data: {
        sender: address.toLowerCase(),
        recipient: recipient.toLowerCase(),
        content
      }
    });
    return NextResponse.json({ success: true, id: msg.id });
  } catch (e) {
    console.error('[queue POST]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
