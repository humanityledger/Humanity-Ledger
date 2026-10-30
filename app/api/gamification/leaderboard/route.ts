import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { safeRedisGet, safeRedisSet } from '@/lib/redis/client';
import { safeJsonParse } from '@/lib/utils/json';

/**
 * GET /api/gamification/leaderboard
 * 
 * CORE PERFORMANCE: Ranks sovereign identities by on-chain volume.
 * UTILIZES: Pre-computed Redis index with a 120s freshness window.
 */
export const dynamic = 'force-dynamic';
const CACHE_KEY = 'cache:leaderboard:institutional';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const type  = searchParams.get('type')  || 'volume';
        const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
        const limit = Math.max(1, Math.min(isNaN(rawLimit) ? 50 : rawLimit, 100));

        //  CACHE LAYER (MAXIMA PERFECCION) 
        if (type === 'volume') {
           const cached = await safeRedisGet(`${CACHE_KEY}:${limit}`);
           if (cached && cached !== 'TIMEOUT') {
               const parsed = safeJsonParse(cached, null, 'GAMIFICATION_LEADERBOARD');
               if (parsed) {
                   return NextResponse.json(parsed, {
                       headers: { 'X-Cache': 'HIT', 'Cache-Control': 'no-store' }
                   });
               }
           }
        }

        if (type === 'volume') {
            const grouped = await prisma.$queryRaw<
                Array<{ walletAddress: string; totalUsd: number; txCount: bigint }>
            >`
                SELECT 
                    "walletAddress",
                    SUM(CAST("usdValue" AS FLOAT)) AS "totalUsd",
                    COUNT(*) AS "txCount"
                FROM "LedgerActivity"
                GROUP BY "walletAddress"
                ORDER BY "totalUsd" DESC
                LIMIT ${limit}
            `;

            const entries = grouped.map((row, i) => ({
                rank:          i + 1,
                walletAddress: row.walletAddress,
                username:      `${row.walletAddress.slice(0, 6)}${row.walletAddress.slice(-4)}`,
                value:         Number(row.totalUsd).toFixed(2),
                txCount:       Number(row.txCount),
                badge:         i < 3 ? (['gold', 'silver', 'bronze'] as const)[i] : null,
            }));

            const payload = {
                type,
                entries,
                totalEntries: entries.length,
                source: 'on-chain',
                timestamp: Date.now(),
            };

            // PERSIST TO CACHE
            await safeRedisSet(`${CACHE_KEY}:${limit}`, JSON.stringify(payload), 'EX', 120);

            return NextResponse.json(payload, {
                headers: { 'X-Cache': 'MISS', 'Cache-Control': 'no-store' }
            });
        }

        // For other types (winRate, alpha)  pending real scores
        return NextResponse.json({
            type,
            entries: [],
            source: 'pending',
            message: `Leaderboard type '${type}' requires additional on-chain analytics indexing.`,
            timestamp: Date.now(),
        });

    } catch (error: any) {
        console.error('[API ERROR] Leaderboard:', error);
        return NextResponse.json(
            { error: 'Internal server error', entries: [] },
            { status: 500 }
        );
    }
}
