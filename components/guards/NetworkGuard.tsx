"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function NetworkGuard() {
    const { chain, isConnected } = useAccount();
    const { switchChain } = useSwitchChain();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // ID hardcoded for Polygon Mainnet (137)
    const POLYGON_ID = 137;
    // Also allow Amoy (80002) for testing if needed, but stricter requirement said "Polygon Mainnet"
    // If not connected, we don't block. Only if connected and wrong network.
    const isWrongNetwork = isConnected && chain?.id !== POLYGON_ID;

    if (!mounted || !isWrongNetwork) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-xl">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md w-full p-8 rounded-3xl bg-[#0D0D12] border border-red-500/20 shadow-2xl shadow-red-900/40 text-center"
            >
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle size={32} className="text-red-500" />
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">Red Incorrecta</h2>
                <p className="text-gray-400 mb-8 leading-relaxed">
                    Esta aplicación solo funciona en la red <span className="text-purple-400 font-semibold">Polygon</span>.
                    Por favor cambia de red para continuar.
                </p>

                <button
                    onClick={() => switchChain({ chainId: POLYGON_ID })}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-[#25D366] text-white font-bold tracking-brand shadow-lg transition-all transform hover:-translate-y-1 active:scale-95"
                >
                    Cambiar a Polygon
                </button>
            </motion.div>
        </div>
    );
}


