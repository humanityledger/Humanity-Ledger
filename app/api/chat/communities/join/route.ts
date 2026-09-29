import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

async function resolveCaller(req: NextRequest) {
  const verified = req.headers.get('x-verified-session-address');
  if (verified) return verified.toLowerCase();
  const session = await getSession();
  if (session?.userId) return session.userId.toLowerCase();
  return req.headers.get('x-web3-address')?.toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { joinCode } = await req.json();
    if (!joinCode) return NextResponse.json({ error: 'joinCode required' }, { status: 400 });

    const code = joinCode.toUpperCase().trim();

    const community = await (prisma as any).community.findUnique({
      where: { joinCode: code }
    });

    if (!community) return NextResponse.json({ error: 'Community not found or link invalid' }, { status: 404 });

    const existing = await (prisma as any).communityMember.findUnique({
      where: { communityId_walletAddress: { communityId: community.id, walletAddress: caller } }
    });

    if (existing) {
      return NextResponse.json({ ok: true, status: 'ALREADY_MEMBER', community });
    }

    await (prisma as any).communityMember.create({
      data: {
        communityId: community.id,
        walletAddress: caller,
        role: 'MEMBER'
      }
    });

    return NextResponse.json({ ok: true, status: 'JOINED', community });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
