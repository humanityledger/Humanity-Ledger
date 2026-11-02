/**
 * GET  /api/leaderboard/hall-of-fame
 *   Returns the top community detections ordered by verified USD impact.
 *
 * POST /api/leaderboard/hall-of-fame
 *   Submit a community detection for verification.
 *   Body: { walletAddress, txHash, chain, description }
 *
 * A "detection" is a ledger event that was:
 *   1. First flagged by a non-sovereign community member, AND
 *   2. Verified on-chain (transactionHash exists in ledgerActivity)
 *
 * Each verified submission earns the submitter:
 *   - A "Sentinel" badge on their profile
 *   - Leaderboard ranking by total verified USD detected
 *   - Hall of Fame entry after 3+ verifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { safeRedisGet, safeRedisSet } from '@/lib/redis/client';
import { safeJsonParse } from '@/lib/utils/json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

//  GET  Fetch Hall of Fame 

export async function GET(req: NextRequest) {
    const params    = req.nextUrl.searchParams;
    const limit     = Math.min(100, Number(params.get('limit') ?? 20));
    const minDetect = Number(params.get('minDetections') ?? 1);

    const CACHE_KEY = `api:hall-of-fame:limit-${limit}:min-${minDetect}`;

    try {
        // [PHASE 4 - REDIS CACHE FAST PATH]
        const cached = await safeRedisGet(CACHE_KEY);
        if (cached && cached !== 'TIMEOUT') {
            const parsed = safeJsonParse(cached, null, 'HALL_OF_FAME');
            if (parsed) return NextResponse.json(parsed);
        }

        const { prisma } = await import('@/lib/prisma');

        // Aggregate community detections from ledgerActivity where metadata.communityDetection = true
        const detections = await (prisma as any).communityDetection?.findMany?.({
            where:   { verified: true, detectionCount: { gte: minDetect } },
            orderBy: { totalUsdDetected: 'desc' },
            take:    limit,
            include: { user: { select: { id: true, name: true, image: true } } },
        });

        // Graceful fallback: if table not yet migrated, aggregate from ledgerActivity metadata
        if (!detections) {
            const rows = await prisma.ledgerActivity.findMany({
                where: {
                    metadata: { path: ['communityDetection'], equals: true },
                },
                orderBy: { usdValue: 'desc' },
                take: limit * 3,
                select: {
                    id: true, chain: true, token: true, usdValue: true,
                    transactionHash: true, timestamp: true, metadata: true,
                },
            });

            // Group by detector wallet (from metadata.detectorWallet)
            const grouped: Record<string, any> = {};
            for (const row of rows) {
                const meta = row.metadata as any;
                const dw   = meta?.detectorWallet ?? 'anonymous';
                if (!grouped[dw]) {
                    grouped[dw] = {
                        detectorWallet:    dw,
                        detectorAlias:     meta?.detectorAlias ?? `Sentinel_${dw.slice(0, 6)}`,
                        detectionCount:    0,
                        totalUsdDetected:  0,
                        topDetection:      null,
                        firstDetectedAt:   null,
                    };
                }
                grouped[dw].detectionCount++;
                grouped[dw].totalUsdDetected += Number(row.usdValue);
                if (!grouped[dw].topDetection || Number(row.usdValue) > grouped[dw].topDetection.usdValue) {
                    grouped[dw].topDetection = {
                        txHash:    row.transactionHash,
                        chain:     row.chain,
                        token:     row.token,
                        usdValue:  Number(row.usdValue),
                        timestamp: row.timestamp,
                    };
                }
                if (!grouped[dw].firstDetectedAt || row.timestamp < grouped[dw].firstDetectedAt) {
                    grouped[dw].firstDetectedAt = row.timestamp;
                }
            }

            const sorted = Object.values(grouped)
                .filter((g: any) => g.detectionCount >= minDetect)
                .sort((a: any, b: any) => b.totalUsdDetected - a.totalUsdDetected)
                .slice(0, limit)
                .map((entry: any, i: number) => ({
                    rank:            i + 1,
                    ...entry,
                    totalUsdFormatted: `$${(entry.totalUsdDetected / 1e6).toFixed(2)}M`,
                    badge:           entry.detectionCount >= 10 ? ' GRAND SENTINEL'
                        : entry.detectionCount >= 5 ? ' ELITE SENTINEL'
                        : entry.detectionCount >= 3 ? ' SENTINEL'
                        : ' WATCHER',
                }));

            const responsePayload = {
                hallOfFame: sorted,
                totalEntries: sorted.length,
                source:        'fallback-aggregation',
                updatedAt:     new Date().toISOString(),
                cached:        true,
            };

            await safeRedisSet(CACHE_KEY, JSON.stringify(responsePayload), 'EX', 60);

            return NextResponse.json({ ...responsePayload, cached: false });
        }

        const responsePayload = {
            hallOfFame:   detections,
            totalEntries: detections.length,
            source:       'community-detection-table',
            updatedAt:    new Date().toISOString(),
            cached:       true,
        };

        await safeRedisSet(CACHE_KEY, JSON.stringify(responsePayload), 'EX', 60);

        return NextResponse.json({ ...responsePayload, cached: false });

    } catch (err: any) {
        return NextResponse.json(
            { error: 'Hall of Fame unavailable', detail: 'Internal error' },
            { status: 503 }
        );
    }
}

//  POST  Submit Community Detection 

export async function POST(req: NextRequest) {
    try {
        const { getSession } = await import('@/lib/session');
        const session = await getSession();
        if (!session?.userId) {
            return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
        }
        const walletAddress = session.userId;

        const body = await req.json();
        const { txHash, chain, description } = body;

        // Invalidate Hall of Fame CACHE if new detection enters CACHE_KEY might vary by params, so we can wipe the base if we used a wildcard mechanism, but here we update records async.
        const INVALIDATE_CACHE_KEY = `api:hall-of-fame:limit-20:min-1`;
        await safeRedisSet(INVALIDATE_CACHE_KEY, '', 'EX', 1);

        if (!txHash || !chain) {
            return NextResponse.json(
                { error: 'Missing required fields: txHash, chain' },
                { status: 400 }
            );
        }

        const { prisma } = await import('@/lib/prisma');

        // Verify the detection exists in our on-chain DB (no fabrication allowed)
        const verified = await prisma.ledgerActivity.findUnique({
            where: { transactionHash: txHash },
        });

        if (!verified) {
            return NextResponse.json(
                { error: 'Transaction not found in system database. Verification failed.' },
                { status: 404 }
            );
        }

        // Tag the existing record with community detection metadata
        await prisma.ledgerActivity.update({
            where: { transactionHash: txHash },
            data: {
                metadata: {
                    ...(verified.metadata as object),
                    communityDetection: true,
                    detectorWallet:     walletAddress,
                    detectorAlias:      `Sentinel_${walletAddress.slice(0, 6)}`,
                    detectionNote:      description?.slice(0, 500) ?? null,
                    detectedAt:         new Date().toISOString(),
                },
            },
        });

        return NextResponse.json({
            success:   true,
            verified:  true,
            txHash,
            chain:     verified.chain,
            usdValue:  verified.usdValue,
            message:   ' Detection verified and recorded to Hall of Fame.',
            badge:     'You have earned the  WATCHER badge. Keep detecting!',
        });

    } catch (err: any) {
        return NextResponse.json(
            { error: 'Submission failed', detail: 'Internal error' },
            { status: 500 }
        );
    }
}
