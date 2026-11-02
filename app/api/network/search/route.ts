import { NextRequest, NextResponse } from 'next/server';
import { searchAnalyticsService } from '@/lib/services/SearchAnalyticsService';
export const dynamic = 'force-dynamic';

/**
 *  LEGENDARY SEARCH API 
 * Unified discovery for Addresses and Transaction Hashes
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');

    if (!q) {
        return NextResponse.json({ error: 'Search query required' }, { status: 400 });
    }

    try {
        console.log(`[API-SEARCH] Executing legendary search for: ${q}`);
        const report = await searchAnalyticsService.getLegendaryReport(q);
        
        return NextResponse.json(report);
    } catch (error: any) {
        console.error('[API-SEARCH-CRASH]', error.message);
        return NextResponse.json({ 
            error: 'Failed to generate legendary analytics', 
            details: 'Error details redacted' 
        }, { status: 500 });
    }
}

