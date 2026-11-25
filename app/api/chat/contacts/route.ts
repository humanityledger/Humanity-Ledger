import { NextRequest, NextResponse } from 'next/server';
import { prisma, prismaRead } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';
import { safeRedisGet, safeRedisSet } from '@/lib/redis';

export const dynamic = 'force-dynamic';

const CONTACTS_CACHE_TTL_S = 60;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const callerAddress = auth.walletAddress.toLowerCase();

    const { searchParams } = new URL(req.url);
    const queryAddress = searchParams.get('address')?.toLowerCase();
    if (queryAddress && queryAddress !== callerAddress) {
      return NextResponse.json({ error: 'Forbidden: Cannot access contacts for another address' }, { status: 403 });
    }

    const rawLimit = Number(searchParams.get('limit') || '500');
    const take = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(1000, Math.floor(rawLimit)) : 500;
    const cacheKey = `contacts:peers:${callerAddress}:${take}`;
    const cached = await safeRedisGet(cacheKey);
    if (cached && cached !== 'TIMEOUT') {
      try {
        const peers = JSON.parse(cached);
        if (Array.isArray(peers)) return NextResponse.json({ peers });
      } catch {}
    }

    try {
      const dbRead = prismaRead ?? prisma;
      const contacts = await dbRead.chatContact.findMany({
        where: { owner: callerAddress },
        orderBy: { updatedAt: 'desc' },
        select: { peer: true },
        take,
      });
      const peers = contacts.map((c: { peer: string }) => c.peer.toLowerCase());
      await safeRedisSet(cacheKey, JSON.stringify(peers), 'EX', CONTACTS_CACHE_TTL_S);
      return NextResponse.json({ peers });
    } catch (dbError: any) {
      console.warn('[Chat Contacts] Database offline or unavailable, returning empty contacts list.');
      return NextResponse.json({ peers: [] });
    }
  } catch (error) {
    console.error('[Chat Contacts] Error fetching:', error);
    return NextResponse.json({ peers: [] });
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

    // One request used to upsert any number of rows, with any string as an
    // address. Bound it and keep only real addresses.
    const clean: string[] = Array.from(new Set<string>(
      peers.filter((p: unknown): p is string => typeof p === 'string' && /^0x[0-9a-fA-F]{40}$/.test(p))
        .map((p: string) => p.toLowerCase())
        .filter((p: string) => p !== callerAddress),
    )).slice(0, 200);
    if (clean.length === 0) return NextResponse.json({ success: true });

    const owner = callerAddress;

    try {
      // One INSERT … ON CONFLICT DO NOTHING instead of up to 200 upserts in a transaction: the
      // client posts its whole list, and nearly every row already exists.
      await prisma.chatContact.createMany({
        data: clean.map((peer: string) => ({ owner: owner.toLowerCase(), peer })),
        skipDuplicates: true,
      });
      await safeRedisSet(`contacts:peers:${owner.toLowerCase()}:500`, '', 'EX', 1);
      await safeRedisSet(`updates:contacts:v1:${owner.toLowerCase()}`, '', 'EX', 1);
      await safeRedisSet(`updates:feed:v1:${owner.toLowerCase()}`, '', 'EX', 1);
      await Promise.all(clean.slice(0, 50).map((peer) => safeRedisSet(`stories:authors:v1:${peer}`, '', 'EX', 1)));
    } catch (dbError: any) {
      console.warn('[Chat Contacts] Database offline, contact saved to client storage.');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Chat Contacts] Error saving:', error);
    return NextResponse.json({ success: true });
  }
}
