"use client";

import React, { useState } from 'react';
import { Gift, ShieldCheck, ChevronRight, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useWriteContract } from 'wagmi';
import { parseAbi } from 'viem';

export default function CoreWelcomeClaim({ signature, onSuccess }: { signature: string, onSuccess: () => void }) {
    const [isClaiming, setIsClaiming] = useState(false);
    const [hasClaimed, setHasClaimed] = useState(false);
    
    const { writeContractAsync } = useWriteContract();

    const handleClaim = async () => {
        if (!signature) {
            toast.error('Authorization signature not found. Check your registration.');
            return;
        }

        setIsClaiming(true);
        try {
            // Simulating contract call to CoreAirdrop.claimWelcomeBonus(signature)
            await new Promise(r => setTimeout(r, 2500));
            
            setHasClaimed(true);
            toast.success('¡500 QDs depositados en tu Wallet Cuántica!');
        } catch (error) {
            toast.error('Fallo en la validación On-Chain.');
        } finally {
            setIsClaiming(false);
        }
    };

    if (hasClaimed) {
        return (
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-[24px] p-6 flex items-center justify-between"
            >
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400">
                        <CheckCircle2 size={24} />
                    </div>
                    <div>
                        <h3 className="text-white font-bold tracking-tight">Bono Reclamado</h3>
                        <p className="text-emerald-400/80 text-sm font-medium">500 QDs asegurados On-Chain</p>
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <div className="w-full bg-gradient-to-br from-blue-900/40 to-purple-900/40 border border-white/10 rounded-[24px] p-1 relative overflow-hidden">
            {/* Animated border effect */}
            <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)] animate-[spin_4s_linear_infinite] opacity-20" />
            
            <div className="bg-white rounded-[22px] p-6 relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                
                <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-[#25D366] to-purple-500 rounded-2xl flex items-center justify-center shadow-lg shadow-[#25D366]/20 shrink-0">
                        <Gift className="text-white" size={28} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-xl font-black text-white tracking-tighter uppercase">Bono Fundador</h3>
                            <span className="bg-[#25D366]/20 text-blue-400 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-[#25D366]/20">
                                EIP-712
                            </span>
                        </div>
                        <p className="text-white/60 text-sm font-medium leading-relaxed max-w-md">
                            Has creado tu cuenta exitosamente. Reclama tus <strong className="text-white">500 CoreDots (QDs)</strong> iniciales. La transacción está pre-firmada por el servidor para máxima seguridad sin coste de gas.
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleClaim}
                    disabled={isClaiming}
                    className="w-full md:w-auto px-8 py-4 bg-white text-black font-black uppercase tracking-widest text-sm rounded-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
                >
                    {isClaiming ? (
                        <>Validando <ShieldCheck size={18} className="animate-pulse" /></>
                    ) : (
                        <>Reclamar 500 QDs <ChevronRight size={18} /></>
                    )}
                </button>
            </div>
        </div>
    );
}

