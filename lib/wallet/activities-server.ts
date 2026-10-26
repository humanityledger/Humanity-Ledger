/**
 * Enriched History Service
 * Fetch real on-chain transactions across multiple chains using Alchemy
 */

import { matchNewsToMarket } from '@/lib/utils/news-matcher';

const DATA_API = 'https://data-api.polymarket.com';

const KNOWN_ROUTERS: Record<string, string> = {
  '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D': 'Uniswap V2',
  '0xE592427A0AEce92De3Edee1F18E0157C05861564': 'Uniswap V3',
  '0x3fC91A3afd003363435A4017ef20a2dCf95BB222': 'Uniswap Universal',
  '0x1111111254EEB25477B68fb85Ed929f73A960582': '1inch',
  '0x881D40237659C251811CEC9c364ef91dC08D300C': 'Metamask Swap',
  '0xa5E0829CaCEd8fFDD03902106140928170dDC299': 'QuickSwap',
  '0xc45e8615D0D727F475e0764684062ba879cc88e5': 'Aerodrome',
  '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45': 'Uniswap V3 (Poly/Base)',
};

const KNOWN_BRIDGES: Record<string, string> = {
  '0xb8901acB165ed027E32754E0FFe830802919c463': 'Hop Protocol',
  '0x5c7BC2d53442343564997E308DA5A3D39626C88A': 'Across',
  '0x8731d54E9D025E285642698A9158D0294118124A': 'Stargate',
};

interface AlchemyTransfer {
  uniqueId: string;
  hash: string;
  from: string;
  to: string;
  value: number;
  asset: string;
  category: string;
  metadata: {
    blockTimestamp: string;
  };
}

async function safeAlchemyFetch(url: string, body: any) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000)
    });
    
    const text = await response.text();
    
    // Alchemy returns "Monthly cap reached" or "402 Payment Required" as text when plan is exhausted
    if (!text.startsWith('{') && !text.startsWith('[')) {
      console.log(`[Alchemy] Non-JSON response (possibly quota reached): ${text.slice(0, 100)}`);
      return { result: { transfers: [] } };
    }
    
    return JSON.parse(text);
  } catch (e) {
    console.error('[Alchemy Fetch Error]', e);
    return { result: { transfers: [] } };
  }
}

async function fetchAlchemyTransfers(address: string, chainId: number): Promise<AlchemyTransfer[]> {
  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  const networkMap: Record<number, string> = {
    1: 'eth-mainnet',
    10: 'opt-mainnet',
    137: 'polygon-mainnet',
    8453: 'base-mainnet',
    42161: 'arb-mainnet'
  };

  const network = networkMap[chainId];
  if (!network) return [];

  const url = `https://${network}.g.alchemy.com/v2/${apiKey}`;

  const fetchBatch = async (dir: 'fromAddress' | 'toAddress') => {
    const data = await safeAlchemyFetch(url, {
      jsonrpc: '2.0',
      id: 1,
      method: 'alchemy_getAssetTransfers',
      params: [{
        fromBlock: "0x0",
        toBlock: "latest",
        [dir]: address,
        category: ["external", "internal", "erc20"],
        withMetadata: true,
        excludeZeroValue: true,
        maxCount: "0x64"
      }]
    });
    return data.result?.transfers || [];
  };

  const [outgoing, incoming] = await Promise.all([
    fetchBatch('fromAddress'),
    fetchBatch('toAddress')
  ]);

  return [...outgoing, ...incoming];
}

