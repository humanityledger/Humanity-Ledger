import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { RpcRelayerManager } from '@/lib/blockchain/rpc-relayer';
import { getPriceCached } from '@/lib/price-cache';

const LEDGER_USD_THRESHOLD = 0; // $0 minimum to guarantee system vitality and Zero-Mock attestation

// Token registry: (address lowercase) -> { symbol, decimals }
const TOKEN_REGISTRY: Record<string, { symbol: string; decimals: number }> = {
  // ETH MAINNET
  "0xdac17f958d2ee523a2206206994597c13d831ec7": { symbol: "USDT", decimals: 6 },
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { symbol: "USDC", decimals: 6 },
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": { symbol: "WETH", decimals: 18 },
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": { symbol: "WBTC", decimals: 8 },
  "0x514910771af9ca656af840dff83e8264ecf986ca": { symbol: "LINK", decimals: 18 },
  "0x6b175474e89094c44da98b954eedeac495271d0f": { symbol: "DAI", decimals: 18 },
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": { symbol: "UNI", decimals: 18 },
  "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9": { symbol: "AAVE", decimals: 18 },
  "0xae7ab96520de3a18e5e111b5eaab095312d7fe84": { symbol: "stETH", decimals: 18 },
  "0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce": { symbol: "SHIB", decimals: 18 },
  "0x6982508145454ce325ddbe47a25d4ec3d2311933": { symbol: "PEPE", decimals: 18 },
  "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0": { symbol: "POL", decimals: 18 },
  // BASE
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": { symbol: "USDC", decimals: 6 },
  "0x4200000000000000000000000000000000000006": { symbol: "WETH", decimals: 18 },
  "0x50c5725949a6f0c72e6c4a641f24049a917db0cb": { symbol: "DAI", decimals: 18 },
  "0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22": { symbol: "cbETH", decimals: 18 },
  // BSC
  "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c": { symbol: "WBNB", decimals: 18 },
  "0x55d398326f99059ff775485246999027b3197955": { symbol: "USDT", decimals: 18 },
  "0xe9e7cea3dedca5984780bafc599bd69add087d56": { symbol: "BUSD", decimals: 18 },
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": { symbol: "USDC", decimals: 18 },
  "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c": { symbol: "BTCB", decimals: 18 },
  "0x2170ed0880ac9a755fd29b2688956bd959f933f8": { symbol: "ETH", decimals: 18 },
  // MATIC / POL
  "0x0000000000000000000000000000000000001010": { symbol: "MATIC", decimals: 18 },
};

const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");

interface ChainConfig {
  label: string;
  chainId: number;
  rpcUrls: string[];
  nativeSymbol: string;
  priceKey: string;
}

// The GETBLOCK_POOL and hardcoded public RPCs are deleted in favor of the Sovereign Multi-Account RpcRelayerManager.

// Build chain configs lazily at request time so environment variables are
// guaranteed to be populated (static init runs before .env is injected in
// some Railway edge cases causing BSC to report "No working RPC").
function getChains(): ChainConfig[] {
  return [
    {
      label: 'ETHEREUM',
      chainId: 1,
      rpcUrls: [
        RpcRelayerManager.getRpcUrl('ETH', 'RPC') || 'https://cloudflare-eth.com',
        RpcRelayerManager.getRpcUrl('ETH', 'WSS'),
      ].filter(Boolean),
      nativeSymbol: 'ETH',
      priceKey: 'ETH',
    },
    {
      label: 'BASE',
      chainId: 8453,
      rpcUrls: [
        process.env.BASE_MAINNET_RPC_URL ||
        RpcRelayerManager.getRpcUrl('ARB', 'RPC') ||
        'https://mainnet.base.org',
      ].filter(Boolean),
      nativeSymbol: 'ETH',
      priceKey: 'ETH',
    },
    {
      label: 'BSC',
      chainId: 56,
      rpcUrls: [
        // Priority 1: sovereign GetBlock endpoint (keyed, highest reliability)
        process.env.GB_BSC_RPC_1 || null,
        // Priority 2: env override
        process.env.BSC_RPC_URL || null,
        // Priority 3: RpcRelayerManager (multi-account rotation)
        RpcRelayerManager.getRpcUrl('BSC', 'RPC') || null,
        // Priority 47: public fallback cascade
        'https://bsc.publicnode.com',
        'https://bsc-rpc.publicnode.com',
        'https://bsc-dataseed1.binance.org',
        'https://bsc-dataseed2.binance.org',
        'https://bsc-dataseed3.binance.org',
        'https://bsc-dataseed4.binance.org',
      ].filter(Boolean) as string[],
      nativeSymbol: 'BNB',
      priceKey: 'BNB',
    },
  ];
}

// In-memory cache to avoid hammering RPCs
type CacheEntry = { data: any[]; ts: number };
const cache: Record<string, CacheEntry> = {};
const CACHE_TTL = 30_000; // 30 seconds

