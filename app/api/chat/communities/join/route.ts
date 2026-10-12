import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveVerifiedCaller } from '@/lib/security/resolveCaller';
import { verifyCryptographicInvite, consumeCryptographicInvite } from '@/lib/crypto/CommunityInviteEngine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const caller = await resolveVerifiedCaller(req);
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Connect your wallet first.' }, { status: 401 });
    }

    const body = await req.json();
    const { joinCode, token, inviteToken } = body;
    const rawToken = token || inviteToken || (typeof joinCode === 'string' && joinCode.startsWith('inv_') ? joinCode : null);

    let community: any = null;
    let assignedRole = 'MEMBER';
    let isCryptographicInvite = false;

    // ── PATH A: Cryptographic Invite Token (#96–99) ──────────────────────────
    if (rawToken) {
      const verification = verifyCryptographicInvite(rawToken);
      if (!verification.valid || !verification.payload) {
        return NextResponse.json({
          error: verification.error || 'Cryptographic invite verification failed.',
          code: 'INVALID_CRYPTOGRAPHIC_INVITE'
        }, { status: 400 });
      }

      community = await (prisma as any).community.findUnique({
        where: { id: verification.payload.communityId },
        include: { _count: { select: { members: true } } }
      });

      if (!community) {
        return NextResponse.json({
          error: 'The community associated with this invite no longer exists.',
          code: 'COMMUNITY_NOT_FOUND'
        }, { status: 404 });
      }

      assignedRole = verification.payload.role || 'MEMBER';
      isCryptographicInvite = true;

      // Consume one-time token if single-use
      if (verification.payload.maxUses === 1) {
        consumeCryptographicInvite(verification.payload.nonce);
      }
    } 
    // ── PATH B: Standard Join Code ───────────────────────────────────────────
    else if (joinCode) {
      const code = String(joinCode).toUpperCase().trim();
      community = await (prisma as any).community.findUnique({
        where: { joinCode: code },
        include: { _count: { select: { members: true } } }
      });

      if (!community) {
        return NextResponse.json({
          error: 'This invite link has expired or was revoked by the administrator.',
          code: 'LINK_EXPIRED'
        }, { status: 404 });
      }
    } else {
      return NextResponse.json({ error: 'joinCode or invite token is required' }, { status: 400 });
    }

    // ── GATE 2: Privacy Enforcement ──────────────────────────────────────────
    const existing = await (prisma as any).communityMember.findUnique({
      where: { communityId_walletAddress: { communityId: community.id, walletAddress: caller } }
    });

    // If private and NOT a cryptographic invite and not already a member, block entry
    if (community.isPrivate && !existing && !isCryptographicInvite) {
      return NextResponse.json({
        error: 'This is a private group. Direct link joining is closed. Request a cryptographic invite from an administrator.',
        code: 'GROUP_CLOSED'
      }, { status: 403 });
    }

    // ── GATE 3: Already a Member ─────────────────────────────────────────────
    if (existing) {
      return NextResponse.json({ ok: true, status: 'ALREADY_MEMBER', community });
    }

    // ── JOIN & Role Assignment ───────────────────────────────────────────────
    await (prisma as any).communityMember.create({
      data: {
        communityId: community.id,
        walletAddress: caller,
        role: assignedRole
      }
    });

    // Create system welcome event
    try {
      await (prisma as any).communityPost.create({
        data: {
          communityId: community.id,
          authorAddress: 'system',
          content: `__SYSTEM__${caller} joined the group${isCryptographicInvite && assignedRole !== 'MEMBER' ? ` as ${assignedRole}` : ''}`
        }
      });
    } catch (e) {
      console.error('Failed to post welcome message:', e);
    }

    return NextResponse.json({ ok: true, status: 'JOINED', role: assignedRole, community });
  } catch (error: any) {
    console.error('[JOIN API ERROR]', error);
    return NextResponse.json({ error: 'Failed to join community. Try again later.' }, { status: 500 });
  }
}
