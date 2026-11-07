import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';
import {
  getInMemoryCommunityBySlugOrId,
  joinInMemoryCommunity,
} from '@/lib/communities/in-memory-communities';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const address = auth.walletAddress;

    const { slug: identifier } = await params;

    let community: any = null;
    try {
      community = await (prisma as any).community.findFirst({
        where: {
          OR: [
            { id: identifier },
            { joinCode: identifier.toUpperCase() },
          ],
        },
      });
    } catch {}

    if (community) {
      try {
        const member = await (prisma as any).communityMember.upsert({
          where: {
            communityId_walletAddress: {
              communityId: community.id,
              walletAddress: address.toLowerCase(),
            },
          },
          update: {},
          create: {
            communityId: community.id,
            walletAddress: address.toLowerCase(),
            role: 'MEMBER',
          },
        });
        return NextResponse.json({ member, communityId: community.id });
      } catch {}
    }

    const memCommunity = getInMemoryCommunityBySlugOrId(identifier);
    if (memCommunity) {
      joinInMemoryCommunity(identifier, address, 'MEMBER');
      return NextResponse.json({
        member: {
          communityId: memCommunity.id,
          walletAddress: address.toLowerCase(),
          role: 'MEMBER',
        },
        communityId: memCommunity.id,
      });
    }

    return NextResponse.json({ error: 'Community not found' }, { status: 404 });
  } catch (e) {
    console.error('[communities join POST]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
