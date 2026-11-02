import { alchemyClient } from './alchemy-client';
import { getChainById } from '../chains';
import { getRealTimePrice, getPriceWithChange } from '../priceHelper';
import { PriceService } from '../blockchain/PriceService';
/**
 * Token Discovery & Management
 * Auto-discover ERC20 tokens and fetch metadata
 */

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  balance?: string;
  balanceFormatted?: string;
  priceUSD?: number;
  valueUSD?: number;
  chainId: number;
  change24h?: number;
}

export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  chainId: number;
}



/**
 * Get the correct Alchemy API URL for a specific chain and method
 */
function getAlchemyApiUrl(chainId: number): string {
  return alchemyClient.getApiUrl(chainId);
}

/**
 * Discover all ERC20 tokens in a wallet
 */
export async function discoverTokens(
  walletAddress: string,
  chainId: number
): Promise<Token[]> {
  try {
    const url = getAlchemyApiUrl(chainId);
    const result = await alchemyClient.fetchWithRetry(url, {
      jsonrpc: '2.0',
      method: 'alchemy_getTokenBalances',
      params: [walletAddress],
      id: 1,
    });

    const tokenBalances = result?.tokenBalances || [];

    // Filter out zero balances
    const nonZeroBalances = tokenBalances.filter(
      (token: any) => BigInt(token.tokenBalance || '0') > 0n
    );

    if (nonZeroBalances.length === 0) return [];

    // Fetch metadata results
    const tokenAddresses = nonZeroBalances.map((t: any) => t.contractAddress);
    const metadataResults = await alchemyClient.getBatchMetadata(tokenAddresses, chainId);

    // Fetch prices in batch to avoid rate limiting
    const priceMap = await getTokenPricesBatch(chainId, tokenAddresses);

    // [LEGENDARY FALLBACK] If some prices are 0, try fetching by symbols
    const tokensMissingPrice = nonZeroBalances.filter((t: any) => {
        const lowerAddr = t.contractAddress.toLowerCase();
        return !priceMap[lowerAddr] || priceMap[lowerAddr].price === 0;
    });

    if (tokensMissingPrice.length > 0) {
        const symbolsToFetch = tokensMissingPrice.map((t: any, idx: number) => {
            const meta = metadataResults[nonZeroBalances.indexOf(t)];
            return { symbol: meta?.symbol, address: t.contractAddress, chainId };
        }).filter((t: any) => t.symbol);

        if (symbolsToFetch.length > 0) {
            const symbolPriceMap = await PriceService.getBulkPrices(symbolsToFetch as any);
            
            nonZeroBalances.forEach((t: any, index: number) => {
                const lowerAddr = t.contractAddress.toLowerCase();
                if (!priceMap[lowerAddr] || priceMap[lowerAddr].price === 0) {
                    const symbol = metadataResults[index]?.symbol;
                    if (symbol && symbolPriceMap[symbol.toUpperCase()]) {
                        priceMap[lowerAddr] = symbolPriceMap[symbol.toUpperCase()];
                    }
                }
            });
        }
    }


    const tokensWithMetadata = nonZeroBalances.map((token: any, index: number) => {
        const metadata = metadataResults[index] || { symbol: 'UNKNOWN', name: 'Unknown Token', decimals: 18 };
        const balance = BigInt(token.tokenBalance || '0');
        const formatted = formatTokenBalance(balance, metadata.decimals);
        
        const priceData = priceMap[token.contractAddress.toLowerCase()] || { price: 0, change24h: 0 };

        return {
          address: token.contractAddress,
          symbol: metadata.symbol || 'UNKNOWN',
          name: metadata.name || 'Unknown Token',
          decimals: metadata.decimals || 18,
          logoURI: metadata.logo || undefined,
          balance: balance.toString(),
          balanceFormatted: formatted,
          priceUSD: priceData.price,
          valueUSD: priceData.price * parseFloat(formatted),
          change24h: priceData.change24h,
          chainId,
        };
    });

    // Sort by USD value (highest first)
    return tokensWithMetadata.sort((a: Token, b: Token) => (b.valueUSD || 0) - (a.valueUSD || 0));
  } catch (error) {
    console.error('Error discovering tokens:', error);
    return [];
  }
}

/**
 * Get multiple token prices in a single batch
 */
