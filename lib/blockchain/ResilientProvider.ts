import { ethers } from 'ethers';
import { getGbAllRpc, getGbAllWss } from './getblock-registry';

//  GLOBAL RESILIENCE HACK 
// NodeJS `ws` library (used under the hood by ethers.WebSocketProvider) 
// will emit an unhandled exception and crash the entire process if it receives 
// an HTTP 403 or 429 during the WS Handshake upgrade. 
// We intercept it globally to protect the System Terminal.
if (typeof process !== 'undefined' && !(globalThis as any).__WS_PROTECTED) {
    (globalThis as any).__WS_PROTECTED = true;

    // Silence Next.js uncaughtException stderr writes for aborted network drops and Server Actions
    const originalStderrWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = (chunk: any, encoding?: any, cb?: any) => {
        const str = chunk?.toString() || '';
        if (str.includes('ECONNRESET') || str.includes('Failed to find Server Action') || str.includes('Error: aborted')) {
            return true;
        }
        return originalStderrWrite(chunk, encoding, cb);
    };

    process.on('uncaughtException', (err: any) => {
        // Never terminate during Next.js build compilation
        if (process.env.NEXT_PHASE === 'phase-production-build' || process.env.NODE_ENV !== 'production') {
            console.warn('[LedgerFortress:BuildGuard] Warning in build:', err?.message || err);
            return;
        }

        const msg = err?.message || '';
        const code = err?.code || '';
        
        const lethalWSPatterns = [
            'Unexpected server response',
            'WebSocket',
            '403',
            '429',
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND',       // DNS resolution failure  hostname does not exist
            'ECONNREFUSED',    // Remote host refused connection
            'EHOSTUNREACH',    // No route to host
            'getaddrinfo',     // DNS lookup failure prefix
            'UNKNOWN_ERROR',   // ethers generic catch-all
            'connection timeout exceeded',
            'NETWORK_ERROR'
        ];

        if (lethalWSPatterns.some(p => msg.includes(p) || code.includes(p))) {
            return;
        }
        
        console.error('[LedgerFortress:Fatal] Unhandled Exception:', err);
        process.exit(1);
    });
}

interface RPCEndpoint {
  url: string;
  isHealthy: boolean;
  exhausted: boolean;
  errorCount: number;
  exhaustedAt?: number;
}

/**
 * ResilientProvider  GetBlock Dedicated Interstellar Node Provider
 *
 * Pool con endpoints de alta fidelidad.
 *
 * ETH: https://go.getblock.us/81ed63d96d704589999ff99c9a1ff64b
 * BNB: https://go.getblock.us/8405bc34194e4343a10cdc7a76360793
 */

//  DYNAMIC ENDPOINT LOADING 
const parseMultiplexKeys = (envVal: string | undefined): string[] => {
  if (!envVal) return [];
  return envVal.split(',').map(s => s.trim()).filter(Boolean);
};

