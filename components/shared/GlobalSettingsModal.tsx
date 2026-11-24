"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '@/lib/store/useSettingsStore';
import { X, Settings, LogOut } from 'lucide-react';
import { useSystemSignOut } from '@/hooks/useSystemSignOut';
import { TerminalSettingsPanel } from '@/components/terminal/TerminalSettingsPanel';
import { useT } from '@/lib/i18n/client';

export function GlobalSettingsModal() {
  const t = useT();
    const { isSettingsOpen, setSettingsOpen } = useSettingsStore();

    const { nuclearDisconnect } = useSystemSignOut();
    const [mounted, setMounted] = useState(false);
    const [confirmDisconnect, setConfirmDisconnect] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleDisconnect = async () => {
        setConfirmDisconnect(false);
        setSettingsOpen(false);
        await nuclearDisconnect();
    };

    return (
        <AnimatePresence>
            {isSettingsOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setSettingsOpen(false)}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]"
                    />

                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        className="fixed top-0 right-0 h-full w-full sm:w-[90vw] max-w-[800px] bg-white  border-l border-black/10  z-[99999] shadow-2xl flex flex-col overflow-hidden transition-colors duration-300"
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10  bg-white ">
                             <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-lg bg-black  flex items-center justify-center text-white ">
                                    <Settings size={16} />
                                 </div>
                                 <div className="flex flex-col">
                                    <h2 className="text-[13px] font-black text-black  uppercase tracking-widest">{t("Global Terminal Parameters")}</h2>
                                 </div>
                             </div>
                             <div className="flex items-center gap-4">
                                <button onClick={handleDisconnect} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50  text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-100  transition-colors">
                                    <LogOut size={14} />{" "}{t("Sever Connection")}
                                </button>
                                <button onClick={() => setSettingsOpen(false)} className="p-2 text-black/40 hover:text-black   transition-colors bg-black/5  rounded-full"><X size={18} /></button>
                             </div>
                        </div>

                        <div className="flex-1 overflow-y-auto relative bg-[#FFFFFF] ">
                             {/* Render the full comprehensive Terminal Settings Panel perfectly inside the modal */}
                             <TerminalSettingsPanel />
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
                                    

