"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLedgerFeed } from '@/hooks/useLedgerFeed';
import { 
    Landmark, Fingerprint, Activity, Shield, ArrowRightLeft, 
    Cpu, Database, ChevronDown, ChevronUp, Search, 
    TrendingUp, LineChart, Globe, Zap, Scale, BarChart3,
    Newspaper, X, Menu
} from 'lucide-react';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import { InstitutionalHeader } from '@/components/shared/InstitutionalHeader';
import { InmersiveConstellations } from '@/components/shared/InmersiveConstellations';
import { GlobalMarketSessions } from '@/components/premium/GlobalMarketSessions';
import { EliteAnalyticsNews } from '@/components/premium/EliteAnalyticsNews';
import { SplashContainer } from '@/components/shared/SplashContainer';
import Link from 'next/link';

//  Universal Explorer Logic 
function getExplorerLink(item: any) {
    const hash = item.hash;
    const chain = (item.chain || 'ETHEREUM').toUpperCase();
    
    if (chain === 'BITCOIN' || chain === 'BTC') {
        return `/network/tx/${hash}`;
    }
    
    if (chain === 'ETHEREUM' || chain === 'ETH') {
        return `https://etherscan.io/tx/${hash}`;
    }
    
    if (chain === 'SOLANA' || chain === 'SOL') {
        return `https://solscan.io/tx/${hash}`;
    }
    
    if (chain === 'BASE') {
        return `https://basescan.org/tx/${hash}`;
    }

    if (chain === 'POLYGON' || chain === 'MATIC') {
        return `https://polygonscan.com/tx/${hash}`;
    }

    if (chain === 'ARBITRUM') {
        return `https://arbiscan.io/tx/${hash}`;
    }

    if (chain === 'OPTIMISM') {
        return `https://optimistic.etherscan.io/tx/${hash}`;
    }
    
    return `https://etherscan.io/tx/${hash}`;
}

