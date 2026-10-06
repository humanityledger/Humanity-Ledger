"use client";

import React from 'react';
import { ExternalLink, TrendingUp, TrendingDown, Clock, Activity } from 'lucide-react';
import { PredictionPosition } from '@/types/wallet';
import { motion } from 'framer-motion';

interface PredictionsTabProps {
    predictions: PredictionPosition[];
    isLoading?: boolean;
}

export default function PredictionsTab({ predictions, isLoading }: PredictionsTabProps) {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                <Activity size={40} className="text-neutral-300 mb-4 animate-spin" />
                <p className="text-neutral-500 font-bold">Analizing Markets...</p>
            </div>
        );
    }

    if (predictions.length === 0) {
        return (
            <div className="text-center py-16 text-neutral-400 text-sm">
                <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4 text-neutral-300">
                    <TrendingUp size={24} />
                </div>
                <p className="font-medium">No open predictions found.</p>
                <button className="mt-4 text-blue-600 hover:text-blue-700 font-bold hover:underline">Explore Markets</button>
            </div>
        );
    }

    return (
        <div className="space-y-3 px-4">
            {predictions.map((pos, idx) => (
                <motion.div 
                    key={pos.id || idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white border border-neutral-200 rounded-3xl p-5 hover:shadow-xl transition-all group relative overflow-hidden"
                >
                    {/* Protocol Badge */}
                    <div className="absolute top-0 right-0 px-4 py-1.5 bg-neutral-100 rounded-bl-2xl text-[10px] font-black text-neutral-500 uppercase tracking-tighter">
                        {pos.protocol || 'Polymarket'}
                    </div>

                    <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-col gap-1 pr-12">
                            <h4 className="font-black text-base text-neutral-900 leading-tight">
                                {pos.marketTitle}
                            </h4>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${
                                    pos.outcome === 'YES' 
                                        ? 'bg-emerald-100 text-emerald-700' 
                                        : 'bg-rose-100 text-rose-700'
                                }`}>
                                    {pos.outcome}
                                </span>
                                <span className="text-[10px] text-neutral-400 font-bold flex items-center gap-1">
                                    <Clock size={10} /> {pos.category || 'Politics'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-neutral-50 rounded-2xl p-3">
                            <p className="text-[10px] text-neutral-500 font-bold uppercase mb-1">Value</p>
                            <div className="flex items-center gap-1.5">
                                <span className="font-black text-lg text-neutral-900">
                                    ${(pos.value || 0)?.toFixed(2)}
                                </span>
                            </div>
                        </div>
                        <div className="bg-neutral-50 rounded-2xl p-3">
                            <p className="text-[10px] text-neutral-500 font-bold uppercase mb-1">PnL</p>
                            <div className="flex items-center gap-1.5">
                                {pos.pnl >= 0 ? <TrendingUp size={14} className="text-emerald-500" /> : <TrendingDown size={14} className="text-rose-500" />}
                                <span className={`font-black text-lg ${pos.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {pos.pnl >= 0 ? '+' : ''}{(pos.pnl || 0)?.toFixed(2)}
                                </span>
                                <span className={`text-xs font-bold ${pos.pnl >= 0 ? 'text-emerald-600/60' : 'text-rose-600/60'}`}>
                                    ({(pos.pnlPercent || 0)?.toFixed(1)}%)
                                </span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}


