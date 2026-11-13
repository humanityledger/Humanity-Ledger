import { providerKey } from '@/lib/server/provider-keys';
import { createPublicClient, http, fallback, PublicClient } from 'viem';
import { mainnet, bsc, optimism, base, polygon, arbitrum, avalanche } from 'viem/chains';
import { getGbAllRpc, getGbWss } from './getblock-registry';

//  ALCHEMY FALLBACK KEY 
const ALCHEMY_KEY = providerKey('ALCHEMY_API_KEY') || 'demo';

//  CUSTOM CHAIN DEFS 

const worldchain = {
  id: 480,
  name: 'World Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://worldchain-mainnet.g.alchemy.com/public'] },
  },
} as const;

const hyperevm = {
  id: 999,
  name: 'HyperEVM',
  nativeCurrency: { name: 'HYPE', symbol: 'HYPE', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.hyperliquid.xyz/evm'] },
  },
} as const;

const berachain = {
  id: 80084,
  name: 'Berachain',
  nativeCurrency: { name: 'BERA', symbol: 'BERA', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.berachain.com'] },
  },
} as const;

//  ADVANCED RPC CACHE INTERCEPTOR 
const rpcCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 2500;

async function hashRequest(body: string): Promise<string> {
  let hash = 0;
  for (let i = 0; i < body.length; i++) {
    const char = body.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

const CACHEABLE_METHODS = ['eth_call', 'eth_chainId', 'eth_blockNumber', 'eth_gasPrice'];

// Limpieza automática (Garbage Collection) para evitar fugas de memoria OOM en el contenedor
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rpcCache.entries()) {
    if (value.expiry <= now) {
      rpcCache.delete(key);
    }
  }
}, 60000); // Limpia cada minuto

const memoizedFetch = (url: string) => {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (init?.method === 'POST' && typeof init.body === 'string') {
      try {
        const bodyObj = JSON.parse(init.body);
        const isReadMethod = Array.isArray(bodyObj)
          ? bodyObj.every(b => CACHEABLE_METHODS.includes(b.method))
          : CACHEABLE_METHODS.includes(bodyObj.method);

        if (isReadMethod) {
          const cacheKey = `${url}_${await hashRequest(init.body)}`;
          const cached = rpcCache.get(cacheKey);
          
          if (cached && cached.expiry > Date.now()) {
            return new Response(JSON.stringify(cached.data), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          
          const response = await fetch(input, init);
          if (response.ok) {
            const clone = response.clone();
            const data = await clone.json();
            rpcCache.set(cacheKey, { data, expiry: Date.now() + CACHE_TTL_MS });
          }
          return response;
        }
      } catch {
        // Fallback a fetch normal si falla el parse
      }
    }
    return fetch(input, init);
  };
};

//  Helper: construye transport con endpoints en orden 
const makeTransport = (urls: string[]) =>
  fallback(
    urls.filter(Boolean).map(url =>
      http(url, {
        fetchOptions: { cache: 'no-store', fetch: memoizedFetch(url) } as any,
        batch: { batchSize: 512, wait: 50 },
        retryCount: 2,
        retryDelay: 500,
        timeout: 8_000,
      })
    ),
    { rank: false }
  );

//  CLIENTES VIEM  GetBlock primero, Alchemy segundo, públicos de emergencia 

/** Ethereum Mainnet  GetBlock Archive (2 nodos) + Alchemy + públicos */
export const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: makeTransport([
    ...getGbAllRpc('eth'),                                           // GB slots 1 + 2 (archive)
    `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    'https://cloudflare-eth.com',
    'https://ethereum-rpc.publicnode.com',
    'https://eth.llamarpc.com',
  ]),
});

/** Market Intel  rotación para evitar rate-limit */
export const marketIntelClient = createPublicClient({
  chain: mainnet,
  transport: makeTransport([
    ...getGbAllRpc('eth'),
    `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    'https://eth.drpc.org',
  ]),
});

