"use client";

import React from 'react';
import { ExternalLink, TrendingUp, TrendingDown, Percent, Zap, Loader2 } from 'lucide-react';
import { PerpPosition } from '@/types/wallet';
import { motion } from 'framer-motion';

import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';
interface PerpsTabProps {
    perps: PerpPosition[];
    isLoading?: boolean;
}

export default function PerpsTab({ perps, isLoading }: PerpsTabProps) {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 size={40} className="text-[#1F1F1F] animate-spin mb-4" />
                <p className="text-[#1F1F1F]/60 font-medium font-mono">Syncing Liquidations...</p>
            </div>
        );
    }

    if (perps.length === 0) {
        return (
            <div className="text-center py-16 text-neutral-400 text-sm">
                <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4 text-neutral-300">
                    <Zap size={24} />
                </div>
                <p className="font-medium">No active perp positions.</p>
                <button className="mt-4 text-emerald-600 hover:text-emerald-700 font-bold hover:underline">Attest on GMX</button>
            </div>
        );
    }

    return (
        <div className="space-y-3 px-4">
            {perps.map((pos, idx) => (
                <motion.div 
                    key={pos.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-neutral-900 rounded-[2rem] p-6 text-white border border-white/5 hover:border-white/10 transition-all group overflow-hidden relative"
                >
                    {/* Background Glow */}
                    <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-20 -mr-16 -mt-16 bg-${pos.side === 'LONG' ? 'emerald' : 'rose'}-500`} />

                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-tighter ${
                                    pos.side === 'LONG' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                                }`}>
                                    {pos.side} {pos.leverage}X
                                </span>
                                <span className="text-xs font-bold text-white/40">{pos.protocol}</span>
                            </div>
                            <h4 className="text-2xl font-black">{pos.market}</h4>
                        </div>
                        <div className="text-right">
                           <div className={`text-2xl font-black ${pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {pos.pnl >= 0 ? '+' : ''}${safeToFixed(pos.pnl || 0, 2)}
                           </div>
                           <div className={`text-xs font-bold ${pos.pnl >= 0 ? 'text-emerald-400/50' : 'text-rose-400/50'}`}>
                                {safeToFixed(pos.pnlPercent || 0, 2)}%
                           </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 relative z-10">
                        <div>
                            <p className="text-[10px] text-white/30 font-bold uppercase mb-1">Size</p>
                            <p className="text-sm font-bold">{pos.size} ETH</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-white/30 font-bold uppercase mb-1">Entry</p>
                            <p className="text-sm font-bold">${safeToLocaleString(pos.entryPrice)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-rose-500/50 font-bold uppercase mb-1">Liq. Price</p>
                            <p className="text-sm font-bold text-rose-400">${safeToLocaleString(pos.liquidationPrice)}</p>
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}


