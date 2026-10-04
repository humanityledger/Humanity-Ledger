import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const community = await (prisma as any).community.findUnique({
      where: { slug: params.slug },
      include: {
        channels: { where: { isArchived: false }, orderBy: { position: 'asc' } },
        _count: { select: { members: true } },
      },
    });
    if (!community) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ community });
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
