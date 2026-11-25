"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '@/lib/store/useSettingsStore';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import { useWalletStore } from '@/lib/store/wallet-store';
import { motion, AnimatePresence } from 'framer-motion';
import { Network } from 'lucide-react';
import { useT } from '@/lib/i18n/client';

export function SettingsEnforcer() {
  const t = useT();
    const { address: eoaAddress } = useSystemAccount();
    const { address: systemAddress } = useWalletStore();
    const walletAddress = eoaAddress || systemAddress;

    const { testnetMode } = useSettingsStore();
    const initialSyncDone = useRef(false);

    // 1. Secure PULL settings on connect (via System Session)
    useEffect(() => {
        if (walletAddress && !initialSyncDone.current) {
            useSettingsStore.getState().fetchSettings().then(() => {
                initialSyncDone.current = true;
            });
        }
    }, [walletAddress]);

    return (
        <AnimatePresence>
            {testnetMode && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.9 }}
                    className="fixed bottom-6 right-6 z-[9000] pointer-events-none"
                >
                    <div className="bg-[#FF3B30] text-white px-4 py-2 rounded-full shadow-[0_0_30px_rgba(255,59,48,0.5)] flex items-center gap-2 border-2 border-white">
                        <Network size={14} className="animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{t("Testnet Active")}</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
