/**
 * AlchemyService — Drop-in replacement for MoralisService.
 *
 * Strategy to conserve CUs while feeling real-time:
 *  - Redis cache: 45s for balances, 90s for net-worth, 5min for tx history
 *  - Key rotation: round-robin across 4 keys
 *  - Circuit breaker: disables for 120s if all keys are exhausted
 *  - Response shaping: returns Moralis-compatible objects so zero other
 *    files need changing.
 *
 * CU budget estimate (4 keys × 300M = 1.2B CUs/month):
 *  - getTokenBalances (5 chains): ~500 CUs per unique user/45s window
 *  - With 45s cache, 1000 daily users → ~480K CUs/day → 14.4M/month
 *  - Leaves >1.1B CUs of headroom for spikes. Well within limits.
 */

import { knownPrice, valueOrNull } from '@/lib/pricing/known-price';
import { safeRedisGet, safeRedisSet } from '../redis/client';
import { safeJsonParse } from '../utils/json';
import { PriceService } from './PriceService';

// ─── Chain config ──────────────────────────────────────────────────────────────
export const MORALIS_CHAINS = {
  1:     'eth',
  137:   'polygon',
  56:    'bsc',
  43114: 'avalanche',
  42161: 'arbitrum',
  10:    'optimism',
  8453:  'base',
} as const;

export type MoralisChain = typeof MORALIS_CHAINS[keyof typeof MORALIS_CHAINS];

const CHAIN_RPC: Record<MoralisChain, string> = {
  eth:       'https://eth-mainnet.g.alchemy.com/v2/',
  polygon:   'https://polygon-mainnet.g.alchemy.com/v2/',
  bsc:       'https://bnb-mainnet.g.alchemy.com/v2/',
  avalanche: 'https://avax-mainnet.g.alchemy.com/v2/',
  arbitrum:  'https://arb-mainnet.g.alchemy.com/v2/',
  optimism:  'https://opt-mainnet.g.alchemy.com/v2/',
  base:      'https://base-mainnet.g.alchemy.com/v2/',
};

// ─── Keys (4 Alchemy keys — rotate to stay within free-tier CU limits) ────────
const ALCHEMY_KEYS = [
  'JLvEnyb0K4P7XuqU7dxr8',
  '9-PrperNlQe6nEXGOkKLh',
  'TX3Ly34OF3eQYcQIQUF0o',
  'HzFcJZLmeduTs9XfgcpOl',
  'eJ8JYm5NbVJXQ6U6rkBgK',
  'WSmHi-tN2D_KMM-wC1qWI',
  'UwKeAtmk7pKtXwfFEUDrx',
];

// ─── Cache TTLs (seconds) ──────────────────────────────────────────────────────
const TTL_BALANCES   = 45;   // fast-feel but <1 req/45s per wallet = huge savings
const TTL_NETWORTH   = 90;
const TTL_HISTORY    = 300;  // tx history: 5 min — rarely changes second-by-second
const TTL_DEFI       = 120;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function rpcUrl(chain: MoralisChain, key: string) {
  return `${CHAIN_RPC[chain]}${key}`;
}

