"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellOff, BellRing, Sliders, X, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { HumanityLedger } from '@/hooks/useLedgerFeed';
import Link from 'next/link';
import { toast } from 'sonner';

interface Props {
    alerts: HumanityLedger[];
    threshold: number;
    onThresholdChange: (v: number) => void;
}

const SEVERITY_COLORS: Record<string, string> = {
    low: 'text-emerald-400 border-[#25D366]/20 bg-[#25D366]/5',
    medium: 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5',
    high: 'text-orange-400 border-orange-500/20 bg-orange-500/5',
    critical: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5',
};

export function HumanityLedgers({ alerts, threshold, onThresholdChange }: Props) {
    const [showSettings, setShowSettings] = useState(false);
    const [inputVal, setInputVal] = useState(String(threshold));

    // Update inputVal when prop threshold changes (on first load or remote sync)
    useEffect(() => {
        setInputVal(String(threshold));
    }, [threshold]);
    const [localAlerts, setLocalAlerts] = useState<HumanityLedger[]>(alerts);
    const prevAlertsRef = useRef<Set<string>>(new Set(alerts.map(a => a.id)));
    const [muted, setMuted] = useState(false);

    // Merge new alerts and fire toasts
    useEffect(() => {
        const newOnes = alerts.filter(a => !prevAlertsRef.current.has(a.id));
        if (newOnes.length > 0 && !muted) {
            newOnes.forEach(a => {
                toast.custom(() => (
                    <motion.div
                        initial={{ x: 60, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#12121a] border border-indigo-500/30 shadow-2xl shadow-indigo-500/10 text-white max-w-xs"
                    >
                        <span className="text-2xl"></span>
                        <div>
                            <div className="font-bold text-red-300 text-sm">Humanity Ledger!</div>
                            <div className="text-xs text-gray-400">{a.btcAmount.toFixed(2)} BTC detected</div>
                        </div>
                    </motion.div>
                ));
                prevAlertsRef.current.add(a.id);
            });
            setLocalAlerts(prev => [...newOnes, ...prev].slice(0, 30));
        }
    }, [alerts, muted]);

    const dismissAlert = (id: string) => {
        setLocalAlerts(prev => prev.filter(a => a.id !== id));
    };

    const unread = localAlerts.filter(a => !a.read).length;

    return (
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 flex flex-col gap-5 h-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <BellRing className="text-yellow-400" size={22} />
                        {unread > 0 && (
                            <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                                {unread > 9 ? '9+' : unread}
                            </span>
                        )}
                    </div>
                    <h2 className="text-white font-bold text-lg">Humanity Ledgers</h2>
                    <span className="text-[10px] font-black bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full border border-yellow-500/30 ml-1">LIVE</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setMuted(m => !m)}
                        title={muted ? 'Unmute alerts' : 'Mute alerts'}
                        className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    >
                        {muted ? <BellOff size={16} /> : <Bell size={16} />}
                    </button>
                    <button
                        onClick={() => setShowSettings(s => !s)}
                        className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    >
                        <Sliders size={16} />
                    </button>
                </div>
            </div>

            {/* Settings Panel */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="bg-white/5 rounded-2xl p-4 space-y-3">
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Alert Threshold</p>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    min={1}
                                    value={inputVal}
                                    onChange={e => setInputVal(e.target.value)}
                                    className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-yellow-500/50"
                                />
                                <span className="text-gray-400 text-sm font-mono">BTC</span>
                                <button
                                    onClick={() => {
                                        const v = parseFloat(inputVal);
                                        if (!isNaN(v) && v > 0) onThresholdChange(v);
                                        setShowSettings(false);
                                    }}
                                    className="px-3 py-2 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-xs font-bold border border-yellow-500/30 transition-colors"
                                >
                                    Set
                                </button>
                            </div>
                            <p className="text-[11px] text-gray-600">
                                Currently alerting on transactions  <span className="text-yellow-400 font-mono">{threshold} BTC</span>
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Alert List */}
            <div className="flex-1 space-y-2 overflow-y-auto min-h-0 pr-1">
                <AnimatePresence mode="popLayout">
                    {localAlerts.length === 0 ? (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center h-32 text-gray-600 gap-2"
                        >
                            <Bell size={28} className="opacity-40" />
                            <p className="text-sm">No alerts yet  monitoring mempool...</p>
                        </motion.div>
                    ) : localAlerts.map((alert, i) => (
                        <motion.div
                            key={alert.id}
                            layout
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ delay: i * 0.03 }}
                            className={`flex flex-col gap-3 border rounded-2xl p-4 group transition-all hover:bg-white/[0.02] ${
                                alert.btcAmount > 1000 ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-yellow-500/5 border-yellow-500/15'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl shrink-0"></span>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                                        alert.btcAmount > 1000 ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                                    }`}>
                                        {alert.tier || 'LEDGER'}
                                    </span>
                                </div>
                                <div className="text-[10px] text-gray-600 font-mono">
                                    {formatDistanceToNow(alert.timestamp, { addSuffix: true })}
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-white font-black text-lg font-mono">
                                            {alert.btcAmount.toFixed(2)}
                                        </span>
                                        <span className="text-gray-500 text-xs font-bold">{alert.asset || 'BTC'}</span>
                                    </div>
                                    <div className="text-gray-400 text-xs font-mono">
                                         ${((alert.btcValueUsd || alert.btcAmount * 60000) / 1000000).toFixed(2)}M USD
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Link 
                                        href={`/network/tx/${alert.txid}`} 
                                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white transition-all"
                                        title="Deep Dive View"
                                    >
                                        <ChevronRight size={16} />
                                    </Link>
                                    <button 
                                        onClick={() => dismissAlert(alert.id)} 
                                        className="p-2 rounded-xl bg-white/5 hover:bg-indigo-500/20 text-gray-500 hover:text-indigo-400 transition-all"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                                <Link href={`/network/tx/${alert.txid}`} className="text-emerald-400/60 text-[10px] font-mono hover:text-emerald-400 truncate max-w-[140px]">
                                    {alert.txid}
                                </Link>
                                <span className="text-[9px] text-gray-600 uppercase tracking-tighter">Settlement Confirmed</span>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}


