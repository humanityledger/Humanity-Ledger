import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
// Cache globally at edge/server level every 5 minutes to avoid rate limits
//  [SOVEREIGN RESILIENCE] Persistent in-memory cache for Global Market Data.
// Since Next.js routes run in a long-lived process (except in Serverless where it's per-instance),
// this acts as a critical safety buffer during CoinGecko 429 (Rate Limit) events.
let lastSuccessfulMarketData: any = null;
let lastFetchTimestamp = 0;

export async function GET() {
  try {
    const now = Date.now();
    
    //  1. Performance optimization: return memory cache if younger than 60s 
    if (lastSuccessfulMarketData && (now - lastFetchTimestamp < 60000)) {
       return NextResponse.json(lastSuccessfulMarketData, {
           headers: { 'X-Cache-Hit': 'Memory-Local' }
       });
    }

    const res = await fetch('https://api.coingecko.com/api/v3/global', {
      next: { revalidate: 300 },
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!res.ok) {
        //  2. Fallback on 429/5xx 
        if (lastSuccessfulMarketData) {
            console.warn(`[MarketAPI:RESILIENCE] CoinGecko status ${res.status}. Serving stale data from memory.`);
            return NextResponse.json(lastSuccessfulMarketData, {
                headers: { 'X-Cache-Hit': 'Fallback-Memory', 'X-Upstream-Status': String(res.status) }
            });
        }
        throw new Error(`CoinGecko API error: ${res.status}`);
    }

    const data = await res.json();
    
    //  3. Commit to memory cache 
    lastSuccessfulMarketData = data;
    lastFetchTimestamp = now;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[MARKET_GLOBAL_ERROR]', error.message);
    
    //  4. Emergency Fallback on Network Error 
    if (lastSuccessfulMarketData) {
        return NextResponse.json(lastSuccessfulMarketData, {
            headers: { 'X-Cache-Hit': 'Emergency-Fallback', 'X-Error': error.message }
        });
    }

    return NextResponse.json({ 
        error: 'SYSTEM_BUSY', 
        message: 'Global market telemetry temporarily unavailable.' 
    }, { status: 503 });
  }
}
