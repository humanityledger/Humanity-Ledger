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
    if (!caller) return NextResponse.json({ error: 'Unauthorized. Connect wallet first.' }, { status: 401 });

    const { joinCode } = await req.json();
    if (!joinCode) return NextResponse.json({ error: 'joinCode required' }, { status: 400 });

    const code = joinCode.toUpperCase().trim();

    const community = await (prisma as any).community.findUnique({
      where: { joinCode: code }
    });

    if (!community) return NextResponse.json({ error: 'Invalid or expired invite link.' }, { status: 404 });

    // ─── STRICT PRIVATE GROUP CHECK ───
    // If the community is private, the joinCode must match perfectly. If the admin 
    // changes the privacy settings or revokes the link, the old link is destroyed.
    // In a fully complex implementation, we could check for an "Approval Required" flag
    // or a ban list. Let's check for bans if we had a ban list, but for now we enforce 
    // that the link exists. If the admin revoked it, it won't be found above.

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
    console.error('[JOIN API ERROR]', error);
    return NextResponse.json({ error: 'Failed to join community. Try again later.' }, { status: 500 });
  }
}
