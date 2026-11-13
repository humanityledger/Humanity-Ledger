import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';
import {
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

    let mapped: any[] = [];
    let total = 0;
    try {
      const [communities, dbTotal] = await Promise.all([
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
      total = dbTotal;
      mapped = communities.map((c: any) => ({
        ...c,
        slug: c.joinCode || c.id,
        membersCount: c._count.members,
        channelsCount: c._count.channels,
      }));
    } catch {
      // In-memory fallback
      const mem = listInMemoryCommunities({ isDiscover: true, search });
      total = mem.length;
      mapped = mem.slice(skip, skip + limit);
    }

    return NextResponse.json({ communities: mapped, total, page, pages: Math.ceil(total / limit) });
  } catch (e) {
    console.error('[communities GET]', e);
    const mem = listInMemoryCommunities({ isDiscover: true });
    return NextResponse.json({ communities: mem, total: mem.length, page: 1, pages: 1 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const address = auth.walletAddress;

    const body = await req.json().catch(() => ({}));
    const isPrivate = Boolean(body?.isPrivate);
    const name = typeof body?.name === 'string' ? body.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 64) : '';
    const description = typeof body?.description === 'string' ? body.description.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, 500) : '';
    if (name.length < 2) return NextResponse.json({ error: 'A name of at least 2 characters is required' }, { status: 400 });

    const { randomBytes } = await import('crypto');
    const joinCode = randomBytes(6).toString('hex').toUpperCase();

    try {
      const community = await (prisma as any).community.create({
        data: {
          name,
          description,
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

      return NextResponse.json({
        community: {
          ...community,
          slug: community.joinCode,
          membersCount: community._count.members,
        },
      }, { status: 201 });
    } catch (e: any) {
      // Nothing is kept in this server's memory and reported as created (see app/api/chat/communities).
      console.error('[communities POST] not created:', e?.code || e?.message);
      return NextResponse.json({ error: 'Communities are unavailable right now. Nothing was created.', code: 'STORE_UNAVAILABLE' }, { status: 503 });
    }
  } catch (e: any) {
    console.error('[communities POST]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
