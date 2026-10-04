"use client";

import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Key, Zap, Building } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Simulating data mapping from GraphQL/Prisma 
const GOLD_CANDIDATES = [
  { id: 'binance', name: 'Binance Global', type: 'Exchange', typeLabel: 'Beginner-Friendly / Futures', reserveUsd: 115000000000, features: ['High Liquidity', 'Copy Attesting'] },
  { id: 'uniswap', name: 'Uniswap', type: 'DEX', typeLabel: 'Decentralised Exchange', reserveUsd: 3500000000, features: ['AMM', 'Permissionless', 'Liquidity Pools'] },
  { id: 'ledger', name: 'Ledger Nano', type: 'Wallet', typeLabel: 'Hardware Wallet', reserveUsd: 0, features: ['Cold Storage', 'EAL5+ Secure Element'] },
  { id: 'aave', name: 'Aave', type: 'Lending', typeLabel: 'DeFi Lending Protocol', reserveUsd: 12000000000, features: ['Overcollateralised', 'Flash Loans', 'Yield'] },
];

export default function GoldRegistryPage() {
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifiedList, setVerifiedList] = useState<Record<string, boolean>>({});

  const triggerOnChainPing = (id: string, name: string) => {
    setVerifying(id);
    
    // Simulate smart contract Ping to SystemValidator.sol
    setTimeout(() => {
      setVerifiedList(prev => ({ ...prev, [id]: true }));
      setVerifying(null);
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-transparent text-[#050505] dark:text-[#FFFFFF] p-12">
      <header className="mb-14">
         <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 text-indigo-600 block mb-3">System Authority Hub</span>
         <h1 className="text-5xl font-black tracking-tighter uppercase italic">System Gold Registry</h1>
         <p className="mt-4 text-sm font-medium tracking-wide opacity-50 max-w-xl leading-relaxed">
           We do not publish "reviews". We perform cryptographic audits. Execute an on-chain ping to verify platform solvency and reserve thresholds directly from the blockchain.
         </p>
      </header>

      <div className="grid grid-cols-1 gap-6 max-w-[2560px] text-left">
         {GOLD_CANDIDATES.map((node) => {
           const isVerified = verifiedList[node.id];
           const isSimulating = verifying === node.id;

           return (
             <div key={node.id} className={`bg-white p-6 border rounded-[2rem] shadow-lg transition-all ${isVerified ? 'border-green-500/30 shadow-green-500/5' : 'border-black/5 hover:border-black/10'}`}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                   
                   {/* Info Block */}
                   <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-white/20 dark:bg-black/20 backdrop-blur-md border border-black/5 dark:border-white/5 rounded-2xl flex items-center justify-center">
                         <Building size={24} className="opacity-30" />
                      </div>
                      <div>
                         <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                            {node.name}
                            {isVerified && <ShieldCheck size={18} className="text-green-500" />}
                         </h2>
                         <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-1">{node.typeLabel}</p>
                         <div className="flex gap-2 mt-3">
                            {node.features.map(f => (
                              <span key={f} className="text-[8px] font-mono font-bold uppercase tracking-widest bg-black/5 px-2 py-1 rounded-sm opacity-60">
                                {f}
                              </span>
                            ))}
                         </div>
                      </div>
                   </div>

                   {/* Verification Action Block */}
                   <div className="flex flex-col items-end gap-3 min-w-[200px]">
                      {isVerified ? (
                        <div className="w-full lg:w-1/3 bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-3xl p-8 flex flex-col justify-between">
                           <span className="text-[9px] font-black uppercase tracking-widest text-green-600 block mb-1">
                              Solvency Verified
                           </span>
                           {node.reserveUsd > 0 && (
                             <span className="font-mono text-sm text-green-700">
                               Reserves: ${(node.reserveUsd / 1000000000).toFixed(2)}B
                             </span>
                           )}
                        </div>
                      ) : (
                        <button 
                          onClick={() => triggerOnChainPing(node.id, node.name)}
                          disabled={isSimulating}
                          className="w-full bg-white text-white px-6 py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-[#111] transition-colors disabled:opacity-50"
                        >
                           {isSimulating ? (
                             <Zap size={14} className="animate-pulse text-indigo-400" />
                           ) : (
                             <Key size={14} className="opacity-50" />
                           )}
                           <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                             {isSimulating ? 'Pinging Node...' : 'Verify Solvency'}
                           </span>
                        </button>
                      )}
                   </div>

                </div>

                <AnimatePresence>
                   {isVerified && (
                     <motion.div 
                       initial={{ opacity: 0, height: 0 }}
                       animate={{ opacity: 1, height: 'auto' }}
                       className="mt-6 pt-6 border-t border-black/5"
                     >
                        <a 
                          href={`https://bridge.system.network/go/${node.id}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block w-full text-center py-4 bg-white/20 dark:bg-black/20 backdrop-blur-md hover:bg-white/40 dark:hover:bg-black/40 border border-black/5 dark:border-white/5 text-[#050505] dark:text-[#FFFFFF] font-black uppercase text-[11px] tracking-[0.3em] rounded-xl transition-colors"
                        >
                           Open bridge
                        </a>
                     </motion.div>
                   )}
                </AnimatePresence>
             </div>
           );
         })}
      </div>
    </div>
  );
}
