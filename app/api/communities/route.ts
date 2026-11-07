import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';
import {
  createInMemoryCommunity,
  listInMemoryCommunities,
} from '@/lib/communities/in-memory-communities';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') || '';
    const rawPage = parseInt(searchParams.get('page') || '1', 10);
    const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
    const rawLimit = parseInt(searchParams.get('limit') || '20', 10);
    const limit = Math.max(1, Math.min(isNaN(rawLimit) ? 20 : rawLimit, 50));
    const skip = (page - 1) * limit;

    const where = {
      isPrivate: false,
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    let dbCommunities: any[] = [];
    let total = 0;

    try {
      const [comms, cnt] = await Promise.all([
        (prisma as any).community.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            channels: { orderBy: { position: 'asc' } },
            _count: { select: { members: true, channels: true } },
          },
        }),
        (prisma as any).community.count({ where }),
      ]);
      dbCommunities = comms;
      total = cnt;
    } catch {}

    const memCommunities = listInMemoryCommunities({ isDiscover: true, search });

    const seen = new Set<string>();
    const mapped: any[] = [];

    for (const c of dbCommunities) {
      seen.add(c.id);
      mapped.push({
        ...c,
        slug: c.joinCode || c.id,
        membersCount: c._count?.members || 1,
        channelsCount: c._count?.channels || 1,
      });
    }

    for (const mc of memCommunities) {
      if (!seen.has(mc.id)) {
        seen.add(mc.id);
        mapped.push(mc);
      }
    }

    const finalTotal = Math.max(total, mapped.length);

    return NextResponse.json({
      communities: mapped.slice(0, limit),
      total: finalTotal,
      page,
      pages: Math.max(1, Math.ceil(finalTotal / limit)),
    });
  } catch (e) {
    console.error('[communities GET]', e);
    const fallback = listInMemoryCommunities({ isDiscover: true });
    return NextResponse.json({
      communities: fallback,
      total: fallback.length,
      page: 1,
      pages: 1,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const address = auth.walletAddress;

    const body = await req.json().catch(() => ({}));
    const { name, description, isPrivate } = body;
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name required' }, { status: 400 });
    }

    // Try DB first
    try {
      const { randomBytes } = await import('crypto');
      const joinCode = randomBytes(4).toString('hex').toUpperCase();

      const community = await (prisma as any).community.create({
        data: {
          name: name.trim(),
          description: description?.trim() || '',
          isPrivate: Boolean(isPrivate),
          ownerAddress: address.toLowerCase(),
          joinCode,
          members: {
            create: {
              walletAddress: address.toLowerCase(),
              role: 'ADMIN',
            },
          },
          channels: {
            create: [
              { name: 'general', description: 'General discussion', isPaid: false, position: 0 },
              { name: 'announcements', description: 'Server announcements', isPaid: false, position: 1 },
            ],
          },
          permissions: {
            create: {},
          },
        },
        include: {
          channels: true,
          _count: { select: { members: true } },
        },
      });

      return NextResponse.json(
        {
          community: {
            ...community,
            slug: community.joinCode,
            membersCount: community._count?.members || 1,
          },
        },
        { status: 201 }
      );
    } catch {
      // Standalone mode without DB: use in-memory store
      const memCommunity = createInMemoryCommunity({
        name,
        description: description || '',
        isPrivate: Boolean(isPrivate),
        ownerAddress: address,
      });

      return NextResponse.json({ community: memCommunity }, { status: 201 });
    }
  } catch (e: any) {
    console.error('[communities POST]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
