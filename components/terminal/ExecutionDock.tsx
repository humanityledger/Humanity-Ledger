"use client";

import React, { useState, useEffect } from 'react';
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { useSystemAccount as useAccount } from '@/hooks/useSystemAccount';
import { parseEther } from 'viem';
import { ShieldAlert, Zap, Lock, Crosshair, AlertTriangle, Fingerprint, Activity, Ban } from 'lucide-react';
import { useSniperStore } from '@/store/useSniperStore';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

// Optional: Add default native ETH address and target token (e.g. USDC on ETH Mainnet)
const NATIVE_ETH = "0xEeeeeEeeeEeEeeEeEqEeeEEEeeeeEeeeeeeeEEeE";
const TARGET_USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

export default function ExecutionDock() {
  const { isConnected, address } = useAccount();
  const filters = useSniperStore((state) => state.filters);
  const currentPrice = useSniperStore((state) => state.currentPrice);
  const addExecutedAttest = useSniperStore((state) => state.addExecutedAttest);
  const isArmed = useSniperStore((state) => state.isArmed);
  const setArmed = useSniperStore((state) => state.setArmed);
  
  const { isPending: isSendingTx, sendTransaction, data: txHash, error: txError } = useSendTransaction();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const [localHash, setLocalHash] = useState<string | null>(null);

  // HFT Anomalies polling
  const { data: mevData, isLoading: mevLoading } = useSWR('/api/execution/mev', fetcher, { refreshInterval: 5000 });

  const [isQuoting, setIsQuoting] = useState(false);

  useEffect(() => {
      if (txHash) setLocalHash(txHash);
  }, [txHash]);

  useEffect(() => {
      if (isConfirmed && localHash) {
          addExecutedAttest(localHash, 0, currentPrice);
      }
  }, [isConfirmed, localHash, currentPrice, addExecutedAttest]);

  const handleLethalExecution = async () => {
    if (!isConnected || !address) {
      toast.error('Cannot execute: No identity linked.');
      return;
    }
    
    if (!isArmed) return;

    try {
      setIsQuoting(true);
      // REAL WEB3 INTERACTION: Fetching a real swap quote from 0x Protocol 
      // Swapping 0.001 ETH to USDC as a baseline sniper action
      const sellAmount = parseEther('0.001').toString(); 
      
      const response = await fetch(
        `https://api.0x.org/swap/v1/quote?sellToken=${NATIVE_ETH}&buyToken=${TARGET_USDC}&sellAmount=${sellAmount}&takerAddress=${address}&slippagePercentage=${filters.slippageTolerance / 100}`,
        {
          headers: {
            '0x-api-key': 'd10eefd5-bd84-4861-bb38-4e36dc6fa8e9' // Demo/Public key for 0x
          }
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.validationErrors?.[0]?.reason || err.reason || "Failed to fetch DEX routing.");
      }

      const quote = await response.json();

      setIsQuoting(false);
      
      // Execute the genuine DEX swap transaction
      sendTransaction({
        to: quote.to,
        data: quote.data,
        value: BigInt(quote.value), 
      });
      
      setArmed(false);
    } catch (e: any) {
      setIsQuoting(false);
      setArmed(false);
      toast.error(`Execution failed: ${e.shortMessage || e.message}`);
    }
  };

  return (
    <div className="flex flex-col gap-6 absolute inset-0 p-4 overflow-y-auto custom-scrollbar bg-white">
      
      {/*  PRICE TICKER  */}
      <div className="flex flex-col gap-1 items-end z-10">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--aztec-orchid)] animate-pulse" />
          ORACLE // 0-CONF WSS
        </span>
        <div className="text-4xl lg:text-5xl font-black font-mono text-white tracking-tighter flex items-baseline gap-2">
          <span className="text-white/20 text-2xl">$</span>
          {currentPrice > 0 ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---.--'}
        </div>
      </div>

      <div className="flex-1" />

      {/*  EXECUTION STATS & MEV FEED  */}
      <div className="space-y-3 bg-white/[0.02] border border-white/5 p-4 rounded-xl shadow-sm z-10 relative overflow-hidden backdrop-blur-md hover:border-white/10 transition-colors">
         {/* HFT MEV Anomaly Stream */}
         <div className="border border-[var(--aztec-orchid)]/20 bg-[var(--aztec-orchid)]/5 p-2 rounded-sm mb-4">
             <div className="text-[9px] font-black uppercase text-[var(--aztec-orchid)] mb-2 flex items-center gap-2 tracking-[0.2em]">
                 <Activity size={10} className="animate-pulse" /> FLASHBOTS RELAY (HFT MEMPOOL)
             </div>
             {mevLoading ? (
                 <div className="text-[8px] text-[var(--aztec-orchid)]/50 uppercase font-mono tracking-widest">Listening to dark pool...</div>
             ) : (
                <div className="flex flex-col gap-1.5 max-h-24 overflow-y-auto custom-scrollbar pr-1">
                    {(mevData?.anomalies || []).slice(0, 3).map((anomaly: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-[8px] font-mono border-b border-[var(--aztec-orchid)]/10 pb-1">
                            <span className="text-[var(--aztec-orchid)]/80">{anomaly.pair} ({anomaly.route.split(' ')[0]})</span>
                            <span className="text-[var(--aztec-orchid)] font-black">+${anomaly.profitUsd}</span>
                        </div>
                    ))}
                </div>
             )}
         </div>

         {isQuoting || isSendingTx || isConfirming ? (
             <div className="absolute inset-0 bg-white/90 backdrop-blur-md z-20 flex flex-col items-center justify-center">
                 <div className="flex items-center gap-3 text-[var(--aztec-orchid)] font-black uppercase tracking-[0.2em] text-xs">
                     <Activity size={16} className="animate-spin" /> 
                     {isQuoting ? 'ROUTING DEX LIQUIDITY...' : isSendingTx ? 'AWAITING WALLET SIGNATURE...' : 'BROADCASTING TO MEMPOOL...'}
                 </div>
                 {localHash && <span className="text-[9px] font-mono font-black mt-3 text-[var(--aztec-orchid)]/60 bg-[var(--aztec-orchid)]/10 px-2 py-1 rounded-md border border-[var(--aztec-orchid)]/20">{localHash.slice(0, 10)}...{localHash.slice(-8)}</span>}
             </div>
         ) : isConfirmed ? (
             <div className="absolute inset-0 bg-green-500/10 backdrop-blur-md z-20 flex flex-col items-center justify-center border border-green-500/20">
                 <div className="flex items-center gap-3 text-green-400 font-black uppercase tracking-[0.2em] text-xs">
                     <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.8)]" />
                     EXECUTION CONFIRMED
                 </div>
                 <button onClick={() => window.open(`https://etherscan.io/tx/${localHash}`, '_blank')} className="text-[9px] font-mono font-black mt-3 text-green-400/80 hover:text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-lg transition-colors">Verify on Explorer</button>
             </div>
         ) : null}

         <div className="flex items-center justify-between text-[10px] uppercase font-black tracking-widest text-white/40">
           <span className="flex items-center gap-2"><Crosshair size={12}/> AUTO-EXECUTION</span>
           <span className={filters.autoExecute ? 'text-rose-500' : 'text-white/20'}>
             {filters.autoExecute ? 'LETHAL' : 'DISABLED'}
           </span>
         </div>
         <div className="flex items-center justify-between text-[10px] uppercase font-black tracking-widest text-white/40">
           <span className="flex items-center gap-2"><Lock size={12}/> SLIPPAGE LIMIT</span>
           <span className="text-[var(--aztec-orchid)] font-mono">{filters.slippageTolerance.toFixed(1)}%</span>
         </div>
         <div className="flex items-center justify-between text-[10px] uppercase font-black tracking-widest text-white/40">
           <span className="flex items-center gap-2"><Zap size={12}/> MAX GAS (GWEI)</span>
           <span className="text-[var(--aztec-orchid)] font-mono">{filters.gasLimitGwei}</span>
         </div>
      </div>

      {txError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] uppercase font-black tracking-[0.2em] flex items-center gap-2 text-center justify-center rounded-xl shadow-[0_0_15px_rgba(244,63,94,0.2)]">
              <Ban size={12} /> {(txError as any).shortMessage || 'TX REJECTED BY WALLET'}
          </div>
      )}

      {/*  EXECUTION DEPLOYMENT ZONE  */}
      {!isConnected ? (
        <div className="w-full py-5 bg-white/[0.02] border border-white/5 rounded-[24px] text-center text-white/40 text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3">
          <ShieldAlert size={16} /> WALLET REQUIRED
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
            <button 
                onClick={() => setArmed(!isArmed)}
                disabled={isSendingTx || isConfirming}
                className={`py-5 px-6 rounded-[24px] text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 border ${
                    isArmed 
                     ? 'bg-rose-500/10 text-rose-500 border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.3)]' 
                     : 'bg-white/[0.02] text-white/40 border-white/5 hover:border-white/20 hover:text-white/80 hover:bg-white/[0.04]'
                }`}
            >
                <Fingerprint size={16} className={isArmed ? 'animate-pulse' : ''} />
                {isArmed ? 'ARMED' : 'ARM'}
            </button>
            <button 
                onClick={handleLethalExecution}
                disabled={!isArmed || isQuoting || isSendingTx || isConfirming}
                className={`h-full px-8 relative group overflow-hidden rounded-[24px] transition-all border ${
                    isArmed && !isQuoting && !isSendingTx && !isConfirming
                     ? 'bg-[var(--aztec-orchid)] border-[var(--aztec-orchid)]/50 text-black cursor-crosshair hover:brightness-110 shadow-[0_0_30px_rgba(var(--aztec-orchid-rgb),0.4)] active:scale-95'
                     : 'bg-white/[0.01] border-white/5 text-white/10 cursor-not-allowed'
                }`}
            >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                <div className="relative flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-[0.2em]">
                    <AlertTriangle size={16} />
                    LETHAL FIRE
                </div>
            </button>
        </div>
      )}

    </div>
  );
}
