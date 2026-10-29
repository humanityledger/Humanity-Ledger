/**
 * GET /api/sectors/rankings
 *
 * Serves sector rankings (Z-Score + TVL) from the pre-computed
 * Redis aggregation index (idx:sectors:rankings).
 *
 * Used by the MacroDashboard Sector Heat Map.
 * On cache-miss, falls back to Prisma and repopulates the index.
 */

import { NextRequest, NextResponse } from 'next/server';
import { safeRedisGet, safeRedisSet } from '@/lib/redis/client';
import { safeJsonParse } from '@/lib/utils/json';
import { AGGREGATION_KEYS } from '@/lib/indexer/aggregation-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    try {
        //  Fast path 
        const cached = await safeRedisGet(AGGREGATION_KEYS.SECTOR_RANKINGS);
        if (cached && cached !== 'TIMEOUT') {
            const parsed = safeJsonParse(cached, null, 'SECTOR_RANKINGS');
            if (parsed) {
                return NextResponse.json(parsed, {
                    headers: { 'X-Cache': 'HIT', 'Cache-Control': 'no-store' },
                });
            }
        }

        //  Cache miss: direct Prisma query + repopulate 
        const { prisma } = await import('@/lib/prisma');

        const sectors = await prisma.sector.findMany({
            select: {
                id: true,
                slug: true,
                name: true,
                zScore: true,
                totalTvl: true,
                volume24h: true,
            },
            orderBy: [{ zScore: 'desc' }, { totalTvl: 'desc' }],
            take: 103, // Full 103-sector coverage
        });

        const payload = {
            updatedAt: new Date().toISOString(),
            data: sectors,
        };

        await safeRedisSet(
            AGGREGATION_KEYS.SECTOR_RANKINGS,
            JSON.stringify(payload),
            'EX', 60
        );

        return NextResponse.json(payload, {
            headers: { 'X-Cache': 'MISS', 'Cache-Control': 'no-store' },
        });

    } catch (err: any) {
        return NextResponse.json(
            { error: 'Sector rankings unavailable', detail: 'Internal error' },
            { status: 503 }
        );
    }
}
