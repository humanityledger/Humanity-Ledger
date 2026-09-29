import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

async function resolveCaller(req: NextRequest) {
  const verified = req.headers.get('x-verified-session-address');
  if (verified) return verified.toLowerCase();
  const session = await getSession();
  if (session?.userId) return session.userId.toLowerCase();
  return req.headers.get('x-web3-address')?.toLowerCase();
}

// GET /api/chat/updates
// Fetch my updates AND updates from my contacts
export async function GET(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Find all my contacts
    const contacts = await (prisma as any).chatContact.findMany({
      where: { owner_peer: { owner: caller } },
      select: { peer: true }
    });
    const contactAddresses = contacts.map((c: any) => c.peer);

    // Get active updates (not expired)
    const now = new Date();
    const updates = await (prisma as any).statusUpdate.findMany({
      where: {
        expiresAt: { gt: now },
        OR: [
          { ownerAddress: caller }, // My own
          { ownerAddress: { in: contactAddresses }, privacy: { in: ['everyone', 'contacts'] } },
          { privacy: 'everyone' }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return NextResponse.json({ updates });
  } catch (error: any) {
    console.error('[Updates API]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/chat/updates
// Create a new status update
export async function POST(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { text, emoji, privacy } = await req.json();
    if (!text) return NextResponse.json({ error: 'Text required' }, { status: 400 });

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const update = await (prisma as any).statusUpdate.create({
      data: {
        ownerAddress: caller,
        text,
        emoji,
        privacy: privacy || 'contacts',
        expiresAt
      }
    });

    return NextResponse.json({ update });
  } catch (error: any) {
    console.error('[Updates POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
