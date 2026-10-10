"use client";

import React, { useRef } from 'react';
import { Search, MoreVertical, CreditCard, ArrowUpRight, ArrowDownLeft, Repeat } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';

export function WalletPreview() {
    const containerRef = useRef<HTMLDivElement>(null);

    // Scroll Animation Logic
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"]
    });

    // 1. Initial State: Fully visible
    // 2. "Cover like glass": Curtain slides down [0.2 - 0.5 progress]
    // 3. "Fade away": Opacity goes to 0 [0.5 - 0.8 progress]
    
    // Glass Curtain Height (0% to 100%)
    const curtainHeight = useTransform(scrollYProgress, [0.1, 0.4], ["0%", "100%"]);
    
    // Opacity (Stays 1 until curtain is down, then fades)
    const opacity = useTransform(scrollYProgress, [0.45, 0.6], [1, 0]);
    
    // Scale (Slight shrink for effect)
    const scale = useTransform(scrollYProgress, [0.45, 0.6], [1, 0.95]);

    return (
        <motion.div 
            ref={containerRef}
            style={{ opacity, scale }}
            className="w-full max-w-lg mx-auto bg-[#8B8B83] border border-white/5 rounded-[3rem] p-8 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden relative z-20"
        >
            {/* GLASS CURTAIN OVERLAY ("Tape por partes como cristal") */}
            {/* GLASS CURTAIN OVERLAY - Modified for better readability */}
            <motion.div 
                style={{ height: curtainHeight }}
                className="absolute top-0 left-0 w-full bg-neutral-900/90 z-50 pointer-events-none border-b border-white/10 transition-all duration-300 ease-out"
            />
            {/* Header Area - CENTERED */}
            <div className="flex items-center justify-between mb-8 relative">
                <div className="flex items-center gap-2 text-white/50 bg-black/10 px-3 py-1 rounded-full text-[10px] font-mono">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
                    Mainnet
                </div>
                
                {/* Centered Title */}
                <div className="absolute left-1/2 -translate-x-1/2 text-white font-black text-2xl tracking-tight">
                    Humanity Ledger
                </div>

                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border-2 border-white/20 shadow-lg" />
            </div>

            {/* Total Balance Card - CENTERED & LARGE */}
            <div className="bg-gradient-to-b from-[#6D6D75] to-[#5A5A60] rounded-[2rem] p-10 mb-8 text-center relative shadow-inner border border-white/10">
                <div className="text-white/40 text-sm font-medium mb-4 uppercase tracking-widest">Balance Total</div>
                <div className="text-6xl font-black text-white mb-4 tracking-tighter">$24,593.00</div>
                <div className="text-green-400 font-bold font-mono flex items-center justify-center gap-2 bg-green-500/10 py-1 px-4 rounded-full w-fit mx-auto">
                    <ArrowUpRight size={16} /> +$1,240.50 (5.4%)
                </div>
                
                {/* Actions Grid - CENTERED */}
                <div className="flex justify-center gap-6 mt-10">
                    {['Buy', 'Send', 'Recv', 'Swap'].map((action, i) => (
                        <div key={action} className="flex flex-col items-center gap-3 group cursor-pointer">
                            <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/90 group-hover:bg-white/20 group-hover:scale-110 transition-all duration-300 shadow-lg backdrop-blur-sm">
                                {i === 0 && <CreditCard size={24} />}
                                {i === 1 && <ArrowUpRight size={24} />}
                                {i === 2 && <ArrowDownLeft size={24} />}
                                {i === 3 && <Repeat size={24} />}
                            </div>
                            <span className="text-[11px] font-bold text-white/40 uppercase tracking-wide group-hover:text-white/80 transition-colors">{action}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Accounts List & Search */}
            <div className="space-y-4">
                <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar cuentas..." 
                        className="w-full bg-black/5 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:bg-black/10 transition-colors placeholder:text-white/20"
                        disabled
                    />
                </div>

                {/* Mock Accounts */}
                {[
                    { name: 'Main Vault', balance: '12.5 ETH', usd: '$22,450.00', color: 'bg-[#25D366]' },
                    { name: 'Attesting Alpha', balance: '1.2 BTC', usd: '$42,100.00', color: 'bg-orange-500' },
                    { name: 'Yield Farm', balance: '5,000 USDC', usd: '$5,000.00', color: 'bg-green-500' }
                ].map((acc, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-colors cursor-pointer group border border-transparent hover:border-white/5">
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full ${acc.color} flex items-center justify-center text-xs text-white font-bold shadow-md`}>
                                {acc.name[0]}
                            </div>
                            <div>
                                <div className="text-white font-bold text-base">{acc.name}</div>
                                <div className="text-white/30 text-xs font-mono">{acc.balance}</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-white font-bold text-base">{acc.usd}</div>
                            <MoreVertical size={16} className="text-white/20 ml-auto mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}