export async function getTokenPricesBatch(chainId: number, tokenAddresses: string[]): Promise<Record<string, { price: number; change24h: number }>> {
  if (tokenAddresses.length === 0) return {};
  
  try {
    const platformMap: Record<number, string> = {
      1: 'ethereum',
      137: 'polygon-pos',
      8453: 'base',
      42161: 'arbitrum-one',
      10: 'optimistic-ethereum',
      480: 'worldchain'
    };


    const platform = platformMap[chainId] || 'ethereum';
    const addressString = tokenAddresses.join(',').toLowerCase();
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${addressString}&vs_currencies=usd&include_24hr_change=true`,
      {
        headers: {
          'x-cg-demo-api-key': process.env.NEXT_PUBLIC_COINGECKO_KEY || '',
        },
      }
    );

    if (!response.ok) {
        const text = await response.text();
        if (response.status === 429 || text.includes('Throttled')) {
            console.warn('[CoinGecko] Batched request throttled. Reporting error.');
            return {
                error: 'PRICE_THROTTLED',
                errorMessage: 'Price feed rate-limited'
            } as any;
        }
        throw new Error(`CoinGecko Batch API error: ${response.status}`);
    }

    const data = await response.json();
    const result: Record<string, { price: number; change24h: number }> = {};
    
    tokenAddresses.forEach(addr => {
        const lowerAddr = addr.toLowerCase();
        const tokenData = data[lowerAddr];
        result[lowerAddr] = {
            price: tokenData?.usd || 0,
            change24h: tokenData?.usd_24h_change || 0
        };
    });
    
    return result;
  } catch (error) {
    console.error(`Error fetching batched prices for chain ${chainId}:`, error);
    return {};
  }
}

/**
 * Get the native balance of a chain (e.g. ETH on Ethereum)
 */
export async function getNativeBalanceToken(
  walletAddress: string,
  chainId: number
): Promise<Token | null> {
  try {
    const chain = getChainById(chainId);
    if (!chain) return null;

    const url = getAlchemyApiUrl(chainId);
    const result = await alchemyClient.fetchWithRetry(url, {
      jsonrpc: '2.0',
      method: 'eth_getBalance',
      params: [walletAddress, 'latest'],
      id: 1,
    });

    const balance = BigInt(result || '0x0');
    if (balance === 0n) return null;

    const formatted = formatTokenBalance(balance, chain.nativeCurrency.decimals);
    const { price, change24h } = await getPriceWithChange(chain.nativeCurrency.symbol);

    return {
      address: 'native',
      symbol: chain.nativeCurrency.symbol,
      name: chain.nativeCurrency.name,
      decimals: chain.nativeCurrency.decimals,
      balance: balance.toString(),
      balanceFormatted: formatted,
      priceUSD: price,
      valueUSD: price * parseFloat(formatted),
      change24h: change24h,
      chainId,
    };
  } catch (error) {
    console.error(`Error fetching native balance for chain ${chainId}:`, error);
    return null;
  }
}

/**
 * Get token metadata (symbol, name, decimals)
 */
export async function getTokenMetadata(
  tokenAddress: string,
  chainId: number
): Promise<TokenMetadata> {
  try {
    const result = await alchemyClient.getTokenMetadata(tokenAddress, chainId);

    return {
      address: tokenAddress,
      symbol: result?.symbol || 'UNKNOWN',
      name: result?.name || 'Unknown Token',
      decimals: result?.decimals || 18,
      logoURI: result?.logo || undefined,
      chainId,
    };
  } catch (error) {
    console.error('Error fetching token metadata:', error);
    return {
      address: tokenAddress,
      symbol: 'UNKNOWN',
      name: 'Unknown Token',
      decimals: 18,
      chainId,
    };
  }
}

/**
 * Get token price and 24h change in USD
 */
export async function getTokenPrice(chainId: number, tokenAddress: string): Promise<{ price: number; change24h: number }> {
  try {
    const platformMap: Record<number, string> = {
      1: 'ethereum',
      137: 'polygon-pos',
      8453: 'base',
      42161: 'arbitrum-one',
      10: 'optimistic-ethereum',
      480: 'worldchain'
    };

    const platform = platformMap[chainId] || 'ethereum';
    
    // Native tokens (handled via symbol in fetcher, but this provides specialized contract lookup)
    if (tokenAddress === 'native') {
        const chain = getChainById(chainId);
        if (!chain) return { price: 0, change24h: 0 };
        return await getPriceWithChange(chain.nativeCurrency.symbol);
    }

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${tokenAddress}&vs_currencies=usd&include_24hr_change=true`,
      {
        headers: {
          'x-cg-demo-api-key': process.env.NEXT_PUBLIC_COINGECKO_KEY || '',
        },
      }
    );

    if (!response.ok) {
        const text = await response.text();
        if (text.includes('Throttled')) {
            console.warn(`[CoinGecko] Request for ${tokenAddress} throttled.`);
            return { price: 0, change24h: 0 };
        }
        throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const tokenData = data[tokenAddress.toLowerCase()];
    
    // [LEGENDARY FALLBACK] If price is 0 by contract, try by symbol
    if (!tokenData?.usd) {
        const metadata = await getTokenMetadata(tokenAddress, chainId);
        if (metadata.symbol && metadata.symbol !== 'UNKNOWN') {
           const { getPriceWithChange } = await import('../priceHelper');
           // Retry with symbol (e.g. 'VIRTUAL', 'TRUMP')
           const symbolPrice = await getPriceWithChange(metadata.symbol);
           if (symbolPrice.price > 0) {
              return symbolPrice;
           }
        }
    }

    return {
      price: tokenData?.usd || 0,
      change24h: tokenData?.usd_24h_change || 0
    };
  } catch (error) {
    console.error(`Error fetching price for ${tokenAddress} on chain ${chainId}:`, error);
    return { price: 0, change24h: 0 };
  }
}

