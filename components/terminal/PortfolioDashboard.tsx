// @ts-nocheck
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { useAppKit } from '@reown/appkit/react';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import { useWalletStore } from '@/lib/store/wallet-store';
import { cn } from '@/lib/utils';
import { PortfolioSkeleton } from '@/components/ui/skeleton-loader';
import { TokenLogo } from '@/components/ui/TokenLogo';
import { useRealWalletData } from '@/hooks/useRealWalletData';
import TransactionHistory from '@/components/wallet/TransactionHistory';
import { useChainId, useChains, useSwitchChain } from 'wagmi';
import { toast } from 'sonner';
import { AztecIdentityCard } from '@/components/portfolio/AztecIdentityCard';
import { ProductPassportsPanel } from '@/components/portfolio/ProductPassportsPanel';

import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } }
};

export default function PortfolioDashboard({ walletAddress }: { walletAddress?: string }) {
    const { open } = useAppKit();
    const { address: web3Address } = useSystemAccount();

    const currentChainId = useChainId();
    const allChains = useChains();
    const { switchChainAsync } = useSwitchChain();
    
    const effectiveAddress = walletAddress || web3Address;
    const isConnected = !!effectiveAddress;

    const {
        assets = [],
        totalBalance: totalValueStr,
        change24hUSD: totalChange24h = 0,
        isLoading,
        refetch
    } = useRealWalletData([], effectiveAddress ?? undefined);

    const totalValue = parseFloat(totalValueStr || '0');

    const [mounted, setMounted] = useState(false);
    
    const [activeTab, setActiveTab] = useState<'tokens' | 'activity' | 'aztec' | 'passports'>('tokens');

    useEffect(() => { setMounted(true); }, []);

    const isProfit = totalChange24h >= 0;

    // Deduplicate holdings and apply settings
    const uniqueAssets = React.useMemo(() => {
        const map = new Map();
        assets.forEach(a => {
            if (!map.has(a.symbol)) {
                map.set(a.symbol, a);
            }
        });
        
        let filtered = Array.from(map.values());
        
        if (uiConfig?.hideZeroBalances) {
            filtered = filtered.filter(a => (a.balanceNumeric || a.balance || 0) > 0);
        }
        
        if (uiConfig?.tokenSort === 'value_asc') {
            filtered.sort((a, b) => (a.valueUSD || 0) - (b.valueUSD || 0));
        } else if (uiConfig?.tokenSort === 'alpha') {
            filtered.sort((a, b) => a.symbol.localeCompare(b.symbol));
        } else {
            filtered.sort((a, b) => (b.valueUSD || 0) - (a.valueUSD || 0));
        }
        
        return filtered;
    }, [assets, uiConfig?.hideZeroBalances, uiConfig?.tokenSort]);

    if (!mounted) return null;
    
    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[600px] text-center space-y-12 bg-white">
                <div className="relative p-10 rounded-full border border-slate-200">
                    <span className="font-mono text-5xl font-black text-black">[!]</span>
                </div>
                <div className="space-y-4 max-w-md relative z-10">
                    <h2 className="text-4xl font-black text-black tracking-tighter uppercase leading-none">
                        SECURE TERMINAL
                    </h2>
                    <p className="text-slate-500 text-xs font-mono uppercase tracking-widest leading-relaxed">
                        Identity authentication required for ledger access
                    </p>
                </div>
                <div className="flex flex-col md:flex-row gap-4 relative z-10 w-full max-w-sm px-4">
                    <button
                        onClick={() => open()}
                        className="w-full px-8 py-4 bg-black text-white font-black rounded-xl uppercase tracking-[0.2em] text-[10px] hover:bg-slate-800 transition-colors"
                    >
                        AUTHENTICATE
                    </button>
                    <button
                        onClick={() => useWalletStore.getState().createWallet()}
                        className="w-full px-8 py-4 bg-white border border-slate-200 text-black font-black rounded-xl uppercase tracking-[0.2em] text-[10px] hover:bg-black/5 transition-colors"
                    >
                        INITIALIZE VAULT
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full min-h-0 flex flex-col p-2 sm:p-4 md:p-8 bg-white overflow-x-hidden overflow-y-auto no-scrollbar font-sans text-black relative">
            <div className="w-full max-w-[880px] mx-auto bg-white/80 backdrop-blur-2xl border border-slate-200/60 rounded-[1.5rem] md:rounded-[2rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.07)] p-5 sm:p-7 md:p-10 flex flex-col transition-all duration-500 z-10 overflow-hidden">



                {/* Balance Block (Minimalist) */}
                <div className="w-full border-b border-slate-200/60 pb-8 mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <span className="font-mono text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Total Holdings</span>
                        <button onClick={toggleHideBalances} className="text-slate-400 hover:text-black transition-colors active:scale-95">
                            <span className="font-mono text-[10px] font-black">[EYE]</span>
                        </button>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-end gap-2 md:gap-6 mt-2">
                        <div className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter text-black truncate">
                            {hideBalances ? "*****" : <AnimatedCounter value={totalValue} isCurrency={true} />}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] md:text-sm font-bold tracking-widest font-mono mb-1 md:mb-2">
                            {isProfit ? <span className="font-mono font-black">[+]</span> : <span className="font-mono font-black">[-]</span>}
                            {hideBalances ? "***" : <><AnimatedCounter value={Math.abs(totalChange24h)} isCurrency={false} />%</>}
                        </div>
                    </div>
                    <div className="mt-4 md:mt-6 font-mono text-[9px] md:text-[10px] uppercase tracking-widest text-slate-500 truncate">
                        IDENTITY: {effectiveAddress}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex overflow-x-auto no-scrollbar items-center gap-4 md:gap-6 border-b border-slate-200/60 mb-6 pb-2 w-full">
                    <button
                        onClick={() => setActiveTab('tokens')}
                        className={cn(
                            "flex-shrink-0 pb-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 relative",
                            activeTab === 'tokens' ? "text-black border-black" : "text-slate-400 border-transparent hover:text-black"
                        )}
                    >
                        HOLDINGS
                    </button>
                    <button
                        onClick={() => setActiveTab('activity')}
                        className={cn(
                            "flex-shrink-0 pb-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 relative",
                            activeTab === 'activity' ? "text-black border-black" : "text-slate-400 border-transparent hover:text-black"
                        )}
                    >
                        CHAIN ACTIVITY
                    </button>
                    <button
                        onClick={() => setActiveTab('aztec')}
                        className={cn(
                            "flex-shrink-0 pb-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 relative",
                            activeTab === 'aztec' ? "text-black border-black" : "text-slate-400 border-transparent hover:text-black"
                        )}
                    >
                        Sovereign Identity
                    </button>
                    <button
                        onClick={() => setActiveTab('passports')}
                        className={cn(
                            "flex-shrink-0 pb-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 relative",
                            activeTab === 'passports' ? "text-black border-black" : "text-slate-400 border-transparent hover:text-black"
                        )}
                    >
                        STUDIO PROVENANCE
                    </button>
                </div>

                {/* Tab Content */}
                <AnimatePresence mode="wait">
                    {activeTab === 'tokens' ? (
                        <motion.div
                            key="tokens"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="flex flex-col"
                        >
                            <div className="divide-y divide-slate-100">
                                {isLoading && uniqueAssets.length === 0 ? (
                                    <div className="py-8">
                                        <PortfolioSkeleton />
                                    </div>
                                ) : (
                                    <motion.div variants={containerVariants} initial="hidden" animate="show">
                                    {uniqueAssets.map((asset, idx) => (
                                        <motion.div variants={itemVariants} key={asset.symbol} className="py-6 flex items-center justify-between group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center grayscale group-hover:grayscale-0 transition-all duration-500 group-hover:scale-105 overflow-hidden">
                                                    {uiConfig?.showTokenLogos !== false ? <TokenLogo symbol={asset.symbol} name={asset.name} address={asset.address} logoURI={asset.logoURI} className="w-full h-full object-cover" fallbackClassName="w-full h-full flex items-center justify-center text-[10px]" /> : <span className="font-mono text-xs">{asset.symbol.slice(0, 1)}</span>}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-sm text-black tracking-tight">{asset.symbol}</span>
                                                    <span className="font-mono text-[9px] uppercase tracking-widest text-slate-400">{asset.network}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="font-black text-lg text-black tracking-tighter group-hover:scale-105 transition-transform duration-300 origin-right">
                                                    {hideBalances ? "***.**" : `$formatAmount(asset.valueUSD || 0)`}
                                                </span>
                                                <span className="font-mono text-[9px] font-bold text-slate-500 tracking-widest uppercase mt-0.5">
                                                    {hideBalances ? "**" : safeToFixed(asset.balanceNumeric || asset.balance || 0, 6)} {asset.symbol}
                                                </span>
                                            </div>
                                        </motion.div>
                                    ))}
                                    </motion.div>
                                )}

                                {uniqueAssets.length === 0 && !isLoading && (
                                    <div className="py-20 text-center text-slate-400 font-mono text-[10px] uppercase tracking-[0.2em] font-bold">
                                        No assets detected on this identity.
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ) : activeTab === 'activity' ? (
                        <motion.div
                            key="activity"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                        >
                            <TransactionHistory authUserId={effectiveAddress} />
                        </motion.div>
                    ) : activeTab === 'aztec' ? (
                        <motion.div
                            key="aztec"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="w-full"
                        >
                            <AztecIdentityCard />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="passports"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="w-full"
                        >
                            <ProductPassportsPanel />
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    );
}

