import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const skip = (page - 1) * limit;

    const where = {
      isPublic: true,
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [communities, total] = await Promise.all([
      (prisma as any).community.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { members: true, channels: true } },
        },
      }),
      (prisma as any).community.count({ where }),
    ]);

    return NextResponse.json({ communities, total, page, pages: Math.ceil(total / limit) });
  } catch (e) {
    console.error('[communities GET]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, description, isPublic, slug } = await req.json();
    if (!name || !slug) return NextResponse.json({ error: 'name and slug required' }, { status: 400 });

    // Slug validation
    if (!/^[a-z0-9-]{3,32}$/.test(slug)) {
      return NextResponse.json({ error: 'slug must be 3-32 chars, lowercase letters, numbers, hyphens' }, { status: 400 });
    }

    const community = await (prisma as any).community.create({
      data: {
        name,
        slug,
        description: description || null,
        ownerAddress: session.address.toLowerCase(),
        isPublic: isPublic ?? true,
        members: {
          create: { walletAddress: session.address.toLowerCase(), role: 'owner' },
        },
        channels: {
          create: [
            { name: 'general', type: 'text', accessType: 'free', position: 0 },
            { name: 'announcements', type: 'announcements', accessType: 'free', position: 1 },
          ],
        },
      },
      include: { channels: true, _count: { select: { members: true } } },
    });

    return NextResponse.json({ community }, { status: 201 });
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'Slug already taken' }, { status: 409 });
    console.error('[communities POST]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