/**
 * Format token balance with decimals
 */
function formatTokenBalance(balance: bigint, decimals: number): string {
  if (balance === 0n) return '0';
  
  const divisor = BigInt(10 ** decimals);
  const wholePart = balance / divisor;
  const remainder = balance % divisor;
  
  if (remainder === 0n) {
    return wholePart.toString();
  }
  
  // Format with limited precision for extreme cases
  let fractional = remainder.toString().padStart(decimals, '0');
  
  // limit to 8 significant decimals to avoid layout explosion
  if (fractional.length > 8) {
    fractional = fractional.substring(0, 8);
  }
  
  const trimmed = fractional.replace(/0+$/, '');
  
  return trimmed ? `${wholePart}.${trimmed}` : wholePart.toString();
}

/**
 * Search for tokens by symbol or name
 */
export async function searchTokens(
  query: string,
  chainId: number,
  limit: number = 20
): Promise<TokenMetadata[]> {
  try {
    // Use 1inch token list
    const response = await fetch(
      `https://api.1inch.dev/token/v1.2/${chainId}/search?query=${encodeURIComponent(query)}&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${(process.env.ONEINCH_API_KEY || process.env.NEXT_PUBLIC_1INCH_API_KEY)}`,
        },
      }
    );

    const data = await response.json();
    
    return (data || []).map((token: any) => ({
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      logoURI: token.logoURI,
      chainId,
    }));
  } catch (error) {
    console.error('Error searching tokens:', error);
    return [];
  }
}

/**
 * Get popular/trending tokens for a chain
 */
