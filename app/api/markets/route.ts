import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Removed local fallback. Reality only.

export async function GET() {
    try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/24hr', { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            // Validate Binance payload is strictly an array before feeding to our front-end
            if (data && Array.isArray(data) && data.length > 0) {
                return NextResponse.json({ success: true, data });
            }
        }
    } catch {}
    
    // Failsafe behavior logic: Return 503 error rather than painting fake asset prices.
    return NextResponse.json({ success: false, error: 'MARKET_DATA_UNAVAILABLE' }, { status: 503 });
}
