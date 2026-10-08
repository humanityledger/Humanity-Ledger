"use client";

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, AlertTriangle, Zap, Info, Flame } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { LedgerSignal } from '@/hooks/useLedgerFeed';

interface Props {
    signals: LedgerSignal[];
    isFetching: boolean;
}

const SEVERITY_CONFIG = {
    critical: { border: 'border-white/10 bg-indigo-500/5', badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30', dot: 'bg-indigo-500', icon: Flame, iconColor: 'text-indigo-400' },
    high: { border: 'border-orange-500/30 bg-orange-500/5', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30', dot: 'bg-orange-500', icon: AlertTriangle, iconColor: 'text-orange-400' },
    medium: { border: 'border-yellow-500/20 bg-yellow-500/5', badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', dot: 'bg-yellow-500', icon: TrendingUp, iconColor: 'text-yellow-400' },
    low: { border: 'border-[#25D366]/20 bg-[#25D366]/5', badge: 'bg-[#25D366]/20 text-emerald-300 border-[#25D366]/30', dot: 'bg-[#25D366]', icon: Info, iconColor: 'text-emerald-400' },
};

export function LedgerSignals({ signals, isFetching }: Props) {
    return (
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 flex flex-col gap-5 h-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Zap className="text-purple-400" size={22} />
                    <h2 className="text-white font-bold text-lg">Signal Feed</h2>
                    <span className="text-[10px] font-black bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30 ml-1">AI</span>
                    {isFetching && (
                        <span className="flex h-2 w-2 ml-1">
                            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-purple-400 opacity-60" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
                        </span>
                    )}
                </div>
                <span className="text-xs text-gray-600 font-mono">{signals.length} active</span>
            </div>

            {/* Signal list */}
            <div className="flex-1 space-y-3 overflow-y-auto min-h-0 pr-1">
                {signals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-gray-600 gap-2">
                        <Zap size={28} className="opacity-30" />
                        <span className="text-sm">Analyzing mempool patterns...</span>
                    </div>
                ) : signals.map((signal, i) => {
                    const cfg = SEVERITY_CONFIG[signal.severity];
                    const Icon = cfg.icon;
                    return (
                        <motion.div
                            key={signal.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.06, duration: 0.4 }}
                            className={`rounded-2xl border p-4 space-y-2 ${cfg.border}`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="relative shrink-0">
                                        <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                                        {signal.severity === 'critical' && (
                                            <div className={`absolute inset-0 rounded-full ${cfg.dot} animate-ping opacity-60`} />
                                        )}
                                    </div>
                                    <Icon size={16} className={cfg.iconColor} />
                                    <span className="text-white font-bold text-sm leading-tight">{signal.title}</span>
                                </div>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase shrink-0 ${cfg.badge}`}>
                                    {signal.severity}
                                </span>
                            </div>
                            <p className="text-gray-400 text-xs leading-relaxed pl-4">{signal.body}</p>
                            <div className="flex items-center justify-between pl-4 pt-1">
                                <div className="flex items-center gap-3 text-[11px] text-gray-600">
                                    {signal.btcAmount > 0 && (
                                        <span className="font-mono text-gray-400">
                                            {signal.btcAmount.toFixed(0)} BTC
                                        </span>
                                    )}
                                    <span>{signal.txCount} txs</span>
                                </div>
                                <span className="text-[10px] text-gray-700">
                                    {formatDistanceToNow(signal.timestamp, { addSuffix: true })}
                                </span>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Footer disclaimer */}
            <p className="text-[10px] text-gray-700 text-center border-t border-white/5 pt-3">
                Signals are generated algorithmically from mempool patterns  not financial advice.
            </p>
        </div>
    );
}


