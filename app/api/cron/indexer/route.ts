/**
 * GET /api/cron/indexer
 *
 * Railway Cron Job endpoint  triggered every 15 seconds by Railway's scheduler.
 * Runs all aggregation cycles to pre-index data from the 1TB PostgreSQL store into Redis.
 *
 * Security: Protected by CRON_SECRET header (set in Railway env vars).
 */

import { NextRequest, NextResponse } from 'next/server';
import { runAllAggregations } from '@/lib/indexer/aggregation-service';
import { isCronAuthorized } from '@/lib/security/cronAuth';

export const dynamic  = 'force-dynamic';
export const runtime  = 'nodejs';
export const maxDuration = 60; // Maximum 60s for cron completions on Railway

export async function GET(req: NextRequest) {
    // Validate the cron secret to prevent unauthorized triggering
    // Open to everyone when CRON_SECRET was unset; now refused instead.
    if (!isCronAuthorized(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const start = Date.now();
        await runAllAggregations();
        const elapsed = Date.now() - start;

        return NextResponse.json({
            status: 'ok',
            message: '1TB indexing cycle complete',
            elapsedMs: elapsed,
            timestamp: new Date().toISOString(),
        });
    } catch (err: any) {
        console.error('[CRON/INDEXER] Fatal:', err);
        return NextResponse.json(
            { error: 'Aggregation failed' },
            { status: 500 }
        );
    }
}
