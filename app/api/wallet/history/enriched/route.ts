import { NextRequest, NextResponse } from 'next/server';
import { isAddress } from 'viem';
import { getEnrichedHistory } from '@/lib/wallet/activities-server';
import { withCache, CacheTTL, addressCacheKey } from '@/lib/cache/redis-cache';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');

    if (!userAddress || !isAddress(userAddress)) {
        return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 });
    }

    try {
        const cacheKey = addressCacheKey(userAddress, 'enriched-history');
        
        const data = await withCache(
            cacheKey,
            () => getEnrichedHistory(userAddress),
            { ttl: CacheTTL.TRANSACTION_HISTORY }
        );

        return NextResponse.json(data, {
            status: 200,
            headers: {
                'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
                'Content-Type': 'application/json',
            },
        });

    } catch (error) {
        console.error('Enriched History API Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch enriched history', activities: [] },
            { status: 500 }
        );
    }
}

