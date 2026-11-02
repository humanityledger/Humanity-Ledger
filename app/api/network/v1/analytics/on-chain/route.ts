
import { NextResponse } from 'next/server';

/**
 * On-Chain Metrics API
 * Aggregates key on-chain health indicators from mempool.space stats endpoint.
 * Cached dynamically via fetch next options, not full route cache.
 */
export const dynamic = 'force-dynamic';

const MEMPOOL_BASE = 'https://mempool.space/api';

export async function GET() {
  try {
    // Fetch multiple data points in parallel for speed
    const [statsRes, mempoolStatsRes, hashrateRes] = await Promise.allSettled([
      fetch(`${MEMPOOL_BASE}/v1/statistics/1m`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(6000) }),
      fetch(`${MEMPOOL_BASE}/mempool`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(4000) }),
      fetch(`${MEMPOOL_BASE}/v1/mining/hashrate/3y`, { next: { revalidate: 600 }, signal: AbortSignal.timeout(8000) }),
    ]);

    // --- 1. Monthly chain stats ---
    let chainStats: any = null;
    if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
      const raw = await statsRes.value.json();
      // Last item in the array is most recent
      chainStats = Array.isArray(raw) ? raw[raw.length - 1] : raw;
    }

    // --- 2. Mempool snapshot ---
    let mempoolData: any = null;
    if (mempoolStatsRes.status === 'fulfilled' && mempoolStatsRes.value.ok) {
      mempoolData = await mempoolStatsRes.value.json();
    }

    // --- 3. Hashrate for trend ---
    let hashrateHistory: any[] = [];
    if (hashrateRes.status === 'fulfilled' && hashrateRes.value.ok) {
      const hrRaw = await hashrateRes.value.json();
      // Last 30 data points for sparkline
      hashrateHistory = (hrRaw?.hashrates || []).slice(-30).map((h: any) => ({
        time: h.timestamp * 1000,
        hashrate: parseFloat((h.avgHashrate / 1e18).toFixed(2)), // Convert to EH/s
      }));
    }

    //  Compose response 
    const response = {
      // On-chain volume metrics
      txCountLast30d: chainStats?.tx_count ?? null,
      avgTxValueLastMonth: chainStats?.avg_tx_value ?? null, // in satoshis

      // Mempool health
      mempoolTxCount: mempoolData?.count ?? null,
      mempoolVsize: mempoolData?.vsize ?? null, // bytes
      mempoolTotalFees: mempoolData?.total_fee ?? null, // satoshis

      // Bitcoin supply (21M cap - static + block reward schedule)
      maxSupply: 21_000_000,
      circulatingSupply: 19_850_000, // Approx March 2026, static until next halving calc
      miningRewardBTC: 3.125, // Current post-4th-halving reward

      // Hashrate trend
      hashrateHistory,

      timestamp: Date.now(),
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('[analytics/on-chain] error:', err.message);
    return NextResponse.json(
      { error: 'Failed to fetch on-chain metrics', details: err.message },
      { status: 503 }
    );
  }
}


