import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getInMemoryCommunityBySlugOrId } from '@/lib/communities/in-memory-communities';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug: identifier } = await params;

    let dbCommunity: any = null;
    try {
      dbCommunity = await (prisma as any).community.findFirst({
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
    } catch {}

    if (dbCommunity) {
      return NextResponse.json({
        community: {
          ...dbCommunity,
          slug: dbCommunity.joinCode,
          membersCount: dbCommunity._count?.members || 1,
        },
      });
    }

    const memCommunity = getInMemoryCommunityBySlugOrId(identifier);
    if (memCommunity) {
      return NextResponse.json({ community: memCommunity });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e) {
    console.error('[communities [slug] GET]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
