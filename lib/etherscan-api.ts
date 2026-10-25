import { ethers } from 'ethers';


const getEtherscanApiKey = () => process.env.ETHERSCAN_API_KEY || '';
//  MIGRATED TO V2 (V1 DEPRECATED FEB 2026)
const ETHERSCAN_BASE = 'https://api.etherscan.io/v2/api';
const CHAINID = '1'; // Ethereum Mainnet

// Throttled Fetcher to prevent "NOTOK" rate limits
let lastFetchTime = 0;
async function throttledFetch(url: string, retryCount = 0): Promise<any> {
    const now = Date.now();
    const waitTime = Math.max(0, 250 - (now - lastFetchTime));
    if (waitTime > 0) await new Promise(r => setTimeout(r, waitTime));
    
    lastFetchTime = Date.now();
    try {
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.message === 'NOTOK' && retryCount < 3) {
            console.warn(`[Etherscan] Rate limited. Retrying (${retryCount + 1}/3)...`);
            await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
            return throttledFetch(url, retryCount + 1);
        }
        return data;
    } catch (e) {
        if (retryCount < 3) return throttledFetch(url, retryCount + 1);
        throw e;
    }
}


interface EtherscanBalance {
  balance: string; // ETH balance
}

interface EtherscanTokenBalance {
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  balance: string;
}

/**
 * Get ETH balance using Etherscan
 */
export async function getEtherscanBalance(address: string): Promise<EtherscanBalance | null> {
  try {
    const url = `${ETHERSCAN_BASE}?chainid=${CHAINID}&module=account&action=balance&address=${address}&tag=latest&apikey=${getEtherscanApiKey()}`;
    const data = await throttledFetch(url);
    
    if (data.status === '1' && data.result) {
      // Convert Wei to ETH
      const balanceInEth = ethers.formatEther(data.result);
      return { balance: balanceInEth };
    }
    
    console.warn('[Etherscan] Failed to fetch balance:', data.message);
    return null;
  } catch (error) {
    console.error('[Etherscan] Error fetching balance:', error);
    return null;
  }
}

/**
 * Get all ERC20 token balances for an address using Etherscan
 * This is the KEY function to replace Alchemy
 */
