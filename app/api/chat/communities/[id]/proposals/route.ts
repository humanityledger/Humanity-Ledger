import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { requireWallet } from '@/lib/security/requireWallet';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { memberNames } from '@/lib/communities/member-names';
import {
  durationDays, effectiveStatus, isPrivilegedRole, isVoteChoice, quorumFor, roleIn, tally, type CreatorRole,
} from '@/lib/communities/governance';

export const dynamic = 'force-dynamic';

/**
 * Community governance: proposals and votes.
 *
 * [SECURITY 2026-10-28] The voter and the creator used to come from the
 * request body, with no session and no membership check: anyone could vote
 * as any address (one vote per made-up address, so without limit) and
 * publish proposals in someone else's name, in any community. Both now come
 * from the session, and only members of the community (or its owner) can
 * read, propose and vote.
 */

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** The community, if `wallet` is its owner or a member. */
async function memberCommunity(communityId: string, wallet: string) {
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: { id: true, ownerAddress: true },
  });
  if (!community) return { status: 404 as const };
  if (community.ownerAddress.toLowerCase() === wallet) return { status: 200 as const, community };
  const member = await prisma.communityMember.findUnique({
    where: { communityId_walletAddress: { communityId, walletAddress: wallet } },
    select: { id: true },
  });
  return member ? { status: 200 as const, community } : { status: 403 as const };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const wallet = auth.walletAddress.toLowerCase();

    const { id: communityId } = await params;
    if (!ID_RE.test(communityId)) {
      return NextResponse.json({ error: 'Invalid community identifier' }, { status: 400 });
    }
    const access = await memberCommunity(communityId, wallet);
    if (access.status === 404) return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    if (access.status === 403) return NextResponse.json({ error: 'Join the community to see its proposals.' }, { status: 403 });

    const [proposals, rows, community] = await Promise.all([
      prisma.marketProposal.findMany({
        where: { OR: [{ category: `COMMUNITY_${communityId}` }, { category: communityId }] },
        include: { votes: { select: { id: true, voterAddress: true, vote: true, votedAt: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.communityMember.findMany({ where: { communityId }, select: { walletAddress: true, role: true } }),
      prisma.community.findUnique({ where: { id: communityId }, select: { ownerAddress: true } }),
    ]);
    // Roles as they are now: a moderator's proposal is marked as such while they hold the role.
    const roles = new Map<string, string>(rows.map((r) => [String(r.walletAddress).toLowerCase(), String(r.role)]));
    const owner = community?.ownerAddress ?? null;
    const membersCount = new Set([...roles.keys(), String(owner || '').toLowerCase()].filter(Boolean)).size;
    const names = await memberNames(proposals.map((p) => p.creatorAddress));
    const now = Date.now();
    return NextResponse.json({
      callerRole: roleIn(wallet, owner, roles),
      membersCount,
      proposals: proposals.map((p) => {
        const t = tally(p.votes);
        const creator = String(p.creatorAddress || '').toLowerCase();
        const mine = p.votes.find((v) => String(v.voterAddress).toLowerCase() === wallet);
        return {
          ...p,
          votesFor: t.for,
          votesAgainst: t.against,
          votesAbstain: t.abstain,
          totalVotes: t.total,
          eligibleMembers: membersCount,
          creatorRole: roleIn(creator, owner, roles),
          creatorName: names.get(creator) ?? null,
          myVote: mine ? String(mine.vote).toUpperCase() : null,
          effectiveStatus: effectiveStatus(p, t, now),
        };
      }),
    });
  } catch (error: any) {
    console.error('[community proposals GET]', error?.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireWallet(req);
    if (auth.errorResponse) return auth.errorResponse;
    const wallet = auth.walletAddress.toLowerCase();

    const { id: communityId } = await params;
    if (!ID_RE.test(communityId)) {
      return NextResponse.json({ error: 'Invalid community identifier' }, { status: 400 });
    }
    const access = await memberCommunity(communityId, wallet);
    if (access.status === 404) return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    if (access.status === 403) return NextResponse.json({ error: 'Only members can propose and vote.' }, { status: 403 });

    const rl = await checkRateLimit(wallet, { max: 30, windowSec: 600, prefix: 'rl:community-gov' });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many requests. Try again in a few minutes.' }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const { action, title, description, proposalId, vote } = body ?? {};
    // Addresses sent by older clients must be the caller's own.
    for (const a of [body?.voterAddress, body?.creatorAddress]) {
      if (typeof a === 'string' && a && a.toLowerCase() !== wallet) {
        return NextResponse.json({ error: 'You can only act as yourself.' }, { status: 403 });
      }
    }

    // ── VOTE ──
    if (action === 'VOTE') {
      const normalizedVote = String(vote ?? '').toUpperCase();
      if (typeof proposalId !== 'string' || !proposalId || !isVoteChoice(normalizedVote)) {
        return NextResponse.json({ error: 'A proposal and a vote (For, Against or Abstain) are required.' }, { status: 400 });
      }

      const proposal = await prisma.marketProposal.findUnique({ where: { id: proposalId } });
      // The proposal must belong to this community, not just exist somewhere.
      if (!proposal || (proposal.category !== `COMMUNITY_${communityId}` && proposal.category !== communityId)) {
        return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
      }
      if (new Date() > new Date(proposal.votingEndsAt)) {
        return NextResponse.json({ error: 'Voting has ended for this proposal.' }, { status: 400 });
      }

      // One vote per member and proposal.
      const nullifier = crypto.createHash('sha256').update(`${proposalId}:${wallet}`).digest('hex');
      const existingVote = await prisma.proposalVote.findUnique({ where: { nullifierHash: nullifier } });
      if (existingVote) {
        return NextResponse.json({ error: 'You have already voted on this proposal.' }, { status: 409 });
      }

      try {
        await prisma.$transaction([
          prisma.proposalVote.create({
            data: {
              proposalId,
              voterAddress: wallet,
              vote: normalizedVote,
              nullifierHash: nullifier,
              merkleRoot: '0x0',
              proof: 'session',
              verificationLevel: 'MEMBER',
            },
          }),
          prisma.marketProposal.update({
            where: { id: proposalId },
            data: {
              votesFor: normalizedVote === 'FOR' ? { increment: 1 } : undefined,
              votesAgainst: normalizedVote === 'AGAINST' ? { increment: 1 } : undefined,
            },
          }),
        ]);
      } catch (e: any) {
        // Two requests at once: the unique nullifier lets only one through.
        if (e?.code === 'P2002') return NextResponse.json({ error: 'You have already voted on this proposal.' }, { status: 409 });
        throw e;
      }
      return NextResponse.json({ success: true, message: 'Vote recorded' });
    }

    // ── CREATE PROPOSAL ──
    const cleanTitle = String(title ?? '').trim();
    const cleanDesc = String(description ?? '').trim();
    if (cleanTitle.length < 5 || cleanTitle.length > 200) {
      return NextResponse.json({ error: 'The title must be between 5 and 200 characters.' }, { status: 400 });
    }
    if (cleanDesc.length < 10 || cleanDesc.length > 5000) {
      return NextResponse.json({ error: 'The description must be between 10 and 5000 characters.' }, { status: 400 });
    }

    const [rows, community] = await Promise.all([
      prisma.communityMember.findMany({ where: { communityId }, select: { walletAddress: true, role: true } }),
      prisma.community.findUnique({ where: { id: communityId }, select: { ownerAddress: true } }),
    ]);
    const roles = new Map<string, string>(rows.map((r) => [String(r.walletAddress).toLowerCase(), String(r.role)]));
    const creatorRole: CreatorRole = roleIn(wallet, community?.ownerAddress, roles);
    // A proposal published as a moderators' proposal must come from the owner, an admin or a moderator.
    if ((body?.official === true || body?.officialOnly === true) && !isPrivilegedRole(creatorRole)) {
      return NextResponse.json({ error: 'Only moderators, admins and the owner can publish a moderators’ proposal.' }, { status: 403 });
    }
    const membersCount = new Set([...roles.keys(), String(community?.ownerAddress || '').toLowerCase()].filter(Boolean)).size;
    const days = durationDays(body?.durationDays);

    const newProposal = await prisma.marketProposal.create({
      data: {
        question: cleanTitle,
        description: cleanDesc,
        category: `COMMUNITY_${communityId}`,
        creatorAddress: wallet,
        status: 'VOTING',
        outcomes: ['FOR', 'AGAINST', 'ABSTAIN'],
        votingEndsAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        votingThreshold: quorumFor(membersCount, body?.quorumCount),
      },
    });
    return NextResponse.json({ success: true, proposal: { ...newProposal, creatorRole } }, { status: 201 });
  } catch (error: any) {
    console.error('[community proposals POST]', error?.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