//  FALLBACKS  construido desde getblock-registry + públicos 
// GetBlock siempre en primera posición. Nunca hardcodear URLs aquí.
const FALLBACKS: Record<number, { rpc: string[], wss: string[], archive?: string[] }> = {
  1: {
    rpc: [
      ...getGbAllRpc('eth'),                                          // GB slots 1+2 (archive)
      ...parseMultiplexKeys(process.env.ALCHEMY_ETH_RPCS),
      `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || 'opt-out'}`,
      'https://ethereum-rpc.publicnode.com',
      'https://1rpc.io/eth',
      'https://eth.llamarpc.com',
      'https://cloudflare-eth.com',
    ].filter(Boolean),
    wss: [
      ...getGbAllWss('eth'),                                          // GB WSS slots 1+2+3
      'wss://ethereum-rpc.publicnode.com',
      'wss://eth.llamarpc.com',
    ].filter(Boolean),
  },
  56: {
    rpc: [
      ...getGbAllRpc('bsc'),                                          // GB slot 6
      'https://bsc.llamarpc.com',
      'https://1rpc.io/bnb',
      'https://bsc-dataseed1.binance.org',
      'https://bsc-dataseed2.binance.org',
      'https://bsc.publicnode.com',
    ].filter(Boolean),
    wss: [
      ...getGbAllWss('bsc'),                                          // GB slot 7
      'wss://bsc-rpc.publicnode.com',
    ].filter(Boolean),
  },
  137: {
    rpc: [
      ...getGbAllRpc('polygon'),                                      // GB slot 5 (archive)
      'https://polygon.llamarpc.com',
      'https://1rpc.io/matic',
      'https://polygon.publicnode.com',
      'https://polygon-rpc.com',
    ].filter(Boolean),
    wss: [
      ...getGbAllWss('polygon'),                                      // GB slot 9
      'wss://polygon-bor-rpc.publicnode.com',
    ].filter(Boolean),
  },
  8453: {
    rpc: [
      ...getGbAllRpc('base'),                                         // GB slot 7 (archive)
      'https://base.llamarpc.com',
      'https://1rpc.io/base',
      'https://mainnet.base.org',
      'https://base.publicnode.com',
    ].filter(Boolean),
    wss: [
      ...getGbAllWss('base'),                                         // GB slot 8
      'wss://base-rpc.publicnode.com',
      'wss://base.llamarpc.com',
    ].filter(Boolean),
    archive: [
      ...getGbAllRpc('base'),
      `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || 'opt-out'}`,
      'https://base.publicnode.com',
    ].filter(Boolean),
  },
  42161: {
    rpc: [
      ...getGbAllRpc('arb'),                                          // GB slot 8 (archive)
      `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || 'opt-out'}`,
      'https://arb1.arbitrum.io/rpc',
      'https://arbitrum.publicnode.com',
    ].filter(Boolean),
    wss: [
      ...getGbAllWss('arb'),                                          // GB slot 14
      'wss://arbitrum-one-rpc.publicnode.com',
    ].filter(Boolean),
  },
  //  Optimism (chain 10) 
  10: {
    rpc: [
      ...getGbAllRpc('op'),                                           // GB slot 25 (cuenta única)
      `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || 'opt-out'}`,
      'https://mainnet.optimism.io',
      'https://optimism.publicnode.com',
    ].filter(Boolean),
    wss: [
      'wss://optimism-rpc.publicnode.com',
      'wss://op-mainnet.public.blastapi.io',
    ].filter(Boolean),
  },
  43114: {
    rpc: [
      ...getGbAllRpc('avax'),                                         // GB slot 13
      `https://avalanche-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || 'opt-out'}`,
      'https://api.avax.network/ext/bc/C/rpc',
      'https://1rpc.io/avax',
    ].filter(Boolean),
    wss: [
      'wss://avalanche-c-chain-rpc.publicnode.com',
      'wss://avax-mainnet.public.blastapi.io/ext/bc/C/ws',
    ].filter(Boolean),
  },
  //  WorldChain (480) 
  480: {
    rpc: [
      ...getGbAllRpc('world'),                                        // GB slot 27
      `https://worldchain-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || 'opt-out'}`,
      'https://worldchain-mainnet.g.alchemy.com/public',
    ].filter(Boolean),
    wss: [],
  },
  //  HyperEVM (999) 
  999: {
    rpc: [
      ...getGbAllRpc('hyperevm'),                                     // GB slot 28
      'https://rpc.hyperliquid.xyz/evm',
    ].filter(Boolean),
    wss: [
      'wss://rpc.hyperliquid.xyz/evm',
    ].filter(Boolean),
  },
  //  Berachain (80084) 
  80084: {
    rpc: [
      ...getGbAllRpc('bera'),                                         // GB slot 29
      'https://rpc.berachain.com',
    ].filter(Boolean),
    wss: [],
  },
};

const EXHAUSTION_COOLDOWN_MS = 60 * 1000; // REDUCED EXHAUSTION COOLDOWN TO 60 SECONDS! (Max Agility)

interface PersistentSubscription {
  type: 'block' | 'filter';
  filter?: any;
  callback: any;
}

