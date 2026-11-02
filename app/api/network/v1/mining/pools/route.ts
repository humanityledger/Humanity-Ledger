import { NextResponse } from 'next/server';

/**
 * Mining Pool Distribution API
 * Source: mempool.space /api/v1/mining/pools/1w
 * Mining Pools API
 * Fetches the hashrate distribution among top mining pools from mempool.space.
 * Cached dynamically via fetch next options, not full route cache.
 */
export const dynamic = 'force-dynamic';

const MEMPOOL_BASE = 'https://mempool.space/api';

interface MempoolPool {
  name: string;
  link: string;
  blockCount: number;
  rank: number;
  emptyBlocks: number;
  slug: string;
  avgMatchRate: number | null;
  avgFeeDelta: string | null;
  poolUniqueId: number;
}

interface MempoolPoolsResponse {
  pools: MempoolPool[];
  blockCount: number;
  lastEstimatedHashrate: number;
}

export async function GET() {
  try {
    const res = await fetch(`${MEMPOOL_BASE}/v1/mining/pools/1w`, {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(8000),
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`mempool.space responded with ${res.status}`);
    }

    const raw: MempoolPoolsResponse = await res.json();

    const totalBlocks = raw.blockCount || 1;
    const topPools = raw.pools.slice(0, 12); // Top 12 pools

    const formattedPools = topPools.map((pool) => ({
      name: pool.name,
      slug: pool.slug,
      blockCount: pool.blockCount,
      percentage: parseFloat(((pool.blockCount / totalBlocks) * 100).toFixed(2)),
      avgMatchRate: pool.avgMatchRate,
    }));

    // Aggregate smaller pools into "Others" bucket
    const displayedBlocks = formattedPools.reduce((acc, p) => acc + p.blockCount, 0);
    const othersBlocks = totalBlocks - displayedBlocks;
    if (othersBlocks > 0) {
      formattedPools.push({
        name: 'Others',
        slug: 'others',
        blockCount: othersBlocks,
        percentage: parseFloat(((othersBlocks / totalBlocks) * 100).toFixed(2)),
        avgMatchRate: null,
      });
    }

    return NextResponse.json({
      pools: formattedPools,
      totalBlocks,
      lastHashrate: raw.lastEstimatedHashrate,
      period: '7d',
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error('[mining/pools] fetch error:', err.message);
    // Return graceful fallback  known major pools (approximate distribution)
    return NextResponse.json({
      pools: [
        { name: 'Foundry USA', slug: 'foundry', blockCount: 280, percentage: 29.2, avgMatchRate: 98.5 },
        { name: 'AntPool', slug: 'antpool', blockCount: 195, percentage: 20.3, avgMatchRate: 97.1 },
        { name: 'F2Pool', slug: 'f2pool', blockCount: 120, percentage: 12.5, avgMatchRate: 96.8 },
        { name: 'SpiderPool', slug: 'spiderpool', blockCount: 95, percentage: 9.9, avgMatchRate: null },
        { name: 'Braiins', slug: 'braiins', blockCount: 78, percentage: 8.1, avgMatchRate: 99.1 },
        { name: 'ViaBTC', slug: 'viabtc', blockCount: 65, percentage: 6.8, avgMatchRate: 97.3 },
        { name: 'Luxor', slug: 'luxor', blockCount: 40, percentage: 4.2, avgMatchRate: null },
        { name: 'Others', slug: 'others', blockCount: 87, percentage: 9.0, avgMatchRate: null },
      ],
      totalBlocks: 960,
      lastHashrate: 800000000000000000000,
      period: '7d',
      timestamp: Date.now(),
      fallback: true,
    });
  }
}


