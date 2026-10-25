import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveVerifiedCaller } from '@/lib/security/resolveCaller';
import { generateCryptographicInvite } from '@/lib/crypto/CommunityInviteEngine';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await resolveVerifiedCaller(req);
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Sign in to generate invites.' }, { status: 401 });
    }

    const { id: communityId } = await params;
    const community = await (prisma as any).community.findUnique({
      where: { id: communityId },
      include: {
        members: {
          where: { walletAddress: caller }
        }
      }
    });

    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    // Authorization: owner or ADMIN
    const isOwner = community.ownerAddress?.toLowerCase() === caller;
    const membership = community.members?.[0];
    const isAdmin = membership?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: only community admins can create cryptographic invites' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { role = 'MEMBER', durationHours = 24, singleUse = false } = body;

    const validRoles = ['MEMBER', 'VIP', 'CONTRIBUTOR', 'MODERATOR'];
    const chosenRole = validRoles.includes(role) ? role : 'MEMBER';

    // Duration is a number of hours between 1 and 30 days. Invites that never
    // expire are not issued, because a leaked link would stay valid forever.
    const hours = Math.min(Math.max(Number(durationHours) || 24, 1), 24 * 30);
    const expiresAt = Date.now() + hours * 60 * 60 * 1000;

    const invite = generateCryptographicInvite({
      communityId,
      role: chosenRole as any,
      expiresAt,
      maxUses: singleUse ? 1 : 0,
      creatorAddress: caller,
    });

    return NextResponse.json({
      success: true,
      token: invite.token,
      inviteUrl: invite.inviteUrl,
      qrData: invite.qrData,
      role: chosenRole,
      expiresAt: expiresAt > 0 ? new Date(expiresAt).toISOString() : null,
      singleUse: Boolean(singleUse),
    });
  } catch (error: any) {
    console.error('[Community Invite API]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
