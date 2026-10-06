"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Repeat, Zap } from 'lucide-react';
import SwapInterface from '@/components/wallet/SwapInterface';

// [LEGENDARY] Modes for specialized swap actions
export type SwapMode = 'market' | 'limit' | 'dca' | 'cross-chain';

interface SwapModalProps {
    isOpen: boolean;
    onClose: () => void;
    userAddress?: string;
    chainId?: number;
    assets?: any[];
    initialMode?: SwapMode;
}

export default function SwapModal({ isOpen, onClose, userAddress = '', chainId = 1, assets = [], initialMode = 'market' }: SwapModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-xl bg-[#EAEADF] rounded-[40px] p-2 border-4 border-[#1F1F1F] shadow-[12px_12px_0px_0px_#1F1F1F]"
                    >
                        <button 
                            onClick={onClose} 
                            className="absolute top-6 right-8 z-50 p-2 rounded-full hover:bg-black/5 transition-colors"
                        >
                            <X size={24} className="text-[#1F1F1F]" />
                        </button>
 
                        <div className="p-4 pt-12">
                             {/* Mode Indicators */}
                             {initialMode === 'limit' && (
                                 <div className="flex items-center gap-2 mb-4 px-4 py-2 bg-purple-100 rounded-xl border border-purple-200 text-purple-700">
                                     <Clock size={16} />
                                     <span className="text-xs font-black uppercase tracking-widest">Limit Order Mode</span>
                                 </div>
                             )}
                             {initialMode === 'dca' && (
                                 <div className="flex items-center gap-2 mb-4 px-4 py-2 bg-blue-100 rounded-xl border border-blue-200 text-blue-700">
                                     <Repeat size={16} />
                                     <span className="text-xs font-black uppercase tracking-widest">DCA Strategy</span>
                                 </div>
                             )}
                             {initialMode === 'cross-chain' && (
                                 <div className="flex items-center gap-2 mb-4 px-4 py-2 bg-orange-100 rounded-xl border border-orange-200 text-orange-700">
                                     <Zap size={16} />
                                     <span className="text-xs font-black uppercase tracking-widest">Cross-Chain Router</span>
                                 </div>
                             )}

                            <SwapInterface 
                                userAddress={userAddress}
                                chainId={chainId}
                                assets={assets}
                                onSwap={(tx) => {
                                    console.log("Swap initiated:", tx);
                                    // Additional success handling if needed
                                }} 
                            />
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}



