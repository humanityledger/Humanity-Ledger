/**
 * I-004: Real-time price oracle service with in-memory caching
 * Replaces hardcoded mock prices ($2,650, $3,000, etc.) with real feeds.
 */

interface CachedPrice {
  priceUsd: number;
  updatedAt: number;
}

const priceCache = new Map<string, CachedPrice>();
const CACHE_TTL_MS = 60_000; // 1 minute cache

export async function getTokenPriceUsd(tokenId = 'ethereum'): Promise<number | null> {
  const cached = priceCache.get(tokenId);
  const now = Date.now();

  if (cached && now - cached.updatedAt < CACHE_TTL_MS) {
    return cached.priceUsd;
  }

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(3500),
      }
    );

    if (!res.ok) return cached?.priceUsd ?? null;

    const data = await res.json();
    const price = data[tokenId]?.usd;

    if (typeof price === 'number') {
      priceCache.set(tokenId, { priceUsd: price, updatedAt: now });
      return price;
    }

    return cached?.priceUsd ?? null;
  } catch {
    // If API is down or throttled, return cached if available or null
    return cached?.priceUsd ?? null;
  }
}