export async function getPopularTokens(chainId: number): Promise<TokenMetadata[]> {
  // Predefined popular tokens per chain
  const popularTokens: Record<number, TokenMetadata[]> = {
    1: [ // Ethereum
      { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 1 },
      { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether USD', decimals: 6, chainId: 1 },
      { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', name: 'Wrapped BTC', decimals: 8, chainId: 1 },
      { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, chainId: 1 },
      { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', symbol: 'UNI', name: 'Uniswap', decimals: 18, chainId: 1 },
    ],
    137: [ // Polygon
      { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 137 },
      { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', name: 'Tether USD', decimals: 6, chainId: 137 },
      { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, chainId: 137 },
      { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, chainId: 137 },
    ],
    8453: [ // Base
      { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 8453 },
      { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, chainId: 8453 },
    ],
  };

  return popularTokens[chainId] || [];
}

/**
 * Get highly curated sovereign-grade tokens for the Elite panel
 */
export async function getInstitutionalTokens(chainId: number): Promise<TokenMetadata[]> {
    const registry: Record<number, TokenMetadata[]> = {
        1: [ // Ethereum
            { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 1, logoURI: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png' },
            { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether USD', decimals: 6, chainId: 1, logoURI: 'https://assets.coingecko.com/coins/images/325/small/tether.png' },
            { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', name: 'Wrapped BTC', decimals: 8, chainId: 1, logoURI: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png' },
            { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, chainId: 1, logoURI: 'https://assets.coingecko.com/coins/images/2518/small/weth.png' },
            { address: '0x163f8c2467924be0ae7b5347228cabf260318753', symbol: 'AUTH', name: 'Identity', decimals: 18, chainId: 1, logoURI: 'https://assets.coingecko.com/coins/images/31070/small/identity.jpeg' }
        ],
        137: [ // Polygon
            { address: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 137, logoURI: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png' },
            { address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', symbol: 'USDT', name: 'Tether USD', decimals: 6, chainId: 137, logoURI: 'https://assets.coingecko.com/coins/images/325/small/tether.png' },
            { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, chainId: 137, logoURI: 'https://assets.coingecko.com/coins/images/2518/small/weth.png' },
            { address: '0x163f8c2467924be0ae7b5347228cabf260318753', symbol: 'AUTH', name: 'Identity', decimals: 18, chainId: 137 }
        ],
        8453: [ // Base
            { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 8453, logoURI: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png' },
            { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, chainId: 8453, logoURI: 'https://assets.coingecko.com/coins/images/2518/small/weth.png' },
            { address: '0x163f8c2467924be0ae7b5347228cabf260318753', symbol: 'AUTH', name: 'Identity', decimals: 18, chainId: 8453 }
        ],
        480: [ // World Chain
            { address: '0x2cFc85d8E48F8EAB294be644d9E25C3030863003', symbol: 'AUTH', name: 'Identity', decimals: 18, chainId: 480 },
            { address: '0x79A02482A880bCE3F13e09Da970dC34db4CD68d7', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 480 },
            { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, chainId: 480 }
        ]
    };
    return registry[chainId] || registry[1];
}

/**
 * Add custom token to user's wallet
 */
export async function addCustomToken(
  tokenAddress: string,
  chainId: number
): Promise<TokenMetadata> {
  return getTokenMetadata(tokenAddress, chainId);
}

/**
 * Get token balance for specific address
 */
export async function getTokenBalance(
  walletAddress: string,
  tokenAddress: string,
  chainId: number
): Promise<string> {
  try {
    const rpcUrl = getRPCUrl(chainId);
    
    // ERC20 balanceOf function signature
    const data = `0x70a08231000000000000000000000000${walletAddress.slice(2)}`;
    
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: tokenAddress,
          data,
        }, 'latest'],
        id: 1,
      }),
    });

    const responseData = await response.json();
    return BigInt(responseData.result || '0x0').toString();
  } catch (error) {
    console.error('Error getting token balance:', error);
    return '0';
  }
}

/**
 * Get RPC URL for chain
 */
function getRPCUrl(chainId: number): string {
  const rpcUrls: Record<number, string> = {
    1: `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
    137: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
    8453: 'https://mainnet.base.org',
    42161: `https://arb-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
    10: `https://opt-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  };

  return rpcUrls[chainId] || rpcUrls[1];
}
/**
 * Categorizes tokens into specific sectors for legendary analytics analysis.
 */
export function getSectorForSymbol(symbol: string): string {
    const s = symbol.toUpperCase();
    
    const SECTORS: Record<string, string[]> = {
        'AI': ['AI', 'FET', 'AGIX', 'OCEAN', 'RENDER', 'ANON', 'HOLY', 'LYRA', 'CULT'],
        'Meme': ['PEPE', 'SHIB', 'DOGE', 'BONK', 'WIF', 'FLOKI', 'MUSHY', 'POPCAT'],
        'DeFi': ['UNI', 'AAVE', 'MAKER', 'MKR', 'SNX', 'CRV', 'LQTY', 'DYDX', 'COMP', 'LDO'],
        'Stablecoin': ['USDC', 'USDT', 'DAI', 'PYUSD', 'FRAX', 'LUSD', 'USDE'],
        'Layer 1': ['ETH', 'BTC', 'SOL', 'ADA', 'DOT', 'AVAX', 'NEAR', 'BNB'],
        'Layer 2': ['MATIC', 'POL', 'ARB', 'OP', 'BASE', 'STRK', 'METIS', 'AUTH'],
        'Gaming': ['IMX', 'GALA', 'BEAM', 'AXS', 'SAND', 'MANA']

    };

    for (const [sector, symbols] of Object.entries(SECTORS)) {
        if (symbols.includes(s)) return sector;
    }

    return 'Other';
}


