import { NextResponse } from 'next/server';
import { PriceService } from '@/lib/blockchain/PriceService';

export async function GET() {
    try {
        const symbols = ["BTC", "ETH", "BNB", "SOL", "XRP", "LINK", "UNI", "AAVE", "ARB", "OP", "PEPE", "MATIC"];
        
        const tokens = symbols.map(sym => ({ symbol: sym }));
        const rawPrices = await PriceService.getBulkPrices(tokens);
        
        const prices: Record<string, { price: number; change: number }> = {};
        for (const [sym, data] of Object.entries(rawPrices)) {
            if (!data) continue; // no price known: absent, never 0
            prices[sym] = {
                price: data.price,
                change: data.change24h || 0
            };
        }

        return NextResponse.json(prices);
    } catch (error) {
        console.error("Ticker API Error:", error);
        return NextResponse.json({ error: "Failed to fetch prices" }, { status: 500 });
    }
}