/** BNB Chain  GetBlock + públicos */
export const bscClient = createPublicClient({
  chain: bsc,
  transport: makeTransport([
    ...getGbAllRpc('bsc'),                                          // GB slot 6
    'https://bsc-dataseed1.binance.org',
    'https://bsc-dataseed2.binance.org',
    'https://bsc.publicnode.com',
    `https://bnb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    'https://bsc.llamarpc.com',
  ]),
});

/** Optimism  GetBlock + Alchemy + públicos */
export const optimismClient = createPublicClient({
  chain: optimism,
  transport: makeTransport([
    ...getGbAllRpc('op'),                                           // GB slot 10
    `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    'https://mainnet.optimism.io',
    'https://optimism.publicnode.com',
  ]),
});

/** Base  GetBlock Archive + Alchemy + públicos */
export const baseClient = createPublicClient({
  chain: base,
  transport: makeTransport([
    ...getGbAllRpc('base'),                                         // GB slot 7 (archive)
    `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    'https://mainnet.base.org',
    'https://base.publicnode.com',
    'https://base.llamarpc.com',
  ]),
});

/** Polygon  GetBlock Archive + Alchemy + públicos */
export const polygonClient = createPublicClient({
  chain: polygon,
  transport: makeTransport([
    ...getGbAllRpc('polygon'),                                      // GB slot 5 (archive)
    `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    'https://polygon-rpc.com',
    'https://polygon.publicnode.com',
    'https://polygon.llamarpc.com',
  ]),
});

/** Arbitrum  GetBlock Archive + Alchemy + públicos */
export const arbitrumClient = createPublicClient({
  chain: arbitrum,
  transport: makeTransport([
    ...getGbAllRpc('arb'),                                          // GB slot 8 (archive)
    `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    'https://arb1.arbitrum.io/rpc',
    'https://arbitrum.publicnode.com',
  ]),
});

/** Avalanche  GetBlock + Alchemy + públicos */
export const avalancheClient = createPublicClient({
  chain: avalanche,
  transport: makeTransport([
    ...getGbAllRpc('avax'),                                         // GB slot 13
    `https://avalanche-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    'https://api.avax.network/ext/bc/C/rpc',
    'https://1rpc.io/avax',
  ]),
});

/** WorldChain  GetBlock + Alchemy + público */
export const worldchainClient = createPublicClient({
  //@ts-ignore Custom chain def
  chain: worldchain,
  transport: makeTransport([
    ...getGbAllRpc('world'),                                        // GB slot 11
    `https://worldchain-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    'https://worldchain-mainnet.g.alchemy.com/public',
  ]),
});

/** HyperEVM  GetBlock + público */
export const hyperevmClient = createPublicClient({
  //@ts-ignore Custom chain def
  chain: hyperevm,
  transport: makeTransport([
    ...getGbAllRpc('hyperevm'),                                     // GB slot 14
    'https://rpc.hyperliquid.xyz/evm',
  ]),
});

/** Berachain  GetBlock + público */
export const berachainClient = createPublicClient({
  //@ts-ignore Custom chain def
  chain: berachain,
  transport: makeTransport([
    ...getGbAllRpc('bera'),                                         // GB slot 15
    'https://rpc.berachain.com',
  ]),
});

//  Helper de selección dinámica de chain 
export const getClientForChain = (chainId: number): PublicClient => {
  switch (chainId) {
    case 1:     return mainnetClient as any;
    case 56:    return bscClient as any;
    case 10:    return optimismClient as any;
    case 8453:  return baseClient as any;
    case 137:   return polygonClient as any;
    case 42161: return arbitrumClient as any;
    case 43114: return avalancheClient as any;
    case 480:   return worldchainClient as any;
    case 999:   return hyperevmClient as any;
    case 80084: return berachainClient as any;
    default:    return mainnetClient as any;
  }
};

/** ETH WSS URL desde el registry (para WebSocket providers en ethers) */
export const ETH_WSS_URL = getGbWss('eth') || process.env.GETBLOCK_ETH_WS || '';
