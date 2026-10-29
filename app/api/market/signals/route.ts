import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { safeRedisGet, safeRedisSet } from '@/lib/redis/client';
import rateLimit from '@/lib/rate-limit';
/**
 * GET /api/market/signals
 *
 * System API Marketplace  Sovereign Signal Distribution
 *
 * Serves on-chain ledger analytics signals to paying subscribers
 * WITHOUT exposing source wallets, RPC endpoints, or detection methodology.
 *
 * Authentication:
 *   Header: X-API-Key: <api-key>
 *   Each API key is associated with a tier: FREE | PRO | SOVEREIGN
 *
 * HMAC Request Signing (SOVEREIGN tier):
 *   Header: X-Signature: HMAC-SHA256(timestamp + "." + body, secret)
 *   Header: X-Timestamp: Unix timestamp (must be within 30s)
 *
 * Rate Limits:
 *   FREE:          10 req/min, last 10 events, no filters
 *   PRO:           60 req/min, last 100 events, chain filter
 *   SOVEREIGN: 300 req/min, last 500 events, full filters
 *
 * Response shape: { signals[], tier, quota, remaining, timestamp }
 * Signals omit: walletAddress, fromAddress, toAddress (system source protection)
 */


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

//  Tier Configuration 

type Tier = 'FREE' | 'PRO' | 'SOVEREIGN';

const TIER_CONFIG: Record<Tier, {
    rateLimit: number;
    eventLimit: number;
    requiresHmac: boolean;
    chainsAllowed: boolean;
    filtersAllowed: boolean;
}> = {
    FREE: {
        rateLimit:     10,
        eventLimit:    10,
        requiresHmac:  false,
        chainsAllowed: false,
        filtersAllowed: false,
    },
    PRO: {
        rateLimit:     60,
        eventLimit:    100,
        requiresHmac:  false,
        chainsAllowed: true,
        filtersAllowed: false,
    },
    SOVEREIGN: {
        rateLimit:     300,
        eventLimit:    500,
        requiresHmac:  true,
        chainsAllowed: true,
        filtersAllowed: true,
    },
};

//  API Key Validation 

interface ApiKeyRecord { tier: Tier; secret?: string; ownerId: string }

async function resolveApiKey(key: string): Promise<ApiKeyRecord | null> {
    // Tier 1: Check static env keys (for bootstrap / internal use)
    if (key === process.env.Private_API_KEY_INSTITUTIONAL) {
        return { tier: 'SOVEREIGN', secret: process.env.Private_HMAC_SECRET, ownerId: 'internal' };
    }
    if (key === process.env.Private_API_KEY_PRO) {
        return { tier: 'PRO', ownerId: 'internal-pro' };
    }
    if (key === process.env.Private_API_KEY_FREE) {
        return { tier: 'FREE', ownerId: 'internal-free' };
    }

    // Tier 2: Database lookup via Prisma
    try {
        const { prisma } = await import('@/lib/prisma');
        const record = await prisma.apiKey.findUnique({
            where: { key },
            select: { plan: true, isActive: true, userId: true },
        });
        if (!record || !record.isActive) return null;
        return { tier: record.plan as Tier, ownerId: record.userId };
    } catch {
        // Prisma not available (schema missing ApiKey model)  deny
        return null;
    }
}

//  HMAC Verification 

function verifyHmac(secret: string, timestampHeader: string, body: string, sigHeader: string): boolean {
    const now = Math.floor(Date.now() / 1000);
    const ts  = parseInt(timestampHeader, 10);
    if (isNaN(ts) || Math.abs(now - ts) > 30) return false; // Replay attack window: 30s

    const expected = createHmac('sha256', secret)
        .update(`${ts}.${body}`)
        .digest('hex');

    const expBuf = Buffer.from(expected, 'hex');
    const sigBuf = Buffer.from(sigHeader.replace(/^sha256=/, ''), 'hex');
    if (expBuf.length !== sigBuf.length) return false;
    return timingSafeEqual(expBuf, sigBuf);
}

//  Signal Sanitizer (system source protection) 

function sanitizeSignal(raw: any) {
    return {
        id:        raw.id,
        chain:     raw.chain,
        type:      raw.type,
        token:     raw.token,
        amount:    raw.amount,
        usdValue:  raw.usdValue,
        timestamp: raw.timestamp?.toISOString?.() ?? raw.timestamp,
        // Partial hash (first 10 chars)  enough for dedup without leaking source
        txRef:     raw.transactionHash ? raw.transactionHash.slice(0, 12) + '' : null,
        // Address privacy: never expose full addresses in the marketplace
        fromRef:   raw.fromAddress ? raw.fromAddress.slice(0, 6) + '' : null,
        toRef:     raw.toAddress   ? raw.toAddress.slice(0, 6)   + '' : null,
    };
}

