import { NextResponse } from 'next/server';
import { cashier } from '@/lib/wallet/deposit-watcher';
import { isCronAuthorized } from '@/lib/security/cronAuth';

export const dynamic = 'force-dynamic'; // No caching
export const maxDuration = 60; // Allow longer run time

/**
 * CRON JOB: /api/cron/deposits
 * Called every 1-5 minutes by Railway/Vercel Cron
 */
export async function GET(req: Request) {
    // 1. Security Check (Bearer Token)
    // Failed open before: with CRON_SECRET unset, anyone could start a scan.
    if (!isCronAuthorized(req)) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        console.log('[Cron] Starting Deposit Scan...');
        await cashier.runCycle();
        return NextResponse.json({ success: true, message: 'Scan complete' });
    } catch (error: any) {
        console.error('[Cron] Failed:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}

