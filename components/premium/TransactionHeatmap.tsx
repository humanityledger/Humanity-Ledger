"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface TransactionHeatmapProps {
    data: Record<string, number>; // date -> count
}

/**
 * TransactionHeatmap
 * Celestial-grade visualization of transaction density.
 * Mimics GitHub's contribution graph but with a premium financial aesthetic.
 */
export const TransactionHeatmap: React.FC<TransactionHeatmapProps> = ({ data }) => {
    // Generate last 365 days
    const days: { date: string; count: number }[] = [];
    const today = new Date();
    for (let i = 364; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        days.push({
            date: dateStr,
            count: data[dateStr] || 0
        });
    }

    const getColor = (count: number) => {
        if (count === 0) return 'bg-white/5';
        if (count < 5) return 'bg-emerald-400/30';
        if (count < 10) return 'bg-emerald-400/50';
        if (count < 20) return 'bg-emerald-400/70';
        return 'bg-emerald-400';
    };

    return (
        <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
            <div className="flex gap-1 min-w-max">
                {/* Simplified layout: 52 columns of 7 squares */}
                {Array.from({ length: 52 }).map((_idx, weekIdx) => (
                    <div key={weekIdx} className="flex flex-col gap-1">
                        {Array.from({ length: 7 }).map((_idx, dayIdx) => {
                            const dataIdx = weekIdx * 7 + dayIdx;
                            const day = days[dataIdx];
                            if (!day) return null;

                            return (
                                <motion.div
                                    key={day.date}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: dataIdx * 0.001 }}
                                    className={`w-3 h-3 rounded-sm ${getColor(day.count)} cursor-help transition-all hover:scale-125 hover:shadow-[0_0_10px_rgba(96,165,250,0.5)]`}
                                    title={`${day.date}: ${day.count} txs`}
                                />
                            );
                        })}
                    </div>
                ))}
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-white/40 uppercase tracking-widest">
                <span>1 Year History</span>
                <div className="flex gap-1 items-center">
                    <span>Less</span>
                    <div className="w-2 h-2 bg-white/5 rounded-sm" />
                    <div className="w-2 h-2 bg-emerald-400/30 rounded-sm" />
                    <div className="w-2 h-2 bg-emerald-400/50 rounded-sm" />
                    <div className="w-2 h-2 bg-emerald-400/70 rounded-sm" />
                    <div className="w-2 h-2 bg-emerald-400 rounded-sm" />
                    <span>More</span>
                </div>
            </div>
        </div>
    );
};


