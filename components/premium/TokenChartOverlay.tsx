"use client";

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Droplets, TrendingUp, TrendingDown, ShieldCheck } from 'lucide-react';
import { LedgerMomentumChart } from '@/components/network/ledger/LedgerMomentumChart';
import { useVIPStore, EMPTY_ARRAY } from '@/lib/vip-store';

interface OverlayProps {
    symbol: string;
    onClose: () => void;
}

export const TokenChartOverlay = ({ symbol, onClose }: OverlayProps) => {
    const s = symbol.toUpperCase().trim();
    const tokenEvents = useVIPStore(state => state.tokenFeeds[s] || EMPTY_ARRAY);
    const candles    = useVIPStore(state => state.candleFeeds[s] || EMPTY_ARRAY);

    const lastPrice  = candles.length > 0 ? candles[0].haClose : 0;
    const prevPrice  = candles.length > 1 ? candles[1].haClose : lastPrice;
    const pct        = prevPrice > 0 ? ((lastPrice - prevPrice) / prevPrice) * 100 : 0;
    const isBull     = pct >= 0;
    const vol1h      = candles.reduce((acc, c) => acc + (c.volume || 0), 0);
    const minP       = candles.length > 0 ? Math.min(...candles.map(c => c.haLow))  : 0;
    const maxP       = candles.length > 0 ? Math.max(...candles.map(c => c.haHigh)) : 0;

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);

    const fmt  = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
    const fmtC = (n: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
    const fmtP = (n: number, maxFrac = 0) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: maxFrac }).format(n);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] bg-[#080808]/95 backdrop-blur-3xl flex flex-col overflow-hidden"
            >
                {/* Ambient Glow */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className={`absolute top-0 left-1/4 w-[50%] h-[30%] blur-[160px] rounded-full opacity-10 ${isBull ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                    <div className="absolute bottom-0 right-0 w-[30%] h-[40%] bg-[var(--aztec-orchid)]/10 blur-[120px] rounded-full" />
                </div>

                {/*  TOP HEADER BAR  */}
                <div className="relative z-10 flex items-center justify-between px-8 pt-6 pb-4 border-b border-white/5">
                    
                    {/* Left: Token identity */}
                    <div className="flex items-center gap-6">
                        <div>
                            <div className="flex items-baseline gap-3">
                                <span className="font-aztec-h1 text-5xl uppercase text-white tracking-tighter leading-none">{s}</span>
                                <span className={`font-mono text-2xl font-black tracking-tighter ${isBull ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {fmt(lastPrice)}
                                </span>
                                <span className={`font-aztec-h2 text-[11px] uppercase tracking-[0.25em] px-2.5 py-1 rounded-full border ${
                                    isBull 
                                        ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5' 
                                        : 'text-rose-400 border-rose-400/30 bg-rose-400/5'
                                }`}>
                                    {isBull ? '+' : ''}{pct.toFixed(2)}%
                                </span>
                            </div>
                            {/* Sub-row: compact meta */}
                            <div className="flex items-center gap-5 mt-2">
                                <span className="font-aztec-h2 text-[9px] uppercase tracking-[0.35em] text-white/20">Heikin-Ashi 1m</span>
                                <span className="w-px h-3 bg-white/10" />
                                <span className="font-aztec-h2 text-[9px] uppercase tracking-[0.35em] text-white/20">
                                    Vol  <span className="text-white/50">${fmtC(vol1h)}</span>
                                </span>
                                <span className="w-px h-3 bg-white/10" />
                                <span className="font-aztec-h2 text-[9px] uppercase tracking-[0.35em] text-white/20">
                                    {minP > 0 && maxP > 0 ? `${fmtP(minP, 0)}  ${fmtP(maxP, 0)}` : ''}
                                </span>
                                <span className="w-px h-3 bg-white/10" />
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--aztec-orchid)] animate-pulse" />
                                    <span className="font-aztec-h2 text-[9px] uppercase tracking-[0.35em] text-[var(--aztec-orchid)]/80">Active</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Close */}
                    <button
                        onClick={onClose}
                        className="p-2.5 rounded-xl hover:bg-white/5 border border-white/10 hover:border-white/20 transition-all text-white/40 hover:text-white group"
                    >
                        <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>

                {/*  MAIN CONTENT  */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-0 overflow-hidden z-10">

                    {/* Chart */}
                    <div className="flex flex-col overflow-hidden border-r border-white/5">
                        <div className="flex-1 p-6">
                            <LedgerMomentumChart symbol={s} showAxes={true} />
                        </div>
                    </div>

                    {/* Right Sidebar */}
                    <div className="flex flex-col overflow-hidden bg-white">

                        {/* Stats strip */}
                        <div className="px-5 py-4 border-b border-white/5 grid grid-cols-2 gap-4">
                            <div>
                                <div className="font-aztec-h2 text-[8px] uppercase tracking-[0.35em] text-white/20 mb-1">1h Volume</div>
                                <div className="font-mono text-sm font-black text-white">${fmtC(vol1h)}</div>
                            </div>
                            <div>
                                <div className="font-aztec-h2 text-[8px] uppercase tracking-[0.35em] text-white/20 mb-1">Momentum</div>
                                <div className={`font-aztec-h2 text-[11px] uppercase tracking-wide font-black ${isBull ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {isBull ? ' Bullish' : ' Bearish'}
                                </div>
                            </div>
                            <div>
                                <div className="font-aztec-h2 text-[8px] uppercase tracking-[0.35em] text-white/20 mb-1">24h Low</div>
                                <div className="font-mono text-sm font-black text-white/70">{minP > 0 ? fmtP(minP, 0) : ''}</div>
                            </div>
                            <div>
                                <div className="font-aztec-h2 text-[8px] uppercase tracking-[0.35em] text-white/20 mb-1">24h High</div>
                                <div className="font-mono text-sm font-black text-white/70">{maxP > 0 ? fmtP(maxP, 0) : ''}</div>
                            </div>
                        </div>

                        {/* Flow header */}
                        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Droplets className="w-3.5 h-3.5 text-[var(--aztec-orchid)] animate-pulse" />
                                <span className="font-aztec-h2 text-[9px] uppercase tracking-[0.35em] text-white/50">Ledger Flow</span>
                            </div>
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/60" />
                        </div>

                        {/* Flow list */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {tokenEvents.length > 0 ? (
                                <div className="divide-y divide-white/[0.03]">
                                    {tokenEvents.slice(0, 25).map((e, i) => (
                                        <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors group">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-mono text-[10px] text-white/30 group-hover:text-white/50 transition-colors">
                                                    {e.wallet.slice(0, 10)}
                                                </span>
                                                <span className="font-mono text-[13px] font-black text-white">{fmt(e.usdNum)}</span>
                                            </div>
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className={`font-aztec-h2 text-[9px] uppercase tracking-[0.25em] px-2 py-0.5 rounded border ${
                                                    e.action === 'BUY' 
                                                        ? 'text-emerald-400 border-emerald-400/20 bg-emerald-400/5' 
                                                        : 'text-rose-400 border-rose-400/20 bg-rose-400/5'
                                                }`}>{e.action}</span>
                                                <span className="font-aztec-h2 text-[8px] uppercase tracking-[0.3em] text-white/20">{e.token}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center gap-3 p-8 opacity-30">
                                    <Activity className="w-8 h-8 text-white" />
                                    <span className="font-aztec-h2 text-[9px] uppercase tracking-[0.4em] text-white text-center">
                                        Awaiting flow data
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Footer signature */}
                        <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
                            <span className="font-aztec-h2 text-[8px] uppercase tracking-[0.35em] text-white/15">Humanity Ledger.</span>
                            <div className="flex items-center gap-1.5">
                                <div className="w-1 h-1 rounded-full bg-[var(--aztec-orchid)] animate-pulse" />
                                <span className="font-aztec-h2 text-[8px] uppercase tracking-[0.35em] text-white/15">ha v1.02</span>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
