"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, TrendingUp, TrendingDown, Clock, Users, Coins, FileCode, 
    Image, Layers, PiggyBank, AlertTriangle, Activity, BarChart3, 
    ArrowUpDown, Wallet2, Globe, Sparkles, Zap, DollarSign, ShieldCheck
} from 'lucide-react';
import DeFiPositionsPanel from './DeFiPositionsPanel';
import ProfitabilityTracker from './ProfitabilityTracker';
import useSWR from 'swr';
import { formatDistanceToNow } from 'date-fns';
import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';
interface WalletAnalyticsPanelProps {
    address: string;
    label: string;
    analytics?: WalletAnalytics;
    onClose: () => void;
}

interface WalletAnalytics {
    totalTransactions: number;
    activityScore: number;
    riskScore: number;
    blockchainRank: number | null;
    transactionHeatmap: HourlyActivity[];
    topCounterparties: Counterparty[];
    tokenFlowAnalysis: TokenFlow[];
    historicalBalance: BalancePoint[];
    smartContractInteractions: ContractInteraction[];
    nftPortfolio: NFTHolding[];
    stakingPositions: StakingPosition[];
    liquidityPools: LPPosition[];
    pnl24h: number;
    change24h: number;
    networksActive: string[];
    ledgerEvidence?: string[];
    influenceScore?: number;
    lastUpdated: Date;
    error?: string;
    errorMessage?: string;
    isPartial?: boolean;
}

interface HourlyActivity { hour: number; txCount: number; volume: number; }
interface Counterparty { address: string; txCount: number; totalVolume: number; label?: string; }
interface TokenFlow { token: string; inflow: number; outflow: number; netFlow: number; }
interface BalancePoint { date: Date; balance: number; }
interface ContractInteraction { contract: string; protocol?: string; firstSeen: Date; lastSeen: Date; txCount: number; }
interface NFTHolding { contract: string; tokenId: string; name?: string; imageUrl?: string; floorPrice?: number; }
interface StakingPosition { 
    protocol: string; 
    token: string; 
    amount: number; 
    valueUsd: number; 
    apr?: number; 
    onChain?: boolean; 
    details?: { healthFactor?: number; [key: string]: any }; 
}
interface LPPosition { 
    protocol: string; 
    pair: string; 
    liquidity: number; 
    valueUsd: number; 
    onChain?: boolean; 
    details?: { positionCount?: number; [key: string]: any }; 
}
interface PnLBreakdown { token: string; realized: number; unrealized: number; total: number; }
interface LedgerMovement { timestamp: Date; type: 'IN' | 'OUT'; token: string; amount: number; valueUsd: number; txHash: string; chainId?: number; }

type AnalyticsTab = 'overview' | 'defi' | 'pnl' | 'heatmap' | 'counterparties' | 'flows' | 'contracts' | 'nfts' | 'staking' | 'lps' | 'ledger-moves';

