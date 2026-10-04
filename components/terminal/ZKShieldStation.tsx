// components/terminal/Security ProtocolStation.tsx
"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Fingerprint, Lock, CheckCircle2, Activity, Cpu, Database, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export function ZKShieldStation() {
    const [targetAddress, setTargetAddress] = useState('');
    const [isProving, setIsProving] = useState(false);
    const [lastProof, setLastProof] = useState<any>(null);

    const handleShield = async () => {
        // [SECURITY HARDENING] Strict input validation to prevent XSS or malformed payloads
        const ethRegex = /^0x[a-fA-F0-9]{40}$/;
        if (!ethRegex.test(targetAddress)) {
            toast.error("IDENTIFIER_INVALID: Must be a valid 42-character Ethereum hex address.");
            return;
        }

        setIsProving(true);
        const tid = toast.loading("SYNTHESIZING_GROTH16_SNARK_PROOF...");

        try {
            const res = await fetch('/api/zk/prove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: targetAddress, amount: 1 })
            });
            const data = await res.json();
            
            if (data.success) {
                toast.success("ENTITY_SHIELDED_SUCCESSFULLY", { id: tid });
                setLastProof(data.snark);
            } else {
                toast.error(data.error || "ZK_PROOF_GENERATION_FAILED", { id: tid });
                // Zero-Mock Mandate: do NOT display a Math.random() fake proof.
                // Surface the error to the user instead.
                setLastProof(null);
            }
        } catch (e) {
            toast.error("PROVER_NETWORK_SYNCHRONIZATION_ERROR", { id: tid });
        } finally {
            setIsProving(false);
        }
    };

    return (
        <div className="w-full h-full p-4 flex flex-col items-center overflow-hidden">
        <div className="w-full h-full flex-1 min-h-0 bg-[#FFFFFF] text-[#050505] border border-[#E5E5E5] rounded-2xl font-sans flex flex-col overflow-hidden shadow-sm">
            
            {/*  ACADEMIC INTRO  */}
            <div className="p-8 border-b border-[#E5E5E5] bg-[#FFFFFF] flex items-center justify-between shrink-0">
               <div className="flex items-center gap-6">
                  <div className="p-3 bg-white border border-[#050505] text-[#FFFFFF] rounded-xl">
                     <Shield size={20} />
                  </div>
                  <div>
                     <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#050505]">ZK AZTEC PROTOCOL // PRIVACY LAYER</h2>
                     <p className="text-[9px] text-[#888888] font-bold uppercase tracking-widest mt-1">Non-Interactive Zero Knowledge Subnet // Groth16 Implementation</p>
                  </div>
               </div>
               <div className="flex items-center gap-4 text-[8px] text-[#888888] font-bold uppercase tracking-[0.2em]">
                  <div className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-[#00C076]" />
                     <span>PROVER STATUS: ONLINE</span>
                  </div>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center">
                
                <div className="w-full max-w-[2560px] mx-auto space-y-12 py-12 text-left">
                   
                   <div className="space-y-4">
                      <label className="text-[10px] text-[#888888] font-black uppercase tracking-[0.2em] block text-center">Entity Isolation Target</label>
                      <div className="relative">
                         <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-[#888888]">
                            <Fingerprint size={18} />
                         </div>
                         <input 
                            type="text" 
                            value={targetAddress}
                            onChange={(e) => setTargetAddress(e.target.value)}
                            placeholder="0x95222290DD9278AA3DDD389CC1E1D165CC4BAFE5"
                            className="w-full bg-[#FFFFFF] border border-[#E5E5E5] p-5 pl-14 text-xs font-mono text-[#050505] outline-none focus:border-[#050505] transition-all uppercase tracking-widest rounded-2xl shadow-sm placeholder:text-[#888888]"
                         />
                      </div>
                      <button 
                        onClick={handleShield}
                        disabled={isProving}
                        className="w-full py-5 bg-white border border-[#050505] text-[#FFFFFF] font-black uppercase tracking-[0.2em] text-[10px] hover:bg-[#FFFFFF] hover:text-[#050505] transition-all flex items-center justify-center gap-3 disabled:opacity-50 rounded-xl shadow-sm"
                      >
                         {isProving ? <Activity size={14} className="animate-spin" /> : <EyeOff size={14} />}
                         {isProving ? 'SYNTHESIZING PROOF...' : 'EXECUTE ZK SHIELD'}
                      </button>
                   </div>

                   <AnimatePresence>
                      {lastProof && (
                         <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="border border-[#E5E5E5] bg-[#FFFFFF] overflow-hidden rounded-2xl shadow-sm"
                         >
                            <div className="px-6 py-5 border-b border-[#E5E5E5] bg-[#FFFFFF] flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                  <Cpu size={14} className="text-[#050505]" />
                                  <span className="text-[9px] font-black uppercase tracking-widest text-[#050505]">SNARK PROOF BLOB</span>
                               </div>
                               <span className="text-[8px] text-[#888888] uppercase font-mono font-bold">Algorithm: Groth16 // Curve: BN128</span>
                            </div>
                            <div className="p-6 bg-[#FFFFFF]">
                               <pre className="text-[10px] text-[#888888] font-mono font-bold leading-relaxed overflow-x-auto selection:bg-white selection:text-white">
                                  {JSON.stringify(lastProof, null, 2)}
                               </pre>
                            </div>
                         </motion.div>
                      )}
                   </AnimatePresence>

                   {!lastProof && !isProving && (
                      <div className="flex flex-col items-center gap-6 opacity-20 py-12">
                         <Database size={48} className="text-[#050505]" />
                         <span className="text-[9px] font-black uppercase tracking-[0.4em] text-[#050505]">AWAITING INPUT PARAMETERS</span>
                      </div>
                   )}

                </div>

            </div>

            {/*  FOOTER  */}
            <div className="p-4 border-t border-[#E5E5E5] flex justify-between items-center text-[8px] text-[#888888] uppercase tracking-[0.2em] font-bold shrink-0 bg-[#FFFFFF]">
               <span>Aztec Node Alpha v3.1</span>
               <span>Non-Custodian Isolation Engine</span>
            </div>

        </div>
        </div>
    );
}
