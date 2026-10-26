import { useBalance, useReadContract, useChains, useChainId } from 'wagmi';
import { parseAbi, formatEther } from 'viem';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { matchNewsToMarket } from '@/lib/utils/news-matcher';
import { Asset, NewsItem, Position, Transaction } from '@/types/wallet';
import { useAuth } from '@/hooks/useAuth';
import { useWalletStore } from '@/lib/store/wallet-store';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import { useAztecNative } from '@/context/AztecNativeContext';

import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';
import { SUPPORTED_CHAINS } from '@/lib/wallet/chains';


export const useRealWalletData = (recentNews: NewsItem[] = [], overrideAddress?: string) => {
    const { address: web3Address, isConnected: isWeb3Connected } = useSystemAccount();
    const { isAuthenticated } = useAuth();
    
    // AUDIT FIX (Medium #6): Consume the authoritative QDs balance from AztecNativeContext
    // instead of deriving a different address locally (the old derivation used simple
    // zero-padding which produced a completely different address than SHA-256 derivation).
    const { balance: aztecQdBalance, aztecAddress: authorativeAztecAddress } = useAztecNative();
    
    // Unified connection state
    const isConnected = isWeb3Connected || isAuthenticated;

    
    // Fetch managed wallet if not connected via Web3
    const { data: managedWallet } = useQuery({
        queryKey: ['managed-wallet', isAuthenticated, isWeb3Connected],
        queryFn: async () => {
            if (!isAuthenticated || isWeb3Connected) return null;
            try {
                const { data } = await axios.get('/api/user/wallet', { timeout: 15000 });
                return data;
            } catch (error) {
                return null;
            }
        },
        enabled: isAuthenticated && !isWeb3Connected
    });

    const { address: systemAddress } = useWalletStore();
    
    // [PERFECTION] Immediate Handshake Resolution (High-Efficiency Cookie Reader)
    let handshakeAddressFromCookie = null;
    try {
        handshakeAddressFromCookie = typeof document !== 'undefined' 
            ? document.cookie.split('; ').find(r => r.trim().startsWith('system_handshake=0x'))?.split('=')[1]?.toLowerCase() 
            : null;
    } catch(e) {}

    // Priority Hierarchy: 1. Manual override, 2. Web3 Provider, 3. Immediate Handshake, 4. Store Persistence
    const effectiveAddress = overrideAddress || web3Address || handshakeAddressFromCookie || systemAddress || managedWallet?.address;

    // [DEBUG] Monitor address resolution changes
    // console.log('[useRealWalletData] Address Resolution:', { effectiveAddress, isConnected, isAuthenticated, isWeb3Connected, handshakeAddressFromCookie });

    const currentChainId = useChainId();

    // Derive target chain ID from activeNetwork store selection, fallback to wagmi's currentChainId
    const { activeNetwork } = useWalletStore();
    const targetChainId = Object.values(SUPPORTED_CHAINS).find(c => c.name.toLowerCase() === activeNetwork?.toLowerCase() || Object.keys(SUPPORTED_CHAINS).find(k => k === activeNetwork && SUPPORTED_CHAINS[k].id === c.id))?.id || currentChainId;

    // 1. On-Chain Native Balance (Wagmi v2  no 'token' param, that's deprecated)
    // ERC-20 USDC balance is already fetched by the portfolio assets API below.
    const isValidAddress = Boolean(effectiveAddress && effectiveAddress.startsWith('0x') && effectiveAddress.length === 42 && !effectiveAddress.includes('Virtual'));

    const { data: balanceData, isLoading: isBalanceLoading } = useBalance({
        address: isValidAddress ? (effectiveAddress as `0x${string}`) : undefined,
        chainId: targetChainId, // Dynamic based on active network selection
        query: {
            enabled: isValidAddress,
            refetchInterval: 10000,
        }
    });

    // 2. Posiciones Off-Chain (Vía nuestro Proxy)
    
    const { data: positionsRaw, isLoading: isPositionsLoading } = useQuery({
        queryKey: ['positions', effectiveAddress],
        queryFn: async () => {
             // Si llegamos aquí sin check de 'enabled', evitamos la llamada igual
            if (!isValidAddress) return []; 
            try {
                const { data } = await axios.get(`/api/wallet/positions?userAddress=${effectiveAddress}`, { timeout: 15000 });
                return data;
            } catch (error) {
                console.warn("[Network] 4G/5G timeout on positions fetch", error);
                return [];
            }
        },
        enabled: !!isValidAddress,
        refetchInterval: 15000, // Sync prediction positions every 15s
    });

    // 3. Historial (History) - Enriched On-Chain History
    const { data: historyRaw, isLoading: isHistoryLoading } = useQuery({
        queryKey: ['enriched-history', effectiveAddress],
        queryFn: async () => {
             if (!isValidAddress) return [];
             try {
                const { data } = await axios.get(`/api/wallet/history/enriched?userAddress=${effectiveAddress}`, { timeout: 20000 });
                return data.activities || [];
             } catch (e) {
                console.warn("[Network] 4G/5G timeout on enriched history fetch:", e);
                return [];
             }
        },
        enabled: !!isValidAddress,
        refetchInterval: 30000,
    });


    // 4. Elite Multi-Chain Assets (Improved!)
    const { data: assetsData, isLoading: isAssetsLoading } = useQuery({
        queryKey: ['portfolio-assets', effectiveAddress],
        queryFn: async () => {
            if (!effectiveAddress) return null;
            try {
                // Fetch from Elite grade portfolio API
                const { data } = await axios.get(`/api/wallet/portfolio?address=${effectiveAddress}`, { timeout: 20000 });
                return data;
            } catch (error) {
                console.warn("[Network] 4G/5G timeout on portfolio assets fetch", error);
                return null;
            }
        },
        enabled: !!effectiveAddress,
            refetchInterval: 30_000, // Prevent RPC hammering at scale (was 5s)
    });

    // 5. Procesamiento y Enriquecimiento de Datos
    const positions: Position[] = (Array.isArray(positionsRaw) ? positionsRaw : []).map((pos: any) => {
        // Fix for crash reported by user: outcomePrices might be undefined
        const prices = pos.market?.outcomePrices;
        const currentPrice = Array.isArray(prices) && prices[pos.outcomeIndex] ? parseFloat(prices[pos.outcomeIndex]) : 0;
        const avgPrice = parseFloat(pos.avgPrice) || currentPrice || 0;
        const size = parseFloat(pos.size) || 0;

        // Cálculo PnL
        const value = size * currentPrice;
        const cost = size * avgPrice;
        const pnl = isNaN(value - cost) ? 0 : (value - cost);
        const pnlPercent = cost > 0 && !isNaN(pnl) ? (pnl / cost) * 100 : 0;

        // News Matching
        const newsContext = matchNewsToMarket(pos.market?.question || "", recentNews);

        return {
            id: pos.assetId,
            marketTitle: pos.market?.question || "Unknown Market",
            outcome: pos.outcome,
            shares: size,
            value,
            pnl,
            pnlPercent,
            newsContext // String title or undefined
        };
    }) || [];

    const transactions: Transaction[] = (Array.isArray(historyRaw) ? historyRaw : []).map((tx: any) => ({
        id: tx.id || tx.hash,
        type: tx.type === 'SWAP' ? 'SWAP' : tx.type === 'BRIDGE' ? 'BRIDGE' : (tx.type === 'SEND' ? 'SELL' : tx.type === 'RECEIVE' ? 'DEPOSIT' : 'TRANSFER'),
        amount: tx.value ? safeToFixed(parseFloat(tx.value), 4) : '0',
        asset: tx.asset || 'ETH',
        date: tx.timestamp ? new Date(tx.timestamp).toLocaleString() : 'Recently',
        status: 'COMPLETED',
        hash: tx.hash,
        chainId: tx.chainId,
        from: tx.from,
        to: tx.to,
        platform: tx.platform
    })) || [];

    // Dynamic resolution of network names from Wagmi context instead of hardcoded mappings
    const activeChains = useChains();
    const getNetworkName = (id: number) => activeChains.find(c => c.id === id)?.name || 'Unknown';

    const assets: Asset[] = (Array.isArray(assetsData?.tokens) ? assetsData.tokens : []).map((t: any) => ({
        symbol: t.symbol,
        name: t.name,
        balance: t.balance,
        balanceNumeric: typeof t.balanceNumeric === 'number' ? t.balanceNumeric : parseFloat(t.balance || t.balanceNumeric || '0'),
        balanceFormatted: t.balanceFormatted || (typeof t.balanceNumeric === 'number' ? t.balanceNumeric.toFixed(6) : "0"),
        price: t.price || t.priceUSD || 0,
        priceUSD: t.price || t.priceUSD || 0,
        usdPrice: t.price || t.priceUSD || 0,   //  alias used by LegendaryTransactionModal
        value: t.valueUsd || t.valueUSD || 0,
        valueUSD: t.valueUsd || t.valueUSD || 0,
        address: t.address || 'native',
        decimals: t.decimals || 18,
        logoURI: t.logo || t.logoURI,
        chainId: t.chainId,
        network: getNetworkName(t.chainId),
        change24h: t.change24h || 0
    }));

    // Inject Native Balance if not returned by the API (using Wagmi data)
    const nativeSymbol = balanceData?.symbol || 'ETH';
    const nativeBalanceNum = parseFloat(balanceData?.formatted || '0') || 0;
    const hasNativeInAssets = assets.some(a => a.symbol === nativeSymbol && (a.address === 'native' || a.address === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'));
    
    if (!hasNativeInAssets && nativeBalanceNum > 0) {
        assets.unshift({
            symbol: nativeSymbol,
            name: activeChains.find(c => c.id === currentChainId)?.nativeCurrency?.name || nativeSymbol,
            balance: nativeBalanceNum.toString(),
            balanceNumeric: nativeBalanceNum,
            balanceFormatted: nativeBalanceNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }),
            price: 0, // Fallback if API fails
            priceUSD: 0,
            usdPrice: 0,
            value: 0,
            valueUSD: 0,
            address: 'native',
            decimals: 18,
            logoURI: '',
            chainId: currentChainId,
            network: getNetworkName(currentChainId),
            change24h: 0
        });
    }

    // AUDIT FIX (Medium #6): Use the authoritative QDs balance from AztecNativeContext.
    // The old implementation derived its own Aztec address (simple 0x + zero-padded EVM address)
    // which was completely different from the SHA-256 derived address in AztecNativeContext.
    // This caused the TOKENS tab to show 0 QDs while the AZTEC tab showed the real balance.
    // Now both tabs read from the same source: the AztecNativeContext polling loop.
    const qdBalanceNum = aztecQdBalance || 0;

    if (isConnected) {
        assets.unshift({
            symbol: "QDs",
            name: "Aztec QDs (ZK)",
            balance: qdBalanceNum.toString(),
            balanceNumeric: qdBalanceNum,
            balanceFormatted: qdBalanceNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            price: 0,
            priceUSD: 0,
            usdPrice: 0,
            value: 0,
            valueUSD: 0,
            address: process.env.NEXT_PUBLIC_AZTEC_QDS_ADDRESS || '0x',
            decimals: 18,
            logoURI: "",
            chainId: currentChainId, // Match current chain to always display
            network: "Aztec ZK",
            change24h: 0
        });
    }


    // Totals
    const portfolioValue = positions.reduce((acc: number, curr: any) => acc + (isNaN(curr.value) ? 0 : curr.value), 0);
    const multiChainBalance = assetsData?.totalValueUsd || 0; // Exclude QDs from fiat equivalent
    const usdcBalance = parseFloat(balanceData?.formatted || '0') || 0;
    
    // For "Rainbow" feel, we use the unified balance from the portfolio API
    // which already includes tokens, perps, and predictions.
    const totalNetWorth = multiChainBalance;

    return {
        address: effectiveAddress,
        isConnected,
        usdcBalance: safeToFixed(usdcBalance, 2),
        portfolioValue: safeToFixed(portfolioValue, 2),
        totalBalance: safeToFixed(totalNetWorth, 2),
        positions,
        transactions,
        stats: historyRaw?.stats || null, // New Stats object
        assets,
        perps: Array.isArray(assetsData?.perps) ? assetsData.perps : [],
        predictions: Array.isArray(assetsData?.predictions) ? assetsData.predictions : [],
        claimables: Array.isArray(assetsData?.claimables) ? assetsData.claimables : [],
        isAssetsLoading,
        isHistoryLoading,
        isLoading: isBalanceLoading || isPositionsLoading || isHistoryLoading || isAssetsLoading,
        change24hUSD: assetsData?.change24hUSD || 0,
        change24hPercent: assetsData?.change24hPercent || 0,
        legendaryScore: assetsData?.legendaryScore || 0,
        strategicInsight: assetsData?.strategicInsight || '',
        backendAccounts: [], // Handled by separate sync if needed
        refetch: () => {} // Added to fulfill interface requirement
    };
};