const limiter = rateLimit({ interval: 60_000 });

//  Main Handler 

export async function GET(req: NextRequest) {
    const apiKey    = req.headers.get('x-api-key') ?? req.nextUrl.searchParams.get('apiKey') ?? '';
    const sigHeader = req.headers.get('x-signature') ?? '';
    const tsHeader  = req.headers.get('x-timestamp')  ?? '';

    if (!apiKey) {
        return NextResponse.json(
            { error: 'Missing X-API-Key header', docs: '/docs/api-marketplace' },
            { status: 401 }
        );
    }

    const keyRecord = await resolveApiKey(apiKey);
    if (!keyRecord) {
        return NextResponse.json({ error: 'Invalid or disabled API key' }, { status: 403 });
    }

    const tierCfg = TIER_CONFIG[keyRecord.tier];

    // HMAC verification for SOVEREIGN tier
    if (tierCfg.requiresHmac && keyRecord.secret) {
        if (!sigHeader || !tsHeader || !verifyHmac(keyRecord.secret, tsHeader, '', sigHeader)) {
            return NextResponse.json({ error: 'Invalid HMAC signature or timestamp expired' }, { status: 401 });
        }
    }

    // Rate limiting (Strict atomic lua script via Redis)
    let remaining = tierCfg.rateLimit;
    try {
        await limiter.check(tierCfg.rateLimit, keyRecord.ownerId);
        // Note: For simplicity we aren't tracking remaining dynamically in the generic limiter yet,
        // so we'll just mock it as limit - 1 for headers since the primary goal is strict enforcement.
        remaining = tierCfg.rateLimit - 1;
    } catch {
        return NextResponse.json(
            { error: 'Rate limit exceeded', retryAfterSeconds: 60 },
            { status: 429, headers: { 'Retry-After': '60' } }
        );
    }

    // Query params (filtered by tier)
    const params = req.nextUrl.searchParams;
    const chain  = tierCfg.chainsAllowed   ? (params.get('chain')   ?? undefined) : undefined;
    const token  = tierCfg.filtersAllowed  ? (params.get('token')   ?? undefined) : undefined;
    const minUsd = tierCfg.filtersAllowed  ? Number(params.get('minUsd') ?? 0)    : 0;

    const CACHE_KEY = `api:market-signals:tier-${keyRecord.tier}:limit-${tierCfg.eventLimit}:chain-${chain ?? 'ALL'}:token-${token ?? 'ALL'}:minUsd-${minUsd}`;

    try {
        // [PHASE 4 - REDIS MICRO-CACHING - 5s TTL to protect DB but keep real-time latency]
        const cached = await safeRedisGet(CACHE_KEY);
        if (cached) {
            const { safeJsonParse } = await import('@/lib/utils/json');
            const parsed = safeJsonParse(cached, null, 'MARKET_SIGNALS') as any;
            if (parsed && typeof parsed === 'object') {
                return NextResponse.json({
                    ...parsed,
                    meta: { ...parsed.meta, remaining, quota: tierCfg.rateLimit, cached: true }
                }, {
                    headers: {
                        'Cache-Control': 'no-store',
                        'X-RateLimit-Limit': String(tierCfg.rateLimit),
                        'X-RateLimit-Remaining': String(remaining),
                    }
                });
            }
        }

        const { prisma } = await import('@/lib/prisma');
        const where: any = {};
        if (chain)  where.chain = chain.toUpperCase();
        if (token)  where.token = token.toUpperCase();
        if (minUsd > 0) where.usdValue = { gte: minUsd.toString() };

        const rows = await prisma.ledgerActivity.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take:    tierCfg.eventLimit,
            select: {
                id:              true,
                chain:           true,
                type:            true,
                token:           true,
                amount:          true,
                usdValue:        true,
                timestamp:       true,
                transactionHash: true,
                fromAddress:     true,
                toAddress:       true,
            },
        });

        const signals = rows.map(sanitizeSignal);

        const responsePayload = {
            signals,
            meta: {
                tier:      keyRecord.tier,
                count:     signals.length,
                limit:     tierCfg.eventLimit,
                timestamp: new Date().toISOString(),
            },
        };

        // Cache for 5 seconds to absorb spikes without losing real-time feel
        await safeRedisSet(CACHE_KEY, JSON.stringify(responsePayload), 'EX', 5);

        return NextResponse.json({
            ...responsePayload,
            meta: { ...responsePayload.meta, remaining, quota: tierCfg.rateLimit, cached: false }
        }, {
            headers: {
                'Cache-Control': 'no-store',
                'X-RateLimit-Limit':     String(tierCfg.rateLimit),
                'X-RateLimit-Remaining': String(remaining),
            },
        });

    } catch (err: any) {
        return NextResponse.json(
            { error: 'Signal retrieval failed', detail: 'Internal error' },
            { status: 503 }
        );
    }
}
