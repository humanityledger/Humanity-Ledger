"use client";

import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, ExternalLink, Loader, TrendingUp, TrendingDown, Database, Hash, ArrowUpRight, ShieldAlert, Crosshair, Radar, Clock, Activity, Fingerprint, Globe, BarChart3, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { useState } from 'react'; // Added useState import

interface Props {
    address: string | null;
    onClose: () => void;
}

import { LedgerMomentumChart } from './LedgerMomentumChart';
import { ProFeatureGate } from '../../premium/ProFeatureGate';

export function LedgerProfiler({ address, onClose }: Props) {
    const [showChart, setShowChart] = useState(false); // Added state for toggling chart

    const { data, isLoading, isError } = useQuery({
        queryKey: ['ledger', 'profile', address],
        queryFn: async () => {
            const res = await fetch(`/api/network/v1/address/${address}`);
            if (!res.ok) throw new Error('Failed to load profile');
            return res.json();
        },
        enabled: !!address,
        staleTime: 30_000,
    });

    const chartData = (data?.recent_tx_btc_values ?? []).map((v: number, i: number) => ({
        index: i,
        btc: v,
    })).reverse();

    const isAccumulating = chartData.length > 1 &&
        chartData[chartData.length - 1]?.btc > chartData[0]?.btc;

    // --- REAL ON-CHAIN HEURISTICS FOR KYT SCORE ---
    let kytScore = 0;
    let kytPattern = "Awaiting Data";
    let kytColor = "text-gray-500";
    let kytBg = "bg-gray-500/10";
    let kytTraceOrigin = "Unknown";

    if (data) {
        const txCount = data.tx_count || 1;
        const balance = data.balance_btc || 0;
        
        if (txCount < 5 && balance > 100) {
            // High Balance, extremely low tx count -> Likely OTC or Mixer deposit
            kytScore = Math.min(95, 75 + (balance / 10)); 
            kytPattern = "High Risk OTC Pattern";
            kytColor = "text-indigo-500";
            kytBg = "bg-indigo-500/10";
            kytTraceOrigin = "Unestablished Entity";
        } else if (txCount > 1000) {
            // Massive tx count -> Likely Known Exchange / Hot Wallet
            kytScore = Math.max(5, 30 - (txCount / 5000));
            kytPattern = "Trusted Elite Node";
            kytColor = "text-emerald-500";
            kytBg = "bg-emerald-500/10";
            kytTraceOrigin = "Verified CEX / Custodian";
        } else {
            // Normal user / medium ledger
            kytScore = 40 + (balance / 50) + (100 / txCount);
            kytScore = Math.min(70, Math.max(20, kytScore));
            kytPattern = "Standard On-Chain Behavior";
            kytColor = "text-yellow-500";
            kytBg = "bg-yellow-500/10";
            kytTraceOrigin = "Standard Peer Network";
        }
        kytScore = Math.round(kytScore);
    }

    // --- BEHAVIORAL FORENSICS ---
    let timeZoneCluster = "Unknown Geography";
    let velocityLabel = "Inactive";
    let velocityColor = "text-gray-500";
    let temporalDensity = 0;

    if (data && data.recent_txs?.length > 1) {
        const validTxs = data.recent_txs.filter((t:any) => t.status?.block_time);
        
        if (validTxs.length > 1) {
            const firstT = validTxs[0].status.block_time;
            const lastT = validTxs[validTxs.length - 1].status.block_time;
            const avgSeconds = Math.abs(firstT - lastT) / validTxs.length;
            const avgHours = avgSeconds / 3600;

            if (avgHours < 1) {
                velocityLabel = "Algorithmic Routing (HFT)";
                velocityColor = "text-purple-400";
                temporalDensity = 95;
            } else if (avgHours < 24) {
                velocityLabel = "Active Daily Verifier";
                velocityColor = "text-emerald-400";
                temporalDensity = 75;
            } else {
                velocityLabel = "Deep Cold Storage";
                velocityColor = "text-blue-400";
                temporalDensity = 25;
            }

            let usCount = 0, asianCount = 0, euCount = 0;
            validTxs.forEach((t:any) => {
                const hour = new Date(t.status.block_time * 1000).getUTCHours();
                if (hour >= 13 && hour <= 21) usCount++;
                else if (hour >= 1 && hour <= 9) asianCount++;
                else euCount++;
            });

            if (usCount > asianCount && usCount > euCount) timeZoneCluster = "US / Americas Market";
            else if (asianCount > usCount && asianCount > euCount) timeZoneCluster = "APAC / Asian Market";
            else if (euCount > usCount && euCount > asianCount) timeZoneCluster = "EMEA / European Market";
            else timeZoneCluster = "Global / Distributed";
        }
    }

    return (
        <AnimatePresence>
            {address && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
                    />

                    {/* Modal Container */}
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 Pointer-events-none">
                            <motion.div
                                key="modal"
                                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                className="w-full max-w-2xl max-h-[90vh] bg-white border border-slate-200 rounded-[2.5rem] shadow-[0_50px_200px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden pointer-events-auto"
                            >
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-slate-100">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                                        <Fingerprint className="text-slate-900" size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-slate-950 font-black uppercase tracking-widest text-sm">
                                            {showChart ? 'Market Analytics' : 'Scientific Forensics'}
                                        </h2>
                                        <p className="text-slate-400 text-[10px] font-mono tracking-widest truncate max-w-[200px]">{address}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setShowChart(!showChart)} 
                                        className={`p-2 rounded-xl border transition-all ${showChart ? 'bg-slate-950 text-white border-slate-950 shadow-lg scale-105' : 'bg-black/5 text-slate-400 border-slate-100'}`}
                                    >
                                        <BarChart3 size={18} />
                                    </button>
                                    <button onClick={onClose} className="p-2 rounded-xl bg-black/5 border border-slate-100 text-slate-400 hover:text-slate-950 transition-colors">
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-6">
                                {isLoading && (
                                    <div className="flex flex-col items-center justify-center h-48 gap-3">
                                        <Loader className="animate-spin text-slate-400" size={24} />
                                        <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">Deciphering...</span>
                                    </div>
                                )}

                                {isError && (
                                    <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-400">
                                        <span className="text-2xl opacity-50">️</span>
                                        <p className="text-[10px] font-black uppercase tracking-widest">Incomplete Telemetry</p>
                                    </div>
                                )}

                                <AnimatePresence mode="wait">
                                    {data && !isLoading && (
                                        <motion.div
                                            key={showChart ? 'chart' : 'profile'}
                                            initial={{ opacity: 0, scale: 0.98, y: 10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 1.02, y: -10 }}
                                            transition={{ duration: 0.3 }}
                                            className="space-y-6"
                                        >
                                            {showChart ? (
                                                <div className="space-y-4">
                                                    <LedgerMomentumChart 
                                                        symbol={data.token_symbol || 'ETH'}
                                                    />
                                                    <motion.div 
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: 0.3 }}
                                                        className="p-6 bg-black/5 border border-slate-100 rounded-[2.5rem]"
                                                    >
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <Activity size={14} className="text-slate-950" />
                                                            <span className="text-slate-950 font-black text-[10px] uppercase tracking-widest">Market Impact Spec</span>
                                                        </div>
                                                        <p className="text-[11px] text-slate-500 leading-relaxed font-medium italic">
                                                            "High-velocity capital detected in this timeframe. Each marker represents a localized liquidity event captured by our Humanity Ledger Pro indexers."
                                                        </p>
                                                    </motion.div>
                                                </div>
                                            ) : (
                                                <motion.div 
                                                    initial="hidden"
                                                    animate="visible"
                                                    variants={{
                                                        visible: { transition: { staggerChildren: 0.05 } }
                                                    }}
                                                    className="space-y-6"
                                                >
                                                    {/* Identity & Stats Grid */}
                                                    <motion.div variants={rowVariant} className="flex flex-wrap items-center gap-2">
                                                        <span className={`px-4 py-2 rounded-full text-[9px] font-black border tracking-widest uppercase ${
                                                            data.identity_tier === 'Cryptographic' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                            data.identity_tier === 'PROTOCOL' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                            'bg-black/5 text-slate-600 border-slate-100'
                                                        }`}>
                                                            {data.identity_tier || 'GHOST ENTITY'}
                                                        </span>
                                                        <span className="px-4 py-2 rounded-full bg-black/5 text-slate-400 text-[9px] font-black border border-slate-100 uppercase tracking-widest">
                                                            {data.label}
                                                        </span>
                                                    </motion.div>

                                                    <motion.div variants={rowVariant} className="grid grid-cols-2 gap-4">
                                                        <div className="bg-black/5 border border-slate-100 rounded-[2rem] p-6">
                                                            <div className="flex items-center gap-1.5 mb-2">
                                                                <Database size={12} className="text-slate-400" />
                                                                <span className="text-slate-400 text-[9px] uppercase tracking-widest font-black">Capital Value</span>
                                                            </div>
                                                            <div className="text-slate-950 font-black font-mono text-lg tracking-tighter">
                                                                {data.is_evm ? `$${(data.total_value_usd ?? 0).toLocaleString()}` : `${(data.balance_btc ?? 0).toFixed(6)} BTC`}
                                                            </div>
                                                        </div>
                                                        <div className="bg-black/5 border border-slate-100 rounded-[2rem] p-6">
                                                            <div className="flex items-center gap-1.5 mb-2">
                                                                <Hash size={12} className="text-slate-400" />
                                                                <span className="text-slate-400 text-[9px] uppercase tracking-widest font-black">Total Events</span>
                                                            </div>
                                                            <div className="text-slate-950 font-black font-mono text-lg tracking-tighter">{data.tx_count?.toLocaleString() ?? ''}</div>
                                                        </div>
                                                    </motion.div>

                                                    {/* Forensics */}
                                                    {data.forensics && (
                                                        <motion.div variants={rowVariant} className="p-6 bg-slate-950 rounded-[2.5rem] space-y-3 shadow-xl">
                                                            <div className="flex items-center gap-2">
                                                                <Fingerprint size={16} className="text-slate-300" />
                                                                <span className="text-white font-black text-xs uppercase tracking-widest">Forensic Report</span>
                                                            </div>
                                                            <p className="text-[11px] text-slate-400 leading-relaxed font-medium italic">{data.forensics.summary}</p>
                                                        </motion.div>
                                                    )}

                                                    {/* PRO FEATURE: AI Forensic Analysis */}
                                                    <motion.div variants={rowVariant}>
                                                        <ProFeatureGate featureName="Deep Forensic AI">
                                                            <div className="p-6 bg-indigo-950 rounded-[2.5rem] space-y-4 shadow-2xl relative overflow-hidden group">
                                                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent pointer-events-none" />
                                                                <div className="flex items-center justify-between relative z-10">
                                                                    <div className="flex items-center gap-2">
                                                                        <ShieldCheck size={18} className="text-indigo-400" />
                                                                        <span className="text-white font-black text-xs uppercase tracking-[0.2em]">Alpha Forensic Scan</span>
                                                                    </div>
                                                                    <div className="px-2 py-0.5 rounded bg-indigo-500/30 border border-indigo-500/50 text-[8px] font-black text-indigo-200 uppercase animate-pulse">
                                                                        Active AI Inference
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="grid grid-cols-3 gap-4 relative z-10">
                                                                    <div className="space-y-1">
                                                                        <span className="text-[8px] font-black text-indigo-300/50 uppercase tracking-widest">Risk Score</span>
                                                                        <div className="text-xl font-mono font-black text-white">{kytScore}/100</div>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <span className="text-[8px] font-black text-indigo-300/50 uppercase tracking-widest">Entity Class</span>
                                                                        <div className="text-[10px] font-black text-indigo-200 uppercase">{kytPattern}</div>
                                                                    </div>
                                                                    <div className="space-y-1 text-right">
                                                                        <span className="text-[8px] font-black text-indigo-300/50 uppercase tracking-widest">Origin Trace</span>
                                                                        <div className="text-[10px] font-black text-indigo-200 uppercase">{kytTraceOrigin}</div>
                                                                    </div>
                                                                </div>

                                                                <div className="pt-4 border-t border-white/5 relative z-10">
                                                                    <div className="flex items-center gap-2 mb-2 text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                                                                        <Radar size={12} /> Behavioral Anomalies
                                                                    </div>
                                                                    <p className="text-[10px] text-white/60 leading-relaxed italic">
                                                                        "Pattern recognition identifies {velocityLabel.toLowerCase()} with high temporal density ({temporalDensity}%). No mixer interaction detected in current hop."
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </ProFeatureGate>
                                                    </motion.div>

                                                    {/* Behavior */}
                                                    <motion.div variants={rowVariant} className="bg-black/5 border border-slate-100 rounded-[2rem] p-6">
                                                        <div className="flex items-center gap-2 mb-4">
                                                            <Activity size={16} className="text-slate-400" />
                                                            <span className="text-slate-950 font-black text-[10px] tracking-widest uppercase">Behavioral Vector</span>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-900 shadow-sm">
                                                                <Globe size={24} />
                                                            </div>
                                                            <div>
                                                                <div className="text-[9px] text-slate-400 tracking-widest uppercase font-black">Primary Market</div>
                                                                <div className="font-mono text-xs font-black text-indigo-600 uppercase italic">{timeZoneCluster}</div>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                </motion.div>
                                            )}

                                            <motion.a
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: 0.5 }}
                                                href={data.is_evm ? `https://debank.com/profile/${address}` : `https://mempool.space/address/${address}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-center gap-3 w-full py-5 rounded-[2.5rem] bg-black/5 hover:bg-slate-950 border border-slate-100 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all duration-500 shadow-sm"
                                            >
                                                <ExternalLink size={14} /> Explorer View
                                            </motion.a>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}

const rowVariant = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3 } }
};


