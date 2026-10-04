"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Network, Shield, Zap, Activity, Bot, Cpu } from 'lucide-react';

export default function AppChainStatus() {
    return (
        <div className="bg-white rounded-[2rem] p-8 border border-black/5 shadow-sm space-y-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-lg">
                        <Network className="text-white" size={24} />
                    </div>
                    <div>
                        <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-[#050505]">Human AppChain</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="w-2 h-2 rounded-full bg-black/20" />
                            <span className="text-[9px] font-black text-black/40 uppercase tracking-widest">Status: Operational</span>
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-black text-[#050505]/20 uppercase tracking-widest leading-none">Powered by</div>
                    <div className="text-xs font-bold text-[#050505] tracking-tighter mt-1">GetBlock Modular</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#FFFFFF] border border-black/5 rounded-3xl p-6 space-y-4">
                    <div className="flex items-center gap-2 opacity-40">
                        <Shield size={14} className="text-black" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-black">Consensus</span>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-black tracking-tight uppercase">Nominal</div>
                        <div className="text-[9px] font-bold text-black/30 uppercase tracking-tight">100% Synced</div>
                    </div>
                </div>

                <div className="bg-[#FFFFFF] border border-black/5 rounded-3xl p-6 space-y-4">
                    <div className="flex items-center gap-2 opacity-40">
                        <Zap size={14} className="text-black" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-black">Execution Layer</span>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-black tracking-tight">0.00ms</div>
                        <div className="text-[9px] font-bold text-black/30 uppercase tracking-tight">Latency / Optimization</div>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 space-y-4 text-white">
                    <div className="flex items-center gap-2 opacity-40">
                        <Cpu size={14} />
                        <span className="text-[9px] font-black uppercase tracking-widest">Inference Layer</span>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-white tracking-tight">Active</div>
                        <div className="text-[9px] font-bold text-white/30 uppercase tracking-tight">On-Chain Ledger</div>
                    </div>
                </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-black/5">
                <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-black/40 flex items-center gap-2">
                        <Activity size={12} className="text-black/40" /> Network Feed
                    </h4>
                </div>
                <div className="py-2 flex flex-col gap-2">
                    <SignalEntry timestamp="NOW" type="BLOCK VALIDATION" status="Verified" desc="ZERO LATENCY CONSENSUS" />
                    <SignalEntry timestamp="-12s" type="STATE TRANSITION" status="Verified" desc="ZK-ROLLUP COMMITTED" />
                    <SignalEntry timestamp="-24s" type="ORACLE PING" status="Verified" desc="PRICES SYNCHRONIZED" />
                </div>
            </div>
        </div>
    );
}

function SignalEntry({ timestamp, type, status, desc }: { timestamp: string, type: string, status: string, desc: string }) {
    return (
        <div className="flex items-center justify-between p-3 hover:bg-[#FFFFFF] rounded-2xl transition-colors group border border-transparent hover:border-black/5">
            <div className="flex items-center gap-3">
                <div className="text-[10px] font-bold text-black/10 font-mono w-12">{timestamp}</div>
                <div>
                    <div className="text-[11px] font-black text-black tracking-tight uppercase">{type}</div>
                    <div className="text-[9px] text-black/30 uppercase font-bold tracking-widest">{desc}</div>
                </div>
            </div>
            <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-black/5 text-black/40`}>
                {status}
            </div>
        </div>
    );
}

