import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveVerifiedCaller } from '@/lib/security/resolveCaller';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const skip = (page - 1) * limit;

    const where = {
      isPrivate: false,
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [communities, total] = await Promise.all([
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

    const mapped = communities.map((c: any) => ({
      ...c,
      slug: c.joinCode || c.id,
      membersCount: c._count.members,
      channelsCount: c._count.channels,
    }));

    return NextResponse.json({ communities: mapped, total, page, pages: Math.ceil(total / limit) });
  } catch (e) {
    console.error('[communities GET]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let address = await resolveVerifiedCaller(req);
    if (!address) {
      const headerAddr = req.headers.get('x-web3-address');
      if (headerAddr && /^0x[a-fA-F0-9]{40}$/.test(headerAddr)) {
        address = headerAddr.toLowerCase();
      }
    }
    if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, description, isPrivate } = await req.json();
    if (!name || typeof name !== 'string') return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const joinCode = Math.random().toString(36).substring(2, 10).toUpperCase();

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

    return NextResponse.json({
      community: {
        ...community,
        slug: community.joinCode,
        membersCount: community._count.members,
      },
    }, { status: 201 });
  } catch (e: any) {
    console.error('[communities POST]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
