import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const session = await getSession();
    if (!session?.address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const community = await (prisma as any).community.findUnique({ where: { slug: params.slug } });
    if (!community) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const member = await (prisma as any).communityMember.upsert({
      where: { communityId_walletAddress: { communityId: community.id, walletAddress: session.address.toLowerCase() } },
      update: {},
      create: { communityId: community.id, walletAddress: session.address.toLowerCase(), role: 'member' },
    });

    return NextResponse.json({ member });
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