export async function getEtherscanTokenBalances(address: string): Promise<EtherscanTokenBalance[]> {
  try {
    const url = `${ETHERSCAN_BASE}?chainid=${CHAINID}&module=account&action=tokentx&address=${address}&startblock=0&endblock=999999999&sort=desc&apikey=${getEtherscanApiKey()}`;
    const data = await throttledFetch(url);
    
    if (data.status !== '1' || !Array.isArray(data.result)) {
      // Empty result is normal for new wallets — use debug, not warn, to avoid PM2 stderr routing.
      console.debug('[Etherscan] No token transactions found for this address.');
      return [];
    }

    // Get unique token contracts from transaction history (Limit to 50 for real-time performance)
    const tokenContracts = new Set<string>();
    data.result.slice(0, 300).forEach((tx: any) => {
      if (tx.contractAddress && tokenContracts.size < 50) {
        tokenContracts.add(tx.contractAddress.toLowerCase());
      }
    });

    console.log(`[Etherscan] Found ${tokenContracts.size} unique tokens for ${address}`);

    // Fetch current balance for each token (Throttled to avoid Rate Limits)
    const balances: (EtherscanTokenBalance | null)[] = [];
    const queue = Array.from(tokenContracts);
    const CHUNK_SIZE = 2; // Conservative limit for free API tier (5 calls/sec)

    for (let i = 0; i < queue.length; i += CHUNK_SIZE) {
        const chunk = queue.slice(i, i + CHUNK_SIZE);
        console.log(`[Etherscan] Processing chunk ${i / CHUNK_SIZE + 1}/${Math.ceil(queue.length / CHUNK_SIZE)}...`);
        
        const results = await Promise.all(chunk.map(async (contractAddress) => {
            try {
            const balanceUrl = `${ETHERSCAN_BASE}?chainid=${CHAINID}&module=account&action=tokenbalance&contractaddress=${contractAddress}&address=${address}&tag=latest&apikey=${getEtherscanApiKey()}`;
            const balanceRes = await fetch(balanceUrl);
            const balanceData = await balanceRes.json();

            if (balanceData.status === '1' && balanceData.result && balanceData.result !== '0') {
                // Get token info
                const infoUrl = `${ETHERSCAN_BASE}?chainid=${CHAINID}&module=token&action=tokeninfo&contractaddress=${contractAddress}&apikey=${getEtherscanApiKey()}`;
                const infoRes = await fetch(infoUrl);
                const infoData = await infoRes.json();

                const tokenInfo = infoData.status === '1' && infoData.result?.[0] ? infoData.result[0] : null;

                return {
                contractAddress,
                tokenName: tokenInfo?.tokenName || 'Unknown',
                tokenSymbol: tokenInfo?.symbol || 'UNKNOWN',
                tokenDecimal: tokenInfo?.divisor || '18',
                balance: balanceData.result,
                };
            }
            return null;
            } catch (err) {
            console.warn(`[Etherscan] Failed to fetch balance for ${contractAddress}:`, err);
            return null;
            }
        }));

        balances.push(...results);
        // Wait 300ms between chunks
        if (i + CHUNK_SIZE < queue.length) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    return balances.filter((b): b is EtherscanTokenBalance => b !== null && parseFloat(b.balance) > 0);
  } catch (error) {
    console.error('[Etherscan] Error fetching token balances:', error);
    return [];
  }
}

/**
 * Get unified transaction history (ETH + ERC20) using Etherscan
 * formats it to match Alchemy's AssetTransfersResult somewhat
 */
export async function getEtherscanHistory(address: string, page = 1, offset = 50) {
  try {
    const apiKey = process.env.ETHERSCAN_API_KEY || ''; // Fallback key
    
    // 1. Get Normal ETH Transactions
    const ethUrl = `${ETHERSCAN_BASE}?chainid=${CHAINID}&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=${page}&offset=${offset}&sort=desc&apikey=${apiKey}`;
    
    // 2. Get ERC20 Token Transactions
    const tokenUrl = `${ETHERSCAN_BASE}?chainid=${CHAINID}&module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&page=${page}&offset=${offset}&sort=desc&apikey=${apiKey}`;

    const [ethRes, tokenRes] = await Promise.all([
      throttledFetch(ethUrl),
      throttledFetch(tokenUrl)
    ]);

    const ethTxs = (ethRes.status === '1' && Array.isArray(ethRes.result)) ? ethRes.result : [];
    const tokenTxs = (tokenRes.status === '1' && Array.isArray(tokenRes.result)) ? tokenRes.result : [];

    console.log(`[Etherscan-History-DEBUG] ${address}: ETH=${ethTxs.length}, Tokens=${tokenTxs.length}`);
    if (ethRes.message === 'NOTOK') console.error(`[Etherscan-History-ERROR] Rate limited: ${ethRes.result}`);

    // Map ETH Txs
    const formattedEth = ethTxs.map((tx: any) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: parseFloat(ethers.formatEther(tx.value)),
        asset: 'ETH',
        category: 'external',
        blockNum: tx.blockNumber,
        metadata: { blockTimestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString() },
        rawContract: { address: null }
    }));

    // Map Token Txs
    const formattedTokens = tokenTxs.map((tx: any) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: parseFloat(ethers.formatUnits(tx.value, parseInt(tx.tokenDecimal || '18'))),
        asset: tx.tokenSymbol,
        category: 'erc20',
        blockNum: tx.blockNumber,
        metadata: { blockTimestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString() },
        rawContract: { address: tx.contractAddress }
    }));

    // Merge and Sort by Time Descending
    const combined = [...formattedEth, ...formattedTokens].sort((a, b) => {
        return new Date(b.metadata.blockTimestamp).getTime() - new Date(a.metadata.blockTimestamp).getTime();
    });

    return combined.slice(0, offset); // Limit to requested offset

  } catch (error) {
    console.error('[Etherscan] Error fetching unified history:', error);
    return [];
  }
}