async function alchemyRpc(
  url: string,
  method: string,
  params: any[],
): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Alchemy HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Alchemy RPC error: ${json.error.message}`);
  return json.result;
}

// ─── Service ──────────────────────────────────────────────────────────────────
export class MoralisService {
  private keyIndex = 0;
  private circuitBreakerUntil = 0;
  private failures = 0;

  constructor() {
    console.log('[AlchemyService] Initialized — 4-key rotation, Redis caching, CU-efficient mode.');
  }

  // ── Cached fetch wrapper ───────────────────────────────────────────────────
  private async cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
    try {
      const hit = await safeRedisGet(key);
      if (hit) {
        const parsed = safeJsonParse(hit, null);
        if (parsed !== null) return parsed as T;
      }
    } catch { /* Redis miss — proceed */ }

    const data = await fn();
    try { await safeRedisSet(key, JSON.stringify(data), 'EX', ttl); } catch { /* ignore */ }
    return data;
  }

  // ── Key rotation ──────────────────────────────────────────────────────────
  private nextKey(): string {
    if (Date.now() < this.circuitBreakerUntil) throw new Error('ALCHEMY_CIRCUIT_OPEN');
    const key = ALCHEMY_KEYS[this.keyIndex % ALCHEMY_KEYS.length];
    this.keyIndex = (this.keyIndex + 1) % ALCHEMY_KEYS.length;
    return key;
  }

  private tripBreaker() {
    this.failures++;
    if (this.failures >= ALCHEMY_KEYS.length * 2) {
      console.error('[AlchemyService] Circuit breaker tripped — all keys exhausted.');
      this.circuitBreakerUntil = Date.now() + 120_000;
      this.failures = 0;
      throw new Error('ALCHEMY_QUOTA_EXHAUSTED');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API — Moralis-compatible signatures
  // ─────────────────────────────────────────────────────────────────────────

  /** ERC-20 token balances for a wallet. Returns Moralis-shaped result array. */
  async getWalletBalances(address: string, chain: MoralisChain, cursor?: string) {
    const cacheKey = `alchemy:balances:${chain}:${address}`;
    return this.cached(cacheKey, TTL_BALANCES, async () => {
      const key = this.nextKey();
      try {
        const result = await alchemyRpc(rpcUrl(chain, key), 'alchemy_getTokenBalances', [address]);
        const tokens = (result?.tokenBalances ?? []).filter((t: any) => t.tokenBalance !== '0x0');
        
        // Enrich with metadata in a single batched call (1 CU per token, capped at 20)
        const enriched = await Promise.all(
          tokens.slice(0, 20).map(async (t: any) => {
            const metaKey = `alchemy:meta:${chain}:${t.contractAddress}`;
            const meta = await this.cached(metaKey, 3600, async () => {
              try {
                return await alchemyRpc(rpcUrl(chain, key), 'alchemy_getTokenMetadata', [t.contractAddress]);
              } catch { return { name: 'Unknown', symbol: 'UNK', decimals: 18, logo: '' }; }
            });
            const raw = BigInt(t.tokenBalance || '0');
            const decimals = meta.decimals ?? 18;
            const balance = (Number(raw) / 10 ** decimals).toFixed(6);
            return {
              token_address: t.contractAddress,
              name:          meta.name    ?? 'Unknown Token',
              symbol:        meta.symbol  ?? 'UNK',
              logo:          meta.logo    ?? '',
              thumbnail:     meta.logo    ?? '',
              decimals,
              balance:       raw.toString(),
              balance_formatted: balance,
              usd_price:     0,
              usd_value:     0,
              native_token:  false,
              possible_spam: false,
              verified_contract: true,
            };
          })
        );
        this.failures = 0;
        return { result: enriched, cursor: null };
      } catch (e: any) {
        this.tripBreaker();
        throw e;
      }
    });
  }

  /** Native (ETH/MATIC/BNB) balance */
  async getNativeBalance(address: string, chain: MoralisChain) {
    const cacheKey = `alchemy:native:${chain}:${address}`;
    return this.cached(cacheKey, TTL_BALANCES, async () => {
      const key = this.nextKey();
      const hex = await alchemyRpc(rpcUrl(chain, key), 'eth_getBalance', [address, 'latest']);
      const wei = BigInt(hex || '0');
      const balance = (Number(wei) / 1e18).toFixed(8);
      this.failures = 0;
      // Return both the human-readable balance AND the raw wei string so
      // consumers can safely call BigInt() on balanceWei without hitting
      // "Cannot convert 0.00000000 to a BigInt" when balance is 0.
      return { balance, balanceWei: wei.toString() };
    });
  }

  /** Approximate net-worth by summing native balances across chains */
  async getWalletNetWorth(address: string) {
    const cacheKey = `alchemy:networth:${address}`;
    return this.cached(cacheKey, TTL_NETWORTH, async () => {
      // Only query chains confirmed to work on the current Alchemy plan.
      // Optimism and Avalanche return 403 on free-tier keys, so we exclude them here.
      // PortfolioService will still query them independently via RPC fallback.
      const chains: MoralisChain[] = ['eth', 'polygon', 'arbitrum', 'base', 'bsc'];
      let totalUsd = 0;
      const chainDetails: any[] = [];
      const unpricedChains: string[] = [];

      await Promise.allSettled(chains.map(async (chain) => {
        try {
          const { balance } = await this.getNativeBalance(address, chain);
          const symbol = ({ eth: 'ETH', polygon: 'MATIC', arbitrum: 'ETH', base: 'ETH', bsc: 'BNB', avalanche: 'AVAX', optimism: 'ETH' } as Record<string, string>)[chain] || 'ETH';
          const prices = await PriceService.getBulkPrices([{ symbol, address: '', chainId: 1 }]).catch(() => ({}));
          // F-09b: no price means the chain's value is unknown, not 0 (lib/pricing/known-price.ts).
          const usdValue = valueOrNull(parseFloat(balance), knownPrice((prices as any)[symbol]?.price));
          if (usdValue === null) unpricedChains.push(chain);
          else totalUsd += usdValue;
          chainDetails.push({
            chain, balance, native_balance_formatted: balance, chain_id: chain,
            usd_value: usdValue === null ? null : usdValue.toFixed(2),
            native_balance_usd: usdValue === null ? null : usdValue.toFixed(2),
            networth_usd: usdValue === null ? null : usdValue.toFixed(2),
            price_status: usdValue === null ? 'unavailable' : 'priced',
          });
        } catch { /* skip chain if error */ }
      }));

      return {
        total_networth_usd: totalUsd.toFixed(2),
        total_is_partial: unpricedChains.length > 0,
        unpriced_chains: unpricedChains,
        chains: chainDetails,
      };
    });
  }

  /** Transaction history via alchemy_getAssetTransfers */
  async getWalletHistory(address: string, chain: MoralisChain, limit: number = 100) {
    const cacheKey = `alchemy:history:${chain}:${address}`;
    return this.cached(cacheKey, TTL_HISTORY, async () => {
      const key = this.nextKey();
      try {
        const [sent, received] = await Promise.all([
          alchemyRpc(rpcUrl(chain, key), 'alchemy_getAssetTransfers', [{
            fromAddress: address, category: ['external', 'erc20', 'internal'],
            maxCount: `0x${Math.min(limit, 50).toString(16)}`, withMetadata: true, order: 'desc',
          }]),
          alchemyRpc(rpcUrl(chain, key), 'alchemy_getAssetTransfers', [{
            toAddress: address, category: ['external', 'erc20', 'internal'],
            maxCount: `0x${Math.min(limit, 50).toString(16)}`, withMetadata: true, order: 'desc',
          }]),
        ]);

        const toMoralis = (tx: any, direction: 'sent' | 'received') => ({
          hash:            tx.hash,
          block_number:    parseInt(tx.blockNum, 16),
          block_timestamp: tx.metadata?.blockTimestamp ?? new Date().toISOString(),
          from_address:    tx.from,
          to_address:      tx.to,
          value:           tx.value?.toString() ?? '0',
          token_symbol:    tx.asset ?? 'ETH',
          category:        tx.category,
          direction,
        });

        const txs = [
          ...(sent?.transfers ?? []).map((t: any) => toMoralis(t, 'sent')),
          ...(received?.transfers ?? []).map((t: any) => toMoralis(t, 'received')),
        ].sort((a, b) => b.block_number - a.block_number).slice(0, limit);

        this.failures = 0;
        return { result: txs };
      } catch (e: any) {
        this.tripBreaker();
        throw e;
      }
    });
  }

  /** DeFi positions — lightweight stub (Alchemy doesn't have a direct endpoint) */
  async getDefiPositions(address: string) {
    return { result: [] };
  }

  async getDefiSummary(address: string) {
    return { result: [] };
  }

  async getWalletStats(address: string, chain?: MoralisChain) {
    return { transactions: 0, nft_transfers: 0, token_transfers: 0 };
  }

  async getWalletActiveChains(address: string) {
    return { active_chains: ['eth', 'polygon', 'arbitrum', 'base', 'bsc'] };
  }

  // ── Stubs for interface compatibility ─────────────────────────────────────
  async getWalletProfitability(address: string, days?: number) { return { total_profit_usd: '0', result: [] }; }
  async getTokenTransfers(address: string, chain: MoralisChain, limit: number = 100) { return { result: [] }; }
  async getWalletNFTs(address: string, chain: MoralisChain, limit: number = 100) { return { result: [] }; }
  async getNFTFloorPrice(address: string, chain: MoralisChain) { return { floor_price_usd: '0' }; }
  async resolveENSDomain(domain: string) { return { address: '' }; }
  async resolveAddress(address: string) { return { name: '' }; }
  async resolveUnstoppableDomain(domain: string) { return { address: '' }; }
  async getOHLCV(address: string, chain: MoralisChain, timeframe: string = '1h', limit: number = 100) { return []; }
  async getTransaction(transactionHash: string, chain: MoralisChain = 'eth') { return null; }

  async getTokenPrice(address: string, chain: MoralisChain) {
    try {
      const prices = await PriceService.getBulkPrices([{ symbol: 'UNK', address, chainId: 1 }]);
      return { usdPrice: knownPrice((prices as any)['UNK']?.price) };
    } catch { return { usdPrice: null }; }
  }

  /** No batch price source is wired here: every price is reported unavailable, never 0. */
  async getMultipleTokenPrices(tokens: Array<{ address: string; chain: MoralisChain }>) {
    return tokens.map(t => ({ tokenAddress: t.address, usdPrice: null as number | null, priceStatus: 'unavailable' as const }));
  }

  getChainName(chainId: number): MoralisChain {
    return MORALIS_CHAINS[chainId as keyof typeof MORALIS_CHAINS] || 'eth';
  }
}

export const moralisService = new MoralisService();
