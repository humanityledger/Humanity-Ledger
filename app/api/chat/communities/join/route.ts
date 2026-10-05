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
    if (!caller) return NextResponse.json({ error: 'Unauthorized. Connect your wallet first.' }, { status: 401 });

    const { joinCode } = await req.json();
    if (!joinCode) return NextResponse.json({ error: 'joinCode required' }, { status: 400 });

    const code = joinCode.toUpperCase().trim();

    const community = await (prisma as any).community.findUnique({
      where: { joinCode: code },
      include: { _count: { select: { members: true } } }
    });

    // ── GATE 1: Link existence (revocation check) ──────────────────────────────
    if (!community) {
      return NextResponse.json({
        error: 'This invite link has expired or was revoked by the administrator.',
        code: 'LINK_EXPIRED'
      }, { status: 404 });
    }

    // ── GATE 2: Privacy enforcement ────────────────────────────────────────────
    // A PRIVATE community means the admin has closed entry to the public.
    // Only existing members (already in the DB) can re-enter. New members are BLOCKED.
    const existing = await (prisma as any).communityMember.findUnique({
      where: { communityId_walletAddress: { communityId: community.id, walletAddress: caller } }
    });

    if (community.isPrivate && !existing) {
      return NextResponse.json({
        error: 'This is a private group. New members cannot join via link. Ask an administrator to add you.',
        code: 'GROUP_CLOSED'
      }, { status: 403 });
    }

    // ── GATE 3: Already a member ───────────────────────────────────────────────
    if (existing) {
      return NextResponse.json({ ok: true, status: 'ALREADY_MEMBER', community });
    }

    // ── JOIN ───────────────────────────────────────────────────────────────────
    await (prisma as any).communityMember.create({
      data: {
        communityId: community.id,
        walletAddress: caller,
        role: 'MEMBER'
      }
    });

    // Create a system post announcing the new member
    try {
      await (prisma as any).communityPost.create({
        data: {
          communityId: community.id,
          authorAddress: 'system',
          content: `__SYSTEM__${caller} joined the group`
        }
      });
    } catch (e) {
      console.error('Failed to post welcome message:', e);
    }

    return NextResponse.json({ ok: true, status: 'JOINED', community });
  } catch (error: any) {
    console.error('[JOIN API ERROR]', error);
    return NextResponse.json({ error: 'Failed to join community. Try again later.' }, { status: 500 });
  }
}
