/**
 * GET /api/top-ledger-events
 *
 * Serves the Top 50 Ledger Events of the last 24h from the pre-computed
 * Redis aggregation index (idx:ledgerevents:top:24h).
 *
 * On cache-miss, falls back to a direct Prisma query and repopulates the index.
 */

import { NextRequest, NextResponse } from 'next/server';
import { safeRedisGet, safeRedisSet } from '@/lib/redis/client';
import { safeJsonParse } from '@/lib/utils/json';
import { AGGREGATION_KEYS } from '@/lib/indexer/aggregation-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    try {
        //  Fast path: pre-computed aggregation index 
        const cached = await safeRedisGet(AGGREGATION_KEYS.TOP_LEDGER_EVENTS_24H);
        if (cached && cached !== 'TIMEOUT') {
            const parsed = safeJsonParse(cached, null, 'TOP_LEDGER_EVENTS');
            if (parsed) {
                return NextResponse.json(parsed, {
                    headers: { 'X-Cache': 'HIT', 'Cache-Control': 'no-store' },
                });
            }
        }

        //  Cache miss: direct Prisma query + repopulate 
        const { prisma } = await import('@/lib/prisma');
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const events = await prisma.globalLedgerEvent.findMany({
            where: { timestamp: { gte: since } },
            orderBy: { amountUSD: 'desc' },
            take: 50,
        });

        const payload = {
            updatedAt: new Date().toISOString(),
            data: events,
        };

        // Repopulate the index for 30 seconds
        await safeRedisSet(
            AGGREGATION_KEYS.TOP_LEDGER_EVENTS_24H,
            JSON.stringify(payload),
            'EX', 30
        );

        return NextResponse.json(payload, {
            headers: { 'X-Cache': 'MISS', 'Cache-Control': 'no-store' },
        });

    } catch (err: any) {
        return NextResponse.json(
            { error: 'Top ledger events unavailable', detail: 'Internal error' },
            { status: 503 }
        );
    }
}
