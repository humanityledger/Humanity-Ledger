import { providerKey } from '@/lib/server/provider-keys';
import { safeJsonParse } from '../utils/json';
import { alchemyClient } from '../wallet/alchemy-client';
import { getBulkPricesWithChange, STEEL_DOME_FALLBACKS } from '../priceHelper';
import { LRUCache } from 'lru-cache';

/**
 * Legendary PriceService
 * Centralised high-performance pricing engine with multi-source fallback.
 */
export class PriceService {
  private static cache = new LRUCache<string, any>({
    max: 2000,
    ttl: 1000 * 30, // 30 seconds  real-time professional requirement
  });

  private static MAJORS = ['ETH', 'BTC', 'USDC', 'USDT', 'SOL', 'BNB', 'AVAX', 'MATIC', 'POL', 'ARB', 'OP'];

  /**
   * Get top 100 markets for the bubbles/market view
   * Replaces the direct CoinGecko bubbles route.
   */
  public static async getTopMarkets() {
    const cacheKey = 'top_markets_legendary';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      // 1. Primary Attempt: CoinGecko (with demo key)
      const data = await this.fetchCoinGeckoMarkets();
      if (data && data.length > 0) {
        this.cache.set(cacheKey, data);
        return data;
      }
    } catch (e) {
      console.warn('[PriceService] CoinGecko Markets failed, falling back to cached or mock majors.');
    }

    // 2. Secondary Attempt: Return last good data from cache even if expired
    // (Handled by lru-cache naturally if we don't clear it, but let's be explicit if needed)
    
    // 3. Final Fallback: Return empty to avoid mock data contamination
    return [];
  }

  /**
   * Get prices for a batch of tokens across multiple chains
   */
  public static async getBulkPrices(tokens: { symbol: string, address?: string, chainId?: number }[]) {
    if (!tokens || tokens.length === 0) return {};

    const result: Record<string, { price: number, change24h: number }> = {};
    const symbols = Array.from(new Set(tokens.map(t => t.symbol.toUpperCase())));
    
    //  [STEEL DOME] Pre-populate with fallbacks for safety
    try {
      symbols.forEach(sym => {
        if (!sym) return;
        const fallback = STEEL_DOME_FALLBACKS[sym];
        if (fallback) {
          result[sym] = { price: fallback, change24h: 0 };
        } else {
          result[sym] = { price: 0, change24h: 0 };
        }
      });
    } catch (e: any) {
      console.error('[PriceService] Crash in fallback loop:', e.message);
      throw e;
    }

    // 1. Fetch symbols from CoinGecko simple price (Majors/Known symbols)
    try {
      const cgPrices = await getBulkPricesWithChange(symbols);
      
      // Update result with real prices, but don't overwrite with 0 if we already have a fallback
      Object.entries(cgPrices).forEach(([sym, data]) => {
        if (data && data.price > 0) {
          result[sym] = data;
        } else if ((data as any)?.error === 'PRICE_THROTTLED') {
          console.warn(`[PriceService] CoinGecko throttled for ${sym}. Using Steel Dome fallback.`);
        }
      });
    } catch (e) {
      console.warn('[PriceService] CG Bulk failed.');
    }

    // 2. For missing prices or non-majors, try DexScreener (Best for Base/L2 tokens)
    const missing = tokens.filter(t => t.address && (!result[t.symbol.toUpperCase()] || result[t.symbol.toUpperCase()].price === 0));
    
    if (missing.length > 0) {
      console.log(`[PriceService] Attempting DexScreener fallback for ${missing.length} tokens...`);
      //  [LEGENDARY] Parallelizing DexScreener fetches to avoid massive sequential delay
      const pricePromises = missing.map(async (token) => {
        try {
          const dsPrice = await PriceService.fetchDexScreenerPrice(token.address!, token.chainId!);
          if (dsPrice && dsPrice.price > 0) {
            return { symbol: token.symbol.toUpperCase(), priceData: dsPrice };
          }
        } catch (e) {
          // Silent fail for individual tokens
        }
        return null;
      });

      const priceResults = await Promise.all(pricePromises);
      priceResults.forEach(res => {
        if (res) {
          // Priority: DexScreener price is usually more accurate for niche tokens than a generic fallback
          result[res.symbol] = res.priceData;
        }
      });
    }

    return result;
  }

  private static getApiKey(): string {
    return providerKey('COINGECKO_KEY') || '';
  }

  private static async fetchCoinGeckoMarkets() {
    const cgKey = this.getApiKey();
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=1h,24h,7d`;
    
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (cgKey) headers['x-cg-demo-api-key'] = cgKey;

    const res = await fetch(url, { 
      headers, 
      cache: 'no-store', // [REAL-TIME] no Next.js Data Cache  always fresh
      signal: AbortSignal.timeout(10000)
    });
    if (res.status === 429) {
        console.warn('[PriceService] ️ CoinGecko 429 Throttled for markets. Using STEEL DOME Fallback immediately.');
        throw new Error('THROTTLED');
    }
    if (!res.ok) throw new Error(`CG Status ${res.status}`);
    
    const text = await res.text();
    const parsedData = safeJsonParse<any[]>(text, [], 'PRICE_SERVICE_MARKETS');
    const coinList = Array.isArray(parsedData) ? parsedData : [];
    return coinList.map((coin: any) => ({
      id: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      image: coin.image,
      current_price: coin.current_price,
      market_cap: coin.market_cap,
      total_volume: coin.total_volume,
      price_change_1h: coin.price_change_percentage_1h_in_currency || 0,
      price_change_24h: coin.price_change_percentage_24h_in_currency || coin.price_change_percentage_24h || 0,
      price_change_7d: coin.price_change_percentage_7d_in_currency || 0,
      sparkline: coin.sparkline_in_7d?.price || [],
      market_cap_rank: coin.market_cap_rank || 0,
    }));
  }

  private static async fetchDexScreenerPrice(address: string, chainId: number) {
    // DexScreener is excellent for L2/New tokens
    const chainMap: Record<number, string> = {
      1: 'ethereum',
      137: 'polygon',
      8453: 'base',
      42161: 'arbitrum',
      10: 'optimism',
      56: 'bsc',
      480: 'worldchain'
    };

    const chainName = chainMap[chainId];
    if (!chainName) return null;

    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
        signal: AbortSignal.timeout(8000)
      });

      //  [HTML GUARD] DexScreener CDN/Cloudflare occasionally returns an HTML error page.
      // Attempting JSON.parse on HTML produces misleading SyntaxError log spam.
      // Bail out early if the response is not clean JSON.
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json') && !contentType.includes('text/json')) {
        // Silently skip  this is a known transient CDN degradation, not a code bug.
        return null;
      }

      const text = await res.text();
      if (!text || text.trimStart().startsWith('<')) return null; // Extra HTML guard

      const data = safeJsonParse<any>(text, null, 'PRICE_SERVICE_DEXSCREENER');
      if (!data) return null;
      const pair = data.pairs?.[0]; // Get most liquid pair
      
      if (pair) {
        return {
          price: parseFloat(pair.priceUsd || '0'),
          change24h: parseFloat(pair.priceChange?.h24 || '0')
        };
      }
    } catch (e) {
      return null;
    }
    return null;
  }

}

