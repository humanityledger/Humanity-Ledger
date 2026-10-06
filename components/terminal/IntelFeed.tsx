'use client';

import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Zap, Globe, Vote, Lock, AlertTriangle, TrendingUp, TrendingDown, Target, Wallet, Cpu, Fish, Banknote } from 'lucide-react';
import { toast } from 'sonner';

import { useAiSentiment } from '@/hooks/useAiSentiment';
import { useGovSniper } from '@/hooks/useGovSniper';
import { useYieldHunter } from '@/hooks/useYieldHunter';
import { GovernanceProposals } from '@/components/terminal/GovernanceProposals';

import { ZapButton } from '@/components/defi/ZapButton'; // [NEW] Phase 3

type FeedMode = 'LIVE' | 'LEDGERS' | 'GOV' | 'YIELD';

export function IntelFeed() {
    const searchParams = useSearchParams();

    // Get mode from URL params, default to LIVE
    const mode = (searchParams?.get('mode')?.toUpperCase() as FeedMode) || 'LIVE';

    // --- Hook Integration ---
    const sentiment = useAiSentiment();
    const gov = useGovSniper();
    const yieldData = useYieldHunter();





    return (
        <div className="flex flex-col h-full w-full relative overflow-hidden">
            {/* --- HEADER --- */}
            {/* --- CONTENIDO PRINCIPAL (Z-20) --- */}
            <div className="flex-1 flex flex-col relative z-20 overflow-hidden">

                {/* --- CONTENIDO DE DATOS (SCROLLABLE) --- */}
                <div className="flex-1 px-4 pb-4 pt-0 overflow-y-auto relative z-20 custom-scrollbar">
                    <AnimatePresence mode='wait'>

                        {/* --- TAB: LIVE (Governance Proposals) --- */}
                        {mode === 'LIVE' && (
                            <motion.div
                                key="live"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-4"
                            >
                                <GovernanceProposals />
                            </motion.div>
                        )}



                        {/* --- TAB: LEDGERS (Placeholder/Future) --- */}
                        {mode === 'LEDGERS' && (
                            <motion.div
                                key="ledgers"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-2 p-8"
                            >
                                <Fish size={32} className="text-violet-500 opacity-50" />
                                <p className="text-xs font-mono">LEDGER TRACKING SYSTEM</p>
                                <p className="text-[10px] text-zinc-600 text-center">Monitoring large scale movements across the chain. <br />(Module Initializing...)</p>
                            </motion.div>
                        )}





                        {/* --- TAB: YIELD (DeFi) --- */}
                        {mode === 'YIELD' && (
                            <motion.div
                                key="yield"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-3"
                            >
                                <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
                                    <span><Wallet size={12} className="inline mr-1" /> Yield Opportunities</span>
                                    <span className="text-emerald-400">Top: {yieldData.topPick?.protocol}</span>
                                </div>

                                {yieldData.pools.map((pool, i) => (
                                    <div key={i} className="relative bg-white/5 border border-white/5 p-4 rounded-xl overflow-hidden group hover:border-emerald-500/30 transition-all">
                                        {/* Rank Number */}
                                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/5 rounded-full flex items-end justify-start p-3 text-4xl font-bold text-white/5 group-hover:text-emerald-500/20 transition-colors">
                                            {i + 1}
                                        </div>

                                        <div className="flex justify-between items-start mb-2 relative z-10">
                                            <div>
                                                <h4 className="text-sm font-bold text-white">{pool.pool}</h4>
                                                <p className="text-xs text-zinc-400">{pool.protocol}</p>
                                            </div>
                                            <div className="text-right flex flex-col items-end gap-1">
                                                <div className="text-lg font-bold text-emerald-400 font-mono">{pool.apy}% APY</div>
                                                <div className="text-[10px] text-zinc-500">TVL: {pool.tvl}</div>
                                                <ZapButton poolName={pool.pool} apy={`${pool.apy}%`} /> {/* [NEW] Phase 3 */}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 mt-3 relative z-10">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${pool.badge === 'SAFE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                pool.badge === 'DEGEN' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                    pool.badge === 'RISKY' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                        'bg-[#25D366]/10 text-blue-400 border-[#25D366]/20'
                                                }`}>
                                                {pool.badge}
                                            </span>
                                            <span className="text-[10px] text-zinc-500 font-mono">
                                                Risk: {pool.riskScore}/10
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}


