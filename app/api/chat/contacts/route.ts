import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const callerAddress = auth.walletAddress;

    const { searchParams } = new URL(req.url);
    const queryAddress = searchParams.get('address')?.toLowerCase();
    if (queryAddress && queryAddress !== callerAddress) {
      return NextResponse.json({ error: 'Forbidden: Cannot access contacts for another address' }, { status: 403 });
    }

    const contacts = await prisma.chatContact.findMany({
      where: { owner: callerAddress },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ peers: contacts.map(c => c.peer) });
  } catch (error) {
    console.error('[Chat Contacts] Error fetching:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const callerAddress = auth.walletAddress;

    const { searchParams } = new URL(req.url);
    const queryAddress = searchParams.get('address')?.toLowerCase();
    if (queryAddress && queryAddress !== callerAddress) {
      return NextResponse.json({ error: 'Forbidden: Cannot modify contacts for another address' }, { status: 403 });
    }

    const body = await req.json();
    const { address, peers } = body;

    if (!peers || !Array.isArray(peers)) {
      return NextResponse.json({ error: 'Missing or invalid parameters' }, { status: 400 });
    }

    if (address && address.toLowerCase() !== callerAddress) {
      return NextResponse.json({ error: 'Forbidden: Cannot modify contacts for another address' }, { status: 403 });
    }

    const owner = callerAddress;

    await prisma.$transaction(
      peers.map((peerAddr: string) => {
        const peer = peerAddr.toLowerCase();
        return prisma.chatContact.upsert({
          where: { owner_peer: { owner, peer } },
          update: { updatedAt: new Date() },
          create: { owner, peer },
        });
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Chat Contacts] Error saving:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
