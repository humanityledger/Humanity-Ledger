import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyTokenGate, TokenGateConfig } from '@/lib/gating/TokenGateEngine';
import { resolveVerifiedCaller } from '@/lib/security/resolveCaller';

export const dynamic = 'force-dynamic';

const ETH_ADDR_REGEX = /^0x[a-fA-F0-9]{40}$/;
const SUPPORTED_CHAINS = [1, 8453, 137];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: communityId } = await params;
    if (!communityId || typeof communityId !== 'string' || communityId.length > 64) {
      return NextResponse.json({ error: 'Invalid community identifier' }, { status: 400 });
    }

    const caller = await resolveVerifiedCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const community = await prisma.community.findUnique({
      where: { id: communityId },
      include: { channels: true }
    });

    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    // Channel lists of private communities are for members only.
    if (community.isPrivate) {
      const member = await (prisma as any).communityMember.findFirst({ where: { communityId, walletAddress: caller } });
      if (!member && community.ownerAddress?.toLowerCase() !== caller) {
        return NextResponse.json({ error: 'Community not found' }, { status: 404 });
      }
    }

    return NextResponse.json({
      communityId,
      isGated: community.isPrivate,
      channels: community.channels
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: communityId } = await params;
    if (!communityId || typeof communityId !== 'string' || communityId.length > 64) {
      return NextResponse.json({ error: 'Invalid community identifier' }, { status: 400 });
    }

    const body = await req.json();
    const { action, walletAddress, gateConfig } = body;

    if (action === 'VERIFY') {
      if (!walletAddress || !gateConfig) {
        return NextResponse.json({ error: 'walletAddress and gateConfig are required' }, { status: 400 });
      }

      if (!ETH_ADDR_REGEX.test(walletAddress)) {
        return NextResponse.json({ error: 'Invalid user wallet address' }, { status: 400 });
      }

      // Only a signed in wallet can run the check, and only for itself. This
      // endpoint makes on chain calls, so it must not be an open proxy.
      const caller = await resolveVerifiedCaller(req);
      if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (walletAddress.toLowerCase() !== caller) {
        return NextResponse.json({ error: 'You can only verify your own wallet' }, { status: 403 });
      }

      if (!gateConfig.contractAddress || !ETH_ADDR_REGEX.test(gateConfig.contractAddress)) {
        return NextResponse.json({ error: 'Invalid token contract address' }, { status: 400 });
      }

      if (gateConfig.chainId && !SUPPORTED_CHAINS.includes(Number(gateConfig.chainId))) {
        return NextResponse.json({ error: 'Unsupported blockchain network' }, { status: 400 });
      }

      const result = await verifyTokenGate(walletAddress, gateConfig as TokenGateConfig);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unrecognized action' }, { status: 400 });
  } catch (error: any) {
    console.error('[TokenGate API Security Guard]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
