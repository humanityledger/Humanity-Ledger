
"use client";

import React, { useEffect, useState } from 'react';
import { useAppKit, useAppKitNetwork } from '@reown/appkit/react';
import { motion } from 'framer-motion';
import { Globe, ChevronDown, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

export function NetworkSwitcher() {
    const { open } = useAppKit();
    const { chainId, caipNetwork } = useAppKitNetwork();
    const { isAuthenticated } = useAuth();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    if (!mounted || !isAuthenticated) return null;

    const networkName = caipNetwork?.name || 'Unknown Network';
    const isMainnet = chainId === 1;

    // Map common chain IDs to colors/icons if needed, generally AppKit handles icons in modal
    // But for sticker, we want a nice indicator
    const getNetworkColor = (id?: number | string) => {
        switch (Number(id)) {
            case 1: return 'bg-[#25D366]'; // Ethereum
            case 137: return 'bg-purple-500'; // Polygon
            case 10: return 'bg-red-500'; // Optimism
            case 42161: return 'bg-cyan-500'; // Arbitrum
            case 8453: return 'bg-emerald-600'; // Base
            default: return 'bg-gray-500';
        }
    };

    return (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => open({ view: 'Networks' })}
            className="group relative flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
        >
            <div className={cn("w-2 h-2 rounded-full animate-pulse", getNetworkColor(chainId))} />
            
            <span className="text-xs font-bold text-gray-300 group-hover:text-white transition-colors uppercase tracking-wider hidden md:block">
                {networkName}
            </span>
            
            <ChevronDown size={14} className="text-gray-500 group-hover:text-white transition-colors" />

            {/* Glow Effect */}
            <div className={cn(
                "absolute inset-0 rounded-xl opacity-0 group-hover:opacity-20 transition-opacity blur-md",
                getNetworkColor(chainId)
            )} />
        </motion.button>
    );
}