export async function getEnrichedHistory(address: string) {
  const chains = [1, 10, 137, 8453, 42161]; 
  
  const allResults = await Promise.all(chains.map(async id => {
      const transfers = await fetchAlchemyTransfers(address, id);
      return transfers.map(t => ({ ...t, chainId: id }));
  }));
  
  const flattened = allResults.flat();
  
  // Group by Hash to detect Swaps and Multi-Asset transactions
  const groupedByHash: Record<string, any[]> = {};
  flattened.forEach(t => {
      if (!groupedByHash[t.hash]) groupedByHash[t.hash] = [];
      groupedByHash[t.hash].push(t);
  });

  const processedActivities = Object.entries(groupedByHash).map(([hash, transfers]) => {
      const outgoing = transfers.filter(t => t.from.toLowerCase() === address.toLowerCase());
      const incoming = transfers.filter(t => t.to.toLowerCase() === address.toLowerCase());
      
      const first = transfers[0];
      const timestamp = first.metadata.blockTimestamp;
      const chainId = first.chainId;

      // Determine Type
      let type: 'SEND' | 'RECEIVE' | 'SWAP' | 'BRIDGE' = 'SEND';
      let platform = undefined;
      let displayValue = 0;
      let displayAsset = 'ETH';

      const isSwap = transfers.some(t => KNOWN_ROUTERS[t.to.toLowerCase()] || KNOWN_ROUTERS[t.from.toLowerCase()]);
      const isBridge = transfers.some(t => KNOWN_BRIDGES[t.to.toLowerCase()] || KNOWN_BRIDGES[t.from.toLowerCase()]);

      if (isSwap) {
          type = 'SWAP';
          platform = transfers.find(t => KNOWN_ROUTERS[t.to.toLowerCase()])?.to || transfers.find(t => KNOWN_ROUTERS[t.from.toLowerCase()])?.from;
          platform = KNOWN_ROUTERS[platform?.toLowerCase() || ''];
          // For swaps, display the incoming asset as the "result"
          displayValue = incoming[0]?.value || outgoing[0]?.value || 0;
          displayAsset = incoming[0]?.asset || outgoing[0]?.asset || 'ETH';
      } else if (isBridge) {
          type = 'BRIDGE';
          platform = transfers.find(t => KNOWN_BRIDGES[t.to.toLowerCase()])?.to || transfers.find(t => KNOWN_BRIDGES[t.from.toLowerCase()])?.from;
          platform = KNOWN_BRIDGES[platform?.toLowerCase() || ''];
          displayValue = outgoing[0]?.value || incoming[0]?.value || 0;
          displayAsset = outgoing[0]?.asset || incoming[0]?.asset || 'ETH';
      } else if (outgoing.length > 0 && incoming.length === 0) {
          type = 'SEND';
          displayValue = outgoing.reduce((acc, curr) => acc + curr.value, 0);
          displayAsset = outgoing[0]?.asset || 'ETH';
      } else if (incoming.length > 0 && outgoing.length === 0) {
          type = 'RECEIVE';
          displayValue = incoming.reduce((acc, curr) => acc + curr.value, 0);
          displayAsset = incoming[0]?.asset || 'ETH';
      } else {
          // Fallback
          type = outgoing.length > 0 ? 'SEND' : 'RECEIVE';
          displayValue = transfers[0]?.value || 0;
          displayAsset = transfers[0]?.asset || 'ETH';
      }

      return {
          id: hash,
          hash,
          type,
          platform,
          value: displayValue,
          asset: displayAsset,
          timestamp,
          chainId,
          from: outgoing[0]?.from || first.from,
          to: incoming[0]?.to || first.to,
          details: transfers // Include full trace for advanced debugging
      };
  });

  // Sort by time
  processedActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Calculate Statistics
  const stats = {
      totalVolumeUSD: processedActivities.reduce((acc, curr) => acc + (curr.type === 'SWAP' ? curr.value : 0), 0), // Simplifying for swap volume
      sentCount: processedActivities.filter(a => a.type === 'SEND').length,
      receivedCount: processedActivities.filter(a => a.type === 'RECEIVE').length,
      swapCount: processedActivities.filter(a => a.type === 'SWAP').length,
      bridgeCount: processedActivities.filter(a => a.type === 'BRIDGE').length,
      lastActivity: processedActivities[0]?.timestamp
  };

  return {
      activities: processedActivities,
      stats
  };
}

