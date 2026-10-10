"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, CreditCard, Check, Smartphone, AlertCircle, Loader2, Key } from 'lucide-react';
import { useNFC } from '@/hooks/useNFC';

export default function NFCHardware() {
    const { isSupported, status, startScan, simulateScan, serialNumber, reset } = useNFC();

    return (
        <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center p-8 bg-[#EAEADF] relative overflow-hidden rounded-[40px]">
            
            {/* Ambient Pulse */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#25D366]/5 rounded-full blur-3xl pointer-events-none animate-pulse" />

            <AnimatePresence mode="wait">
                
                {/* STATE: IDLE or UNSUPPORTED */}
                {(status === 'idle' || status === 'unsupported') && (
                    <motion.div
                        key="idle"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="text-center space-y-8 relative z-10 max-w-md"
                    >
                        <div className="relative mx-auto w-32 h-32">
                           <div className="absolute inset-0 bg-[#25D366]/10 rounded-full animate-ping" />
                           <div className="relative w-full h-full bg-white rounded-full flex items-center justify-center shadow-xl border border-[#25D366]/10">
                                <Wifi size={48} className="text-emerald-600" />
                           </div>
                        </div>

                        <div>
                            <h2 className="text-3xl font-black text-[#1F1F1F] mb-3">Tap to Pair</h2>
                            <p className="text-[#1F1F1F]/60">
                                Turn your Ledger Card into a hardware key. 
                                <br/>Sign transactions securely with a tap.
                            </p>
                        </div>

                        {status === 'unsupported' ? (
                            <div className="p-4 bg-orange-100 text-orange-800 rounded-2xl border border-orange-200 text-sm">
                                <div className="flex items-center gap-2 font-bold mb-1">
                                    <AlertCircle size={16} />
                                    Desktop Detected
                                </div>
                                Minimalist Simulation Mode active. You can still test the pairing flow.
                            </div>
                        ) : null}

                        <button
                            onClick={startScan}
                            className="w-full py-4 bg-[#1F1F1F] text-white rounded-2xl font-bold text-lg shadow-xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-3"
                        >
                            <Key size={20} />
                            Start Pairing
                        </button>
                    </motion.div>
                )}

                {/* STATE: SCANNING */}
                {status === 'scanning' && (
                    <motion.div
                        key="scanning"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center space-y-8 relative z-10"
                    >
                         <div className="relative mx-auto w-48 h-32">
                            {/* Phone and Card Animation */}
                            <motion.div 
                                animate={{ y: [0, 10, 0], rotateX: [0, 5, 0] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute top-0 left-1/2 -translate-x-1/2 z-20"
                            >
                                <Smartphone size={100} className="text-[#1F1F1F]" strokeWidth={1} />
                            </motion.div>
                            <motion.div
                                animate={{ y: [20, -10, 20], scale: [0.9, 1, 0.9], opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                                className="absolute bottom-0 left-1/2 -translate-x-1/2 z-10"
                            >
                                <CreditCard size={80} className="text-emerald-600 filling-emerald-600/20" />
                            </motion.div>
                         </div>

                         <div>
                            <h3 className="text-2xl font-bold text-[#1F1F1F] animate-pulse">Scanning...</h3>
                            <p className="text-[#1F1F1F]/50">Hold your Ledger Card against the back of your device.</p>
                        </div>
                        
                        {!isSupported && (
                            <button 
                                onClick={simulateScan}
                                className="mt-8 px-6 py-3 bg-emerald-100 text-emerald-700 rounded-xl font-bold text-sm hover:bg-emerald-200"
                            >
                                [DEV] Simulate Tap
                            </button>
                        )}
                    </motion.div>
                )}

                {/* STATE: SUCCESS */}
                {status === 'success' && (
                    <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 1.1 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center space-y-8 relative z-10 max-w-md"
                    >
                         <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-green-500/20">
                             <Check size={48} className="text-white" strokeWidth={4} />
                         </div>

                         <div>
                            <h2 className="text-3xl font-black text-[#1F1F1F] mb-2">Paired</h2>
                            <p className="text-[#1F1F1F]/60">Your card is now linked.</p>
                        </div>

                         <div className="bg-white p-6 rounded-3xl border border-[#1F1F1F]/5 shadow-sm">
                             <div className="text-xs text-[#1F1F1F]/40 uppercase tracking-widest font-bold mb-1">Device ID</div>
                             <div className="font-mono text-xl font-bold text-[#1F1F1F] tracking-widest">{serialNumber}</div>
                         </div>

                         <button
                            onClick={reset}
                            className="w-full py-4 bg-white border-2 border-[#1F1F1F]/10 text-[#1F1F1F] rounded-2xl font-bold text-lg hover:bg-[#F5F5F0] transition-colors"
                        >
                            Done
                        </button>
                    </motion.div>
                )}

                {/* STATE: ERROR */}
                {status === 'error' && (
                    <motion.div key="error" className="text-center space-y-6">
                        <AlertCircle size={64} className="text-red-500 mx-auto" />
                        <h3 className="text-xl font-bold">Scanning Failed</h3>
                        <button onClick={reset} className="text-emerald-600 font-bold underline">Try Again</button>
                    </motion.div>
                )}

            </AnimatePresence>
        </div>
    );
}


