"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDynamicIsland } from '@/lib/store/dynamic-island-store';
import { Phone, Mic, Shield, Wallet, Loader2, Bell, CheckCircle2, ChevronRight } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

export function DynamicIsland() {
  const { activeState, payload, expanded, setExpanded, dismiss } = useDynamicIsland();
  const pathname = usePathname();
  const router = useRouter();
  
  // L3 enforcement: Island lives in App layer only.
  const ISLAND_ALLOWLIST = [
    '/chat', '/portfolio', '/studio', '/settings', 
    '/hub', '/ledger', '/terminal', '/scan', '/passport'
  ];
  const isAppRoute = ISLAND_ALLOWLIST.some(r => pathname?.startsWith(r));
  if (!isAppRoute) return null;

  // Local timer for calls/recording
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeState === 'calling' || activeState === 'recording') {
      setTimer(0);
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [activeState]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleTap = () => {
    if (activeState === 'idle') return;
    setExpanded(!expanded);
  };

  const handleAction = () => {
    if (activeState === 'notification') {
      router.push('/chat');
      dismiss();
    }
  };

  // Dimensions based on state
  let width = 120;
  let height = 36;
  let borderRadius = 20;

  if (activeState !== 'idle') {
    width = expanded ? 340 : 200;
    height = expanded ? 80 : 36;
    if (activeState === 'notification' && expanded) height = 90;
    if (activeState === 'tx_processing' && expanded) height = 100;
  }

  return (
    <div className="fixed top-2 md:top-4 left-0 right-0 z-[9999] flex justify-center pointer-events-none">
      <motion.div
        layout
        onClick={handleTap}
        initial={{ y: -50, opacity: 0 }}
        animate={{ 
          y: 0, 
          opacity: 1, 
          width, 
          height,
          borderRadius
        }}
        transition={{ 
          type: "spring", 
          stiffness: 400, 
          damping: 30,
          mass: 0.8
        }}
        className={`relative bg-black text-white overflow-hidden shadow-2xl flex items-center ${activeState !== 'idle' ? 'pointer-events-auto cursor-pointer' : ''}`}
        style={{
          boxShadow: '0 10px 40px -10px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1) inset'
        }}
      >
        <AnimatePresence mode="wait">
          {activeState === 'idle' && (
            <motion.div 
              key="idle"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              className="w-full flex justify-center items-center gap-2 px-4"
            >
              <div className="w-2 h-2 rounded-full bg-white/20" />
            </motion.div>
          )}

          {activeState === 'calling' && (
            <motion.div 
              key="calling"
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex items-center justify-between px-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                  <Phone size={12} fill="currentColor" />
                </div>
                {expanded && (
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col">
                    <span className="text-[11px] font-bold text-white/50 uppercase tracking-widest">Active Call</span>
                    <span className="text-[13px] font-medium text-white">{payload?.title || 'Unknown Peer'}</span>
                  </motion.div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {expanded && (
                   <div className="flex gap-1 items-center mr-2 h-4">
                     {[...Array(5)].map((_, i) => (
                       <motion.div 
                         key={i} 
                         animate={{ height: [4, 12, 4] }} 
                         transition={{ repeat: Infinity, duration: 1, delay: i * 0.1 }}
                         className="w-[2px] bg-green-400 rounded-full" 
                       />
                     ))}
                   </div>
                )}
                <span className="text-[13px] font-mono text-green-400 font-bold">{formatTime(timer)}</span>
              </div>
            </motion.div>
          )}

          {activeState === 'recording' && (
            <motion.div 
              key="recording"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex items-center justify-between px-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                {expanded && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[12px] font-mono uppercase tracking-widest text-white/70">
                    Recording Audio
                  </motion.span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-[2px] items-center h-4">
                   {[...Array(8)].map((_, i) => (
                     <motion.div 
                       key={i} 
                       animate={{ height: [3, Math.random() * 12 + 4, 3] }} 
                       transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.05 }}
                       className="w-[2px] bg-red-500 rounded-full" 
                     />
                   ))}
                </div>
                <span className="text-[13px] font-mono text-red-500 font-bold">{formatTime(timer)}</span>
              </div>
            </motion.div>
          )}

          {activeState === 'syncing' && (
            <motion.div 
              key="syncing"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex items-center justify-between px-4"
            >
              <div className="flex items-center gap-3">
                <Loader2 size={14} className="text-blue-400 animate-spin" />
                {expanded && (
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col">
                    <span className="text-[11px] font-bold text-blue-400 uppercase tracking-widest">Network Sync</span>
                    <span className="text-[12px] font-medium text-white/70">Connecting to Aztec L2...</span>
                  </motion.div>
                )}
              </div>
              {!expanded && <span className="text-[11px] font-mono text-blue-400 font-bold tracking-widest">SYNC</span>}
            </motion.div>
          )}

          {activeState === 'wallet_connected' && (
            <motion.div 
              key="wallet"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex items-center justify-between px-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white">
                  <Wallet size={12} />
                </div>
                {expanded ? (
                  <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col">
                    <span className="text-[11px] font-bold text-white/50 uppercase tracking-widest">Wallet Linked</span>
                    <span className="text-[13px] font-medium text-white">{payload?.title || '0x...'}</span>
                  </motion.div>
                ) : (
                  <span className="text-[12px] font-mono font-bold">Linked</span>
                )}
              </div>
              <CheckCircle2 size={16} className="text-white" />
            </motion.div>
          )}

          {activeState === 'notification' && (
            <motion.div 
              key="notification"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex items-center justify-between px-4 w-full"
            >
              <div className="flex items-center gap-3 w-full">
                <div className="w-8 h-8 rounded-full bg-blue-600 shrink-0 flex items-center justify-center overflow-hidden">
                   {payload?.icon ? <img src={payload.icon} className="w-full h-full object-cover" /> : <Bell size={14} className="text-white" />}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-white truncate">{payload?.title || 'New Message'}</span>
                    {!expanded && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                  {expanded && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[13px] text-white/70 truncate mt-1">
                      {payload?.subtitle || 'Tap to view'}
                    </motion.span>
                  )}
                </div>
              </div>
              {expanded && (
                <button onClick={handleAction} className="ml-2 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 hover:bg-white/20 transition-colors">
                  <ChevronRight size={16} className="text-white" />
                </button>
              )}
            </motion.div>
          )}

          {activeState === 'tx_processing' && (
            <motion.div 
              key="tx_processing"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex flex-col justify-center px-4"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <Shield size={16} className="text-[#1c7aff]" />
                  <span className="text-[13px] font-bold text-white">{expanded ? 'Zero-Knowledge Proof' : 'Proving...'}</span>
                </div>
                <Loader2 size={14} className="text-[#1c7aff] animate-spin" />
              </div>
              {expanded && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 w-full">
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-[#1c7aff]"
                      animate={{ width: ['0%', '100%'] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-white/50 mt-2 text-center">Generating SNARK</p>
                </motion.div>
              )}
            </motion.div>
          )}
          
          {activeState === 'tx_success' && (
            <motion.div 
              key="tx_success"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex items-center justify-between px-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-white text-black flex items-center justify-center">
                  <CheckCircle2 size={14} />
                </div>
                <span className="text-[13px] font-bold text-white">Verified</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
