import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ETH_ADDR_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * Resolve the authenticated address from session OR x-web3-address header fallback.
 * This allows WalletConnect-only users (no server session cookie) to read their own
 * contact list immediately after connecting their wallet.
 */
async function resolveUserId(req: NextRequest, queryAddress: string | null): Promise<string | null> {
  try {
    const session = await getSession();
    if (session?.userId && ETH_ADDR_REGEX.test(session.userId)) return session.userId.toLowerCase();
  } catch {}

  const verifiedHeader = req.headers.get('x-verified-session-address');
  if (verifiedHeader && ETH_ADDR_REGEX.test(verifiedHeader)) return verifiedHeader.toLowerCase();

  const web3Address = req.headers.get('x-web3-address');
  if (web3Address && ETH_ADDR_REGEX.test(web3Address)) return web3Address.toLowerCase();

  if (queryAddress && ETH_ADDR_REGEX.test(queryAddress)) return queryAddress.toLowerCase();

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address')?.toLowerCase() ?? null;

    const userId = await resolveUserId(req, address);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!address || address !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const contacts = await prisma.chatContact.findMany({
      where: { owner: address },
      orderBy: { updatedAt: 'desc' }
    });

    return NextResponse.json({ peers: contacts.map(c => c.peer) });
  } catch (error) {
    console.error('[Chat Contacts] Error fetching:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const qAddress = searchParams.get('address')?.toLowerCase() ?? null;

    const userId = await resolveUserId(req, qAddress);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { address, peers } = await req.json();

    if (!address || !peers || !Array.isArray(peers)) {
      return NextResponse.json({ error: 'Missing or invalid parameters' }, { status: 400 });
    }

    if (address.toLowerCase() !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const owner = address.toLowerCase();

    await prisma.$transaction(
      peers.map((peerAddr: string) => {
        const peer = peerAddr.toLowerCase();
        return prisma.chatContact.upsert({
          where: { owner_peer: { owner, peer } },
          update: { updatedAt: new Date() },
          create: { owner, peer }
        });
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Chat Contacts] Error saving:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
