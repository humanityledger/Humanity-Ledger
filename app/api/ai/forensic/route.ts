import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/services/AIService';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/forensic
 * Performs AI forensic analysis on a blockchain address.
 * Requires authentication -- unauthenticated callers cannot probe addresses
 * (prevents adversarial enumeration of known wallets via our AI pipeline).
 */
export async function POST(req: NextRequest) {
    // Auth gate -- must be a logged-in user
    const session = await getSession();
    if (!session?.userId) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    try {
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        const { address, context } = body;

        if (!address || typeof address !== 'string') {
            return NextResponse.json({ error: 'address is required' }, { status: 400 });
        }
        // Validate address format -- 0x + 40 hex chars (EVM) or tx hash (0x + 64 hex)
        if (!/^0x[a-fA-F0-9]{40}$/.test(address) && !/^0x[a-fA-F0-9]{64}$/.test(address)) {
            return NextResponse.json({ error: 'Invalid address format' }, { status: 400 });
        }
        // Sanitize context structure with safe limits to prevent prompt injection & DoS
        const safeContext = {
            transactionCount: typeof context?.transactionCount === 'number' ? Math.max(0, Math.min(1_000_000, context.transactionCount)) : 0,
            activeAgeDays: typeof context?.activeAgeDays === 'number' ? Math.max(0, Math.min(36_500, context.activeAgeDays)) : 0,
            historySnippet: Array.isArray(context?.historySnippet) ? context.historySnippet.slice(0, 50) : [],
            defiPositions: Array.isArray(context?.defiPositions) ? context.defiPositions.slice(0, 50) : [],
            washAttestingMetrics: context?.washAttestingMetrics ? {
                score: typeof context.washAttestingMetrics.score === 'number' ? context.washAttestingMetrics.score : 0,
                patterns: Array.isArray(context.washAttestingMetrics.patterns) ? context.washAttestingMetrics.patterns.slice(0, 20) : []
            } : undefined
        };

        const analysis = await aiService.analyzeAddressForensics(address, safeContext);

        return NextResponse.json(analysis);
    } catch (error: any) {
        console.error('[API:Forensic] Error performing analysis');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
