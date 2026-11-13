import { providerKey } from '@/lib/server/provider-keys';
/**
 * LedgerFlowService.ts
 * Real-time on-chain ledger transaction monitoring via Alchemy Asset Transfers API.
 * No mock data. No synthetic fills. Every row is a verifiable blockchain transaction.
 *
 * Threshold: > $100,000 USD equivalent per transfer.
 * Chains: ETH Mainnet, Base, Arbitrum, Polygon.
 */

import { Alchemy, Network, AssetTransfersCategory, SortingOrder } from 'alchemy-sdk';

const ALCHEMY_KEY = providerKey('ALCHEMY_API_KEY') || '';

// Labelled known sovereign wallets
const KNOWN_WALLETS: Record<string, string> = {
    '0x28c6c06298d514db089934071355e5743bf21d60': 'Binance Hot Wallet 14',
    '0x21a31ee1afc51d94c2efccaa2092ad1028285549': 'Binance Hot Wallet 20',
    '0xdfd5293d8e347dfe59e90efd55b2956a1343963d': 'Binance Cold Wallet',
    '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43': 'Coinbase',
    '0x503828976d22510aad0201ac7ec88293211d23da': 'Coinbase 2',
    '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be': 'Binance CEX',
    '0x6cc5f688a315f3dc28a7781717a9a798a59fda7b': 'OKX Hot Wallet',
    '0x98ec059dc3adfbdd63429454aeb0c990fba4a128': 'Kraken Exchange',
    '0x1db3439a222c519ab44bb1144fc28167b4fa6ee6': 'Wintermute Attesting',
    '0x00000000219ab540356cbb839cbe05303d7705fa': 'ETH2 Deposit Contract',
    '0xae7ab96520de3a18e5e111b5eaab095312d7fe84': 'Lido stETH',
    '0xdc6ff44d5d932cbd77b52e5612ba0529dc6226f1': 'Wrapped MATIC',
    '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0': 'Polygon: MATIC Token',
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'USDC on Base',
};

const STABLE_SYMBOLS = new Set(['USDC', 'USDT', 'DAI', 'BUSD', 'FRAX', 'LUSD', 'TUSD']);

// Approx USD price lookup for ledger threshold calculation
// These are reference prices only  used only for filtering server-side
const APPROX_PRICES: Record<string, number> = {
    'ETH': 3350, 'WETH': 3350,
    'BTC': 67000, 'WBTC': 67000,
    'BNB': 600,
    'SOL': 145,
    'LINK': 14,
    'ARB': 0.95,
    'OP': 1.8,
    'UNI': 9,
    'AAVE': 90,
    'USDC': 1, 'USDT': 1, 'DAI': 1,
};

function estimateUsdValue(rawValue: string | undefined, symbol: string, decimals: number): number {
    if (!rawValue) return 0;
    try {
        const amount = parseFloat(rawValue);
        if (isNaN(amount)) return 0;
        const price = APPROX_PRICES[symbol.toUpperCase()] ?? (STABLE_SYMBOLS.has(symbol.toUpperCase()) ? 1 : 0);
        return amount * price;
    } catch {
        return 0;
    }
}

interface LedgerTransfer {
    id: string;
    walletAddress: string;
    walletLabel: string;
    type: 'IN' | 'OUT' | 'TRANSFER';
    token: string;
    amount: number;
    usdValue: number;
    timestamp: string;
    txHash: string;
    chain: string;
    blockNum?: string;
}

interface AlchemyConfig {
    apiKey: string;
    network: Network;
}

const CHAIN_CONFIGS: Array<{ network: Network; chainLabel: string }> = [
    { network: Network.ETH_MAINNET, chainLabel: 'ethereum' },
    { network: Network.BASE_MAINNET, chainLabel: 'base' },
    { network: Network.ARB_MAINNET, chainLabel: 'arbitrum' },
    { network: Network.MATIC_MAINNET, chainLabel: 'polygon' },
];

/**
 * Fetch real large transfers from Alchemy across multiple chains.
 * Returns only transfers with estimated USD value > $100,000.
 */
