'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Fuel, AlertTriangle, ArrowRight, Check } from 'lucide-react';
import { toast } from 'sonner';

export function RefuelStation({ gasLevel = 0.5 }: { gasLevel?: number }) {
    // Protocol logic: If native gas value < $1, show SOS
    // For demo purposes, we can hardcode logic or pass props
    const isEmergency = gasLevel < 1;

    const [isOpen, setIsOpen] = useState(false);
    const [isBridging, setIsBridging] = useState(false);

    const handleBridge = async () => {
        setIsBridging(true);
        await new Promise(r => setTimeout(r, 2000));
        setIsBridging(false);
        setIsOpen(false);
        toast.success("Emergency Gas Refueled! +5 MATIC");
    };

    if (!isEmergency) return null;

    return (
        <>
            {/* SOS Button */}
            <motion.button
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/30 transition-colors"
            >
                <AlertTriangle size={14} />
                SOS: REFUEL
            </motion.button>

            {/* Refuel Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#0D0D12] border border-red-500/30 rounded-2xl p-6 w-full max-w-sm"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Fuel className="text-red-500" />
                            <h3 className="text-lg font-bold text-white">Emergency Refuel</h3>
                        </div>

                        <div className="bg-white/5 rounded-xl p-4 flex items-center justify-between mb-6">
                            <div className="text-center">
                                <div className="text-xs text-zinc-500">FROM</div>
                                <div className="font-bold text-white">USDC</div>
                                <div className="text-[10px] text-zinc-600">Ethereum</div>
                            </div>
                            <ArrowRight className="text-zinc-600" />
                            <div className="text-center">
                                <div className="text-xs text-zinc-500">TO</div>
                                <div className="font-bold text-red-400">MATIC</div>
                                <div className="text-[10px] text-zinc-600">Polygon</div>
                            </div>
                        </div>

                        <button
                            onClick={handleBridge}
                            disabled={isBridging}
                            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isBridging ? 'BRIDGING...' : 'BRIDGE $5 GAS'}
                        </button>
                        <button onClick={() => setIsOpen(false)} className="w-full mt-2 py-2 text-xs text-zinc-500 hover:text-white">
                            CANCEL
                        </button>
                    </motion.div>
                </div>
            )}
        </>
    );
}