/**
 * Get NFT balances using Etherscan (ERC721/ERC1155)
 * Discovers NFTs via transfer history
 */
export async function getEtherscanNFTs(address: string) {
  try {
    const url = `${ETHERSCAN_BASE}?chainid=${CHAINID}&module=account&action=tokennfttx&address=${address}&startblock=0&endblock=999999999&sort=desc&apikey=${getEtherscanApiKey()}`;
    const data = await throttledFetch(url);
    
    if (data.status !== '1' || !Array.isArray(data.result)) {
      return [];
    }

    // Get unique NFT contracts
    const nftContracts = new Set<string>();
    const nftMetadata: Record<string, { name: string, symbol: string }> = {};

    data.result.slice(0, 100).forEach((tx: any) => {
      if (tx.contractAddress) {
        const addr = tx.contractAddress.toLowerCase();
        nftContracts.add(addr);
        if (!nftMetadata[addr]) {
            nftMetadata[addr] = {
                name: tx.tokenName,
                symbol: tx.tokenSymbol
            };
        }
      }
    });

    // Check balances (Throttled: Chunk size 3)
    const holdings: any[] = [];
    const nftQueue = Array.from(nftContracts).slice(0, 20);
    const NFT_CHUNK_SIZE = 3;

    for (let i = 0; i < nftQueue.length; i += NFT_CHUNK_SIZE) {
        const chunk = nftQueue.slice(i, i + NFT_CHUNK_SIZE);
        const results = await Promise.all(chunk.map(async (contractAddress) => {
            try {
            // Check balance
            const balanceUrl = `${ETHERSCAN_BASE}?chainid=${CHAINID}&module=account&action=tokenbalance&contractaddress=${contractAddress}&address=${address}&tag=latest&apikey=${getEtherscanApiKey()}`;
            const balanceData = await throttledFetch(balanceUrl);

            if (balanceData.status === '1' && balanceData.result && parseInt(balanceData.result) > 0) {
                return {
                contractAddress,
                ...nftMetadata[contractAddress],
                balance: balanceData.result,
                type: 'ERC721', // Assumption, could be 1155
                };
            }
            return null;
            } catch (e) { return null; }
        }));
        holdings.push(...results);
        
        if (i + NFT_CHUNK_SIZE < nftQueue.length) {
            await new Promise(r => setTimeout(r, 200));
        }
    }

    return holdings.filter(h => h !== null);

  } catch (error) {
    console.error('[Etherscan] Error fetching NFTs:', error);
    return [];
  }
}

/**
 * Get complete portfolio using ONLY Etherscan API
 * This replaces Alchemy completely for Ethereum Mainnet
 */
export async function getEtherscanPortfolio(address: string) {
  console.log(`[Etherscan]  Fetching complete portfolio for ${address}`);
  
  try {
    const [ethBalance, tokenBalances, nfts] = await Promise.all([
      getEtherscanBalance(address),
      getEtherscanTokenBalances(address),
      getEtherscanNFTs(address),
    ]);

    console.log(`[Etherscan]  Portfolio fetched: ETH=${ethBalance?.balance || 0}, Tokens=${tokenBalances.length}, NFTs=${nfts.length}`);

    return {
      ethBalance: ethBalance?.balance || '0',
      tokens: tokenBalances,
      nfts,
      totalTokens: tokenBalances.length,
    };
  } catch (error) {
    console.error('[Etherscan]  Portfolio fetch failed:', error);
    return {
      ethBalance: '0',
      tokens: [],
      nfts: [],
      totalTokens: 0,
    };
  }
}

