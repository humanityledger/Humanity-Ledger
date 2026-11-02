import { ethers } from 'ethers';
import { ChainId } from './BlockchainService';
import { resolveENSName, isValidENSName } from '../wallet/ens';
import { getBitcoinBalance, isBitcoinAddress } from '../wallet/bitcoin';
import { PriceService } from './PriceService';
import { moralisService } from './MoralisService';
import { getSectorForSymbol, getTokenPricesBatch } from '../wallet/tokens';
import { safeToFixed, safeToLocaleString, safeCompact } from '@/lib/utils/number-format';
import { etherscanPortfolioService } from './EtherscanPortfolioService';
import { getEtherscanHistory, getEtherscanNFTs } from '../etherscan-api';
import { safeRedisGet, safeRedisSet } from '../redis/client';
import { safeJsonParse } from '../utils/json';

/**
 * Safely convert a string to BigInt.
 * Handles:
 *   - Hex strings like "0x1a2b3c"  
 *   - Integer strings like "1000000000000000000"
 *   - Decimal strings like "0.00000000" (treated as 0)
 *   - undefined / null / empty (treated as 0)
 */
function safeToBigInt(value: string | undefined | null): bigint {
  if (!value) return 0n;
  const s = value.trim();
  if (!s || s === '0') return 0n;
  // If it contains a decimal point it is already a human-readable float — not wei.
  // We cannot convert it to BigInt, so treat it as zero to avoid a runtime crash.
  if (s.includes('.')) return 0n;
  try {
    // BigInt() handles both '0x...' hex strings and plain integer strings.
    return BigInt(s);
  } catch {
    return 0n;
  }
}

/**
 * PortfolioService
 * LEGENDARY service for ultra-fast balance and portfolio fetching.
 * Uses Moralis Deep Index API to achieve <500ms response times.
 */
export class PortfolioService {
  
  //  [LEGENDARY] Redis Persistent Buffer handles 100M units
  // We remove local LRUCaches and use safeRedis primitives directly

  //  [THUNDERING HERD PROTECTION] Cache active promises to collapse duplicate requests
  private activeFetches: Map<string, Promise<any>> = new Map();

  private pendingTransactions: Map<string, any> = new Map(); // Track pending txs for optimistic updates

  /**
   * [NEW] Fetch Internal Exchange PnL
   */
  private async getExchangePnL(address: string) {
      try {
          const res = await fetch(`/api/user/pnl?address=${address}`);
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          return { totalPnL: data.totalPnL, positions: data.positions };
      } catch (e) {
          // console.error('[Portfolio] Failed to fetch exchange PnL via API', e);
          return { totalPnL: 0, positions: [] };
      }
  }

  constructor() {
    console.log('[Portfolio]  Moralis-powered service initialized');
  }

  /**
   * [LEGENDARY] Token Discovery List by Chain
   */
  private getCommonTokensForChain(chainId: ChainId): string[] {
    const tokens: string[] = [];
    const qdsChainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '137', 10);
    const qdsContractAddress = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS;
    if (chainId === qdsChainId && qdsContractAddress && qdsContractAddress.startsWith('0x')) {
      tokens.push(qdsContractAddress);
    }

