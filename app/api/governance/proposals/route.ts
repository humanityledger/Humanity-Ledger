/**
 * API Route: Get Proposals
 * GET /api/governance/proposals
 * 
 * Returns all active proposals for governance voting
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const proposals = await (prisma as any).marketProposal.findMany({
            where: {
                status: {
                    in: ['VOTING', 'APPROVED']
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 50 // Limit to 50 most recent proposals
        });

        // Transform the data to match the expected format
        const formattedProposals = proposals.map((proposal: any) => ({
            id: proposal.id,
            question: proposal.question,
            description: proposal.description,
            outcomes: proposal.outcomes || ['Yes', 'No'],
            category: proposal.category,
            creatorAddress: proposal.creatorAddress,
            votes: (proposal.votesFor || 0) + (proposal.votesAgainst || 0),
            createdAt: proposal.createdAt.toISOString(),
        }));

        return NextResponse.json(formattedProposals);

    } catch (error) {
        console.error('Error fetching proposals:', error);
        return NextResponse.json(
            { error: 'Failed to fetch proposals' },
            { status: 500 }
        );
    }
}