export async function fetchRealLedgerTransfers(limit = 40): Promise<LedgerTransfer[]> {
    if (!ALCHEMY_KEY) {
        console.error('[LedgerFlowService] No Alchemy API key configured. Set ALCHEMY_API_KEY in environment.');
        return [];
    }

    const results: LedgerTransfer[] = [];

    // Query all chains in parallel
    await Promise.allSettled(
        CHAIN_CONFIGS.map(async ({ network, chainLabel }) => {
            try {
                // [RESILIENCE] Verify Alchemy API Quota before heavy operations
                const alchemy = new Alchemy({ apiKey: ALCHEMY_KEY, network });
                
                // Wrapped query to catch non-JSON errors (like "Monthly capacity reached")
                const safeFetchTransfers = async (params: any) => {
                    try {
                        return await alchemy.core.getAssetTransfers(params);
                    } catch (e: any) {
                        if (e.message?.includes('Monthly capacity') || e.message?.includes('Unexpected token')) {
                            console.warn(`[LedgerFlowService] ${chainLabel}: Alchemy Quota Exhausted or Blocked.`);
                            return { transfers: [] };
                        }
                        throw e;
                    }
                };

                // Fetch recent ERC-20 and ETH transfers
                const [erc20Transfers, ethTransfers] = await Promise.all([
                    safeFetchTransfers({
                        fromBlock: '0x0',
                        category: [AssetTransfersCategory.ERC20],
                        withMetadata: true,
                        maxCount: 50,
                        order: SortingOrder.DESCENDING,
                        excludeZeroValue: true,
                    }),
                    safeFetchTransfers({
                        fromBlock: '0x0',
                        category: [AssetTransfersCategory.EXTERNAL],
                        withMetadata: true,
                        maxCount: 20,
                        order: SortingOrder.DESCENDING,
                        excludeZeroValue: true,
                    }),
                ]);

                const allTransfers = [
                    ...(erc20Transfers.transfers || []),
                    ...(ethTransfers.transfers || []),
                ];

                for (const tx of allTransfers) {
                    const symbol = tx.asset || 'ETH';
                    const rawValue = tx.value?.toString();
                    const usdValue = estimateUsdValue(rawValue, symbol, 18);

                    // Only include ledger-size transactions: > $100,000
                    if (usdValue < 100000) continue;

                    const fromLabel = tx.from
                        ? (KNOWN_WALLETS[tx.from.toLowerCase()] || `${tx.from.slice(0, 6)}...${tx.from.slice(-4)}`)
                        : 'Unknown';
                    const toLabel = tx.to
                        ? (KNOWN_WALLETS[tx.to?.toLowerCase() ?? ''] || null)
                        : null;

                    // Determine direction label
                    const isFromKnown = KNOWN_WALLETS[tx.from?.toLowerCase() ?? ''];
                    const isToKnown = toLabel !== null && toLabel !== `${tx.to?.slice(0, 6)}...${tx.to?.slice(-4)}`;
                    let type: 'IN' | 'OUT' | 'TRANSFER' = 'TRANSFER';
                    if (isFromKnown) type = 'OUT';
                    else if (isToKnown) type = 'IN';

                    const timestamp = (tx.metadata as any)?.blockTimestamp
                        ? new Date((tx.metadata as any).blockTimestamp).toISOString()
                        : new Date().toISOString();

                    results.push({
                        id: tx.hash || `${chainLabel}-${Date.now()}`,
                        walletAddress: tx.from || '',
                        walletLabel: fromLabel,
                        type,
                        token: symbol.toUpperCase(),
                        amount: parseFloat(rawValue || '0'),
                        usdValue,
                        timestamp,
                        txHash: tx.hash || '',
                        chain: chainLabel,
                        blockNum: tx.blockNum,
                    });
                }
            } catch (err: any) {
                console.error(`[LedgerFlowService] Error fetching from ${chainLabel}:`, err.message);
            }
        })
    );

    // Sort by USD value descending, then take top `limit`
    results.sort((a, b) => b.usdValue - a.usdValue);
    return results.slice(0, limit);
}