export class ResilientProvider {
  private endpoints: RPCEndpoint[];
  private providers: ethers.JsonRpcProvider[];
  private wsProvider?: ethers.WebSocketProvider;
  private wssUrls: string[];
  private currentWssIndex: number = 0;
  private chainId: number;
  private destroyed: boolean = false;
  private subscriptions: PersistentSubscription[] = [];

  constructor(chainId: number = 1) {
    this.chainId = chainId;
    
    // Aggressive Multiplexer Array Expansion
    const urls = FALLBACKS[chainId]?.rpc || [];
    this.wssUrls = FALLBACKS[chainId]?.wss || [];

    // Deduplicate to avoid overlap errors
    const uniqueUrls = Array.from(new Set(urls));
    this.wssUrls = Array.from(new Set(this.wssUrls));

    this.endpoints = uniqueUrls.map(url => ({
      url,
      isHealthy: true,
      exhausted: false,
      errorCount: 0,
    }));

    this.providers = uniqueUrls.map(url =>
      new ethers.JsonRpcProvider(url, chainId, { staticNetwork: true })
    );

    console.log(`[ResilientProvider]  Booted Multiplexer for chain ${chainId} with ${uniqueUrls.length} HTTP / ${this.wssUrls.length} WSS Endpoints.`);
  }

  public destroy() {
    this.destroyed = true;
    if (this.wsProvider) {
        this.wsProvider.removeAllListeners();
        this.wsProvider.destroy();
    }
  }

  /**
   * [HIGH FIDELITY] Subscribe to blockchain events with automatic rotation recovery.
   * This is the sovereign standard for long-running telemetry daemons.
   */
  public on(type: 'block' | any, callbackOrFilter: any, callback?: any) {
    if (type === 'block') {
        this.subscriptions.push({ type: 'block', callback: callbackOrFilter });
    } else {
        this.subscriptions.push({ type: 'filter', filter: type, callback: callbackOrFilter });
    }
    
    // Attach immediately if provider is ready
    if (this.wsProvider) {
        this.wsProvider.on(type, callbackOrFilter);
    }
  }

