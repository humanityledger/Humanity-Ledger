import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, withRateLimitHeaders } from '@/lib/middleware/apiAuth';
import { isTokenAllowed, PlanTier } from '@/lib/node_infrastructure/tiers';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    // True enables HMAC signature enforcement if the user's tier requires it
    const access = await withApiAuth(request, true);
    if (access.error) return access.error;

    const { tier } = access.auth!;

    // 1. Parse Query Params
    const url = new URL(request.url);
    const symbol = url.searchParams.get('symbol') || 'BTC';
    const resolution = url.searchParams.get('resolution') || '1d';

    // 2. Validate Token Access Based on Tier
    if (!isTokenAllowed(tier as PlanTier, symbol)) {
        const response = NextResponse.json(
             { error: `Access to token ${symbol} is not included in the ${tier} plan.` },
             { status: 403 }
        );
        return withRateLimitHeaders(response, access.auth!);
    }

    // 3. Real Data Query (Phase 6: Logic Eradicated)
    const candles = await (prisma as any).exchangeCandle.findMany({
        where: { 
            symbol: symbol.endsWith('USDT') ? symbol : `${symbol}USDT`,
            interval: resolution
        },
        orderBy: { timestamp: 'desc' },
        take: 100
    });

    if (candles.length === 0) {
        const response = NextResponse.json({ 
            symbol, 
            resolution, 
            data: [], 
            message: "No historical data found for this symbol/interval." 
        });
        return withRateLimitHeaders(response, access.auth!);
    }

    const realData = {
        symbol,
        resolution,
        timestamp: Date.now(),
        provider: 'HumanityLedger Elite Engine (Real-Time)',
        tier,
        data: candles.map((c: any) => ({
            time: Number(c.timestamp),
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
            volume: Number(c.volume)
        }))
    };

    // 4. Return with Rate Limit Headers injected
    const response = NextResponse.json(realData);
    return withRateLimitHeaders(response, access.auth!);
}
