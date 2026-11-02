import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const [diffAdjRes, hashrateRes] = await Promise.all([
            fetch('https://mempool.space/api/v1/difficulty-adjustment', { next: { revalidate: 60 } }),
            fetch('https://mempool.space/api/v1/mining/hashrate/1m', { next: { revalidate: 60 } })
        ]);

        if (!diffAdjRes.ok || !hashrateRes.ok) throw new Error('Mempool API unavailable');

        const diffAdjData = await diffAdjRes.json();
        const hashrateData = await hashrateRes.json();

        return NextResponse.json({
            difficulty: hashrateData.currentDifficulty || 145000000000000,
            difficultyChange: diffAdjData.difficultyChange || 0,
            progressPercent: diffAdjData.progressPercent || 0,
            estimatedRetargetDate: diffAdjData.estimatedRetargetDate || Date.now(),
            remainingBlocks: diffAdjData.remainingBlocks || 0,
            remainingTime: diffAdjData.remainingTime || 0
        });

    } catch (err) {
        console.error('[Difficulty API]', err);
        return NextResponse.json({
            difficulty: 0,
            difficultyChange: 0,
            progressPercent: 0,
            error: 'Difficulty data temporarily unavailable'
        }, { status: 500 });
    }
}

