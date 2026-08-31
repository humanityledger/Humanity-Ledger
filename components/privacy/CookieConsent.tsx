'use client';

/**
 * [PHASE 5 — CYPHERPUNK PRIVACY NOTICE]
 *
 * This is NOT a cookie consent banner. Humanity Ledger does not collect analytics.
 * This is a one-time privacy notice that informs users of our zero-data architecture.
 *
 * Architecture: The notice is shown once, persisted in localStorage with key
 * `privacy-acknowledged`. Once dismissed, it never re-appears.
 * No server call is made. No consent is "stored" in a database.
 * Privacy is enforced at the cryptographic layer, not at the UI layer.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCookieConsent } from './CookieContext';
import { ShieldCheck, X } from 'lucide-react';

export function CookieConsent() {
    const { showBanner, acceptAll } = useCookieConsent();

    if (!showBanner) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 120, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 120, opacity: 0, transition: { duration: 0.4, ease: 'easeIn' } }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="fixed bottom-0 left-0 right-0 z-[99999] p-4 sm:p-6 pointer-events-none"
            >
                <div className="w-full max-w-3xl mx-auto pointer-events-auto">
                    <div 
                        className="relative rounded-2xl overflow-hidden border border-[#050505]/10 shadow-[0_20px_60px_rgba(0,0,0,0.08)] bg-white/95 backdrop-blur-xl"
                    >
                        {/* Top Accent Line */}
                        <div className="h-[2px] w-full bg-[#050505]" />

                        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5 p-6 sm:px-8">
                            
                            {/* Icon & Label */}
                            <div className="flex flex-col sm:items-center gap-2 shrink-0">
                                <div className="w-10 h-10 rounded-full border border-[#050505]/10 flex items-center justify-center bg-white shadow-sm">
                                    <ShieldCheck size={18} className="text-[#050505]" />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#050505]">
                                    Zero Data
                                </span>
                            </div>

                            {/* Divider (Desktop) */}
                            <div className="hidden sm:block w-[1px] h-12 bg-[#050505]/10 shrink-0 mx-2" />

                            {/* Text Content */}
                            <div className="flex-1 min-w-0 pr-2">
                                <p className="text-[12px] text-black/70 leading-relaxed font-sans">
                                    This platform enforces a <strong className="text-[#050505] font-black">zero-analytics</strong> and <strong className="text-[#050505] font-black">zero-marketing</strong> architecture. 
                                    Your portfolio state and identity are locally encrypted on your device. 
                                    <span className="block mt-1 text-[10px] font-mono text-black/50 uppercase tracking-widest">
                                        Planned Aztec Network Privacy Primitives
                                    </span>
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto mt-2 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-[#050505]/5">
                                <button
                                    onClick={acceptAll}
                                    className="flex-1 sm:flex-none px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-200 active:scale-[0.97] bg-[#050505] text-white hover:bg-[#222] shadow-md"
                                >
                                    Acknowledge
                                </button>
                                <button
                                    onClick={acceptAll}
                                    className="w-11 h-11 rounded-xl border border-[#050505]/10 flex items-center justify-center text-black/40 hover:text-black hover:border-[#050505]/30 hover:bg-black/5 transition-all"
                                    aria-label="Dismiss"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
