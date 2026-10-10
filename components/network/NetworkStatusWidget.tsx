"use client";

import { useQuery } from '@tanstack/react-query';
import { Globe, Zap, Box, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

export function NetworkStatusWidget() {
    const [isHovered, setIsHovered] = useState(false);

    const { data: fees } = useQuery({
        queryKey: ['network', 'fees', 'mini'],
        queryFn: async () => {
            const res = await fetch('/api/network/v1/fees/recommended');
            if (!res.ok) throw new Error('Failed to fetch fees');
            return res.json();
        },
        refetchInterval: 15000,
    });

    const { data: blocks } = useQuery({
        queryKey: ['network', 'blocks', 'latest', 'mini'],
        queryFn: async () => {
            const res = await fetch('/api/network/v1/blocks');
            if (!res.ok) throw new Error('Failed to fetch blocks');
            return res.json();
        },
        refetchInterval: 60000,
    });

    const latestBlock = blocks?.[0];

    return (
        <div 
            className="relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <Link href="/ledger">
                <motion.div 
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-premium border border-white/10 hover:border-[#25D366]/50 transition-all cursor-pointer group"
                    whileHover={{ scale: 1.02 }}
                >
                    <div className="relative">
                        <Globe size={14} className="text-emerald-400 group-hover:rotate-12 transition-transform" />
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse border border-[#0D0D12]" />
                    </div>
                    
                    <div className="flex items-center gap-3 text-[11px] font-medium text-white/70">
                        <div className="flex items-center gap-1">
                            <Box size={12} className="text-gray-500" />
                            <span className="font-mono text-white">
                                {latestBlock ? `#${Number(latestBlock.height).toLocaleString()}` : '...'}
                            </span>
                        </div>
                        
                        <div className="h-3 w-[1px] bg-white/10" />
                        
                        <div className="flex items-center gap-1">
                            <Zap size={12} className="text-yellow-500" />
                            <span className="font-mono text-white">
                                {fees?.fastestFee ?? '...'} <span className="text-[9px] text-gray-500">sat/vB</span>
                            </span>
                        </div>
                    </div>
                </motion.div>
            </Link>

            <AnimatePresence>
                {isHovered && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full mt-2 right-0 w-64 glass-premium border border-white/10 p-4 rounded-2xl shadow-2xl z-[100] pointer-events-none"
                    >
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-400">Network Condition</span>
                                <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Optimal</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <span className="text-[10px] text-gray-500 uppercase">Mempool</span>
                                    <div className="text-sm font-bold text-white font-mono">2,481 txs</div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] text-gray-500 uppercase">Hashrate</span>
                                    <div className="text-sm font-bold text-white font-mono">612 EH/s</div>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-white/5 flex items-center justify-between group/link">
                                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-tighter cursor-pointer">Explorer Full Access</span>
                                <Globe size={12} className="text-emerald-400 group-hover/link:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}


