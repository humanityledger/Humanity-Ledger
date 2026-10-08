"use client";

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Waves, Bell, Activity, ShieldCheck, Zap } from 'lucide-react';
import useSWR from 'swr';
import { useAuth } from '@/hooks/useAuth';
import { useVIPStore, LedgerEvent } from '@/lib/vip-store';
import { ledgerAudio } from '@/lib/utils/LedgerAudio';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function MinimalDarkPool() {
    const { isAuthenticated } = useAuth();
    const { mergeLedgerEvents, ledgerEvents } = useVIPStore();
    const [audioInitialized, setAudioInitialized] = useState(false);
    const lastEventId = useRef<string | null>(null);

    // Fetch the latest global ledger events
    // Polling every 5 seconds to get the newest ledgers
    const { data } = useSWR('/api/network/ledger/alpha-events', fetcher, {
        refreshInterval: 5000,
        revalidateOnFocus: true,
    });

    // Handle new incoming events and audio triggers
    useEffect(() => {
        if (data && data.events && data.events.length > 0) {
            mergeLedgerEvents(data.events);

            // Audio Logic: Determine if there is a NEW event we haven't seen yet
            const newestEvent = data.events[0];
            
            if (audioInitialized && lastEventId.current && newestEvent.id !== lastEventId.current) {
                // We have a new event! Check if it's a MEGA ledger for the deep sonar
                if (newestEvent.rawUsd >= 5_000_000) {
                    ledgerAudio?.playLedgerSonar(1.5); // Deep loud pulse
                } else if (newestEvent.rawUsd >= 1_000_000) {
                    ledgerAudio?.playLedgerSonar(0.8); // Standard pulse
                } else {
                    ledgerAudio?.playSubtleBlip(); // Elite transfer
                }
            }
            
            lastEventId.current = newestEvent.id;
        }
    }, [data, mergeLedgerEvents, audioInitialized]);

    // Browser Autoplay Policy requires first interaction to enable AudioContext
    const handleInitializeAudio = () => {
        if (!audioInitialized) {
            ledgerAudio?.playSubtleBlip();
            setAudioInitialized(true);
        }
    };

    return (
        <div 
            className="w-full h-full min-h-[500px] bg-black rounded-[2.5rem] border border-white/5 p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col font-mono relative overflow-hidden group"
            onClick={handleInitializeAudio}
        >
            {/* Background Radar Effect */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-[#25D366]/30 animate-[spin_8s_linear_infinite]">
                    <div className="w-1/2 h-[2px] bg-gradient-to-r from-transparent to-emerald-400 origin-left" />
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-[#25D366]/20 shadow-[0_0_50px_rgba(59,130,246,0.1)]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] rounded-full border border-[#25D366]/20 shadow-[0_0_50px_rgba(59,130,246,0.1)] animate-ping" />
            </div>

            {/* Header */}
            <div className="relative z-10 flex justify-between items-center mb-8 border-b border-white/10 pb-6">
                <div>
                    <h2 className="text-white text-2xl font-black tracking-widest uppercase flex items-center gap-3">
                        <Waves className="text-[#25D366]" size={28} />
                        Active Dark Pool
                    </h2>
                    <p className="text-[#25D366]/50 text-xs mt-1 tracking-[0.2em] uppercase">On-Chain Entity Analytics</p>
                </div>
                <div className="flex items-center gap-4">
                    {!audioInitialized ? (
                        <button 
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 text-emerald-400 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-600/30 transition-colors animate-pulse border border-[#25D366]/30"
                        >
                            <Bell size={14} /> Enable Sonar
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 rounded-xl text-xs font-bold uppercase tracking-widest border border-green-500/20">
                            <Activity size={14} className="animate-pulse" /> Sonar Active
                        </div>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="relative z-10 flex-1 overflow-y-auto pr-4 space-y-3 custom-scrollbar">
                {ledgerEvents.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-[#25D366]/50 space-y-6">
                        <div className="relative">
                            <div className="absolute inset-0 bg-[#25D366]/20 blur-xl rounded-full animate-pulse" />
                            <Activity size={64} className="relative animate-bounce text-emerald-400" />
                        </div>
                        <span className="text-sm font-bold tracking-[0.3em] uppercase animate-pulse">Scanning Deep Network...</span>
                        <span className="text-[10px] text-white/30 uppercase tracking-widest max-w-[200px] text-center leading-relaxed">Awaiting Elite transfers exceeding $500k USD.</span>
                    </div>
                ) : (
                    <AnimatePresence>
                        {ledgerEvents.map((event, index) => (
                            <MinimalLedgerRow key={event.id} event={event} isNew={index === 0} />
                        ))}
                    </AnimatePresence>
                )}
            </div>
            
             <div className="relative z-10 mt-6 pt-4 border-t border-white/10 flex justify-between items-center text-[10px] text-white/40 uppercase tracking-widest">
                <span>Persistencia: Temporal (Desde Registro)</span>
                <span>Umbral: &gt; $500k USD</span>
            </div>
        </div>
    );
}

function MinimalLedgerRow({ event, isNew }: { event: LedgerEvent, isNew: boolean }) {
    const eventAny = event as any;
    return (
        <motion.div
            initial={{ opacity: 0, x: -20, backgroundColor: 'rgba(59, 130, 246, 0.2)' }}
            animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(255, 255, 255, 0.02)' }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5 }}
            className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${isNew ? 'border-[#25D366]/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'border-white/5 hover:border-white/20'}`}
        >
            <div className="flex items-center gap-6 w-1/3">
                <div className={`w-2 h-2 rounded-full ${eventAny.rawUsd >= 5000000 ? 'bg-purple-500' : 'bg-[#25D366]'}`} />
                <div>
                    <div className="text-white font-bold flex items-center gap-2">
                        {event.wallet}
                        {event.tier === 'MEGA LEDGER' && <Zap size={12} className="text-purple-400 fill-purple-400" />}
                    </div>
                    <div className="text-white/40 text-[10px] uppercase tracking-widest mt-1">Entity {event.hash?.slice(0,6)}</div>
                </div>
            </div>

            <div className="w-1/3 text-center">
                <div className="text-white/80 font-bold">{event.amount} <span className="text-white/40">{event.token}</span></div>
                <div className="text-emerald-400/70 text-xs mt-0.5">{event.action}</div>
            </div>

            <div className="w-1/3 flex flex-col items-end">
                <div className="text-lg font-black text-white tracking-tight">{event.usdValue}</div>
                <div className="flex items-center gap-1 text-white/30 text-[10px] uppercase tracking-widest mt-1">
                    <ShieldCheck size={10} className="text-green-500/70" />
                    Verified On-Chain
                </div>
            </div>
        </motion.div>
    );
}


