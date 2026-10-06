"use client";

import { useChainId, useSwitchChain, useChains } from "wagmi";
import { useState } from "react";
import { ChevronDown, Globe, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function NetworkSwitcher() {
    const chainId = useChainId();
    const { switchChain, isPending } = useSwitchChain();
    const chains = useChains();
    const [isOpen, setIsOpen] = useState(false);

    const activeChain = chains.find((c) => c.id === chainId);

    const handleSwitch = (id: number) => {
        switchChain({ chainId: id });
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-black/20 border border-white/5 hover:bg-white/10 transition-all text-white/90"
            >
                {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white/70" />
                ) : (
                    <Globe className={`w-4 h-4 ${activeChain?.name === 'Polygon' ? 'text-emerald-400' : 'text-blue-400'}`} />
                )}
                <span className="text-sm font-medium">{activeChain?.name || "Unknown"}</span>
                <ChevronDown className={`w-4 h-4 text-white/50 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute right-0 top-full mt-2 w-48 py-2 rounded-xl bg-[#1a1b23]/90 border border-white/10 shadow-2xl backdrop-blur-xl z-50 overflow-hidden"
                        >
                            <div className="px-3 py-2 text-xs font-bold text-white/40 uppercase tracking-wider">
                                Select Network
                            </div>
                            {chains.map((chain) => (
                                <button
                                    key={chain.id}
                                    onClick={() => handleSwitch(chain.id)}
                                    className={`w-full text-left px-4 py-3 flex items-center space-x-3 hover:bg-white/10 transition-colors ${chain.id === chainId ? "bg-white/5" : ""
                                        }`}
                                >
                                    <div className={`w-2 h-2 rounded-full ${chain.id === chainId ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-white/20"}`} />
                                    <span className={`text-sm ${chain.id === chainId ? "text-white font-bold" : "text-white/70"}`}>
                                        {chain.name}
                                    </span>
                                </button>
                            ))}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}


