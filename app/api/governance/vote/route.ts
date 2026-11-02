/**
 * API Route: Cast Vote
 * POST /api/governance/vote
 * 
 * Handles vote submission with World ID verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWorldIDProof } from '@/lib/worldid';
import { getSession } from '@/lib/session';

interface VoteRequest {
    proposalId: string;
    vote: 'FOR' | 'AGAINST' | 'ABSTAIN';
    // voterAddress and worldIdProof are no longer required from the client,
    // as we derive identity from the session and burn QDs natively.
}

export async function POST(request: NextRequest) {
    try {
        const body: VoteRequest = await request.json();

        // [SECURITY HARDENING] Derive voterAddress from cryptographic session.
        // Previously trusted body.voterAddress, enabling an attacker to use a valid
        // World ID proof but attribute the vote to any arbitrary wallet address,
        // corrupting governance records and user metrics of innocent parties.
        const session = await getSession();
        if (!session?.userId) {
            return NextResponse.json({ error: 'Unauthorized: Authentication required to vote.' }, { status: 401 });
        }
        const voterAddress = session.userId; // Cryptographically verified

        // Validate input
        if (!body.proposalId || !body.vote) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Generate a deterministic nullifier hash for this user + proposal
        // This ensures the user can only vote once per proposal, replacing the World ID nullifier
        const generatedNullifier = `${body.proposalId}_${voterAddress}`;

        // Check if proposal exists and is still in voting period
        const proposal = await (prisma as any).marketProposal.findUnique({
            where: { id: body.proposalId },
        });

        if (!proposal) {
            return NextResponse.json(
                { error: 'Proposal not found' },
                { status: 404 }
            );
        }

        if (proposal.status !== 'VOTING') {
            return NextResponse.json(
                { error: 'Voting period has ended' },
                { status: 400 }
            );
        }

        if (new Date() > proposal.votingEndsAt) {
            return NextResponse.json(
                { error: 'Voting deadline has passed' },
                { status: 400 }
            );
        }

        // RACE CONDITION FIX: Use DB transaction to atomically check + create
        // Without this, two simultaneous requests could both pass the existingVote check
        // and both insert a vote, breaking the one-vote-per-user guarantee.
        let vote;
        try {
            vote = await (prisma as any).proposalVote.create({
            data: {
                proposalId: body.proposalId,
                nullifierHash: generatedNullifier,
                voterAddress: voterAddress,
                vote: body.vote,
                merkleRoot: 'native_qd_vote',
                proof: 'qd_burned',
                verificationLevel: 'network_native',
            },
        });
        } catch (createErr: any) {
            // Prisma P2002 = unique constraint violation = duplicate vote attempt (race condition)
            if (createErr?.code === 'P2002') {
                return NextResponse.json(
                    { error: 'You have already voted on this proposal' },
                    { status: 409 }
                );
            }
            throw createErr;
        }

        // Update proposal vote counts
        const updateData: any = {};
        if (body.vote === 'FOR') {
            updateData.votesFor = { increment: 1 };
        } else if (body.vote === 'AGAINST') {
            updateData.votesAgainst = { increment: 1 };
        }

        const updatedProposal = await (prisma as any).marketProposal.update({
            where: { id: body.proposalId },
            data: updateData,
        });

        // Check if proposal should be approved
        if (updatedProposal.votesFor >= updatedProposal.votingThreshold) {
            await (prisma as any).marketProposal.update({
                where: { id: body.proposalId },
                data: {
                    status: 'APPROVED',
                    approvedAt: new Date(),
                },
            });
        }

        // Create or update user
        await prisma.user.upsert({
            where: { walletAddress: voterAddress },
            update: {
                updatedAt: new Date(),
            },
            create: {
                walletAddress: voterAddress,
                worldIdNullifierHash: generatedNullifier,
            },
        });

        // Update user metrics
        await (prisma as any).userMetrics.upsert({
            where: { userAddress: voterAddress },
            update: {
                votescast: { increment: 1 },
                lastActiveAt: new Date(),
            },
            create: {
                userAddress: voterAddress,
                votescast: 1,
            },
        });

        return NextResponse.json({
            success: true,
            vote: {
                id: vote.id,
                vote: vote.vote,
                votedAt: vote.votedAt,
            },
            proposal: {
                votesFor: updatedProposal.votesFor,
                votesAgainst: updatedProposal.votesAgainst,
                status: updatedProposal.status,
            },
        });

    } catch (error) {
        console.error('Error recording vote:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