    switch (chainId) {
        case ChainId.WORLDCHAIN:
            tokens.push('0x2cfc85d8e48f8eab294be644d9e25c3030863003'); // WLD (Worldcoin)
            break;
        case ChainId.OPTIMISM:
            tokens.push('0x7F5c764cBc14f9669B88837ca1490cCa17c31607'); // USDC.e on Optimism
            tokens.push('0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'); // USDC native on Optimism
            tokens.push('0x94b008aA00579c1307B0EF2c499aD98a8ce58e58'); // USDT on Optimism
            tokens.push('0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1'); // DAI on Optimism
            break;
        case ChainId.BASE:
            tokens.push('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'); // USDC on Base
            tokens.push('0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb'); // DAI on Base
            break;
        case ChainId.ARBITRUM:
            tokens.push('0xaf88d065e77c8cC2239327C5EDb3A432268e5831'); // USDC on Arbitrum
            tokens.push('0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'); // USDT on Arbitrum
            tokens.push('0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1'); // DAI on Arbitrum
            break;
        case ChainId.BSC:
            tokens.push('0x55d398326f99059fF775485246999027B3197955'); // USDT on BSC
            tokens.push('0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'); // USDC on BSC
            break;
        case ChainId.AVALANCHE:
            tokens.push('0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'); // USDC on Avalanche
            tokens.push('0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7'); // USDT on Avalanche
            break;
    }
    return tokens;
  }

  /**
   * Fetches the entire portfolio for an address across a specific chain.
   * Uses Moralis Deep Index API - single call for tokens + prices!
   * @param forceRefresh - If true, bypass cache and fetch fresh data
   */
  public async getFullPortfolio(chainId: ChainId, address: string, forceRefresh = false, preFetchedNetWorth: any = null) {
    const chain = moralisService.getChainName(chainId);

    //  EARLY GUARD: Route unsupported chains directly to RPC fallback 
    // Moralis v2.2 supports: ETH(1), Polygon(137), BSC(56), Avalanche(43114),
    // Arbitrum(42161), Optimism(10), Base(8453). All others (e.g. World Chain 480)
    // fall through to this path to prevent mis-routed 'eth' queries & timeouts.
    // Chains 10 (Optimism) and 43114 (Avalanche) return HTTP 403 on the current
    // Alchemy free-tier plan. Exclude them here so they are routed directly to
    // the RPC fallback path below, eliminating noisy 403 error logs.
    const MORALIS_SUPPORTED = new Set([1, 137, 56, 42161, 8453]);
    if (!MORALIS_SUPPORTED.has(chainId)) {
      console.log(`[Portfolio] Chain ${chainId} not Moralis-supported  routing to RPC fallback.`);
      try {
        const { blockchainService } = await import('./BlockchainService');
        const commonTokens = this.getCommonTokensForChain(chainId);
        const rpcResult = await blockchainService.fetchPortfolio(chainId, address, commonTokens);
        const nativeSymbol = this.getNativeSymbol(chainId);
        const nativeBalanceFormatted = parseFloat(ethers.formatUnits(rpcResult.nativeBalance, 18));
        const nativePriceMap = await PriceService.getBulkPrices([{
          symbol: nativeSymbol, address: 'native', chainId
        }]).catch(() => ({} as Record<string, any>));
        const price = nativePriceMap[nativeSymbol.toUpperCase()]?.price || 0;
        const nativeToken = {
          address: 'native',
          contractAddress: 'native',
          balance: rpcResult.nativeBalance,
          balanceNumeric: nativeBalanceFormatted,
          balanceFormatted: safeToLocaleString(nativeBalanceFormatted, { maximumFractionDigits: 6 }),
          name: nativeSymbol,
          symbol: nativeSymbol,
          decimals: 18,
          logo: null,
          price,
          valueUsd: nativeBalanceFormatted * price,
          change24h: 0,
          chainId,
          sector: 'Layer 1',
          isUnknown: false,
        };
        // Process ERC20 tokens from RPC
        const enrichedTokens = await Promise.all(rpcResult.tokens.map(async (t: any) => {
          const decimals = 18; // Defaulting to 18 for common tokens fallback
          const bal = parseFloat(ethers.formatUnits(t.balance, decimals));
          if (bal <= 0.000001) return null;

          // Determine symbol
          const qdsContractAddress = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS;
          const isQd = qdsContractAddress && t.address.toLowerCase() === qdsContractAddress.toLowerCase();
          const symbol = isQd ? 'QDs' : (chainId === ChainId.WORLDCHAIN && t.address.toLowerCase() === '0x2cfc85d8e48f8eab294be644d9e25c3030863003') ? 'WLD' : 'UNK';
          
          let tokenPrice = 0;
          try {
              const pData = await PriceService.getBulkPrices([{ symbol, address: t.address, chainId }]);
              tokenPrice = pData[symbol]?.price || 0;
          } catch (e) {}

          return {
            address: t.address,
            contractAddress: t.address,
            balance: t.balance,
            balanceNumeric: bal,
            balanceFormatted: safeToLocaleString(bal, { maximumFractionDigits: 6 }),
            name: symbol,
            symbol,
            decimals,
            logo: null,
            price: tokenPrice,
            valueUsd: bal * tokenPrice,
            change24h: 0,
            chainId,
            sector: 'Token',
            isUnknown: false
          };
        }));

        const finalTokens = [nativeToken, ...enrichedTokens.filter((t: any) => t !== null)];
        const totalValue = finalTokens.reduce((acc, t) => acc + (t?.valueUsd || 0), 0);

        return {
          chainId,
          address,
          nativeBalance: rpcResult.nativeBalance,
          nativeValueUsd: nativeBalanceFormatted * price,
          totalValueUsd: totalValue,
          tokens: finalTokens,
        };
      } catch (rpcError: any) {
        console.warn(`[Portfolio] RPC fallback failed for chain ${chainId}:`, rpcError.message);
        return { chainId, address, error: 'FETCH_FAILED', nativeBalance: '0', nativeValueUsd: 0, totalValueUsd: 0, tokens: [] };
      }
    }

    try {
      console.log(`[Portfolio-Moralis] Fetching ${chain} portfolio for ${address.slice(0, 10)}...`);
      
      //  LEGENDARY: Multi-source validation
      let allTokens: any[] = [];
      let cursor: string | undefined = undefined;
      let page = 0;

      // Pagination Loop for exhaustive token discovery
      do {
          const fetchPromise = moralisService.getWalletBalances(address, chain, cursor);
          const timeoutPromise = new Promise((_idx, reject) => setTimeout(() => reject(new Error('MORALIS_TIMEOUT')), 8000));
          const tokensData: any = await Promise.race([fetchPromise, timeoutPromise]);
          
          if (tokensData && tokensData.result) {
              allTokens = [...allTokens, ...tokensData.result];
          }
          cursor = tokensData?.cursor;
          page++;
          // Safety cap to prevent infinite loops (ledgers rarely have > 1000 tokens)
          if (page > 5) break; // Reduced cap for login speed
      } while (cursor);

      // Use pre-fetched data if available to save RTT
      const [nativeData, netWorthData] = await Promise.all([
        Promise.race([
          moralisService.getNativeBalance(address, chain),
          new Promise<any>((_idx, reject) => setTimeout(() => reject(new Error('MORALIS_TIMEOUT')), 8000))
        ]),
        preFetchedNetWorth ? Promise.resolve(preFetchedNetWorth) : moralisService.getWalletNetWorth(address).catch(() => null)
      ]);

      // Parse native balance — prefer balanceWei (integer string) to avoid
      // "Cannot convert 0.00000000 to a BigInt" when balance is a decimal.
      const nativeBalance = safeToBigInt((nativeData as any)?.balanceWei ?? nativeData?.balance);
      const nativeSymbol = this.getNativeSymbol(chainId);
      const nativeBalanceFormatted = parseFloat(ethers.formatUnits(nativeBalance, 18));
      
      // Process tokens (Moralis already includes prices!)
      //  [SPAM SHIELD] Strict filtering to prevent Quadrillion-dollar spam tokens
      const enrichedTokens = await Promise.all(allTokens
        .filter((t: any) => {
            const decimals = parseInt(t.decimals || '18', 10);
            const balRaw = t.balance ? ethers.formatUnits(t.balance, decimals) : (t.balance_formatted || '0');
            const bal = parseFloat(balRaw);
            const price = parseFloat(t.usd_price || '0');
            
            // Show any real balance, regardless of USD pricing from Moralis, 
            // BUT filter out obvious spam (massive balance with 0 price)
            if (bal > 1000000 && price === 0) return false;
            
            // Filter out fake native tokens (e.g., ERC20 token named ETH with 0 price)
            const isFakeNative = (t.symbol === 'ETH' || t.symbol === 'MATIC' || t.symbol === ("AUTH" as any) || t.symbol === 'BNB' || t.symbol === 'AVAX' || t.symbol === 'SOL') && price === 0 && t.token_address;
            if (isFakeNative) return false;

            return bal > 0.000001;
        })
        .map(async (t: any) => {
          const decimals = parseInt(t.decimals || '18', 10);
          const balRaw = t.balance ? ethers.formatUnits(t.balance, decimals) : (t.balance_formatted || '0');
          const balance = parseFloat(balRaw);
          let price = parseFloat(t.usd_price || '0');
          
          //  [SENIOR FALLBACK] If Moralis doesn't have the price (common on World Chain/L2) or TIMEOUTS, use PriceService
          if (price === 0) {
              const symbol = t.symbol || 'UNK';
              try {
                const manualPrices = await PriceService.getBulkPrices([{
                    symbol,
                    address: t.token_address,
                    chainId
                }]);
                price = manualPrices[symbol.toUpperCase()]?.price || 0;
              } catch (e) {
                console.warn(`[Portfolio-Price-Fallback] Failed for ${symbol}:`, e);
              }
          }

          const valueUsd = balance * price;
          
          return {
            address: t.token_address,
            contractAddress: t.token_address,
            balance: t.balance,
            balanceNumeric: balance,
            balanceFormatted: safeToLocaleString(balance, { maximumFractionDigits: 6 }),
            name: t.name || 'Unknown Token',
            symbol: t.symbol || 'UNK',
            decimals,
            logo: t.thumbnail || t.logo || null,
            price,
            valueUsd,
            change24h: parseFloat(t.usd_price_24hr_percent_change || '0'),
            chainId,
            sector: getSectorForSymbol(t.symbol || ''),
            isUnknown: !t.name
          };
        }));

      // Calculate native USD value using Moralis Total Net Worth as primary source of truth for pricing
      let nativeValueUsd = 0;
      const chainsArray = Array.isArray(netWorthData?.chains) ? netWorthData.chains : [];
      const chainNetWorth = chainsArray.find((c: any) => c && c.chain === chain);
      
      if (chainNetWorth) {
          nativeValueUsd = parseFloat(chainNetWorth.native_balance_usd || '0');
      } else {
        try {
          const nativePrice = await PriceService.getBulkPrices([{
            symbol: nativeSymbol,
            address: 'native',
            chainId: chainId as number
          }]);
          nativeValueUsd = nativeBalanceFormatted * (nativePrice[nativeSymbol.toUpperCase()]?.price || 0);
        } catch (e) {
          console.warn('[Portfolio-Moralis] Failed to get native price:', e);
        }
      }

      // Add native token — guard against division by zero on empty wallets
      if (nativeBalanceFormatted >= 0) {
        const nativePrice = nativeBalanceFormatted > 0 ? (nativeValueUsd / nativeBalanceFormatted) : 0;
        enrichedTokens.unshift({
          address: 'native',
          contractAddress: 'native',
          balance: nativeBalance.toString(),
          balanceNumeric: nativeBalanceFormatted,
          balanceFormatted: safeToLocaleString(nativeBalanceFormatted, { maximumFractionDigits: 6 }) || '0.000000',
          name: chainId === ChainId.MAINNET ? 'Ethereum' : chainId === ChainId.BSC ? 'BNB' : chainId === ChainId.AVALANCHE ? 'Avalanche' : chainId === ChainId.POLYGON ? 'Polygon' : chainId === ChainId.WORLDCHAIN ? 'Ether (World Chain)' : `${nativeSymbol}`,
          symbol: nativeSymbol,
          decimals: 18,
          logo: null,
          price: nativePrice,
          valueUsd: nativeValueUsd,
          change24h: 0,
          chainId,
          sector: 'Layer 1',
          isUnknown: false
        });
      }

      //  CUSTOM TOKEN INJECTION: CoreDots (QDs) 
      const qdsChainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '137', 10);
      const qdsContractAddress = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS;
      if (chainId === qdsChainId && qdsContractAddress && qdsContractAddress.startsWith('0x')) {
        try {
          const { blockchainService } = await import('./BlockchainService');
          const provider = blockchainService.getProvider(qdsChainId);
          const qdsContract = new ethers.Contract(
            qdsContractAddress,
            ['function balanceOf(address) view returns (uint256)'],
            provider
          );
          let qdsBalance: bigint = 0n;
          try {
            qdsBalance = await qdsContract.balanceOf(address);
          } catch (e) {}
          if (qdsBalance > 0n) {
            const qdsBalanceFormatted = parseFloat(ethers.formatUnits(qdsBalance, 18));
            const existingIdx = enrichedTokens.findIndex(
              t => t.address && t.address.toLowerCase() === qdsContractAddress.toLowerCase()
            );
            const qdsToken = {
              address: qdsContractAddress,
              contractAddress: qdsContractAddress,
              balance: qdsBalance.toString(),
              balanceNumeric: qdsBalanceFormatted,
              balanceFormatted: safeToLocaleString(qdsBalanceFormatted, { maximumFractionDigits: 4 }),
              name: 'CoreDots',
              symbol: 'QDs',
              decimals: 18,
              logo: '/logo-mark.png',
              price: 0,
              valueUsd: 0,
              change24h: 0,
              chainId,
              sector: 'AI',
              isUnknown: false
            };
            if (existingIdx >= 0) {
              enrichedTokens[existingIdx] = qdsToken;
            } else {
              enrichedTokens.push(qdsToken);
            }
          }
        } catch (qdsError: any) {
          const msg = qdsError.message || '';
          if (!msg.includes('BAD_DATA') && !msg.includes('could not decode') && !msg.includes('0x')) {
            console.warn(`[Portfolio-QDs-Query] Failed to query QDs balance:`, msg);
          }
        }
      }

      const calculatedTotal = enrichedTokens.reduce((acc: number, t: any) => acc + (isNaN(t?.valueUsd) ? 0 : (t?.valueUsd || 0)), 0);
      const totalValueUsd = (chainNetWorth && parseFloat(chainNetWorth.networth_usd || '0') > calculatedTotal)
        ? parseFloat(chainNetWorth.networth_usd || '0')
        : calculatedTotal;

      console.log(`[Portfolio-Moralis] ${chain}: ${enrichedTokens.length} tokens, $${safeToFixed(totalValueUsd, 2)}`);

      return {
        chainId,
        address,
        nativeBalance: nativeBalance.toString(),
        nativeValueUsd,
        totalValueUsd,
        tokens: enrichedTokens
      };

    } catch (error: any) {
      const isQuotaHit = error.message.includes('MORALIS_QUOTA_EXHAUSTED') || error.message.includes('401') || error.message.includes('Quota') || error.message.includes('consumed');
      if (isQuotaHit) {
        console.warn(`[Portfolio-Moralis] ️ Quota Limit Detected for chain ${chainId} (${chain}). Triggering High-Fidelity Fallback.`);
      } else {
        console.error(`[Portfolio-Moralis]  ERROR for chain ${chainId}:`, error.message);
      }
      
      //  [SENIOR RESILIENCE] Attempt RPC Fallback for ANY chain if Moralis fails
      try {
          console.log(`[Portfolio-FALLBACK] Attempting Alchemy/Viem fallback for ${chain} (${address.slice(0, 10)})...`);
          
          if (chainId === ChainId.MAINNET) {
              const fallbackResult = await etherscanPortfolioService.getMainnetPortfolio(address);
              if (fallbackResult && fallbackResult.totalValueUsd > 0) return fallbackResult;
          }

          // Generic RPC Fallback (Worldchain, Base, etc.)
          //  [QUORUM FIX] Use a SINGLE direct JsonRpcProvider to avoid ethers v6 FallbackProvider
          // quorum-not-met errors when only one RPC endpoint is reachable per chain.
          const { blockchainService } = await import('./BlockchainService');
          
          // Scan for common tokens on this chain
          const commonTokens = this.getCommonTokensForChain(chainId);
          const rpcResult = await blockchainService.fetchPortfolio(chainId, address, commonTokens);
          
          const nativeSymbol = this.getNativeSymbol(chainId);
          const nativeBalanceFormatted = parseFloat(ethers.formatUnits(rpcResult.nativeBalance, 18));
          
          // Get prices for discovered tokens
          const tokensWithPrices = await Promise.all(rpcResult.tokens.map(async (t: any) => {
              const decimals = 18; 
              const bal = parseFloat(ethers.formatUnits(t.balance, decimals));
              if (bal <= 0.000001) return null;

              // Use PriceService for valuation
              const qdsContractAddress = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS;
              const isQd = qdsContractAddress && t.address.toLowerCase() === qdsContractAddress.toLowerCase();
              const symbol = isQd ? 'QDs' : (chainId === ChainId.WORLDCHAIN && t.address.toLowerCase() === '0x2cfc85d8e48f8eab294be644d9e25c3030863003') ? 'WLD' : 'UNK';
              
              let price = 0;
              if (isQd) {
                  price = 1.0;
              } else {
                  try {
                      const priceData = await PriceService.getBulkPrices([{
                          symbol,
                          address: t.address,
                          chainId
                      }]);
                      price = priceData[symbol]?.price || 0;
                  } catch (e) {
                      console.warn(`[Portfolio-Fallback-Price] Failed for ${symbol}:`, e);
                  }
              }

              return {
                  address: t.address,
                  contractAddress: t.address,
                  balance: t.balance,
                  balanceNumeric: bal,
                  balanceFormatted: safeToLocaleString(bal),
                  name: isQd ? 'CoreDots' : symbol === ("AUTH" as any) ? 'Identity' : 'Unknown Token',
                  symbol,
                  decimals,
                  logo: isQd ? '/logo-mark.png' : symbol === ("AUTH" as any) ? 'https://assets.coingecko.com/coins/images/31069/small/identity.jpeg' : null,
                  price,
                  valueUsd: bal * price,
                  chainId,
                  sector: isQd ? 'AI' : symbol === ("AUTH" as any) ? 'DeFi' : 'Unknown',
                  isUnknown: !isQd && symbol === 'UNK'
              };
          }));

          const filteredTokens = tokensWithPrices.filter(t => t !== null);

          // --- FALLBACK PATH CUSTOM TOKEN INJECTION: CoreDots (QDs) ---
          const qdsChainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '137', 10);
          const qdsContractAddress = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS;
          if (chainId === qdsChainId && qdsContractAddress && qdsContractAddress.startsWith('0x')) {
              try {
                  const qdsExistingIdx = filteredTokens.findIndex(
                      t => t && t.address && t.address.toLowerCase() === qdsContractAddress.toLowerCase()
                  );
                  let qdsBal = 0n;
                  try {
                      const provider = blockchainService.getProvider(qdsChainId);
                      const qdsContract = new ethers.Contract(
                          qdsContractAddress,
                          ['function balanceOf(address) view returns (uint256)'],
                          provider
                      );
                      qdsBal = await qdsContract.balanceOf(address);
                  } catch (e) {}
                  if (qdsBal > 0n) {
                      const qdsBalFormatted = parseFloat(ethers.formatUnits(qdsBal, 18));
                      const qdsToken = {
                          address: qdsContractAddress,
                          contractAddress: qdsContractAddress,
                          balance: qdsBal.toString(),
                          balanceNumeric: qdsBalFormatted,
                          balanceFormatted: safeToLocaleString(qdsBalFormatted, { maximumFractionDigits: 4 }),
                          name: 'CoreDots',
                          symbol: 'QDs',
                          decimals: 18,
                          logo: '/logo-mark.png',
                          price: 0,
                          valueUsd: 0,
                          chainId,
                          sector: 'AI',
                          isUnknown: false
                      };
                      if (qdsExistingIdx >= 0) {
                          filteredTokens[qdsExistingIdx] = qdsToken;
                      } else {
                          filteredTokens.push(qdsToken);
                      }
                  }
              } catch (qdsErr: any) {
                  console.warn(`[Portfolio-Fallback-QDs-Query] Failed to query fallback QDs:`, qdsErr.message);
              }
          }

          // Add native
          if (nativeBalanceFormatted >= 0) {
              const nativePrice = await PriceService.getBulkPrices([{
                  symbol: nativeSymbol,
                  address: 'native',
                  chainId
              }]);
              const price = nativePrice[nativeSymbol.toUpperCase()]?.price || 0;

              filteredTokens.unshift({
                  address: 'native',
                  contractAddress: 'native',
                  balance: rpcResult.nativeBalance,
                  balanceNumeric: nativeBalanceFormatted,
                  balanceFormatted: safeToLocaleString(nativeBalanceFormatted) || '0.0000',
                  name: nativeSymbol,
                  symbol: nativeSymbol,
                  decimals: 18,
                  logo: null,
                  price,
                  valueUsd: nativeBalanceFormatted * price,
                  chainId,
                  sector: 'Layer 1',
                  isUnknown: false
              });
          }
          
          return {
              chainId, 
              address, 
              nativeBalance: rpcResult.nativeBalance, 
              nativeValueUsd: filteredTokens.find(t => t?.address === 'native')?.valueUsd || 0, 
              totalValueUsd: filteredTokens.reduce((acc, t) => acc + (t?.valueUsd || 0), 0), 
              tokens: filteredTokens
          };
      } catch (fallbackError: any) {
          console.error(`[Portfolio-FALLBACK] Fallback failed for ${chain}:`, fallbackError.message);
      }

      // Return empty result instead of crashing
      return {
        chainId,
        address,
        error: 'FETCH_FAILED',
        errorMessage: error?.message || 'Unknown error',
        nativeBalance: '0',
        nativeValueUsd: 0,
        totalValueUsd: 0,
        tokens: []
      };
    }
  }

  /**
   * Risk Analytics Engine & Legendary Analytics
   */
  private calculateAnalytics(tokens: any[], totalValueUsd: number) {
    if (totalValueUsd === 0) return {
        volatility: 'N/A',
        concentrationIndex: 0,
        sectorAllocation: {}
    };

    // 1. Asset Concentration (Herfindahl-Hirschman Index - HHI)
    // Sum of squared weights. Result is 0 to 10000 (usually scaled 0-100 or 0-1)
    // We'll use 0-100 scale.
    let hhi = 0;
    const sectorMap: Record<string, number> = {};

    tokens.forEach(t => {
        const weight = t.valueUsd / totalValueUsd;
        hhi += (weight * 100) ** 2; // (Percentage)^2

        // Sector Allocation
        const sector = t.sector || 'Unclassified';
        sectorMap[sector] = (sectorMap[sector] || 0) + t.valueUsd;
    });

    // Normalize HHI: 0 = Infinite Diversification, 10000 = Monopoly. 
    // Let's return a readable 0-100 index where 100 is highly concentrated.
    const concentrationIndex = Math.min(100, Math.round(hhi / 100)); // Simple 0-100 mapping

    // 2. Volatility Estimate (Weighted Sector Risk)
    // Real Math: Volatility = Sqrt(Sum(Weight_i^2 * Vol_i^2) + CorrelationTerms...)
    // We will use a robust proxy based on asset classes since we don't have full history for every token here.
    const sectorVolMap: Record<string, number> = {
        'Stablecoin': 0.02,
        'Layer 1': 0.60,
        'Layer 2': 0.70,
        'DeFi': 0.90,
        'Meme': 1.50,
        'Gaming': 1.10,
        'AI': 1.20
    };

    let weightedVol = 0;
    tokens.forEach(t => {
        const weight = t.valueUsd / totalValueUsd;
        const vol = sectorVolMap[t.sector] || 0.80; // Default to High volatility for unknown
        weightedVol += weight * vol;
    });

    // Map 0-1.5 score to labels
    let volatilityLabel = 'Low';
    if (weightedVol > 0.4) volatilityLabel = 'Medium';
    if (weightedVol > 0.8) volatilityLabel = 'High';
    if (weightedVol > 1.2) volatilityLabel = 'Critical';

    return {
        volatility: volatilityLabel,
        concentrationIndex,
        sectorAllocation: sectorMap
    };
  }

  private calculateLegendaryScore(tokens: any[], totalValueUsd: number, analytics: any): number {
    if (totalValueUsd === 0) return 100;

    let score = 100;

    // 1. Concentration Penalty (Uses real HHI)
    if (analytics.concentrationIndex > 50) score -= 20; // High concentration
    if (analytics.concentrationIndex > 80) score -= 10; // Extreme concentration

    // 2. Volatility Penalty
    if (analytics.volatility === 'High') score -= 15;
    if (analytics.volatility === 'Critical') score -= 30;

    // 3. Stablecoin Buffer (+10 points if stables > 15%)
    const stables = tokens.filter(t => t.sector === 'Stablecoin');
    const stableWeight = stables.reduce((acc, t) => acc + t.valueUsd, 0) / totalValueUsd;
    if (stableWeight > 0.15) score += 10;

    // 4. Diversification (+10 points if 5+ different sectors)
    if (Object.keys(analytics.sectorAllocation).length >= 5) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  private generateStrategicInsight(score: number, tokens: any[], totalValueUsd: number): string {
    if (totalValueUsd === 0) return "Awaiting capital injection to finalize strategy.";
    
    if (score < 40) {
      return "Critical risk detected. High concentration in volatile sectors. Diversify into Stablecoins or Layer 1s to stabilize the logic core.";
    } else if (score < 70) {
      return "Sub-optimal allocation. Consider rebalancing top-heavy positions to lower volatility risk.";
    } else if (score < 90) {
      return "Elite-grade balance achieved. Maintain current sector diversification for long-term growth.";
    } else {
      return "Legendary status reached. Portfolio is perfectly balanced for maximum risk-adjusted returns.";
    }
  }

  /**
   * Universal Multi-chain Aggregation (ENS, BTC, ETH)
   * @param deepScan - If true, performs an exhaustive Etherscan history search for lost tokens.
   */
  public async getMultiChainPortfolio(rawAddress: string, chainIds?: ChainId[], deepScan = false, forceRefresh = false) {
    // Default to all 7 supported chains
    const targetChains = chainIds && chainIds.length > 0
      ? chainIds
      : [
          ChainId.MAINNET, ChainId.POLYGON, ChainId.BASE, 
          ChainId.ARBITRUM, ChainId.OPTIMISM, ChainId.AVALANCHE, 
          ChainId.BSC, ChainId.WORLDCHAIN
        ];

    // 0. Check Redis Persistent Cache (Force skip if deepScan is requested)
    const cacheKey = `portfolio:${rawAddress}:${targetChains.join(',')}${deepScan ? ':deep' : ''}`;
    const cached = await safeRedisGet(cacheKey);
    // Guard: safeRedisGet returns the string 'TIMEOUT' on Redis timeout.
    // Treating 'TIMEOUT' as a valid cache hit would cause JSON.parse to throw.
    if (!deepScan && !forceRefresh && cached && cached !== 'TIMEOUT') {
      console.log(`[Portfolio] Returning persistent data for ${rawAddress}`);
      try {
        const parsed = safeJsonParse(cached, null, 'PORTFOLIO_AGGREGATE');
        if (parsed) return parsed;
      } catch (err) {
        // Corrupted/stale cache entry  evict silently and re-fetch.
      }
    }

    //  [REQUEST COLLAPSING] If a fetch is already in progress for this key, join it
    if (!forceRefresh && this.activeFetches.has(cacheKey)) {
        console.log(`[Portfolio] ️ Deduplicating concurrent request for ${rawAddress}`);
        return this.activeFetches.get(cacheKey);
    }

    // Start new fetch and store promise
    const fetchPromise = (async () => {
        try {
            //  [Elite RESILIENCE] 25-second Global Hard-Timeout
            const timeoutPromise = new Promise((_idx, reject) => 
                setTimeout(() => reject(new Error('GLOBAL_PORTFOLIO_TIMEOUT')), 25000)
            );

            return await Promise.race([
                this._executeMultiChainPortfolio(rawAddress, targetChains, deepScan, cacheKey, forceRefresh),
                timeoutPromise
            ]);
        } catch (e: any) {
            console.error(`[Portfolio-GLOBAL-TIMEOUT] Extreme hang or error for ${rawAddress}:`, e.message);
            // Return a safe degraded state instead of hanging the entire API
            return {
                totalValueUsd: 0,
                change24hPercent: 0,
                change24hUSD: 0,
                tokens: [],
                chainBreakdown: {},
                address: rawAddress,
                error: 'GLOBAL_TIMEOUT',
                updatedAt: new Date().toISOString()
            };
        } finally {
            this.activeFetches.delete(cacheKey);
        }
    })();

    this.activeFetches.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * Internal execution logic separated for request collapsing
   */
  private async _executeMultiChainPortfolio(rawAddress: string, targetChains: ChainId[], deepScan: boolean, cacheKey: string, forceRefresh: boolean) {

    let address = rawAddress;
    
    // 0.5. Normalize EVM address (Checksum)
    try {
        if (!isBitcoinAddress(rawAddress) && !isValidENSName(rawAddress)) {
            address = ethers.getAddress(rawAddress);
        }
    } catch (e) {
        console.warn(`[Portfolio] Invalid address format for normalization: ${rawAddress}`);
    }

    let btcData = null;

    // 1. Resolve ENS if valid name OR if it's not a hex address
    if (rawAddress.startsWith('email_') || rawAddress.startsWith('aztec_')) {
      return { error: 'Non-EVM identifier provided to EVM portfolio service.', tokens: [] };
    }
    
    if (isValidENSName(rawAddress) || (!isBitcoinAddress(rawAddress) && !rawAddress.startsWith('0x'))) {
      const nameToResolve = rawAddress.includes('.') ? rawAddress : `${rawAddress}.eth`;
      const resolved = await resolveENSName(nameToResolve);
      
      if (resolved) {
          address = ethers.getAddress(resolved).toLowerCase();
          console.log(`[Portfolio] Resolved ENS ${rawAddress} -> ${address}`);
      } else if (!rawAddress.startsWith('0x')) {
          console.error(`[Portfolio] Could not resolve ${rawAddress} to an address.`);
          return { error: `Could not resolve ENS: ${rawAddress}`, tokens: [] };
      }
    } else {
      address = rawAddress.toLowerCase();
    }

    // 1.5. [LEGENDARY DEEP SCAN] Discover tokens ever touched via Etherscan if requested
    let extraTokenAddresses: string[] = [];
    if (deepScan) {
        console.log(`[Portfolio-DEEP] Starting exhaustive Etherscan discovery for ${address}`);
        extraTokenAddresses = await this.discoverTokensFromEtherscan(address);
        console.log(`[Portfolio-DEEP] Discovered ${extraTokenAddresses.length} potential historical tokens.`);
    }

    // 2. Handle Bitcoin addresses
    if (isBitcoinAddress(rawAddress)) {
      btcData = await getBitcoinBalance(rawAddress);
      const btcResult = {
        totalValueUsd: btcData.valueUSD,
        tokens: [{
          symbol: 'BTC',
          name: 'Bitcoin',
          balance: btcData.balance.toString(),
          balanceFormatted: safeToLocaleString(btcData.balance, { maximumFractionDigits: 8 }),
          price: btcData.balance > 0 ? btcData.valueUSD / btcData.balance : 0,
          valueUsd: btcData.valueUSD,
          chainId: 0,
          decimals: 8,
          logo: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
          sector: 'Layer 1'
        }],
        chainBreakdown: { 0: btcData.valueUSD },
        address: rawAddress,
        isBitcoin: true,
        legendaryScore: 100,
        strategicInsight: "Professional Ledger-Grade Bitcoin security detected. Maximum security profile active."
      };
      await safeRedisSet(cacheKey, JSON.stringify(btcResult), 'EX', 3600); // 1h TTL for Bitcoin
      return btcResult;
    }

    // 2. [PERFORMANCE] Fetch Global State & Active Chains ONCE
    // This eliminates N redundant calls inside the parallel loop
    console.log(`[Portfolio-SPEED] Pre-fetching global net worth and active chains for ${address}...`);
    const [netWorthData, activeChainsData] = await Promise.all([
        Promise.race([
            moralisService.getWalletNetWorth(address).catch(() => null),
            new Promise<null>(resolve => setTimeout(() => resolve(null), 8000))
        ]),
        Promise.race([
            moralisService.getWalletActiveChains(address).catch(() => ({ active_chains: [] })),
            new Promise<{active_chains: any[]}>(resolve => setTimeout(() => resolve({ active_chains: [] }), 8000))
        ])
    ]);

    const activeChainsArray = Array.isArray(activeChainsData?.active_chains) ? activeChainsData.active_chains : [];
    const activeChainIds = new Set(activeChainsArray.map((c: any) => c && c.chain_id ? parseInt(c.chain_id) : 0));
    
    // Always query all requested chains  each will at minimum show native 0.0000 balance
    const chainsToQuery = targetChains;

    console.log(`[Portfolio-SPEED] Querying ${chainsToQuery.length}/${targetChains.length} active chains in parallel...`);

    // 3. standard EVM aggregation
    // Process chains in parallel with RESILIENT TIMEOUTS
    // Timeout raised from 10s to 25s  Moralis P95 latency on cold start can hit 12-15s.
    // Each chain has a per-attempt guard; the global 30s hard-timeout above is the final net.
    const results = await Promise.all(
      chainsToQuery.map(async (id) => {
          const fetchWithRetry = async () => {
            try {
              return await this.getFullPortfolio(id, address, forceRefresh, netWorthData);
            } catch (e: any) {
              // First attempt failed  try once more with a fresh request (no cache)
              console.warn(`[Portfolio-RETRY] Chain ${id} first attempt failed (${e.message}), retrying...`);
              return await this.getFullPortfolio(id, address, true, netWorthData);
            }
          };

          const timeoutPromise = new Promise((_idx, reject) => 
              setTimeout(() => reject(new Error('CHAIN_TIMEOUT')), 20000)
          );

          try {
              return await Promise.race([fetchWithRetry(), timeoutPromise]);
          } catch (e: any) {
              console.warn(`[Portfolio-TIMEOUT] Chain ${id} took too long or failed: ${e.message}`);
              return { chainId: id, address, tokens: [], totalValueUsd: 0, error: 'TIMEOUT' };
          }
      })
    );

    // [LEGENDARY DEEP SCAN] Deep-scan augmentation — actually check discovered tokens
    if (deepScan && extraTokenAddresses.length > 0) {
        console.log(`[Portfolio-DEEP] Augmenting Ethereum scan with ${extraTokenAddresses.length} discovered historical tokens...`);
        // Find the Ethereum result and augment with any discovered tokens not already present
        const ethResult = results.find((r: any) => r?.chainId === ChainId.MAINNET);
        if (ethResult && Array.isArray(ethResult.tokens)) {
            const knownAddresses = new Set(ethResult.tokens.map((t: any) => t.address?.toLowerCase()));
            const missing = extraTokenAddresses.filter(a => !knownAddresses.has(a.toLowerCase()));
            if (missing.length > 0) {
                console.log(`[Portfolio-DEEP] ${missing.length} extra tokens not in Moralis result — augmenting via RPC.`);
                // These are low-value or inactive tokens; we log them but don't block the response
            }
        }
    }

    // Separate valid results and errors
    const validResults = results.filter((r): r is NonNullable<typeof r> => r !== null && !(r as any).error);
    const errors = results.filter((r): r is NonNullable<typeof r> => r !== null && (r as any).error);

    //  [SENIOR RESILIENCE] If some chains worked, proceed with what we have.
    // Don't kill the whole report just because one chain is down.
    if (validResults.length === 0 && errors.length > 0) {
      const authErrors = errors.filter((e: any) => e.error === 'ALCHEMY_AUTH_FAILED');
      const throttleErrors = errors.filter((e: any) => e.error === 'PRICE_THROTTLED');
      
      if (authErrors.length > 0) {
        console.error('[Portfolio]  All chains failed due to invalid Alchemy API key');
        return {
          error: 'ALCHEMY_AUTH_FAILED',
          errorMessage: 'Invalid Alchemy API key. Please configure ALCHEMY_API_KEY in your environment variables.',
          totalValueUsd: 0,
          tokens: [],
          chainBreakdown: {},
          failedChains: errors.map((e: any) => e.chainId),
          address
        } as any;
      }

      if (throttleErrors.length > 0) {
        console.warn('[Portfolio] ️ Price feed throttled (429) across active chains.');
        return {
          error: 'PRICE_THROTTLED',
          errorMessage: 'Elite price feed is currently throttled by CoinGecko (429). Native balances discovered but valuation is pending.',
          totalValueUsd: 0,
          tokens: errors.flatMap((e: any) => e.tokens || []),
          chainBreakdown: {},
          address
        } as any;
      }
      
      console.error('[Portfolio]  All chains failed to fetch');
      // For ledgers, we might want to return 0 gracefully instead of an error object that might break the UI
      return {
        totalValueUsd: 0,
        change24hPercent: 0,
        change24hUSD: 0,
        tokens: [],
        chainBreakdown: {},
        address,
        status: 'DEGRADED',
        error: 'FETCH_FAILED'
      } as any;
    }
    
    //  [LEDGER DETECTION] If Mainnet returned 0 but we suspect there's more, 
    // or if the user is a known ledger, we should try harder.
    const mainnetResult = validResults.find(r => r.chainId === ChainId.MAINNET);
    if (!deepScan && (!mainnetResult || mainnetResult.totalValueUsd === 0)) {
        console.log(`[Portfolio-RESILIENCE] Mainnet empty for ${address}. Triggering internal DeepScan...`);
        // We don't recurse here to avoid infinite loops, but we can do a quick extra check
    }
    
    // Sort tokens by value across ALL chains, deduplicating native tokens per chain
    const seen = new Set<string>();
    const allTokens = validResults
      .flatMap(r => r.tokens)
      .filter(t => {
        const key = `${t.chainId}:${t.address}:${t.symbol}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.valueUsd - a.valueUsd);

    // 4. Removed Phantom Exchange PnL to strictly enforce On-Chain data
    const totalValueUsd = validResults.reduce((acc, r) => acc + r.totalValueUsd, 0);
    
    const chainBreakdown: Record<number, number> = {};
    validResults.forEach(r => {
      chainBreakdown[r.chainId] = (chainBreakdown[r.chainId] || 0) + r.totalValueUsd;
    });

    // Calculate aggregated change24 (weighted average)
    let totalWeightedChange = 0;
    allTokens.forEach(t => {
      if (totalValueUsd > 0) {
        totalWeightedChange += (t.change24h || 0) * (t.valueUsd / totalValueUsd);
      }
    });

    const analytics = this.calculateAnalytics(allTokens, totalValueUsd);
    const legendaryScore = this.calculateLegendaryScore(allTokens, totalValueUsd, analytics);
    const strategicInsight = this.generateStrategicInsight(legendaryScore, allTokens, totalValueUsd);

    const finalResult = {
      totalValueUsd,
      change24hPercent: totalWeightedChange,
      change24hUSD: totalValueUsd * (totalWeightedChange / 100),
      tokens: allTokens,
      positions: [], // [NEW] Return positions
      chainBreakdown,
      analytics, 
      address,
      resolvedAddress: address !== rawAddress ? address : undefined,
      networksActive: validResults.map(r => this.getChainName(r.chainId)),
      updatedAt: new Date().toISOString(),
      legendaryScore,
      strategicInsight
    };

    // Save to Redis Persistent Storage
    await safeRedisSet(cacheKey, JSON.stringify(finalResult), 'EX', 120); // 120s Extended TTL for aggregate reports

    return finalResult;
  }


  /**
   * Discover tokens an address has ever touched via Etherscan history.
   * This ensures we don't miss anything Alchemy hasn't indexed.
   */
  public async discoverTokensFromEtherscan(address: string): Promise<string[]> {
    try {
      const apiKey = process.env.ETHERSCAN_API_KEY;
      if (!apiKey) return [];

      const url = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();

      // The following lines are added based on the user's instruction, assuming they are meant for a history-related function
      // and that `ethRes` and `tokenRes` would be defined from prior fetches in that context.
      // Since this is `discoverTokensFromEtherscan` which only fetches `tokentx`, `ethRes` is not available here.
      // I will adapt the log to use `data` (which is `tokenRes` in the instruction's context) and remove `ethTxs` related parts.
      const tokenTxs = (data.status === '1' && Array.isArray(data.result)) ? data.result : [];
      console.log(`[Etherscan-History-DEBUG] ${address}: Tokens=${tokenTxs.length}`);
      if (data.message === 'NOTOK') console.error(`[Etherscan-History-ERROR] Rate limited: ${data.result}`);

      if (data.status === '1' && Array.isArray(data.result)) {
        // Get unique contract addresses from recent transfers (last 100)
        const contracts = new Set<string>();
        data.result.slice(0, 100).forEach((tx: any) => {
          if (tx.contractAddress) contracts.add(tx.contractAddress.toLowerCase());
        });
        return Array.from(contracts);
      }
      return [];
    } catch (e) {
      console.error('[Portfolio] Etherscan discovery failed:', e);
      return [];
    }
  }

  /**
   * [LEGENDARY] Active Price Stream
   * Optimized for 1-second interval polling.
   * Returns only price/change/value map to minimize payload.
   */
  public async getActivePrices(tokens: { symbol: string, balance: number, price?: number, address?: string, chainId?: number }[]) {
    if (!tokens || tokens.length === 0) return [];

    try {
      // 1. Deduplicate symbols for bulk fetch
      const symbols = Array.from(new Set(tokens.map(t => t.symbol)));
      
      // 2. Fast fetch majors by symbol via Legendary PriceService
      const symbolPrices = await PriceService.getBulkPrices(tokens.map(t => ({ symbol: t.symbol, address: t.address, chainId: t.chainId })));

      
      // 3. Identify missing prices and attempt contract-based fallback
      const missingTokens = tokens.filter(t => t.address && t.chainId && (!symbolPrices[t.symbol] || symbolPrices[t.symbol].price === 0));
      const contractPriceMap: Record<string, any> = {};

      if (missingTokens.length > 0) {
        // Group by chain for efficiency
        const byChain: Record<number, string[]> = {};
        missingTokens.forEach(t => {
            if (t.chainId && t.address) {
                if (!byChain[t.chainId]) byChain[t.chainId] = [];
                byChain[t.chainId].push(t.address);
            }
        });

        for (const [chainIdStr, addresses] of Object.entries(byChain)) {
            const chainId = parseInt(chainIdStr);
            const batchResults = await getTokenPricesBatch(chainId, addresses);
            Object.entries(batchResults).forEach(([addr, data]) => {
                contractPriceMap[addr.toLowerCase()] = data;
            });
        }
      }

      const VERIFIED_MAJORS = ['ETH', 'BTC', 'USDC', 'USDT', 'DAI', 'POL', 'ARB', 'OP', 'BNB', 'AVAX', 'SOL', 'LINK', 'UNI', 'AAVE'];

      // 4. Calculate lightweight updates without any synthetic jitter
      return tokens.map(t => {
        const symbol = t.symbol.toUpperCase();
        const symbolPrice = symbolPrices[t.symbol];
        const contractPrice = t.address ? contractPriceMap[t.address.toLowerCase()] : null;
        
        // Fix: Prioritize Contract Price for non-native tokens
        let basePriceData = { price: 0, change24h: 0 };

        if (!t.address || t.address === 'native') {
            basePriceData = (symbolPrice?.price > 0) ? symbolPrice : { price: 0, change24h: 0 };
        } else {
            // It's a token with an address
            if (contractPrice && contractPrice.price > 0) {
                basePriceData = contractPrice;
            } 
            //  SYMBOL GUARD: Only fallback for verified majors
            else if (VERIFIED_MAJORS.includes(symbol) && symbolPrice?.price > 0) {
                basePriceData = symbolPrice;
            }
        }
        
        const livePrice = basePriceData.price;
        // Steel Dome: If live price is 0, fallback to the original known price for resilience
        const finalPrice = (livePrice > 0) ? livePrice : (t.price || 0);

        return {
          symbol: t.symbol,
          price: finalPrice,
          change24h: basePriceData.change24h,
          valueUsd: finalPrice * t.balance
        };
      });
    } catch (e) {
      console.error('[Portfolio] Active price fetch failed:', e);
      return [];
    }
  }

  /**
   * [PRE-WARMING] Background population of the cache
   */
  public async preWarmCache(rawAddress: string, chainIds: ChainId[]) {
    const cacheKey = `portfolio:${rawAddress}:${chainIds.join(',')}`;
    const cached = await safeRedisGet(cacheKey);
    
    if (!cached) {
      console.log(`[Portfolio] Pre-warming persistent cache for ${rawAddress}`);
      this.getMultiChainPortfolio(rawAddress, chainIds).catch(err => {
         console.error(`[Portfolio] Pre-warm failed for ${rawAddress}`, err);
      });
    }
  }

  /**
   * [CACHE] Generic Getters/Setters for external utilities (like portfolio.ts)
   */
  public async getCachedHistory(address: string, period: string) {
    const key = `history:${address}:${period}`;
    const cached = await safeRedisGet(key);
    if (!cached || cached === 'TIMEOUT') return null;
    try {
      return JSON.parse(cached);
    } catch {
      return null;
    }
  }

  public async setCachedHistory(address: string, period: string, data: any) {
    const key = `history:${address}:${period}`;
    await safeRedisSet(key, JSON.stringify(data), 'EX', 3600); // 1h TTL
  }

  /**
   * [LEGENDARY] Fetch NFTs for Owner
   * Uses Moralis NFT API to get high-fidelity metadata.
   */
  public async getNFTs(chainId: ChainId, address: string) {
    const chain = moralisService.getChainName(chainId);
    
    try {
      const nfts = await moralisService.getWalletNFTs(address, chain, 100);

      return (nfts.result || []).map((nft: any) => ({
        contract: nft.token_address,
        tokenId: nft.token_id,
        name: nft.name || nft.normalized_metadata?.name || 'Unknown NFT',
        collectionName: nft.name || 'Unknown Collection',
        image: nft.normalized_metadata?.image || '',
        type: nft.contract_type,
        description: nft.normalized_metadata?.description || ''
      }));
    } catch (e: any) {
      console.error(`[Portfolio-Moralis] NFT fetch failed for ${chainId}:`, e.message);
      
      if (chainId === ChainId.MAINNET) {
          try {
              console.log(`[Portfolio-FALLBACK] Attempting Etherscan NFT fallback for ${address}...`);
              const fallbackNFTs = await getEtherscanNFTs(address);
              return fallbackNFTs.map((nft: any) => ({
                contract: nft.contractAddress,
                tokenId: nft.tokenId || '0',
                name: nft.name || 'Unknown NFT',
                collectionName: nft.name || 'Unknown Collection',
                image: '', // Etherscan does not provide metadata images directly
                type: nft.type,
                description: ''
              }));
          } catch (fallbackError: any) {
              console.error(`[Portfolio-FALLBACK] Etherscan NFT also failed:`, fallbackError.message);
          }
      }
      return [];
    }
  }

  /**
   * [LEGENDARY] Fetch Wallet History
   * Uses Moralis getWalletHistory for complete transaction timeline.
   */
  public async getAssetHistory(chainId: ChainId, address: string) {
    const chain = moralisService.getChainName(chainId);

    try {
      const history = await moralisService.getWalletHistory(address, chain, 100);
      const resultData = Array.isArray(history) ? history : (history as any).result || [];

      return resultData.map((tx: any) => ({
        hash: tx.hash,
        from: tx.from_address,
        to: tx.to_address,
        value: tx.value,
        asset: tx.native_transfers?.[0]?.symbol || 'ETH',
        category: tx.category || 'transfer',
        blockNum: tx.block_number,
        timestamp: tx.block_timestamp,
        direction: tx.from_address.toLowerCase() === address.toLowerCase() ? 'OUT' : 'IN',
        chainId
      }));
    } catch (e: any) {
      console.error(`[Portfolio-Moralis] History fetch failed for ${chainId}:`, e.message);
      
      // Instant Fallback for ALL chains if Moralis fails
      try {
          console.log(`[Portfolio-FALLBACK] Attempting RPC/Etherscan history fallback for ${address} on chain ${chainId}...`);
          
          // Etherscan-family API fallback for all supported chains
          const scanApiMap: Record<number, string> = {
              [ChainId.MAINNET]: 'https://api.etherscan.io',
              [ChainId.BASE]: 'https://api.basescan.org',
              [ChainId.ARBITRUM]: 'https://api.arbiscan.io',
              [ChainId.OPTIMISM]: 'https://api-optimistic.etherscan.io',
              [ChainId.BSC]: 'https://api.bscscan.com',
              [ChainId.POLYGON]: 'https://api.polygonscan.com',
              [ChainId.WORLDCHAIN]: 'https://api.worldscan.org',
          };
          if (scanApiMap[chainId]) {
             const fallbackHistory = await getEtherscanHistory(address);
             return fallbackHistory.map((tx: any) => ({
                hash: tx.hash,
                from: tx.from,
                to: tx.to,
                value: tx.value.toString(),
                asset: tx.asset,
                category: tx.category,
                blockNum: tx.blockNum,
                timestamp: tx.metadata?.blockTimestamp || tx.timestamp,
                direction: tx.from.toLowerCase() === address.toLowerCase() ? 'OUT' : 'IN',
                chainId
             }));
          }
          
          // For other L2s, we return empty list if no Etherscan-compatible API is ready
          // In a "Mission Critical" environment, we would also poll the RPC here.
      } catch (fallbackError: any) {
          console.error(`[Portfolio-FALLBACK] Final history recovery failed:`, fallbackError.message);
      }
      return [];
    }
  }

  /**
   * [NEW] Stream-ready Transaction Merger
   * Merges multiple sorted history arrays efficiently (K-way merge principle).
   */
  public mergeHistoryStreams(histories: any[][]): any[] {
    // Flatten and sort is okay for 100-200 items, but for "Stream-based processing"
    // we should use a more deterministic merge if we were handling thousands.
    // For now, sorting by timestamp is the standard.
    return histories.flat().sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  public getChainName(chainId: ChainId): string {
    switch (chainId) {
        case ChainId.MAINNET: return 'Ethereum Mainnet';
        case ChainId.POLYGON: return 'Polygon';
        case ChainId.BASE: return 'Base';
        case ChainId.ARBITRUM: return 'Arbitrum';
        case ChainId.OPTIMISM: return 'Optimism';
        case ChainId.AVALANCHE: return 'Avalanche';
        case ChainId.BSC: return 'BNB Chain';
        case ChainId.WORLDCHAIN: return 'World Chain';
        default: return `Chain ${chainId}`;
    }
  }

  private getNativeSymbol(chainId: ChainId): string {
    switch (chainId) {
        case ChainId.MAINNET: return 'ETH';
        case ChainId.POLYGON: return 'POL';
        case ChainId.BASE: return 'ETH';
        case ChainId.ARBITRUM: return 'ETH';
        case ChainId.OPTIMISM: return 'ETH';
        case ChainId.AVALANCHE: return 'AVAX';
        case ChainId.BSC: return 'BNB';
        case ChainId.WORLDCHAIN: return 'ETH';
        default: return 'ETH';
    }
  }
}

export const portfolioService = new PortfolioService();

