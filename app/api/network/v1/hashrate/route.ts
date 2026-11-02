import { NextResponse } from 'next/server';

// 
// /api/network/v1/hashrate  Real Bitcoin Network Hashrate
// Source: mempool.space (public, no API key needed)
// Returns current hashrate in EH/s + 30-day history
// 

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Fetch current hashrate and blocks from mempool.space
        const [hashrateRes, blocksRes] = await Promise.all([
            fetch('https://mempool.space/api/v1/mining/hashrate/1m', {
                next: { revalidate: 60 }
            }),
            fetch('https://mempool.space/api/v1/blocks', {
                next: { revalidate: 60 }
            })
        ]);

        if (!hashrateRes.ok) throw new Error('mempool.space hashrate unavailable');

        const hashrateData = await hashrateRes.json();
        const blocks = blocksRes.ok ? await blocksRes.json() : [];

        // mempool.space returns hashrates in H/s  convert to EH/s (/ 1e18)
        const hashratePoints = (hashrateData.hashrates || []).map((h: any) => ({
            time: h.timestamp * 1000,
            hashrate: h.avgHashrate / 1e18, // Convert H/s  EH/s
        }));

        // Use the currentHashrate provided by the API (if missing, use the last point)
        const currentEHS = hashrateData.currentHashrate 
            ? hashrateData.currentHashrate / 1e18 
            : (hashratePoints.length > 0 ? hashratePoints[hashratePoints.length - 1].hashrate : null);

        // Derive average block time from last 6 blocks (real data)
        let avgBlockTimeMin = 10; // fallback
        if (blocks.length >= 2) {
            const times = blocks.slice(0, 6).map((b: any) => b.timestamp);
            const diffs = [];
            for (let i = 0; i < times.length - 1; i++) {
                diffs.push(Math.abs(times[i] - times[i + 1]));
            }
            const avgSec = diffs.reduce((a: number, b: number) => a + b, 0) / diffs.length;
            avgBlockTimeMin = avgSec / 60;
        }

        return NextResponse.json({
            current: currentEHS,
            unit: 'EH/s',
            history: hashratePoints.slice(-30), // last 30 data points
            avgBlockTimeMin: parseFloat(avgBlockTimeMin.toFixed(2)),
            latestBlockHeight: blocks[0]?.height || null,
            updatedAt: Date.now(),
        });

    } catch (err) {
        console.error('[Hashrate API]', err);
        return NextResponse.json({
            error: 'Hashrate data temporarily unavailable',
            current: null,
            unit: 'EH/s',
            history: [],
            avgBlockTimeMin: null,
        }, { status: 500 });
    }
}


