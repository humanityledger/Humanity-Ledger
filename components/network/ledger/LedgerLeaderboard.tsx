"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ChevronRight, Copy, Check, Tag, Star } from 'lucide-react';
import { useState } from 'react';
import type { LeaderboardEntry } from '@/hooks/useLedgerFeed';
import Link from 'next/link';

interface Props {
    leaderboard: LeaderboardEntry[];
    onSelectAddress: (address: string) => void;
    watchedAddresses: Set<string>;
    onToggleWatch: (address: string) => void;
}

const RANK_STYLES = [
    'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
    'text-gray-300 border-gray-500/30 bg-gray-500/10',
    'text-orange-400 border-orange-500/30 bg-orange-500/10',
];

const LABEL_COLORS: Record<string, string> = {
    'Taproot': 'text-green-400 bg-green-500/10 border-green-500/20',
    'SegWit Wallet': 'text-emerald-400 bg-[#25D366]/10 border-[#25D366]/20',
    'P2SH / Exchange': 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    'Legacy / Miner': 'text-purple-400 bg-purple-500/10 border-purple-500/20',
};

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };
    return (
        <button onClick={handleCopy} className="p-1 rounded-lg hover:bg-white/10 text-gray-600 hover:text-white transition-colors">
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
        </button>
    );
}

export function LedgerLeaderboard({ leaderboard, onSelectAddress, watchedAddresses, onToggleWatch }: Props) {
    const [expanded, setExpanded] = useState<string | null>(null);

    return (
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 flex flex-col gap-5 h-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Trophy className="text-indigo-400" size={22} />
                    <h2 className="text-white font-black tracking-widest uppercase text-sm">Ledger Leaderboard</h2>
                    <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/30 ml-1">TOP {leaderboard.length}</span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/20">sorted by net inflow (USD)</span>
            </div>

            {/* Podium (top 3) */}
            {leaderboard.length >= 3 && (
                <div className="grid grid-cols-3 gap-2">
                    {[leaderboard[1], leaderboard[0], leaderboard[2]].map((entry, podiumIdx) => {
                        const actualRank = podiumIdx === 0 ? 2 : podiumIdx === 1 ? 1 : 3;
                        const heights = ['h-16', 'h-20', 'h-14'];
                        return (
                            <motion.button
                                key={entry.address}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: podiumIdx * 0.1 }}
                                onClick={() => onSelectAddress(entry.address)}
                                className={`${heights[podiumIdx]} rounded-2xl border flex flex-col items-center justify-center gap-1 cursor-pointer hover:brightness-125 transition-all ${RANK_STYLES[podiumIdx] ?? 'text-gray-400 bg-white/5 border-white/10'}`}
                            >
                                <span className="text-lg font-black">{''[actualRank - 1]}</span>
                                <span className="text-[9px] font-black tracking-tighter opacity-70">${(entry.totalUsd / 1_000_000).toFixed(1)}M</span>
                            </motion.button>
                        );
                    })}
                </div>
            )}

            {/* Full list */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-1.5">
                <AnimatePresence mode="popLayout">
                    {leaderboard.map((entry, i) => {
                        const isExpanded = expanded === entry.address;
                        const labelColor = LABEL_COLORS[entry.label] ?? 'text-gray-400 bg-gray-500/10 border-gray-500/20';
                        
                        // Elite Rank Branding
                        const rankLabel = entry.rank <= 3 ? 'LEVIATHAN' : entry.rank <= 10 ? 'APEX PREDATOR' : 'ALPHA ENTITY';
                        const rankColor = entry.rank <= 3 ? 'text-indigo-400' : entry.rank <= 10 ? 'text-purple-400' : 'text-white/40';

                        return (
                            <motion.div
                                key={entry.address}
                                layout
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.025 }}
                                className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden"
                            >
                                <div
                                    role="button"
                                    onClick={() => setExpanded(isExpanded ? null : entry.address)}
                                    className="w-full cursor-pointer flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                                >
                                    <div className="w-24 shrink-0">
                                        <div className={`text-[8px] font-black tracking-widest uppercase ${rankColor}`}>{rankLabel}</div>
                                        <div className="text-[10px] font-black text-white/20">#{entry.rank}</div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onToggleWatch(entry.address); }}
                                                className={`transition-colors ${watchedAddresses.has(entry.address) ? 'text-yellow-400' : 'text-gray-700 hover:text-gray-400'}`}
                                            >
                                                <Star size={12} fill={watchedAddresses.has(entry.address) ? "currentColor" : "none"} />
                                            </button>
                                            <span className="font-mono text-indigo-400 text-xs truncate">{entry.address.slice(0, 12)}...{entry.address.slice(-6)}</span>
                                            <CopyButton text={entry.address} />
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${labelColor}`}>
                                                {entry.label}
                                            </span>
                                            {entry.lastChain && (
                                                <span className="text-[8px] text-white/20 font-black uppercase tracking-widest">{entry.lastChain} ACTIVE</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-white font-black tracking-tighter text-sm">${(entry.totalUsd / 1_000_000).toFixed(2)}M</div>
                                        <div className="text-white/20 text-[9px] font-black uppercase tracking-widest">{entry.txCount} INTERCEPTS</div>
                                    </div>
                                    <ChevronRight size={14} className={`text-white/10 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                                </div>

                                {/* Expanded detail */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: 'auto' }}
                                            exit={{ height: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-4 pb-3 pt-1 border-t border-white/5 flex flex-col md:flex-row md:items-center gap-4">
                                                <div className="flex-1 grid grid-cols-2 gap-4 text-[10px]">
                                                    <div>
                                                        <span className="text-white/20 font-black uppercase tracking-widest">Avg Pulse</span>
                                                        <div className="text-white font-black tracking-tight">${(entry.avgTxUsd / 1000).toFixed(1)}k USD</div>
                                                    </div>
                                                    <div>
                                                        <span className="text-white/20 font-black uppercase tracking-widest">Last Tactical Move</span>
                                                        <div className="text-indigo-400 font-bold leading-tight">{entry.lastMove || 'Routine Positioning'}</div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onSelectAddress(entry.address); }}
                                                        className="px-4 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 text-[10px] font-black uppercase tracking-widest border border-indigo-500/30 transition-colors whitespace-nowrap"
                                                    >
                                                        Analytics Profile
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {leaderboard.length === 0 && (
                    <div className="flex items-center justify-center h-24 text-gray-600 text-sm">
                        Building leaderboard...
                    </div>
                )}
            </div>
        </div>
    );
}


