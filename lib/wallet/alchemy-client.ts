import { providerKey } from '@/lib/server/provider-keys';
import { LRUCache } from 'lru-cache';

/**
 * Alchemy Client Utility
 * Handles rate limiting, retries with exponential backoff, and metadata caching
 */
class AlchemyClient {
  private get apiKey(): string {
    return providerKey('ALCHEMY_API_KEY') || '';
  }

  private metadataCache = new LRUCache<string, any>({
    max: 1000,
    ttl: 1000 * 60 * 60 * 24, // 24 hours
  });

  private baseDelay = 500;
  private maxRetries = 2;

  /**
   * Get the correct Alchemy API URL for a specific chain
   */
  getApiUrl(chainId: number): string {
    const networkMap: Record<number, string> = {
      1: 'eth-mainnet',
      137: 'polygon-mainnet',
      8453: 'base-mainnet',
      42161: 'arb-mainnet',
      10: 'opt-mainnet',
      43114: 'avax-mainnet',
      56: 'bnb-mainnet',
      480: 'worldchain-mainnet',
    };

    const network = networkMap[chainId] || 'eth-mainnet';
    return `https://${network}.g.alchemy.com/v2/${this.apiKey}`;
  }

  /**
   * Fetch with exponential backoff and 429 handling
   */
  async fetchWithRetry(url: string, body: any, attempt = 0): Promise<any> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.status === 429) {
        if (attempt >= this.maxRetries) {
          throw new Error('Alchemy API rate limit exceeded after maximum retries');
        }

        const waitTime = this.baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.warn(`[Alchemy] Rate limited (429). Retrying in ${Math.round(waitTime)}ms... (Attempt ${attempt + 1})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.fetchWithRetry(url, body, attempt + 1);
      }

      if (!response.ok) {
        throw new Error(`Alchemy API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`Alchemy RPC error: ${data.error.message || JSON.stringify(data.error)}`);
      }

      return data.result;
    } catch (error: any) {
      if (attempt < this.maxRetries && !error.message.includes('429')) {
        const waitTime = this.baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.fetchWithRetry(url, body, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Get token metadata with caching
   */
  async getTokenMetadata(tokenAddress: string, chainId: number): Promise<any> {
    const cacheKey = `${chainId}-${tokenAddress.toLowerCase()}`;
    const cached = this.metadataCache.get(cacheKey);
    if (cached) return cached;

    const url = this.getApiUrl(chainId);
    const result = await this.fetchWithRetry(url, {
      jsonrpc: '2.0',
      method: 'alchemy_getTokenMetadata',
      params: [tokenAddress],
      id: 1,
    });

    if (result) {
      this.metadataCache.set(cacheKey, result);
    }
    return result;
  }

  /**
   * Staggered discovery of metadata for multiple tokens
   */
  async getBatchMetadata(addresses: string[], chainId: number): Promise<any[]> {
    const results = [];
    const chunkSize = 15; // Increased for faster multi-token indexing
    
    for (let i = 0; i < addresses.length; i += chunkSize) {
      const chunk = addresses.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(
        chunk.map(addr => this.getTokenMetadata(addr, chainId).catch(() => null))
      );
      results.push(...chunkResults);
      
      if (i + chunkSize < addresses.length) {
        // Minimal delay between batches
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    return results;
  }
}

export const alchemyClient = new AlchemyClient();

