import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveVerifiedCaller } from '@/lib/security/resolveCaller';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    let address = await resolveVerifiedCaller(req);
    if (!address) {
      const headerAddr = req.headers.get('x-web3-address');
      if (headerAddr && /^0x[a-fA-F0-9]{40}$/.test(headerAddr)) {
        address = headerAddr.toLowerCase();
      }
    }
    if (!address) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { slug: identifier } = await params;
    const community = await (prisma as any).community.findFirst({
      where: {
        OR: [
          { id: identifier },
          { joinCode: identifier.toUpperCase() },
        ],
      },
    });

    if (!community) return NextResponse.json({ error: 'Community not found' }, { status: 404 });

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
  } catch (e) {
    console.error('[communities join POST]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
