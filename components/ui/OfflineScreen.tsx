"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, RefreshCw } from "lucide-react";
import { useDisconnect } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/client';

/**
 * [LEGENDARY] OfflineScreen  branded fullscreen overlay shown when the browser loses network.
 * Auto-dismisses when the connection is restored.
 */
export function OfflineScreen() {
  const t = useT();
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0D0D12] select-none overflow-hidden"
        >
            {/* Ambient glows */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#d4ff28]/5 blur-[150px] rounded-full" />
                <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-[#d4ff28]/5 blur-[120px] rounded-full" />
            </div>

            {/* Pulsing icon */}
            <motion.div
                animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
                className="relative flex items-center justify-center mb-8"
            >
                <div className="absolute w-32 h-32 rounded-full bg-[#d4ff28]/10 blur-xl" />
                <div className="relative w-24 h-24 rounded-full bg-white/5 border border-[#d4ff28]/20 backdrop-blur-xl flex items-center justify-center shadow-2xl">
                    <WifiOff className="text-[#d4ff28]" size={40} />
                </div>
            </motion.div>

            {/* Branding */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="text-center space-y-3 px-6 max-w-md"
            >
                <div className="text-xs font-black uppercase tracking-[0.3em] text-[#d4ff28] mb-4">
                    {t("Humanity Ledger")}
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
                    {t("Connection Lost")}
                </h1>
                <p className="text-gray-400 text-lg leading-relaxed">
                    {t("Forensic link terminated. Please verify your network. Disconnecting wallet for security.")}
                </p>
            </motion.div>

            {/* Animated connecting dots */}
            <motion.div
                className="flex items-center gap-2 mt-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
            >
                <RefreshCw className="text-[#d4ff28]/40 animate-spin" size={14} />
                <span className="text-gray-600 text-sm font-mono tracking-widest uppercase">{t("Pinging Nodes...")}</span>
            </motion.div>

            {/* Scan line effect */}
            <motion.div
                className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#d4ff28]/20 to-transparent pointer-events-none"
                animate={{ top: ["0%", "100%"] }}
                transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
            />
        </motion.div>
    );
}

/**
 * Drop this anywhere in your tree (e.g. layout.tsx) to get automatic offline detection.
 */
export function OfflineDetector() {
    const [isOffline, setIsOffline] = useState(false);
    const { disconnect } = useDisconnect();
    const router = useRouter();

    useEffect(() => {
        const handleOffline = () => {
            setIsOffline(true);
            disconnect();
            router.push('/');
        };
        const handleOnline = () => setIsOffline(false);

        // Check initial state
        if (!navigator.onLine) {
            handleOffline();
        }

        window.addEventListener("offline", handleOffline);
        window.addEventListener("online", handleOnline);
        return () => {
            window.removeEventListener("offline", handleOffline);
            window.removeEventListener("online", handleOnline);
        };
    }, [disconnect, router]);

    return (
        <AnimatePresence>
            {isOffline && <OfflineScreen />}
        </AnimatePresence>
    );
}

