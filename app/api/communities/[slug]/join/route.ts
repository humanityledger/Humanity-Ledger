import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';

export const dynamic = 'force-dynamic';

// A-008: Use requireWallet instead of resolveVerifiedCaller + x-web3-address header
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const address = auth.walletAddress;

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