//  Market Analytics Row 
function TransactionRow({ item, index }: { item: any, index: number }) {
    const [isOpen, setIsOpen] = useState(false);
    const auditLink = getExplorerLink(item);
    const dateObj = new Date(item.timestamp);
    
    const fullDateTime = dateObj.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    }) + " " + dateObj.toLocaleTimeString(undefined, { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    }) + " UTC";
    
    return (
        <motion.div 
            layout
            className="group border-b border-white/5 last:border-0 bg-transparent hover:bg-white/[0.02] transition-all duration-300"
        >
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-8 p-6 sm:p-8 cursor-pointer relative"
            >
                <div className="shrink-0 flex items-center gap-4 w-full sm:w-auto">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl sm:rounded-[1.5rem] bg-white/[0.02] flex items-center justify-center border border-white/5 overflow-hidden relative shadow-sm group-hover:border-white/10 transition-colors">
                         <div className={`absolute inset-0 opacity-10 bg-white`} />
                        {item.type?.includes('SELL') ? <Scale className="text-white relative z-10" size={18} /> : 
                         item.type?.includes('BUY') ? <Zap className="text-white relative z-10" size={18} /> :
                         <Activity className="text-white/50 relative z-10" size={18} />}
                    </div>
                    <div className="sm:hidden flex-1">
                        <div className="flex items-center gap-3">
                            <span className="text-[9px] font-black uppercase tracking-widest text-white/40">{item.tier?.replace(' tier', '') || 'INST'}</span>
                             <span className={`text-[9px] font-black uppercase tracking-widest text-white/70`}>{item.type || 'TX'}</span>
                        </div>
                        <div className="text-[10px] font-mono font-black text-white/90 mt-0.5">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div className="sm:hidden text-right">
                        <div className="text-sm font-black text-white/90">${item.usdValue.toLocaleString()}</div>
                    </div>
                </div>

                <div className="flex-1 min-w-0 space-y-2 sm:space-y-3 w-full">
                    <div className="hidden sm:flex items-center gap-4">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                            {item.tier?.replace(' tier', '') || 'Sovereign'}
                        </span>
                        <div className="h-1 w-1 rounded-full bg-white/20" />
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] text-white/80`}>
                            {item.type || 'EXCHANGE TRANSFER'}
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                        <span className="text-xl sm:text-3xl font-black tracking-tighter text-white font-mono">
                            {item.amount.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                            <span className="text-xs sm:text-sm text-white/40 ml-2 font-black">{item.asset}</span>
                        </span>
                        
                        <div className="flex items-center gap-3 px-3 py-1.5 sm:px-4 sm:py-2 bg-white/[0.02] rounded-xl sm:rounded-2xl border border-white/5 w-full sm:w-auto">
                            <span className="text-[9px] sm:text-[11px] font-mono font-bold text-white/50 truncate flex-1 sm:max-w-[120px]">{item.from}</span>
                            <ArrowRightLeft size={10} className="text-white/30 shrink-0" />
                            <span className="text-[9px] sm:text-[11px] font-mono font-bold text-white/50 truncate flex-1 sm:max-w-[120px]">{item.to}</span>
                        </div>
                    </div>
                </div>

                <div className="hidden sm:block text-right space-y-1 shrink-0">
                    <div className="text-white text-xl font-black tracking-tighter font-mono">${item.usdValue.toLocaleString()}</div>
                    <div className="text-white/40 text-[10px] font-black uppercase tracking-widest flex items-center justify-end gap-2">
                        <Database size={10} /> {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>

                <div className="absolute top-6 right-6 sm:relative sm:top-0 sm:right-0 text-white/30 group-hover:text-white transition-colors p-2 rounded-full hover:bg-white/5">
                    {isOpen ? <ChevronUp size={20} /> : <Menu size={20} className="sm:hidden" />}
                    <div className="hidden sm:block">
                         {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-white/[0.01] px-8 pb-10"
                    >
                        <div className="border-t border-white/5 pt-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div className="space-y-6">
                                    <div className="flex flex-col gap-2">
                                        <div className="text-[10px] font-black text-white/90 uppercase tracking-[0.3em] bg-white/5 px-4 py-2 rounded-lg border border-white/10 self-start">
                                            {fullDateTime}
                                        </div>
                                        <div className="text-[9px] font-mono font-bold text-white/50 break-all bg-white/[0.02] p-4 rounded-xl border border-white/5">
                                            {item.hash}
                                        </div>
                                    </div>
                                    
                                    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-[2.5rem] shadow-sm flex items-center justify-between">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Execution Fee</div>
                                        <div className="text-sm font-mono font-black text-white/90">
                                            {item.gasPriceGwei || (item.chain === 'BITCOIN' ? 'L1 Standard' : '0.00')} <span className="text-[10px] text-white/30">GWEI</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-6 md:border-l md:border-white/5 md:pl-12">
                                    <div className="space-y-3">
                                        <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/5">
                                            <div className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-1 opacity-60">Source</div>
                                            <div className="text-[10px] font-mono font-bold text-white/90 break-all">{item.from}</div>
                                        </div>
                                        <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/5">
                                            <div className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-1 opacity-60">Destination</div>
                                            <div className="text-[10px] font-mono font-bold text-white/90 break-all">{item.to}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-12 flex flex-col items-center gap-6">
                                <div className="text-[11px] font-black text-white/90 flex items-center gap-2">
                                    <span className="text-white/40 font-bold tracking-tight">Valuation:</span>
                                    <span>${item.usdValue.toLocaleString()} USD</span>
                                    <span className="text-white/20 mx-1">|</span>
                                    <span className="text-white/60">({(item.usdValue * 0.92).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR)</span>
                                </div>
                                
                                <a 
                                    href={auditLink}
                                    target={auditLink.startsWith('http') ? "_blank" : "_self"}
                                    rel={auditLink.startsWith('http') ? "noopener noreferrer" : ""}
                                    className="w-full max-w-xs flex items-center justify-center gap-4 px-10 py-5 rounded-3xl bg-white/10 text-white text-[10px] font-black uppercase tracking-[0.4em] hover:bg-white/20 hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
                                >
                                    <Fingerprint size={16} /> Full Audit
                                </a>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export function LedgerTrackerDashboard() {
    const { unifiedLedgerFeed, isLoading } = useLedgerFeed();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('ALL');
    const { address, isConnected } = useSystemAccount();
    const [showNews, setShowNews] = useState(false);

    const filtered = useMemo(() => {
        let result = unifiedLedgerFeed;
        if (activeTab !== 'ALL') {
            if (activeTab === 'TOKENS') {
                result = result.filter(tx => tx.chain !== 'BITCOIN');
            } else if (activeTab === 'BTC') {
                result = result.filter(tx => tx.chain === 'BITCOIN');
            }
        }
        if (searchQuery) {
            result = result.filter(tx => 
                tx.hash.toLowerCase().includes(searchQuery.toLowerCase()) ||
                tx.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
                tx.to.toLowerCase().includes(searchQuery.toLowerCase()) ||
                tx.asset.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return result;
    }, [unifiedLedgerFeed, searchQuery, activeTab]);

    return (
        <div className="relative bg-white min-h-screen text-white/90 font-sans selection:bg-white/20 selection:text-white overflow-x-hidden">
            <div className="relative z-10 w-full max-w-[2560px] mx-auto flex flex-col">
                <AnimatePresence>
                    {showNews && (
                        <>
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowNews(false)}
                                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[90]"
                            />
                            <motion.div 
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                                className="fixed right-0 top-0 h-full w-full max-w-lg z-[100] shadow-2xl"
                            >
                                <div className="absolute top-8 left-[-4.5rem] z-10">
                                    <button 
                                        onClick={() => setShowNews(false)}
                                        className="p-5 bg-white/10 text-white rounded-full shadow-2xl hover:bg-white/20 hover:scale-110 transition-all active:scale-90 flex items-center justify-center group backdrop-blur-md"
                                    >
                                        <X size={28} className="group-hover:rotate-90 transition-transform" />
                                    </button>
                                </div>
                                <EliteAnalyticsNews />
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                <main className="flex-1 max-w-[2560px] mx-auto w-full pt-32 pb-16 px-8 space-y-32 text-left">
                    <div className="flex flex-col items-center text-center space-y-16">
                        <div className="space-y-6">
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="w-80 h-80 flex items-center justify-center mx-auto relative group"
                            >
                                <div className="absolute inset-0 bg-white/5 blur-3xl rounded-full" />
                                <SplashContainer className="w-full h-full transition-transform duration-500 scale-125 group-hover:scale-150 relative z-10 flex items-center justify-center">
                                    <img 
                                        src="/logo-mark.png" 
                                        className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]" 
                                        alt="Humanity Ledger Pro"
                                    />
                                </SplashContainer>
                            </motion.div>
                            <div className="space-y-4">
                                <h1 className="text-4xl sm:text-8xl font-black uppercase tracking-tighter leading-none text-white">
                                    Search your <span className="text-white/40">Transaction</span>
                                </h1>
                            </div>
                        </div>

                        <div className="w-full flex justify-center">
                            <GlobalMarketSessions />
                        </div>

                        <div className="w-full max-w-4xl flex gap-8 items-center">
                            <div className="flex-1 relative group">
                                <div className="absolute inset-y-0 left-10 flex items-center pointer-events-none text-white/40 group-focus-within:text-white transition-colors">
                                    <Search size={28} />
                                </div>
                                <input 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="QUERY BY TX HASH / WALLET SIGNATURE / ASSET..."
                                    className="w-full bg-white/[0.02] border border-white/10 rounded-3xl sm:rounded-[3.5rem] py-6 sm:py-10 pl-16 sm:pl-24 pr-4 sm:pr-40 text-sm sm:text-lg font-bold tracking-tight outline-none focus:border-white/50 focus:shadow-[0_0_50px_rgba(255,255,255,0.05)] transition-all text-white placeholder:text-white/30 shadow-xl"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-16">
                        <div className="flex items-center justify-between border-b border-white/10 pb-10">
                            <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-2">
                                    {['ALL', 'BTC', 'TOKENS'].map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={`px-6 sm:px-12 py-3 sm:py-5 rounded-xl sm:rounded-2xl text-[10px] sm:text-[12px] font-black uppercase tracking-[0.25em] transition-all whitespace-nowrap ${
                                                activeTab === tab 
                                                ? 'bg-white text-black shadow-lg scale-105' 
                                                : 'bg-white/[0.02] text-white/40 border border-white/5 hover:text-white/90 hover:border-white/20'
                                            }`}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                            </div>
                            <div className="flex items-center gap-10">
                                <div className="text-right">
                                    <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Observational Load</div>
                                    <div className="text-base font-mono font-black text-white/90">{filtered.length} Sequences identified</div>
                                </div>
                                <div className="w-px h-12 bg-white/10" />
                            </div>
                        </div>

                        <AnimatePresence mode="wait">
                            <motion.div 
                                key="tx-list"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                className="bg-[#0a0a0a] border border-white/10 rounded-[2rem] sm:rounded-[5rem] overflow-hidden shadow-2xl relative"
                            >
                                {isLoading && (
                                    <div className="h-[700px] flex flex-col items-center justify-center gap-10">
                                        <div className="w-16 h-16 border-[6px] border-white/5 border-t-white animate-spin rounded-full shadow-lg" />
                                        <div className="text-center space-y-3">
                                            <span className="block text-[12px] uppercase font-black tracking-[0.6em] text-white animate-pulse">Synchronizing Block Data</span>
                                            <span className="block text-[10px] font-black text-white/30 uppercase tracking-widest">Resolving Ledger State</span>
                                        </div>
                                    </div>
                                )}

                                {!isLoading && filtered.length > 0 && (
                                    <div className="divide-y divide-white/5">
                                        {filtered.slice(0, 50).map((tx, i) => (
                                            <TransactionRow key={tx.id || i} item={tx} index={i} />
                                        ))}
                                    </div>
                                )}

                                {!isLoading && filtered.length === 0 && (
                                    <div className="h-[700px] flex flex-col items-center justify-center gap-10 opacity-30">
                                        <div className="p-8 bg-white/[0.02] rounded-[3rem] border border-white/5">
                                            <Database size={80} className="text-white/20" />
                                        </div>
                                        <span className="text-sm uppercase font-black tracking-[0.5em] text-white/40">Database Empty</span>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </main>
            </div>
        </div>
    );
}
