import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';

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
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const address = auth.walletAddress;

    const { name, description, isPrivate } = await req.json();
    if (!name || typeof name !== 'string') return NextResponse.json({ error: 'Name required' }, { status: 400 });

    // A-008: use crypto.randomBytes instead of Math.random for join codes
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
