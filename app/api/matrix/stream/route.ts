import { NextResponse } from 'next/server';

// Forced dynamic to avoid caching on Vercel/Railway

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const asset = searchParams.get('asset') || 'BTC';
    
    // We append USDT to the symbol to fetch from Binance
    const symbol = `${asset.toUpperCase()}USDT`;

    try {
        // Fetch 24hr ticker data from Binance
        const tickerRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`, {
            cache: 'no-store',
            headers: { 'Accept': 'application/json' }
        });

        if (!tickerRes.ok) {
            return NextResponse.json({ error: "Failed to fetch from real provider" }, { status: 502 });
        }

        const data = await tickerRes.json();
        
        // Logical, mathematical conversion instead of weird seeds
        const currentPrice = parseFloat(data.lastPrice);
        const priceChange24h = parseFloat(data.priceChangePercent);
        const volume24h = parseFloat(data.volume) * currentPrice; // approximate USD volume
        
        // Momentum scoring (instead of Gravity Score)
        const momentumScore = Math.min(100, Math.max(0, 50 + (priceChange24h * 5))); 
        const isAccumulation = priceChange24h >= 0;

        // "Ledger Vector" logically translated to buy/sell dominance (approximated here by price change strength)
        const vigorPercent = 50 + Math.min(50, Math.max(-50, priceChange24h * 3));

        return NextResponse.json({
            // Strict logical properties replacing sci-fi terminology
            momentumScore: momentumScore,
            direction: isAccumulation ? 'BULLISH' : 'BEARISH',
            targetPrice: currentPrice * (1 + (priceChange24h / 100)),
            currentPrice: currentPrice,
            volumeValue: volume24h,
            vigorPercent: vigorPercent,
            isAccumulation: isAccumulation,
            confluenceValue: Math.abs(priceChange24h) / 10,
            hasData: true,
            icebergs: [], 
            probabilityOfReversal: 20 + Math.abs(priceChange24h * 2), // High vol = high reversal prob
            expectedMove: priceChange24h
        });

    } catch (e: any) {
        return NextResponse.json({ error: "Upstream RPC Error" }, { status: 500 });
    }
}
