/**
 * Polymarket Real Markets API Proxy
 * Fetches live prediction markets from the official Polymarket CLOB API
 * Sorted by volume and filtered to top opportunities
 */
import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const CLOB_API = 'https://clob.polymarket.com';
const GAMMA_API = 'https://gamma-api.polymarket.com';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'all';
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Math.max(1, Math.min(isNaN(rawLimit) ? 50 : rawLimit, 100));

    const CAT_MAP: Record<string, string> = {
        crypto: 'crypto',
        politics: 'politics',
        sports: 'sports',
        economics: 'business',
    };

    try {
        // Fetch recent/top markets (allowing both active and recently closed for persistence)
        const gammaUrl = new URL(`${GAMMA_API}/markets`);
        gammaUrl.searchParams.set('limit', String(limit));
        gammaUrl.searchParams.set('order', 'volume24hr');
        gammaUrl.searchParams.set('ascending', 'false');
        
        const tag = CAT_MAP[category];
        if (tag) {
            gammaUrl.searchParams.set('tag_slug', tag);
        }

        const res = await fetch(gammaUrl.toString(), {
            headers: { 'Accept': 'application/json' },
            next: { revalidate: 30 }
        });

        if (!res.ok) {
            throw new Error(`Gamma API error: ${res.status}`);
        }

        const markets = await res.json();

        // Normalize and enrich the data
        const normalized = (Array.isArray(markets) ? markets : markets.data || []).map((m: any) => {
            const outcomes = Array.isArray(m.outcomes) ? m.outcomes : [];
            const outcomePrices = Array.isArray(m.outcomePrices) ? m.outcomePrices : [];
            
            const findPrice = (name: string) => {
                const index = outcomes.indexOf(name);
                if (index !== -1 && outcomePrices[index]) {
                    return parseFloat(outcomePrices[index]);
                }
                return 0;
            };
            
            const yesPrice = findPrice('Yes') || parseFloat(m.bestAsk || '0.5');
            const noPrice = findPrice('No') || (1 - yesPrice);

            return {
                id: m.id || m.conditionId,
                slug: m.slug,
                question: m.question,
                description: m.description?.slice(0, 200),
                category: m.category || m.tags?.[0]?.label || 'Crypto',
                yesPrice,
                noPrice,
                volume24h: parseFloat(m.volume24hr || m.volume || '0'),
                volumeTotal: parseFloat(m.volumeNum || m.volume || '0'),
                liquidity: parseFloat(m.liquidity || '0'),
                // REAL execution fields  fpmmAddress is the Gnosis FPMM contract for this market
                fpmmAddress: m.market_maker_address || null,
                conditionId: m.conditionId || null,
                endDate: m.endDate || m.resolutionTime || null,
                active: m.active !== undefined ? m.active : true,
                closed: m.closed !== undefined ? m.closed : false,
                image: m.image,
                edge: Math.abs(0.5 - yesPrice),
                evSignal: calcEV(yesPrice),
            };
        });

        // Sort by edge (best arbitrage opportunities first)
        normalized.sort((a: any, b: any) => b.volume24h - a.volume24h);

        return NextResponse.json({
            markets: normalized,
            timestamp: Date.now(),
            count: normalized.length
        });

    } catch (err: any) {
        console.error('[POLYMARKET_MARKETS]', err.message);
        return NextResponse.json({ error: err.message, markets: [], timestamp: Date.now(), count: 0 }, { status: 500 });
    }
}

/** 
 * Compute expected value signal:
 * If price < 0.15  HIGH chance it's under-valued (OVERWEIGHT_YES)
 * If price > 0.85  Overbought, look at shorting
 * Returns a signal string for the frontend
 */
function calcEV(yesPrice: number): string {
    if (yesPrice >= 0.85) return 'OVERBOUGHT';
    if (yesPrice <= 0.15) return 'OVERSOLD';
    if (yesPrice >= 0.58) return 'LEAN_YES';
    if (yesPrice <= 0.42) return 'LEAN_NO';
    return 'NEUTRAL';
}
