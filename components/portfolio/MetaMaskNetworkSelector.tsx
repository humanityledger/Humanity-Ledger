"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, ChevronDown, Check } from 'lucide-react';
import { useAccount, useSwitchChain } from 'wagmi';
import { getChainLogo } from '@/lib/wallet/chains';

export function MetaMaskNetworkSelector({ activeNetworkId, onNetworkChange }: { activeNetworkId?: number, onNetworkChange?: (id: number) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [tab, setTab] = useState<'popular' | 'custom'>('popular');
    
    const { chainId } = useAccount();
    const { chains, switchChain } = useSwitchChain();
    
    const currentId = activeNetworkId || chainId || (chains.length > 0 ? chains[0].id : 1);
    const currentWagmiChain = chains.find(c => c.id === currentId);
    
    const fallbackNames: Record<number, string> = {
        1: 'Ethereum', 56: 'BNB Smart Chain', 137: 'Polygon', 8453: 'Base',
        42161: 'Arbitrum One', 10: 'OP Mainnet', 480: 'World Chain',
        59144: 'Linea', 43114: 'Avalanche Mainnet', 10143: 'Monad Mainnet', 324: 'zkSync Era',
        999001: 'Bitcoin', 999002: 'Solana', 999003: 'Tron'
    };
    
    const currentNetwork = {
        id: currentId,
        name: currentWagmiChain?.name || fallbackNames[currentId] || 'Unknown Network',
        icon: getChainLogo(currentId)
    };
    
    const popularNetworkIds = [1, 56, 137, 8453, 999002]; // added Solana
    const additionalNetworkIds = [42161, 10, 480, 59144, 43114, 10143, 324, 999001, 999003];

    const getNetworkInfo = (id: number) => {
        const wagmiChain = chains.find(c => c.id === id);
        // fallbackNames already defined above
        return { 
            id, 
            name: wagmiChain?.name || fallbackNames[id] || 'Unknown', 
            icon: getChainLogo(id) 
        };
    };
    
    const popularNetworks = popularNetworkIds.map(getNetworkInfo);
    const customNetworks = additionalNetworkIds.map(getNetworkInfo);
    
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (id: number) => {
        if (id >= 999000) {
            if (onNetworkChange) onNetworkChange(id);
            setIsOpen(false);
            return;
        }
        if (switchChain) switchChain({ chainId: id });
        if (onNetworkChange) onNetworkChange(id);
        setIsOpen(false);
    };

    return (
        <div className="relative inline-block" ref={popoverRef}>
            {/* Trigger Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-black/[0.03] hover:bg-black/[0.06] border border-black/10 px-3 py-1.5 rounded-full transition-colors"
            >
                <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center shrink-0">
                    {currentNetwork.icon ? (
                        <img src={currentNetwork.icon} alt={currentNetwork.name} className="w-full h-full object-contain" />
                    ) : (
                        <div className="w-full h-full bg-black/20" />
                    )}
                </div>
                <span className="text-[12px] font-bold text-black font-sans">{currentNetwork.name}</span>
                <ChevronDown size={14} className="text-black/50" />
            </button>

            {/* Dropdown Modal */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Mobile Backdrop */}
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/20 z-[90] sm:hidden"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Modal Content */}
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="fixed bottom-0 left-0 right-0 w-full sm:w-[320px] sm:absolute sm:bottom-auto sm:left-0 sm:right-auto sm:top-full sm:mt-2 bg-white rounded-t-[24px] sm:rounded-b-[16px] sm:rounded-t-[16px] shadow-[0_-8px_30px_rgb(0,0,0,0.12)] sm:shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-black/5 z-[100] overflow-hidden font-sans pb-6 sm:pb-0 max-h-[85vh] flex flex-col"
                        >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-4 border-b border-black/5">
                            <span className="font-bold text-sm text-black flex-1 text-center pl-6">Select network</span>
                            <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-black/5 rounded-md transition-colors">
                                <X size={16} className="text-black/50" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-black/5 px-2">
                            <button 
                                onClick={() => setTab('popular')}
                                className={`flex-1 py-3 text-[13px] font-bold transition-colors relative ${tab === 'popular' ? 'text-black' : 'text-black/50 hover:text-black/80'}`}
                            >
                                Popular
                                {tab === 'popular' && <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-blue-600 rounded-t-md" />}
                            </button>
                            <button 
                                onClick={() => setTab('custom')}
                                className={`flex-1 py-3 text-[13px] font-bold transition-colors relative ${tab === 'custom' ? 'text-black' : 'text-black/50 hover:text-black/80'}`}
                            >
                                Custom
                                {tab === 'custom' && <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-blue-600 rounded-t-md" />}
                            </button>
                        </div>

                        {/* Network List */}
                        <div className="max-h-[380px] overflow-y-auto py-2 custom-scrollbar">
                            {tab === 'popular' && (
                                <button 
                                    className="w-full flex items-center px-4 py-3 hover:bg-black/[0.03] transition-colors"
                                    onClick={() => handleSelect(1)}
                                >
                                    <div className="w-8 h-8 rounded-full border border-black/10 flex items-center justify-center mr-3 shrink-0">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                                    </div>
                                    <span className="text-[14px] font-normal text-black flex-1 text-left">All popular networks</span>
                                </button>
                            )}

                            {(tab === 'popular' ? popularNetworks : customNetworks).map(net => (
                                <button 
                                    key={net.id}
                                    onClick={() => handleSelect(net.id)}
                                    className="w-full flex items-center px-4 py-2 hover:bg-black/[0.03] transition-colors group"
                                >
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center mr-3 shrink-0 overflow-hidden">
                                        {net.icon ? (
                                            <img src={net.icon} alt={net.name} className="w-full h-full object-contain" />
                                        ) : (
                                            <div className="w-full h-full bg-black/10" />
                                        )}
                                    </div>
                                    <span className="text-[14px] font-medium text-black flex-1 text-left">{net.name}</span>
                                    {currentId === net.id ? (
                                        <Check size={16} className="text-blue-600" />
                                    ) : (
                                        <div className="w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="w-1 h-1 bg-black/40 rounded-full mx-[1px]" />
                                            <div className="w-1 h-1 bg-black/40 rounded-full mx-[1px]" />
                                            <div className="w-1 h-1 bg-black/40 rounded-full mx-[1px]" />
                                        </div>
                                    )}
                                </button>
                            ))}

                            {tab === 'popular' && (
                                <div className="mt-2">
                                    <div className="flex items-center gap-1 px-4 py-2">
                                        <span className="text-[13px] text-black/50 font-medium">Additional networks</span>
                                        <Info size={12} className="text-black/40" />
                                    </div>
                                    {customNetworks.map(net => (
                                        <button 
                                            key={net.id}
                                            onClick={() => handleSelect(net.id)}
                                            className="w-full flex items-center px-4 py-2 hover:bg-black/[0.03] transition-colors group"
                                        >
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center mr-3 shrink-0 overflow-hidden bg-black/5">
                                                {net.icon ? (
                                                    <img src={net.icon} alt={net.name} className="w-full h-full object-contain" />
                                                ) : (
                                                    <div className="w-full h-full bg-black/10" />
                                                )}
                                            </div>
                                            <span className="text-[14px] font-medium text-black flex-1 text-left">{net.name}</span>
                                            {currentId === net.id ? (
                                                <Check size={16} className="text-blue-600" />
                                            ) : (
                                                <span className="text-xl font-light text-black/30 group-hover:text-black/60">+</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

