import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveVerifiedCaller } from '@/lib/security/resolveCaller';
import { verifyCryptographicInvite } from '@/lib/crypto/CommunityInviteEngine';
import { setOnce } from '@/lib/security/qrLogin';
import { checkRateLimit } from '@/lib/security/rateLimiter';

/** Roles an invite may grant. ADMIN is never handed out by a link. */
const INVITE_ROLES = new Set(['MEMBER', 'VIP', 'CONTRIBUTOR', 'MODERATOR']);

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const caller = await resolveVerifiedCaller(req);
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized. Connect your wallet first.' }, { status: 401 });
    }

    // Join codes are short: a caller gets 20 attempts a minute, so guessing one is not practical.
    const rl = await checkRateLimit(caller, { max: 20, windowSec: 60, prefix: 'community-join' });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many attempts to join. Wait a minute and try again.', code: 'RATE_LIMITED' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { joinCode, token, inviteToken } = body ?? {};
    const rawToken = token || inviteToken || (typeof joinCode === 'string' && joinCode.startsWith('inv_') ? joinCode : null);

    let community: any = null;
    let assignedRole = 'MEMBER';
    let isCryptographicInvite = false;
    let inviteNonce: string | null = null;
    let inviteExpiresAt = 0;

    // ── PATH A: Cryptographic Invite Token (#96–99) ──────────────────────────
    if (rawToken) {
      const verification = verifyCryptographicInvite(rawToken);
      if (!verification.valid || !verification.payload) {
        return NextResponse.json({
          error: verification.error || 'This invite is not valid.',
          code: 'INVALID_CRYPTOGRAPHIC_INVITE'
        }, { status: 400 });
      }
      const payload = verification.payload;
      if (!payload.expiresAt || !Number.isFinite(payload.expiresAt)) {
        return NextResponse.json({ error: 'This invite has no expiry and is not accepted.', code: 'INVALID_CRYPTOGRAPHIC_INVITE' }, { status: 400 });
      }

      community = await (prisma as any).community.findUnique({
        where: { id: payload.communityId },
        include: { _count: { select: { members: true } } }
      });

      if (!community) {
        return NextResponse.json({
          error: 'The community associated with this invite no longer exists.',
          code: 'COMMUNITY_NOT_FOUND'
        }, { status: 404 });
      }

      // An invite is only as good as its author's authority today: a removed or demoted admin's links stop working.
      const creator = String(payload.creatorAddress || '').toLowerCase();
      const creatorIsOwner = String(community.ownerAddress || '').toLowerCase() === creator;
      const creatorMember = creatorIsOwner ? null : await (prisma as any).communityMember.findUnique({
        where: { communityId_walletAddress: { communityId: community.id, walletAddress: creator } }
      });
      if (!creatorIsOwner && creatorMember?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'This invite was revoked: its author is no longer an admin of the community.', code: 'INVITE_REVOKED' }, { status: 410 });
      }

      assignedRole = INVITE_ROLES.has(payload.role) ? payload.role : 'MEMBER';
      isCryptographicInvite = true;
      inviteNonce = payload.maxUses === 1 ? payload.nonce : null;
      inviteExpiresAt = payload.expiresAt;
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

    // ── Single-use invite: claimed atomically, on every server at once (Redis SET NX), and only by
    // someone who is not already a member, so opening your own link again does not burn it.
    if (inviteNonce) {
      const ttl = Math.max(60, Math.ceil((inviteExpiresAt - Date.now()) / 1000) + 3600);
      const first = await setOnce(`community-invite:used:${inviteNonce}`, caller, ttl).catch(() => false);
      if (!first) {
        return NextResponse.json({ error: 'This one-time invite has already been used.', code: 'INVITE_USED' }, { status: 410 });
      }
    }

    // ── JOIN & Role Assignment ───────────────────────────────────────────────
    try {
      await (prisma as any).communityMember.create({
        data: {
          communityId: community.id,
          walletAddress: caller,
          role: assignedRole
        }
      });
    } catch (e: any) {
      // Two taps on the same link: the second finds the membership the first made.
      if (e?.code === 'P2002') return NextResponse.json({ ok: true, status: 'ALREADY_MEMBER', community });
      throw e;
    }

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
