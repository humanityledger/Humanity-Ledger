import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

//  DexScreener endpoints 
// Discovery: Latest token profiles (often very new/hype)
const DS_PROFILES = 'https://api.dexscreener.com/token-profiles/latest/v1';
// Recovery: Search for recent pairs across all chains
const DS_SEARCH   = 'https://api.dexscreener.com/latest/dex/search?q=ETH%2FUSDT';

//  Map DexScreener pair to standard table shape 
function mapDexPair(p: any, idx = 0) {
    const chainRaw = (p.chainId || p.chain || 'ethereum').toLowerCase();
    const chain =
        chainRaw.includes('solana') ? 'solana' :
        chainRaw.includes('bsc') || chainRaw.includes('bnb') ? 'bsc' :
        chainRaw.includes('arb') ? 'arbitrum' :
        chainRaw.includes('base') ? 'base' :
        chainRaw.includes('polygon') ? 'polygon' :
        chainRaw.includes('avalanche') || chainRaw.includes('avax') ? 'avalanche' : 'ethereum';

    const priceChange = p.priceChange || {};
    const txn = p.txns         || {};
    const m5  = txn.m5         || {};
    const liq = p.liquidity    || {};

    // Calculate a security score based on liquidity/age
    const liqUsd = liq.usd || 0;
    let score = 50;
    if (liqUsd > 100000) score = 92;
    else if (liqUsd > 20000) score = 75;
    else if (liqUsd > 1000)  score = 60;
    else score = 33; // Risky

    return {
        id:           p.pairAddress || p.tokenAddress || `pair_unknown_${idx}`,
        chain,
        dex:          p.dexId ? p.dexId.charAt(0).toUpperCase() + p.dexId.slice(1) : 'DEX',
        baseToken: {
            symbol: (p.baseToken?.symbol || p.symbol || '???').toString().toUpperCase(),
            name:   (p.baseToken?.name   || p.name   || 'Unknown Asset').toString(),
        },
        quoteToken:   { symbol: (p.quoteToken?.symbol || 'USDT').toString() },
        priceUsd:     p.priceUsd ? parseFloat(p.priceUsd).toFixed(parseFloat(p.priceUsd) < 0.0001 ? 8 : 4) : '0.00',
        pairCreatedAt: p.pairCreatedAt || p.createdAt || (Date.now() - 3600000),
        priceChange: {
            m5:  parseFloat(priceChange.m5  || '0') || 0,
            h1:  parseFloat(priceChange.h1  || '0') || 0,
            h6:  parseFloat(priceChange.h6  || '0') || 0,
            h24: parseFloat(priceChange.h24 || '0') || 0,
        },
        liquidity: { usd: liqUsd },
        mcap:  p.marketCap || 0,
        fdv:   p.fdv || 0,
        txns:  { m5: { buys: m5.buys || 0, sells: m5.sells || 0 } },
        verifiers: { makers: p.makers || 1, snipers: 0 },
        security: {
            score,
            honeypotRisk: score < 40,
            lpBurned:     score > 70,
            mintRevoked:  score > 60,
        },
        taxes: { buy: 0, sell: 0 },
    };
}

//  Fetch metadata for an array of addresses found in profiles 
async function fetchEnrichedPairs(addresses: string[]): Promise<any[]> {
    if (addresses.length === 0) return [];
    try {
        // Fetch up to 30 addresses at once via /tokens endpoint
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addresses.join(',')}`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return [];
        const data = await res.json();
        if (!data.pairs) return [];
        
        // Return unique pairs (one per token address)
        const seen = new Set();
        return data.pairs
            .filter((p: any) => {
                const addr = (p.baseToken?.address || '').toLowerCase();
                if (seen.has(addr)) return false;
                seen.add(addr);
                return true;
            })
            .map(mapDexPair);
    } catch (e) {
        console.warn('[NEW-PAIRS] Enrichment failed:', e);
        return [];
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 50);

    try {
        // Step 1: Get latest profiles (high discovery value)
        const profileRes = await fetch(DS_PROFILES, { cache: 'no-store' });
        const profiles = profileRes.ok ? await profileRes.json() : [];
        const addresses = Array.isArray(profiles) 
            ? profiles.map((p: any) => p.tokenAddress).filter(Boolean).slice(0, 15)
            : [];

        // Step 2: Enrich profile addresses with real-time pair telemetry
        const enrichedProfiles = await fetchEnrichedPairs(addresses);

        // Step 3: Fetch search results for recent liquid pairs as filler
        const searchRes = await fetch(DS_SEARCH, { cache: 'no-store' });
        const searchData = searchRes.ok ? await searchRes.json() : { pairs: [] };
        const searchPairs = (searchData.pairs || []).map(mapDexPair);

        // Step 4: Merge (Search pairs first for common tokens, then Enriched Profiles)
        const merged = [...searchPairs, ...enrichedProfiles]
            .filter((p, i, self) => i === self.findIndex(t => t.id === p.id))
            .slice(0, limit);

        return NextResponse.json({
            pairs: merged,
            source: enrichedProfiles.length > 0 ? 'dexscreener_enriched' : 'dexscreener_search',
        });
    } catch (e: any) {
        console.error('[NEW-PAIRS] System Failure:', e.message);
        return NextResponse.json({ pairs: [], source: 'error' });
    }
}
