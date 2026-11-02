/**
 * DeFi Yield Scanner  Real APY Data
 * Uses DeFiLlama's free public API to scan top yield opportunities across chains.
 * Zero API keys required. 100% real data.
 */
import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const LLAMA_YIELDS = 'https://yields.llama.fi/pools';

// Protocols we trust as non-scam (whitelist)
const TRUSTED_PROTOCOLS = new Set([
    'aave-v3', 'aave-v2', 'compound-v3', 'compound-v2',
    'curve', 'curve-dex', 'convex-finance',
    'lido', 'rocket-pool', 'stader', 'frax-ether',
    'uniswap-v3', 'uniswap-v2',
    'pendle', 'pendle-v2',
    'spark', 'morpho', 'morpho-blue',
    'yearn-finance', 'beefy',
    'gmx', 'gmx-v2', 'gains-network',
    'gearbox', 'exactly',
    'fluid', 'euler', 'silo-finance',
    'radiant-v2', 'benqi',
    'venus', 'alpaca-finance',
    'hop-protocol', 'stargate',
    'balancer-v2', 'balancer-v3',
    'velodrome-v2', 'aerodrome',
    'camelot', 'ramses',
]);

const CHAIN_DISPLAY: Record<string, string> = {
    'Ethereum': 'ETH', 'Arbitrum': 'ARB', 'Base': 'BASE',
    'Optimism': 'OP', 'Polygon': 'MATIC', 'BSC': 'BSC',
    'Avalanche': 'AVAX', 'Solana': 'SOL', 'Fantom': 'FTM',
    'Scroll': 'SCR', 'zkSync Era': 'ZK',
};

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const rawApy = parseFloat(searchParams.get('minApy') || '3');
    const minApy = Math.max(0, isNaN(rawApy) ? 3 : rawApy);
    const chain = searchParams.get('chain') || 'all';
    const asset = searchParams.get('asset') || 'all';
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Math.max(1, Math.min(isNaN(rawLimit) ? 50 : rawLimit, 200));

    try {
        const res = await fetch(LLAMA_YIELDS, {
            headers: { 'Accept': 'application/json' },
            cache: 'no-store'
        });

        if (!res.ok) throw new Error(`DeFiLlama error: ${res.status}`);

        const { data } = await res.json();

        let pools = data
            // Only trusted protocols
            .filter((p: any) => TRUSTED_PROTOCOLS.has(p.project))
            // Min APY filter
            .filter((p: any) => (p.apy || 0) >= minApy)
            // Exclude pools with very low TVL (< $500k  usually inaccurate)
            .filter((p: any) => (p.tvlUsd || 0) >= 500_000)
            // Exclude stable-only if APY > 100% (almost certainly unsustainable)
            .filter((p: any) => !(p.stablecoin && p.apy > 100))
            // No IL risk pools or flag explicitly
            .map((p: any) => ({
                pool: p.pool,
                chain: CHAIN_DISPLAY[p.chain] || p.chain,
                chainFull: p.chain,
                project: p.project,
                symbol: p.symbol?.toUpperCase(),
                apy: parseFloat((p.apy || 0).toFixed(2)),
                apyBase: parseFloat((p.apyBase || 0).toFixed(2)),
                apyReward: parseFloat((p.apyReward || 0).toFixed(2)),
                tvlUsd: p.tvlUsd || 0,
                il7d: p.il7d || 0,
                ilRisk: p.ilRisk || 'no',
                stablecoin: !!p.stablecoin,
                url: p.url || `https://defillama.com/yields/pool/${p.pool}`,
                // Risk score: 1 (safest) to 5 (higher risk)
                riskScore: computeRisk(p),
                // Human readable tier
                tier: computeTier(p.apy || 0),
            }));

        // Apply chain or asset filters
        if (chain !== 'all') pools = pools.filter((p: any) => p.chainFull === chain || p.chain === chain);
        if (asset !== 'all') pools = pools.filter((p: any) => p.symbol?.includes(asset.toUpperCase()));

        // Sort by APY descending
        pools.sort((a: any, b: any) => b.apy - a.apy);
        pools = pools.slice(0, limit);

        const stats = {
            avgApy: pools.reduce((s: number, p: any) => s + p.apy, 0) / (pools.length || 1),
            maxApy: pools[0]?.apy || 0,
            stablePools: pools.filter((p: any) => p.stablecoin).length,
            totalTvl: pools.reduce((s: number, p: any) => s + p.tvlUsd, 0),
        };

        return NextResponse.json({ pools, stats, timestamp: Date.now(), count: pools.length });

    } catch (err: any) {
        console.error('[DEFI_YIELDS]', err.message);
        return NextResponse.json({ error: err.message, pools: [], stats: {}, timestamp: Date.now(), count: 0 }, { status: 500 });
    }
}

function computeRisk(p: any): number {
    let risk = 1;
    if (!p.stablecoin) risk += 1;
    if ((p.ilRisk || 'no') !== 'no') risk += 1;
    if (p.apy > 50) risk += 1;
    if ((p.tvlUsd || 0) < 5_000_000) risk += 1;
    return Math.min(risk, 5);
}

function computeTier(apy: number): string {
    if (apy >= 30) return 'AGGRESSIVE';
    if (apy >= 15) return 'HIGH_YIELD';
    if (apy >= 8) return 'BALANCED';
    if (apy >= 3) return 'CONSERVATIVE';
    return 'MINIMAL';
}
