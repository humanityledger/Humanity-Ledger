import { NextResponse } from 'next/server';
import { mempoolWatcher } from '@/lib/blockchain/MempoolWatcher';

export const runtime = 'nodejs'; // Required for global singletons in memory
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Start the watcher if it isn't running
        mempoolWatcher.startListening();

        // 2. Extract recent buffer directly
        const latest = mempoolWatcher.recentTiers.slice(-30);

        return NextResponse.json({ 
            type: 'stream', 
            events: latest 
        }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            }
        });
    } catch (e: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
