import { NextRequest, NextResponse } from 'next/server';
import { formatUnits, erc20Abi } from 'viem';
import { getClientForChain } from '@/lib/blockchain/rpc-engine';

export const dynamic = 'force-dynamic';

//  TOKENS CONOCIDOS ON-CHAIN (contratos verificados on-chain) 
const KNOWN_TOKENS: Array<{
  symbol: string;
  name: string;
  address: `0x${string}`;
  chainId: number;
  decimals: number;
  logo: string;
  coingeckoId: string;
}> = [
  //  AUTH ecosystem 
  { symbol: 'AUTH', name: 'Identity', address: '0x163f8C2467924be0ae7B5347228CABF260318753', chainId: 1, decimals: 18, logo: 'https://assets.coingecko.com/coins/images/31069/small/identity.jpeg', coingeckoId: 'identity-wld' },
  { symbol: 'AUTH', name: 'Identity', address: '0xdc6ff44d5d932cbd77b52e5612ba0529dc6226f1', chainId: 10, decimals: 18, logo: 'https://assets.coingecko.com/coins/images/31069/small/identity.jpeg', coingeckoId: 'identity-wld' },
  { symbol: 'AUTH', name: 'Identity', address: '0x2cFc85d8E48F8EAB294be644d9E25C3030863003', chainId: 480, decimals: 18, logo: 'https://assets.coingecko.com/coins/images/31069/small/identity.jpeg', coingeckoId: 'identity-wld' },
  //  Stablecoins 
  { symbol: 'USDC', name: 'USD Coin', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', chainId: 8453, decimals: 6, logo: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png', coingeckoId: 'usd-coin' },
  { symbol: 'USDC', name: 'USD Coin', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', chainId: 10, decimals: 6, logo: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png', coingeckoId: 'usd-coin' },
  { symbol: 'USDT', name: 'Tether', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', chainId: 1, decimals: 6, logo: 'https://assets.coingecko.com/coins/images/325/small/tether.png', coingeckoId: 'tether' },
  { symbol: 'USDT', name: 'Tether', address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', chainId: 10, decimals: 6, logo: 'https://assets.coingecko.com/coins/images/325/small/tether.png', coingeckoId: 'tether' },
  { symbol: 'USDT', name: 'Tether', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', chainId: 137, decimals: 6, logo: 'https://assets.coingecko.com/coins/images/325/small/tether.png', coingeckoId: 'tether' },
  { symbol: 'USDT', name: 'Tether', address: '0x55d398326f99059fF775485246999027B3197955', chainId: 56, decimals: 18, logo: 'https://assets.coingecko.com/coins/images/325/small/tether.png', coingeckoId: 'tether' },
  //  Bluechips 
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', chainId: 1, decimals: 8, logo: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png', coingeckoId: 'wrapped-bitcoin' },
  { symbol: 'LINK', name: 'Chainlink', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', chainId: 1, decimals: 18, logo: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png', coingeckoId: 'chainlink' },
  { symbol: 'PEPE', name: 'Pepe', address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', chainId: 1, decimals: 18, logo: 'https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg', coingeckoId: 'pepe' },
  { symbol: 'SHIB', name: 'Shiba Inu', address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', chainId: 1, decimals: 18, logo: 'https://assets.coingecko.com/coins/images/11939/small/shiba.png', coingeckoId: 'shiba-inu' },
];

//  CoinGecko prices (real-time, cache:no-store) 
async function getPrices(ids: string[]): Promise<Record<string, { usd: number; usd_24h_change: number }>> {
  try {
    const unique = [...new Set(ids)].join(',');
    const apiKey = process.env.COINGECKO_KEY || '';
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${unique}&vs_currencies=usd&include_24hr_change=true${apiKey ? `&x_cg_demo_api_key=${apiKey}` : ''}`,
      // [REAL-TIME] cache:no-store  never serve stale prices for portfolio valuation
      { cache: 'no-store', signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) {
      console.warn(`[onchain-balances] CoinGecko ${res.status}  prices unavailable, returning 0 (no fake data)`);
      return {};
    }
    const data = await res.json();
    if (!data || Object.keys(data).length === 0) {
      console.warn('[onchain-balances] CoinGecko returned empty response  returning 0');
      return {};
    }
    return data;
  } catch (err) {
    console.error('[onchain-balances] CoinGecko fetch failed  returning 0 (no fake data)', err);
    return {};
  }
}

//  HANDLER 
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address') as `0x${string}` | null;

    if (!address || !address.startsWith('0x')) {
      return NextResponse.json({ error: 'Valid EVM address required' }, { status: 400 });
    }

    // 1. Fetch native ETH balances en parallel para todas las cadenas
    // 1. Fetch native ETH balances en parallel para todas las cadenas
    const chainIds = [1, 10, 8453, 480, 137, 56, 42161, 43114];
    const nativeBalanceResults = await Promise.allSettled(
      chainIds.map(async (chainId) => {
        const client = getClientForChain(chainId);
        if (!client) return null;
        const raw = await client.getBalance({ address });
        return { chainId, raw, formatted: parseFloat(formatUnits(raw, 18)) };
      })
    );

    // 2. Fetch ERC20 balances de tokens conocidos
    const erc20Results = await Promise.allSettled(
      KNOWN_TOKENS.map(async (token) => {
        const client = getClientForChain(token.chainId);
        if (!client) return null;
        const raw = await client.readContract({
          address: token.address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address],
        });
        const balance = parseFloat(formatUnits(raw as bigint, token.decimals));
        return { ...token, balance };
      })
    );

    // 3. Fetch precios de CoinGecko
    const coingeckoIds = [
      'ethereum',
      'identity-wld',
      'usd-coin',
      'tether',
      'wrapped-bitcoin',
      'chainlink',
      'pepe',
      'shiba-inu',
      'binancecoin',
      'solana',
    ];
    const prices = await getPrices(coingeckoIds);

    // 4. Construir tokens con balances > 0
    const tokens: any[] = [];

    // Nativos
    nativeBalanceResults.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value && result.value.formatted > 0.000001) {
        const { chainId, formatted } = result.value;
        const ethPrice = prices['ethereum']?.usd || 0;
        const ethChange24h = prices['ethereum']?.usd_24h_change || 0;
        const chainNames: Record<number, string> = { 1: 'Ethereum', 10: 'Optimism', 8453: 'Base', 480: 'Worldchain', 137: 'Polygon', 56: 'BSC', 42161: 'Arbitrum', 43114: 'Avalanche' };
        tokens.push({
          address: 'native',
          symbol: 'ETH',
          name: chainNames[chainId] ? `ETH (${chainNames[chainId]})` : 'ETH',
          balance: result.value.raw.toString(),
          balanceNumeric: formatted,
          balanceFormatted: formatted.toLocaleString(undefined, { maximumFractionDigits: 6 }),
          price: ethPrice,
          valueUsd: formatted * ethPrice,
          change24h: ethChange24h,
          chainId,
          decimals: 18,
          logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
          sector: 'Layer 1',
          source: 'rpc-direct',
        });
      }
    });

    // ERC20s
    erc20Results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value && result.value.balance > 0.000001) {
        const token = result.value;
        const cgData = prices[token.coingeckoId];
        const price = cgData?.usd || 0;
        const change24h = cgData?.usd_24h_change || 0;

        // Deduplicar si ya existe el mismo símbolo/chain con mayor balance
        const existing = tokens.find(t => t.symbol === token.symbol && t.chainId === token.chainId && t.address !== 'native');
        if (existing) {
          if (token.balance > existing.balanceNumeric) {
            existing.balanceNumeric = token.balance;
            existing.valueUsd = token.balance * price;
          }
        } else {
          tokens.push({
            address: token.address,
            symbol: token.symbol,
            name: token.name,
            balance: BigInt(Math.floor(token.balance * 10 ** token.decimals)).toString(),
            balanceNumeric: token.balance,
            balanceFormatted: token.balance.toLocaleString(undefined, { maximumFractionDigits: 4 }),
            price,
            valueUsd: token.balance * price,
            change24h,
            chainId: token.chainId,
            decimals: token.decimals,
            logo: token.logo,
            sector: token.symbol === 'AUTH' ? 'DeFi' : token.symbol.includes('USD') ? 'Stablecoin' : 'DeFi',
            source: 'rpc-direct',
          });
        }
      }
    });

    // 5. Calcular totales
    const totalValueUsd = tokens.reduce((acc, t) => acc + (t.valueUsd || 0), 0);
    let weightedChange = 0;
    tokens.forEach(t => {
      if (totalValueUsd > 0) weightedChange += (t.change24h || 0) * (t.valueUsd / totalValueUsd);
    });

    return NextResponse.json({
      success: true,
      address,
      tokens: tokens.sort((a, b) => b.valueUsd - a.valueUsd),
      totalValueUsd,
      change24hPercent: weightedChange,
      change24hUsd: totalValueUsd * (weightedChange / 100),
      source: 'rpc-direct',
      chainsScanned: chainIds,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[onchain-balances] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch onchain balances', details: 'Error details redacted' },
      { status: 500 }
    );
  }
}