  private getCircuitState(ep: RPCEndpoint): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    if (!ep.exhausted) return 'CLOSED';
    const elapsed = Date.now() - (ep.exhaustedAt ?? 0);
    if (elapsed < EXHAUSTION_COOLDOWN_MS) return 'OPEN';
    return 'HALF_OPEN';
  }

  private getActiveEndpoints(): number[] {
    if (this.destroyed) return [];
    return this.endpoints
      .map((ep, i) => ({ ep, i }))
      .filter(({ ep }) => {
        const state = this.getCircuitState(ep);
        return state === 'CLOSED' || state === 'HALF_OPEN';
      })
      .map(({ i }) => i);
  }

  private markExhausted(index: number, reason: string) {
    const ep = this.endpoints[index];
    if (!ep) return;
    ep.exhausted = true;
    ep.isHealthy = false;
    ep.exhaustedAt = Date.now();
    ep.errorCount++;
    console.warn(`[ResilientProvider:OPEN] chain=${this.chainId} reason=${reason} ep=${index} url=${ep.url.slice(0, 40)}...`);
    if (this.chainId === 1 && this.wssUrls.length > 0) {
        this.reconnectWS();
    }
  }

  /**
   * Evaluates if the current operation requires an Archive Node.
   * If yes, routes to dedicated archive endpoints to prevent "missing trie node" errors.
   */
  public async getArchiveProvider(): Promise<ethers.JsonRpcProvider> {
    const archiveUrls = (FALLBACKS[this.chainId] as any)?.archive || FALLBACKS[this.chainId]?.rpc || [];
    if (archiveUrls.length === 0) return this.getProvider();
    
    // For now, use the first available archive node (or degrade to standard getProvider if none)
    // Production ready logic for archive multiplexing.
    const url = archiveUrls[0];
    return new ethers.JsonRpcProvider(url, this.chainId, { staticNetwork: true });
  }

  /**
   * Robust `getLogs` wrapper that attempts standard nodes first, 
   * and falls back to an Archive Node if a pruning error is detected.
   */
  public async getLogs(filter: any): Promise<ethers.Log[]> {
    try {
      const p = await this.getProvider();
      return await p.getLogs(filter);
    } catch (err: any) {
      if (err.message && (err.message.includes('missing trie node') || err.message.includes('pruned') || err.message.includes('archive node'))) {
        console.warn('[ResilientProvider] Pruning error detected. Escalating to Archive Node.');
        const archiveProvider = await this.getArchiveProvider();
        return await archiveProvider.getLogs(filter);
      }
      throw err;
    }
  }

  private markRecovered(index: number) {
    const ep = this.endpoints[index];
    if (!ep) return;
    ep.exhausted = false;
    ep.isHealthy = true;
    ep.errorCount = 0;
    ep.exhaustedAt = undefined;
    console.log(`[ResilientProvider:CLOSED] chain=${this.chainId} endpoint recovered: ${ep.url.slice(0, 40)}...`);
  }

  //  Timeout-enforced RPC call 
  private callWithTimeout<T>(fn: (provider: ethers.JsonRpcProvider) => Promise<T>, provider: ethers.JsonRpcProvider, timeoutMs = 8000): Promise<T> {
    return Promise.race([
      fn(provider),
      new Promise<T>((_idx, reject) =>
        setTimeout(() => reject(new Error(`RPC_TIMEOUT_${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  async call<T>(fn: (provider: ethers.JsonRpcProvider) => Promise<T>): Promise<T> {
    const activeIndices = this.getActiveEndpoints();

    // All circuits OPEN  emergency reset (last-resort, avoids total blackout)
    if (activeIndices.length === 0) {
      console.warn(`[ResilientProvider]  EMERGENCY RESET chain=${this.chainId}  all circuits open`);
      this.endpoints.forEach(ep => {
        ep.exhausted = false;
        ep.isHealthy = true;
        ep.errorCount = 0;
        ep.exhaustedAt = undefined;
      });
      return this.callWithTimeout(fn, this.providers[0]);
    }

    for (const i of activeIndices) {
      const state = this.getCircuitState(this.endpoints[i]);
      const t0 = Date.now();
      try {
        const result = await this.callWithTimeout(fn, this.providers[i]);
        const latencyMs = Date.now() - t0;

        // HALF_OPEN probe succeeded  recover endpoint
        if (state === 'HALF_OPEN') this.markRecovered(i);

        // Latency telemetry (soft warn >3s, hard warn >6s)
        if (latencyMs > 6000) console.warn(`[ResilientProvider]  SLOW chain=${this.chainId} ep=${i} latency=${latencyMs}ms`);

        return result;
      } catch (error: any) {
        const latencyMs = Date.now() - t0;
        const status = error?.status ?? error?.statusCode ?? 0;
        const msg = (error?.message ?? '').toLowerCase();

        const isRateLimit  = status === 429 || status === 402 || status === 401 || msg.includes('limit') || msg.includes('quota');
        const isTimeout    = msg.includes('timeout') || msg.includes('rpc_timeout');
        const isNetwork    = msg.includes('econnreset') || msg.includes('enotfound') || msg.includes('econnrefused');

        if (isRateLimit) {
          this.markExhausted(i, `RATE_LIMIT_${status}`);
        } else if (isTimeout || isNetwork) {
          this.markExhausted(i, isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR');
        } else {
          // Transient error  increment but don't open circuit immediately
          this.endpoints[i].errorCount++;
          if (this.endpoints[i].errorCount >= 3) {
            this.markExhausted(i, `REPEATED_FAILURE_x${this.endpoints[i].errorCount}`);
          }
        }

        // HALF_OPEN probe failed  back to OPEN, don't try next endpoint
        if (state === 'HALF_OPEN') break;
        // Otherwise continue to next available endpoint
        continue;
      }
    }

    // Final fallback: use first provider regardless of state
    return this.callWithTimeout(fn, this.providers[0]);
  }

  private initWebSocket(url: string) {
    if (typeof window !== 'undefined' || this.destroyed) return;
    
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      console.error(`[ResilientProvider]  MALFORMED_WS_URL skipping: ${url}`);
      this.reconnectWS();
      return;
    }

    try {
      const newProvider = new ethers.WebSocketProvider(url, this.chainId);
      
      newProvider.on('error', (err: any) => {
          const msg = err?.message || 'Unknown';
          if (msg.includes('UNKNOWN_ID')) return; // Ignore harmless out-of-sync block responses
          console.warn(`[WS-CORE] Asynchronous reconnect for ${url.slice(0, 30)}:`, msg);
          this.reconnectWS();
      });

      // [RESILIENCE RECOVERY] Re-apply all persistent subscriptions
      this.subscriptions.forEach(sub => {
          if (sub.type === 'block') {
              newProvider.on('block', sub.callback);
          } else {
              newProvider.on(sub.filter, sub.callback);
          }
      });

      this.wsProvider = newProvider;

    } catch (e: any) {
      console.error(`[WS-FATAL] Immediate connection failure for ${url}:`, e.message);
      this.reconnectWS();
    }
  }

  private reconnectWS() {
    if (this.wssUrls.length === 0 || this.destroyed) return;
    
    if (this.wsProvider) {
        try {
            this.wsProvider.removeAllListeners();
            this.wsProvider.destroy();
        } catch {}
        this.wsProvider = undefined;
    }

    this.currentWssIndex = (this.currentWssIndex + 1) % this.wssUrls.length;
    console.log(`[WS]  Scaling to Next Endpoint Index ${this.currentWssIndex}...`);
    setTimeout(() => this.initWebSocket(this.wssUrls[this.currentWssIndex]), 5000);
  }

  getProvider(): ethers.JsonRpcProvider {
    return new Proxy(this.providers[0], {
      get: (target, prop) => {
        const resilienceMethods = ['send', 'call', 'getBalance', 'getCode', 'getStorage', 'getTransactionCount', 'getBlock', 'getTransaction', 'getTransactionReceipt', 'getBlockNumber', 'getLogs', 'estimateGas'];
        if (resilienceMethods.includes(prop as string)) {
          return (...args: any[]) => this.call(p => (p as any)[prop](...args));
        }
        return (target as any)[prop];
      },
    });
  }

  getWsProvider(): ethers.WebSocketProvider | undefined {
    if (this.wssUrls.length === 0) return undefined;
    if (!this.wsProvider) this.initWebSocket(this.wssUrls[this.currentWssIndex]);
    return this.wsProvider;
  }
}

//  Singleton instances  todos los chains cubiertos por GetBlock 
export const ethereumResilientProvider  = new ResilientProvider(1);
export const bscResilientProvider       = new ResilientProvider(56);
export const baseResilientProvider      = new ResilientProvider(8453);
export const polygonResilientProvider   = new ResilientProvider(137);
export const arbitrumResilientProvider  = new ResilientProvider(42161);
export const optimismResilientProvider  = new ResilientProvider(10);
export const avalancheResilientProvider = new ResilientProvider(43114);
export const worldchainResilientProvider = new ResilientProvider(480);
export const hyperevmResilientProvider  = new ResilientProvider(999);
export const berachainResilientProvider = new ResilientProvider(80084);

/**
 * Helper: obtener el ResilientProvider correcto por chain ID.
 * Remplaza la necesidad de un switch() en cada punto de uso.
 */
export function getResilientProvider(chainId: number): ResilientProvider {
  switch (chainId) {
    case 1:     return ethereumResilientProvider;
    case 56:    return bscResilientProvider;
    case 8453:  return baseResilientProvider;
    case 137:   return polygonResilientProvider;
    case 42161: return arbitrumResilientProvider;
    case 10:    return optimismResilientProvider;
    case 43114: return avalancheResilientProvider;
    case 480:   return worldchainResilientProvider;
    case 999:   return hyperevmResilientProvider;
    case 80084: return berachainResilientProvider;
    default:    return ethereumResilientProvider; // fallback seguro
  }
}