async function getPrice(symbol: string): Promise<number> {
  const idMap: Record<string, string> = {
    ETH: 'ethereum', BNB: 'binancecoin', BTC: 'bitcoin',
    USDT: 'tether', USDC: 'usd-coin', DAI: 'dai',
    LINK: 'chainlink', UNI: 'uniswap', AAVE: 'aave',
    SOL: 'solana', MATIC: 'matic-network', POL: 'polygon-ecosystem-token',
  };
  const coinId = idMap[symbol];
  if (!coinId || ['USDT', 'USDC', 'DAI', 'BUSD'].includes(symbol)) {
    return 1;
  }
  return getPriceCached(coinId, symbol);
}

async function scanChain(chain: ChainConfig): Promise<any[]> {
  const cacheKey = chain.label;
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const results: any[] = [];
  let provider: ethers.JsonRpcProvider | null = null;

  // Try each RPC in order
  for (const url of chain.rpcUrls) {
    try {
      provider = new ethers.JsonRpcProvider(url, chain.chainId, { staticNetwork: true });
      await provider.getBlockNumber(); // connectivity test
      break;
    } catch {
      provider = null;
    }
  }

  if (!provider) {
    console.log(`[EVM Scan] No active RPC for ${chain.label}  degrading gracefully`);
    return [];
  }

  try {
    const nativePrice = await getPrice(chain.priceKey);
    const latestBlock = await provider.getBlockNumber();

    // Scan the last 5 blocks for native transfers
    const blockPromises = [];
    for (let b = latestBlock; b > latestBlock - 5 && b > 0; b--) {
      blockPromises.push(provider.getBlock(b, true));
    }
    const blocks = await Promise.allSettled(blockPromises);

    for (const res of blocks) {
      if (res.status !== 'fulfilled' || !res.value) continue;
      const block = res.value;

      for (const tx of (block.prefetchedTransactions || [])) {
        if (!tx.value || !tx.from) continue;
        const valueNative = parseFloat(ethers.formatEther(tx.value));
        const usdValue = valueNative * nativePrice;

        if (usdValue >= LEDGER_USD_THRESHOLD) {
          results.push({
            id: tx.hash,
            hash: tx.hash,
            from: tx.from,
            to: tx.to || 'Contract',
            amount: valueNative,
            usdValue,
            asset: chain.nativeSymbol,
            chain: chain.label,
            timestamp: (block.timestamp || Date.now() / 1000) * 1000,
            status: 'CONFIRMED',
            type: 'TRANSFER',
            method: 'Native Transfer',
            gasPriceGwei: tx.gasPrice ? ethers.formatUnits(tx.gasPrice, 'gwei') : '0',
            confirmations: latestBlock - block.number + 1,
          });
        }
      }
    }

    // Scan last 5 blocks for ERC20 ledger transfers
    const fromBlock = latestBlock - 5;
    try {
      const logs = await provider.getLogs({
        fromBlock,
        toBlock: latestBlock,
        topics: [TRANSFER_TOPIC],
      });

      // Process logs with concurrency-friendly batching
      for (const log of logs.slice(0, 200)) { // cap at 200 logs per chain
        const tokenAddr = log.address.toLowerCase();
        const tokenCfg = TOKEN_REGISTRY[tokenAddr];
        if (!tokenCfg) continue;

        try {
          const parsedData = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], log.data);
          const tokenAmount = parseFloat(ethers.formatUnits(parsedData[0], tokenCfg.decimals));

          const tokenPrice = await getPrice(tokenCfg.symbol);
          const usdValue = tokenAmount * tokenPrice;

          if (usdValue >= LEDGER_USD_THRESHOLD) {
            const from = ethers.AbiCoder.defaultAbiCoder().decode(['address'], log.topics[1])[0] as string;
            const to = ethers.AbiCoder.defaultAbiCoder().decode(['address'], log.topics[2])[0] as string;

            results.push({
              id: `${log.transactionHash}-${log.index}`,
              hash: log.transactionHash,
              from,
              to,
              amount: tokenAmount,
              usdValue,
              asset: tokenCfg.symbol,
              chain: chain.label,
              timestamp: Date.now(), // approximate, block lookup skipped for speed
              status: 'CONFIRMED',
              type: 'ERC20_TRANSFER',
              method: 'ERC20 Transfer',
              gasPriceGwei: '0',
              confirmations: 1,
            });
          }
        } catch {
          // skip malformed log
        }
      }
    } catch (e: any) {
      console.log(`[EVM Scan] Log scan failed for ${chain.label}:`, e.message);
    }

    cache[cacheKey] = { data: results, ts: Date.now() };
  } catch (e: any) {
    console.error(`[EVM Scan] Chain ${chain.label} failed:`, e.message);
  }

  return results;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chainFilter = searchParams.get('chain'); // optional ?chain=ETHEREUM

    const chainsToScan = chainFilter
      ? getChains().filter(c => c.label === chainFilter)
      : getChains();

    const results = await Promise.allSettled(chainsToScan.map(scanChain));
    const txs = results
      .flatMap(r => r.status === 'fulfilled' ? r.value : [])
      .sort((a, b) => b.usdValue - a.usdValue)
      .slice(0, 60);

    return NextResponse.json(txs, {
      headers: { 'Cache-Control': 's-maxage=15, stale-while-revalidate=30' }
    });
  } catch (err: any) {
    console.error('[EVM Recent API]', err.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
