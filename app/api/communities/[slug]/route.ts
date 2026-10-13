import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const identifier = params.slug;
    const community = await (prisma as any).community.findFirst({
      where: {
        OR: [
          { id: identifier },
          { joinCode: identifier.toUpperCase() },
        ],
      },
      include: {
        channels: { orderBy: { position: 'asc' } },
        _count: { select: { members: true } },
      },
    });

    if (!community) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      community: {
        ...community,
        slug: community.joinCode,
        membersCount: community._count.members,
      },
    });
  } catch (e) {
    console.error('[communities [slug] GET]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