export default function WalletAnalyticsPanel({ address, label, analytics: initialData, onClose }: WalletAnalyticsPanelProps) {
    const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');

    const { data: fetchedAnalytics, error, isLoading } = useSWR(
        !initialData ? `/api/premium/wallet-analytics?address=${address}` : null,
        async (url) => {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to load analytics');
            const data = await res.json();
            // If the API returned a structured error inside 200 (common in this codebase)
            if (data.error && data.isPartial) {
                console.warn('[Analytics] Received partial data:', data.errorMessage);
            }
            return data;
        },
        {
            revalidateOnFocus: false,
            dedupingInterval: 60000, 
        }
    );

    // Fetch DeFi positions
    const { data: defiData, isLoading: defiLoading } = useSWR(
        `/api/premium/defi-positions?address=${address}`,
        async (url) => {
            const res = await fetch(url);
            if (!res.ok) return null;
            return res.json();
        },
        { revalidateOnFocus: false, dedupingInterval: 120000 }
    );

    // Fetch PnL data
    const { data: pnlData, isLoading: pnlLoading } = useSWR(
        `/api/premium/wallet-profitability?address=${address}`,
        async (url) => {
            const res = await fetch(url);
            if (!res.ok) return null;
            return res.json();
        },
        { revalidateOnFocus: false, dedupingInterval: 120000 }
    );

    // Fetch Net Worth
    const { data: netWorthData } = useSWR(
        `/api/premium/wallet-networth?address=${address}`,
        async (url) => {
            const res = await fetch(url);
            if (!res.ok) return null;
            return res.json();
        },
        { revalidateOnFocus: false, dedupingInterval: 120000 }
    );

    const analytics = initialData || fetchedAnalytics;
    const loading = isLoading && !analytics;

    //  NEW: Handle specific diagnostic errors (like ALCHEMY_AUTH_FAILED or API_LIMIT_REACHED)
    const isPartial = analytics?.isPartial || analytics?.error;
    if (analytics?.error === 'ALCHEMY_AUTH_FAILED' || (error && !analytics)) {
        const errorType = analytics?.error || 'FETCH_FAILED';
        const errorMessage = analytics?.errorMessage || error?.message || 'Unable to synchronize with the blockchain nodes.';
        const isAuthError = errorType === 'ALCHEMY_AUTH_FAILED';
        const isThrottled = errorType === 'PRICE_THROTTLED';

        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-black/40 border border-indigo-500/20 w-full max-w-xl rounded-3xl p-8 shadow-2xl relative overflow-hidden"
                >
                    {/* Ambient Error Glow */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 blur-[60px] pointer-events-none" />
                    
                    <div className="text-center py-8 relative z-10">
                        <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-indigo-500/20">
                            <AlertTriangle size={32} className="text-indigo-500" />
                        </div>
                        
                        <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">
                            {isAuthError ? 'Configuration Required' : isThrottled ? 'Feed Throttled' : 'Analysis Failed'}
                        </h2>
                        <p className="text-gray-400 mb-8 font-mono text-sm leading-relaxed px-4">
                            {errorMessage}
                        </p>

                        {isAuthError && (
                            <div className="bg-blue-600/10 border border-blue-500/30 rounded-2xl p-5 mb-8 text-left">
                                <h4 className="text-blue-400 font-bold text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Sparkles size={14} />
                                    Action Required
                                </h4>
                                <p className="text-xs text-blue-200/70 leading-relaxed font-medium">
                                    The **Alchemy API Key** is missing or invalid. Please update your environment variables with a valid key from the Alchemy Dashboard to enable live synchronization.
                                </p>
                            </div>
                        )}

                        {isThrottled && (
                            <div className="bg-amber-600/10 border border-amber-500/30 rounded-2xl p-5 mb-8 text-left">
                                <h4 className="text-amber-400 font-bold text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Clock size={14} />
                                    Limit Reached
                                </h4>
                                <p className="text-xs text-amber-200/70 leading-relaxed font-medium">
                                    The **CoinGecko price feed** is currently limited due to a high volume of requests. Balances were found, but live valuation is temporarily blocked.
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3">
                                <button 
                                onClick={onClose} 
                                className="flex-1 px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-gray-300 transition-all font-bold text-sm"
                            >
                                Dismiss
                            </button>
                            {isAuthError && (
                                <a 
                                    href="https://terminal.alchemy.com/" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex-1 px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white transition-all font-bold text-sm shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2"
                                >
                                    Get API Key
                                </a>
                            )}
                            {isThrottled && (
                                <a 
                                    href="https://www.coingecko.com/en/api/pricing" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex-1 px-8 py-4 bg-amber-600 hover:bg-amber-500 rounded-2xl text-white transition-all font-bold text-sm shadow-lg shadow-amber-900/40 flex items-center justify-center gap-2"
                                >
                                    Feed Status
                                </a>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }} 
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-black/40 border border-white/10 w-full max-w-2xl rounded-3xl p-12 shadow-[0_0_100px_rgba(59,130,246,0.2)] text-center relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-purple-500/10 to-transparent pointer-events-none" />
                    <Sparkles size={48} className="mx-auto text-blue-400 mb-6 animate-pulse" />
                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-2">
                        Fetching data...
                    </h2>
                    <p className="text-blue-200/60 font-mono text-sm tracking-widest uppercase">
                        Scanning Multichain History...
                    </p>
                </motion.div>
            </div>
        );
    }

    const tabs: { id: AnalyticsTab; label: string; icon: React.ReactNode; count?: number }[] = [
        { id: 'overview', label: 'Overview', icon: <BarChart3 size={16} /> },
        { id: 'defi', label: ' DeFi', icon: <Layers size={16} />, count: defiData?.positions?.length || 0 },
        { id: 'pnl', label: ' P&L', icon: <DollarSign size={16} /> },
        { id: 'heatmap', label: 'Heatmap', icon: <Clock size={16} /> },
        { id: 'counterparties', label: 'Top Wallets', icon: <Users size={16} />, count: (analytics as any)?.topCounterparties?.length || 0 },
        { id: 'flows', label: 'Flows', icon: <ArrowUpDown size={16} /> },
        { id: 'contracts', label: 'DApps', icon: <FileCode size={16} /> },
        { id: 'nfts', label: 'NFTs', icon: <Image size={16} />, count: (analytics as any)?.nftPortfolio?.length || 0 },
        { id: 'staking', label: 'Performance', icon: <PiggyBank size={16} /> },
        { id: 'lps', label: 'Liquidity', icon: <Layers size={16} /> },
        { id: 'ledger-moves', label: 'Ledgers', icon: <Zap size={16} />, count: (analytics as any)?.ledgerMovements?.length || 0 },
    ];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xl overflow-hidden">
            <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="bg-white/90 border border-white/10 w-full max-w-[2560px] mx-auto rounded-[2rem] shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col max-h-[90vh] relative overflow-hidden text-left"
            >
                {/* Background Ambient Glow */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-blue-900/20 to-transparent pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-900/10 blur-[100px] pointer-events-none" />

                {/* API LIMIT WARNING */}
                {analytics?.error === 'API_LIMIT_REACHED' && (
                    <div className="bg-amber-500/10 border-b border-amber-500/20 px-8 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-500 text-[10px] font-bold uppercase tracking-widest">
                            <AlertTriangle size={12} />
                            <span>Limited Metrics: API Quota Exhausted</span>
                        </div>
                        <div className="text-[10px] text-amber-500/60 font-medium">
                            Using Etherscan fallback (Mainnet Only)
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="flex justify-between items-start p-6 md:p-8 border-b border-white/5 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 p-[1px] shadow-lg shadow-blue-900/50">
                            <div className="w-full h-full bg-black rounded-2xl flex items-center justify-center">
                                <Activity className="text-blue-400" size={24} />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                                <span className="truncate max-w-[150px] md:max-w-none">{label}</span>
                                <span className="px-2 py-0.5 rounded text-[8px] md:text-[10px] font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-black uppercase tracking-wider">
                                    Verified
                                </span>
                            </h2>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-[10px] md:text-sm font-mono text-gray-500 tracking-wider bg-white/5 px-2 py-0.5 rounded truncate max-w-[100px] md:max-w-none">
                                    {address}
                                </p>
                                <Globe size={12} className="text-gray-600 hidden md:block" />
                                <span className="text-[10px] text-gray-500 hidden md:block">{analytics.networksActive?.length || 0} Active Networks</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 md:p-3 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-all backdrop-blur-md border border-white/5">
                        <X size={20} />
                    </button>
                </div>

                {/* Mobile Tabs Selector */}
                <div className="md:hidden flex overflow-x-auto border-b border-white/5 bg-black/40 backdrop-blur-md no-scrollbar">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-shrink-0 px-6 py-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
                                activeTab === tab.id
                                    ? 'border-blue-500 text-white bg-blue-500/10'
                                    : 'border-transparent text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className="ml-1 text-[8px] bg-white/10 px-1.5 rounded-full">{tab.count}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Main Content Area */}
                <div className="flex flex-1 overflow-hidden relative z-10">
                    {/* Sidebar Navigation */}
                    <div className="w-64 border-r border-white/5 p-4 flex flex-col gap-1 overflow-y-auto hidden md:flex bg-black/20 backdrop-blur-md">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-between group ${
                                    activeTab === tab.id
                                        ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-white border border-blue-500/30'
                                        : 'text-gray-500 hover:bg-white/5 hover:text-gray-300 border border-transparent'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`${activeTab === tab.id ? 'text-blue-400' : 'text-gray-600 group-hover:text-gray-400'}`}>
                                        {tab.icon}
                                    </span>
                                    {tab.label}
                                </div>
                                {tab.count !== undefined && tab.count > 0 && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-blue-500/20 text-blue-300' : 'bg-white/5 text-gray-600'}`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Content View */}
                    <div className="flex-1 overflow-y-auto p-8 bg-[#080808]/50">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="h-full"
                            >
                                {activeTab === 'overview' && (
                                    <OverviewTab 
                                        analytics={analytics} 
                                        netWorth={netWorthData} 
                                        stakingPositions={analytics.stakingPositions || []}
                                        liquidityPools={analytics.liquidityPools || []}
                                    />
                                )}
                                {activeTab === 'defi' && <DeFiPositionsPanel positions={defiData?.positions || []} totalValueUsd={defiData?.totalValueUsd || 0} protocolCount={defiData?.protocols?.length || 0} />}
                                {activeTab === 'pnl' && <ProfitabilityTracker pnlData={pnlData} isLoading={pnlLoading} />}
                                {activeTab === 'heatmap' && <HeatmapTab data={analytics.transactionHeatmap} />}
                                {activeTab === 'counterparties' && <CounterpartiesTab data={analytics.topCounterparties} />}
                                {activeTab === 'flows' && <FlowsTab data={analytics.tokenFlowAnalysis} />}
                                {activeTab === 'contracts' && <ContractsTab data={analytics.smartContractInteractions} />}
                                {activeTab === 'nfts' && <NFTsTab data={analytics.nftPortfolio} />}
                                {activeTab === 'staking' && <StakingTab data={analytics.stakingPositions} />}
                                {activeTab === 'lps' && <LPsTab data={analytics.liquidityPools} />}
                                {activeTab === 'ledger-moves' && <LedgerMovesTab data={analytics.ledgerMovements} />}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

// Sub-components with Legendary Design

function OverviewTab({ analytics, netWorth, stakingPositions, liquidityPools }: { analytics: WalletAnalytics; netWorth?: any; stakingPositions: any[]; liquidityPools: any[] })  {
    const totalNetWorth = netWorth ? parseFloat(netWorth.total_networth_usd || '0') : 0;

    return (
        <div className="space-y-6">
            {/* Elite Analysis Banner [NEW] */}
            {(stakingPositions.some((p: any) => p.details?.healthFactor) || liquidityPools.some((p: any) => p.onChain)) && (
                <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 bg-blue-500/10 border border-blue-500/20 rounded-[2rem] flex items-center justify-between"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                            <ShieldCheck size={24} className="text-blue-400" />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-white uppercase tracking-widest leading-none mb-1">Scientific Analysis Active</h4>
                            <p className="text-xs text-blue-200/60 font-medium">Direct DeFi positions detected via RPC Multicall.</p>
                        </div>
                    </div>
                    {stakingPositions.find((p: any) => p.details?.healthFactor) && (
                        <div className="text-right">
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block leading-none mb-1">Salud Global (Aave)</span>
                            <span className="text-2xl font-black text-white leading-none">
                                {safeToFixed((stakingPositions.find((p: any) => (p as any).details?.healthFactor) as any).details.healthFactor, 2)}
                            </span>
                        </div>
                    )}
                </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Net Worth Card */}
                {totalNetWorth > 0 && (
                    <StatCard 
                        label="Net Worth Total" 
                        value={'$' + safeToLocaleString(totalNetWorth)} 
                        subtext="Multi-Chain"
                        icon={<Wallet2 size={24} />} 
                        gradient="from-emerald-500 to-teal-500" 
                    />
                )}

                <StatCard 
                    label="Total P&L (24h)" 
                    value={(analytics.pnl24h >= 0 ? '+' : '-') + '$' + Math.abs(analytics.pnl24h || 0).toLocaleString()} 
                    subtext={(analytics.change24h || 0).toFixed(2) + '% 24h'}
                    icon={analytics.pnl24h >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />} 
                    gradient={analytics.pnl24h >= 0 ? "from-emerald-500 to-teal-500" : "from-indigo-500 to-violet-500"} 
                />

                <StatCard 
                    label="Total Transactions" 
                    value={(analytics.totalTransactions || 0).toLocaleString()} 
                    subtext="Blockchain Ledger"
                    icon={<Activity size={24} />} 
                    gradient="from-blue-500 to-cyan-500" 
                />
                <StatCard 
                    label="Activity Score" 
                    value={safeToFixed(analytics.activityScore || 0, 0)} 
                    subtext="/ 100"
                    icon={<Zap size={24} />} 
                    gradient="from-yellow-500 to-orange-500" 
                />
                <StatCard 
                    label="Active Networks" 
                    value={analytics.networksActive?.length || 0} 
                    subtext={analytics.networksActive && analytics.networksActive.length > 0 ? (analytics.networksActive.slice(0, 2).join(', ') + (analytics.networksActive.length > 2 ? '...' : '')) : 'Ethereum Mainnet'}
                    icon={<Globe size={24} />} 
                    gradient="from-purple-500 to-pink-500" 
                />

                {(analytics.influenceScore || 0) > 0 && (
                    <div className="col-span-full md:col-span-2 bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="text-blue-400 font-bold text-xs uppercase tracking-widest mb-1 flex items-center gap-2">
                                    <Zap size={14} />
                                    Market Influence Score
                                </h4>
                                <div className="text-4xl font-black text-white">{analytics.influenceScore || 0}<span className="text-lg text-gray-500 ml-1">/100</span></div>
                            </div>
                            <div className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full">
                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-tighter">Elite Rank</span>
                            </div>
                        </div>
                        <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${analytics.influenceScore || 0}%` }}
                                className="h-full bg-gradient-to-r from-blue-600 via-blue-400 to-purple-500"
                            />
                        </div>
                        <p className="text-xs text-blue-200/60 mt-3 font-medium">Quantified based on elite-grade volume and wealth triggers.</p>
                    </div>
                )}

                {analytics.ledgerEvidence && analytics.ledgerEvidence.length > 0 && (
                    <div className="col-span-full md:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6">
                        <h4 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                            <FileCode size={14} className="text-blue-400" />
                            Verification Evidence
                        </h4>
                        <div className="space-y-3">
                            {analytics.ledgerEvidence.map((ev, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />
                                    <span>{ev}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                <div className="col-span-full bg-white/5 border border-white/10 rounded-2xl p-6 mt-4">
                    <h3 className="text-gray-400 font-bold mb-4 uppercase text-xs tracking-widest">Risk Analysis</h3>
                    <div className="flex items-center gap-6">
                        <div className="relative w-32 h-32 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="64" cy="64" r="60" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="transparent" />
                                <circle 
                                    cx="64" cy="64" r="60" 
                                    stroke={(analytics.riskScore || 0) > 70 ? '#ef4444' : (analytics.riskScore || 0) > 40 ? '#eab308' : '#22c55e'} 
                                    strokeWidth="8" 
                                    fill="transparent" 
                                    strokeDasharray={377} 
                                    strokeDashoffset={377 - (377 * (analytics.riskScore || 0)) / 100}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute text-center">
                                <span className="text-2xl font-black text-white">{analytics.riskScore || 0}</span>
                                <p className="text-[10px] text-gray-500 uppercase">Risk</p>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-white font-bold text-lg">
                                {(analytics.riskScore || 0) > 70 ? 'High Risk Profile' : (analytics.riskScore || 0) > 40 ? 'Moderate Risk Profile' : 'Low Risk Profile'}
                            </h4>
                            <p className="text-gray-400 text-sm mt-1 max-w-md">
                                Based on transaction frequency, counterparty diversity, and interaction with unverified contracts.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function HeatmapTab({ data }: { data: HourlyActivity[] }) {
    const safeData = data || [];
    const maxTx = Math.max(...safeData.map(d => d.txCount), 1);
    return (
        <div>
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h3 className="text-xl font-black text-white">Activity Heatmap</h3>
                    <p className="text-gray-400 text-sm">24-hour transaction frequency distribution (UTC)</p>
                </div>
            </div>
            
            <div className="grid grid-cols-6 md:grid-cols-12 gap-3">
                {safeData.map(d => (
                    <motion.div 
                        key={d.hour} 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: d.hour * 0.02 }}
                        className="flex flex-col items-center group relative"
                    >
                        <div 
                            className="w-full aspect-square rounded-xl transition-all duration-300 group-hover:scale-110 relative border border-white/5 overflow-hidden" 
                            style={{ 
                                backgroundColor: d.txCount === 0 ? 'rgba(255,255,255,0.03)' : `rgba(59, 130, 246, ${(d.txCount / maxTx) * 0.9 + 0.1})`,
                                boxShadow: d.txCount > 0 ? `0 0 ${d.txCount * 2}px rgba(59, 130, 246, 0.5)` : 'none'
                            }}
                        >
                            {d.txCount > 0 && <div className="absolute inset-0 bg-blue-400/20 blur-md" />}
                        </div>
                        <span className="text-[10px] text-gray-600 mt-2 font-mono group-hover:text-white transition-colors">
                            {d.hour}H
                        </span>
                        
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 bg-black/90 border border-white/20 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 backdrop-blur-md">
                            <span className="font-bold text-white">{d.txCount} TXs</span>
                            <span className="text-gray-400 block">${safeToLocaleString(d.volume)} Vol</span>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

function CounterpartiesTab({ data }: { data: Counterparty[] }) {
    const safeData = data || [];
    return (
        <div className="space-y-4">
            <h3 className="text-xl font-black text-white mb-6">Top Interacted Wallets</h3>
            {safeData.map((cp, i) => (
                <motion.div 
                    key={cp.address}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all group"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-800 to-black flex items-center justify-center border border-white/10 text-gray-400 font-bold font-mono">
                            {i + 1}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="font-mono text-white text-lg">{cp.address.slice(0, 6)}...{cp.address.slice(-4)}</p>
                                <Users size={14} className="text-gray-600 group-hover:text-blue-400 transition-colors" />
                            </div>
                            {cp.label && <p className="text-xs text-blue-400 mt-0.5 font-bold uppercase tracking-wider">{cp.label}</p>}
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-white font-black text-xl">{cp.txCount}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Transactions</p>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}

function FlowsTab({ data }: { data: TokenFlow[] }) {
    const safeData = data || [];
    return (
        <div className="space-y-4">
            <h3 className="text-xl font-black text-white mb-6">Token Flow Analysis</h3>
            {safeData.map((flow, i) => {
                const total = flow.inflow + flow.outflow;
                const inPercent = total === 0 ? 50 : (flow.inflow / total) * 100;
                
                return (
                    <motion.div 
                        key={flow.token}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-6 bg-white/5 rounded-2xl border border-white/5"
                    >
                        <div className="flex justify-between items-center mb-4">
                            <span className="font-black text-2xl text-white">{flow.token}</span>
                            <span className={`font-mono text-sm px-3 py-1 rounded-full border ${flow.netFlow >= 0 ? 'border-green-500/30 text-green-400 bg-green-500/10' : 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10'}`}>
                                Net: {flow.netFlow > 0 ? '+' : ''}{safeToFixed(flow.netFlow, 2)}
                            </span>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden flex mb-2">
                            <div style={{ width: `${inPercent}%` }} className="h-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                            <div style={{ width: `${100 - inPercent}%` }} className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.5)]" />
                        </div>
                        
                        <div className="flex justify-between text-xs font-mono">
                            <span className="text-green-400">IN: {safeToFixed(flow.inflow, 2)}</span>
                            <span className="text-indigo-400">OUT: {safeToFixed(flow.outflow, 2)}</span>
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
}

function LedgerMovesTab({ data }: { data: LedgerMovement[] }) {
    const safeData = data || [];
    return (
        <div className="space-y-4">
            <h3 className="text-xl font-black text-white mb-6">Large Transactions {'>'} $100</h3>
            {safeData.length === 0 ? (
                <div className="p-10 border border-dashed border-white/10 rounded-2xl text-center text-gray-500">
                    No major movements detected recently.
                </div>
            ) : (
                safeData.map((move, i) => {
                    const isInbound = move.type === 'IN';
                    return (
                        <motion.div 
                            key={i}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: i * 0.05 }}
                            className={`relative p-5 rounded-2xl border transition-all hover:scale-[1.01] ${isInbound ? 'bg-green-900/10 border-green-500/20 hover:border-green-500/40' : 'bg-indigo-900/10 border-indigo-500/20 hover:border-indigo-500/40'}`}
                        >
                            <div className="flex justify-between items-start relative z-10">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isInbound ? 'bg-green-500/20 text-green-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                                        {isInbound ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-xl text-white">{safeToFixed(move.amount, 4)} {move.token}</span>
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-gray-400 uppercase">
                                                {move.chainId === 480 ? 'WORLD' : move.chainId === 8453 ? 'BASE' : 'ETH'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-400 font-mono">${safeToLocaleString(move.valueUsd)}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500 mb-1">{formatDistanceToNow(new Date(move.timestamp), { addSuffix: true })}</p>
                                    <div className="px-2 py-1 rounded bg-black/40 text-[10px] font-mono text-gray-600 border border-white/5 truncate max-w-[100px]">
                                        {move.txHash.slice(0, 10)}...
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    );
                })
            )}
        </div>
    );
}

// Simple placeholders for other tabs to keep file length manageable, but styled correctly
function ContractsTab({ data }: { data: ContractInteraction[] }) {
    return (
        <div className="space-y-4">
            <h3 className="text-xl font-black text-white mb-6">Smart Contract Interactions</h3>
            {data.length === 0 ? (
                <div className="p-10 border border-dashed border-white/10 rounded-2xl text-center text-gray-500">
                    No contract interactions.
                </div>
            ) : (
                data.map((c, i) => (
                    <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/10">
                        <p className="font-mono text-white">{c.contract}</p>
                        <p className="text-xs text-gray-400">{c.txCount} Interactions</p>
                    </div>
                ))
            )}
        </div>
    );
}

function NFTsTab({ data }: { data: NFTHolding[] }) {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {data.map(nft => (
                <div key={nft.tokenId} className="aspect-square bg-gray-800 rounded-xl overflow-hidden relative group">
                    {nft.imageUrl && <img src={nft.imageUrl} className="w-full h-full object-cover" />}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-end p-4 transition-opacity">
                        <p className="text-white font-bold">{nft.name}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}
function StakingTab({ data }: { data: StakingPosition[] }) { 
    if (!data || data.length === 0) {
        return (
            <div className="p-20 text-center text-gray-500 border border-dashed border-white/10 rounded-[2rem] bg-white/5">
                <PiggyBank size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-bold text-lg">No Active Staking Positions</p>
                <p className="text-sm opacity-60">Deep scan did not detect direct staking on supported protocols.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.map((pos, i) => (
                <motion.div 
                    key={i}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/10 rounded-3xl relative overflow-hidden group"
                >
                    {(pos as any).onChain && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-lg text-[8px] font-black text-green-400 uppercase tracking-widest z-20">
                            Verified On-Chain
                        </div>
                    )}
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Zap size={60} className="text-blue-400" />
                    </div>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-1">{pos.protocol}</span>
                            <h4 className="text-2xl font-black text-white">{safeToFixed(pos.amount, 4)} {pos.token}</h4>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            {pos.apr && pos.apr > 0 && (
                                <div className="bg-green-500/20 border border-green-500/30 px-3 py-1 rounded-full">
                                    <span className="text-xs font-black text-green-400">{safeToFixed(pos.apr, 2)}% APY</span>
                                </div>
                            )}
                            {(pos as any).details?.healthFactor && (
                                <div className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase ${(pos as any).details.healthFactor > 1.5 ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-500'}`}>
                                    Factor: {safeToFixed((pos as any).details.healthFactor, 2)}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-between items-center text-sm font-mono text-gray-500">
                        <span>Current Value</span>
                        <span className="text-white">${safeToLocaleString(pos.valueUsd)}</span>
                    </div>
                </motion.div>
            ))}
        </div>
    ); 
}
function LPsTab({ data }: { data: LPPosition[] }) { 
    if (!data || data.length === 0) {
        return (
            <div className="p-20 text-center text-gray-500 border border-dashed border-white/10 rounded-[2rem] bg-white/5">
                <Layers size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-bold text-lg">No Liquidity Detected</p>
                <p className="text-sm opacity-60">This wallet is not currently providing liquidity to major AMMs.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {data.map((pos, i) => (
                <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all flex items-center justify-between relative overflow-hidden group"
                >
                    {(pos as any).onChain && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded-lg text-[8px] font-black text-purple-400 uppercase tracking-widest z-20">
                            Verified On-Chain
                        </div>
                    )}
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-purple-500/30 transition-colors">
                            <Layers size={24} className="text-purple-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">{pos.protocol}</span>
                                {(pos as any).details?.positionCount && (
                                    <span className="text-[10px] bg-white/10 text-white/60 px-2 py-0.5 rounded-full font-mono">
                                        {pos.details?.positionCount} Pos.
                                    </span>
                                )}
                            </div>
                            <h4 className="text-xl font-black text-white">{pos.pair}</h4>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-black text-white">${safeToLocaleString(pos.valueUsd)}</div>
                        <div className="text-xs font-mono text-gray-500">Liquidity Index: {safeToFixed(pos.liquidity, 2)}</div>
                    </div>
                </motion.div>
            ))}
        </div>
    ); 
}


function StatCard({ label, value, subtext, icon, gradient }: { label: string; value: string | number; subtext?: string; icon: React.ReactNode; gradient: string }) {
    return (
        <div className="relative p-6 bg-[#0B0E11] rounded-2xl border border-white/5 overflow-hidden group hover:border-white/20 transition-all">
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${gradient} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity`} />
            
            <div className="relative z-10 flex items-start justify-between">
                <div>
                    <h4 className="text-sm font-bold text-gray-500 mb-1 uppercase tracking-wider">{label}</h4>
                    <p className="text-3xl font-black text-white tracking-tight">{value}</p>
                    {subtext && <p className="text-xs text-gray-400 mt-1 font-mono">{subtext}</p>}
                </div>
                <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg`}>
                    {icon}
                </div>
            </div>
        </div>
    );
}

function PnLTab({ data }: { data: PnLBreakdown[] }) {
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h3 className="text-lg font-black text-white mb-4">Profit & Loss Breakdown</h3>
            <div className="space-y-3">
                {data.length === 0 ? (
                    <p className="text-gray-500 text-center py-10">P&L data not available</p>
                ) : (
                    data.map(pnl => {
                        const isProfit = pnl.total > 0;
                        return (
                            <div key={pnl.token} className="p-4 bg-white/5 rounded-xl border border-white/10">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-white">{pnl.token}</span>
                                    <span className={`font-bold text-lg ${isProfit ? 'text-green-400' : 'text-indigo-400'}`}>
                                        {isProfit ? '+' : ''}${safeToLocaleString(pnl.total)}
                                    </span>
                                </div>
                                <div className="flex gap-4 text-sm">
                                    <span className="text-gray-400">Realized: ${safeToLocaleString(pnl.realized)}</span>
                                    <span className="text-gray-400">Unrealized: ${safeToLocaleString(pnl.unrealized)}</span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </motion.div>
    );
}

