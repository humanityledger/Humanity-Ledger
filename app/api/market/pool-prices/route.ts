/**
 * GET /api/market/pool-prices
 * 
 * Returns real UniswapV3 on-chain pool prices via GetBlock EP4 (slot0).
 * Uses: https://go.getblock.io/28362d2830a5473a840edab3fda9fc3c
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPoolPrices } from '@/lib/blockchain/getblock-engine';

export const dynamic = 'force-dynamic';
export const runtime  = 'nodejs';

// Cache responses for 30 seconds to avoid hammering GetBlock CUs
const responseCache = new Map<string, { data: any; expires: number }>();

export async function GET(_req: NextRequest) {
  const cacheKey = 'pool-prices';
  const cached = responseCache.get(cacheKey);

  if (cached && cached.expires > Date.now()) {
    return NextResponse.json({ ...cached.data, cached: true });
  }

  try {
    const pools = await getPoolPrices();

    const result = {
      ok: true,
      pools,
      fetchedAt: new Date().toISOString(),
      source: 'getblock-ep4-uniswapv3',
    };

    responseCache.set(cacheKey, { data: result, expires: Date.now() + 30_000 });

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' },
    });
  } catch (err: any) {
    console.error('[PoolPrices] Error:', err.message);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch pool prices.', detail: 'Internal error' },
      { status: 502 }
    );
  }
}
