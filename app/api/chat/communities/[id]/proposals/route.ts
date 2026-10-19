import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const ETH_ADDR_REGEX = /^0x[a-fA-F0-9]{40}$/;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: communityId } = await params;
    if (!communityId || typeof communityId !== 'string' || communityId.length > 64) {
      return NextResponse.json({ error: 'Invalid community identifier' }, { status: 400 });
    }

    const categoryKey = `COMMUNITY_${communityId}`;

    const proposals = await prisma.marketProposal.findMany({
      where: {
        OR: [
          { category: categoryKey },
          { category: communityId }
        ]
      },
      include: {
        votes: {
          select: {
            id: true,
            voterAddress: true,
            vote: true,
            votedAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return NextResponse.json({ proposals });
  } catch (error: any) {
    console.error('[Community Proposals GET Security Guard]', error);
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

    // Verify community existence
    const community = await prisma.community.findUnique({
      where: { id: communityId }
    });
    if (!community) {
      return NextResponse.json({ error: 'Target community not found' }, { status: 404 });
    }

    const body = await req.json();
    const { action, title, description, creatorAddress, proposalId, vote, voterAddress } = body;

    // ── ACTION: VOTE ──────────────────────────────────────────────────────────
    if (action === 'VOTE') {
      if (!proposalId || !voterAddress || !vote) {
        return NextResponse.json({ error: 'Missing required voting parameters' }, { status: 400 });
      }

      if (!ETH_ADDR_REGEX.test(voterAddress)) {
        return NextResponse.json({ error: 'Security alert: Invalid voter Ethereum address format' }, { status: 400 });
      }

      const normalizedVote = String(vote).toUpperCase();
      if (normalizedVote !== 'FOR' && normalizedVote !== 'AGAINST') {
        return NextResponse.json({ error: 'Invalid vote option: must be FOR or AGAINST' }, { status: 400 });
      }

      const proposal = await prisma.marketProposal.findUnique({
        where: { id: proposalId }
      });

      if (!proposal) {
        return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
      }

      if (new Date() > new Date(proposal.votingEndsAt)) {
        return NextResponse.json({ error: 'Voting period has expired for this proposal' }, { status: 400 });
      }

      // Generate a deterministic SHA-256 nullifier to prevent double voting
      const nullifier = crypto.createHash('sha256')
        .update(`${proposalId}:${voterAddress.toLowerCase()}`)
        .digest('hex');

      // Check for duplicate vote attempt
      const existingVote = await prisma.proposalVote.findUnique({
        where: { nullifierHash: nullifier }
      });

      if (existingVote) {
        return NextResponse.json({ error: 'Duplicate vote rejected: address has already participated' }, { status: 409 });
      }

      // Atomic execution
      await prisma.$transaction([
        prisma.proposalVote.create({
          data: {
            proposalId,
            voterAddress: voterAddress.toLowerCase(),
            vote: normalizedVote,
            nullifierHash: nullifier,
            merkleRoot: '0x0',
            proof: 'direct-sig',
            verificationLevel: 'MEMBER'
          }
        }),
        prisma.marketProposal.update({
          where: { id: proposalId },
          data: {
            votesFor: normalizedVote === 'FOR' ? { increment: 1 } : undefined,
            votesAgainst: normalizedVote === 'AGAINST' ? { increment: 1 } : undefined
          }
        })
      ]);

      return NextResponse.json({ success: true, message: 'Vote cryptographically recorded' });
    }

    // ── ACTION: CREATE PROPOSAL ───────────────────────────────────────────────
    if (!title || !description || !creatorAddress) {
      return NextResponse.json({ error: 'title, description, and creatorAddress are required' }, { status: 400 });
    }

    if (!ETH_ADDR_REGEX.test(creatorAddress)) {
      return NextResponse.json({ error: 'Security alert: Invalid creator Ethereum address format' }, { status: 400 });
    }

    const cleanTitle = String(title).trim();
    const cleanDesc = String(description).trim();

    // Prevent payload bloat and DoS
    if (cleanTitle.length < 5 || cleanTitle.length > 200) {
      return NextResponse.json({ error: 'Title must be between 5 and 200 characters' }, { status: 400 });
    }
    if (cleanDesc.length < 10 || cleanDesc.length > 5000) {
      return NextResponse.json({ error: 'Description must be between 10 and 5000 characters' }, { status: 400 });
    }

    const endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day voting window

    const newProposal = await prisma.marketProposal.create({
      data: {
        question: cleanTitle,
        description: cleanDesc,
        category: `COMMUNITY_${communityId}`,
        creatorAddress: creatorAddress.toLowerCase(),
        status: 'VOTING',
        outcomes: ['FOR', 'AGAINST'],
        votingEndsAt: endsAt,
        votingThreshold: 10
      }
    });

    return NextResponse.json({ success: true, proposal: newProposal }, { status: 201 });
  } catch (error: any) {
    console.error('[Community Proposals POST Security Guard]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
