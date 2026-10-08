"use client";

import React from 'react';
import { Gift, ExternalLink, ArrowRight, Sparkles } from 'lucide-react';
import { ClaimableAsset } from '@/types/wallet';
import { motion } from 'framer-motion';

import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';
interface ClaimablesTabProps {
    claimables: ClaimableAsset[];
    isLoading?: boolean;
}

export default function ClaimablesTab({ claimables, isLoading }: ClaimablesTabProps) {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Gift size={40} className="text-neutral-300 animate-bounce mb-4" />
                <p className="text-neutral-500 font-bold">Scanning for Rewards...</p>
            </div>
        );
    }

    if (claimables.length === 0) {
        return (
            <div className="text-center py-16 text-neutral-400 text-sm">
                <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4 text-neutral-300">
                    <Gift size={24} />
                </div>
                <p className="font-medium">No claimable rewards found.</p>
                <button className="mt-4 text-emerald-600 hover:text-emerald-700 font-bold hover:underline">Check Airdrops</button>
            </div>
        );
    }

    return (
        <div className="space-y-3 px-4">
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white">
                    <Sparkles size={20} />
                </div>
                <div>
                   <p className="text-xs font-black text-emerald-900 uppercase tracking-tighter">Instant Discovery</p>
                   <p className="text-sm font-bold text-emerald-700">You have {claimables.length} rewards ready to claim.</p>
                </div>
            </div>

            {claimables.map((item, idx) => (
                <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center justify-between p-5 bg-white border border-neutral-100 rounded-3xl hover:shadow-lg transition-all"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-neutral-900 flex items-center justify-center text-white font-black overflow-hidden relative">
                            {item.protocol[0]}
                        </div>
                        <div>
                            <div className="font-black text-neutral-900">{item.name}</div>
                            <div className="text-xs text-neutral-500 font-bold flex items-center gap-1">
                                {item.protocol}  <span className="text-emerald-600">{item.type}</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                        <div>
                            <div className="font-black text-neutral-900">{item.amount}</div>
                            <div className="text-xs text-emerald-600 font-black">${safeToFixed(item.valueUSD, 2)}</div>
                        </div>
                        <button className="w-10 h-10 bg-neutral-100 hover:bg-neutral-900 hover:text-white rounded-full flex items-center justify-center transition-colors">
                            <ArrowRight size={18} />
                        </button>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}


