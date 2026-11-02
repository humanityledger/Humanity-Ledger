"use client";

import React, { useState, useEffect } from 'react';
import { Server, Activity, Database, Zap, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Public Aztec Mainnet — confirmed by @joshc [AZTC] 2026-07-07
// Browser → public RPC (CORS-enabled). PXE sidecar for server-side ops uses AZTEC_PXE_URL env.
const AZTEC_RPC_URL = process.env.NEXT_PUBLIC_AZTEC_NODE_URL || 'https://node.aztec.network';

export function NetworkStats({ theme = 'default' }: { theme?: 'default' | 'arctic' }) {
  const isArctic = theme === 'arctic';
  const cardClass = isArctic 
    ? "bg-white/80 backdrop-blur-xl border border-slate-200 p-8 rounded-[2.5rem] shadow-sm relative overflow-hidden group hover:border-indigo-200 transition-all duration-500"
    : "bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-sm relative overflow-hidden group hover:border-slate-200 transition-all duration-500";
  
  const iconBoxClass = isArctic
    ? "p-2.5 bg-black/5 text-indigo-600 rounded-xl group-hover:bg-slate-950 group-hover:text-white transition-colors duration-500"
    : "p-2.5 bg-black/5 text-slate-400 rounded-xl group-hover:bg-slate-950 group-hover:text-white transition-colors duration-500";

  const [aztecData, setAztecData] = useState<{
    blockHeight: number | null;
    nodeVersion: string | null;
    chainId: number | null;
    txCount: number | null;
  }>({
    blockHeight: null,
    nodeVersion: null,
    chainId: null,
    txCount: null,
  });

  const [status, setStatus] = useState<'CONNECTING' | 'CONNECTED' | 'ERROR'>('CONNECTING');
  const [logs, setLogs] = useState<string[]>(['[RPC] Initializing connection to Aztec Sandbox...']);

  useEffect(() => {
    let mounted = true;
    let interval: NodeJS.Timeout;

    const fetchAztecRPC = async () => {
      try {
        if (mounted && status === 'CONNECTING') {
            setLogs(prev => [...prev, `[RPC] Handshake with ${AZTEC_RPC_URL}`]);
        }

        const nodeInfoRes = await fetch(AZTEC_RPC_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "node_getNodeInfo", params: [] }) });
        const blockRes = await fetch(AZTEC_RPC_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "node_getBlockNumber", params: [] }) });
        const nodeInfo = (await nodeInfoRes.json()).result || {};
        const blockNumber = (await blockRes.json()).result || 0;

        if (mounted) {
          setAztecData({
            blockHeight: blockNumber,
            nodeVersion: nodeInfo.nodeVersion,
            chainId: nodeInfo.chainId,
            txCount: null, // Aztec node does not expose a global txCount endpoint
          });
          setStatus('CONNECTED');
          if (logs.length < 5) {
              setLogs(prev => [...prev.slice(-3), `[RPC] Synced L2 Block: ${blockNumber}`]);
          }
        }
      } catch (e) {
        if (mounted) {
          setStatus('ERROR');
          setLogs(prev => [...prev.slice(-3), `[RPC] Connection failed. Retrying...`]);
        }
      }
    };

    fetchAztecRPC();
    interval = setInterval(fetchAztecRPC, 3000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Node Status Card */}
      <div className={cardClass}>
        <div className="relative z-10 flex flex-col h-full justify-between gap-6">
            <div className="flex justify-between items-start">
                <div className={iconBoxClass}>
                    <Activity size={18} strokeWidth={3} />
                </div>
                <div className="flex items-center gap-2">
                   <span className={`text-[8px] font-black uppercase tracking-widest ${status === 'CONNECTED' ? 'text-emerald-600' : status === 'CONNECTING' ? 'text-amber-500' : 'text-rose-600'}`}>
                     {status}
                   </span>
                   <div className={`w-1.5 h-1.5 rounded-full ${status === 'CONNECTED' ? 'bg-emerald-500' : status === 'CONNECTING' ? 'bg-amber-500' : 'bg-rose-600'} ${status === 'CONNECTED' ? 'animate-pulse' : ''}`} />
                </div>
            </div>
            <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Aztec RPC Link</span>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl font-black font-mono text-slate-950 tracking-tighter">
                        {status === 'CONNECTED' ? 'ONLINE' : status === 'CONNECTING' ? 'SYNCING...' : 'OFFLINE'}
                    </h3>
                </div>
                {/* Optimistic UI Log Stream */}
                <div className="h-4 overflow-hidden mt-2">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={logs[logs.length - 1]}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="text-[8px] font-mono text-slate-400 uppercase truncate"
                        >
                            {logs[logs.length - 1]}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
      </div>

      {/* Block Height Card */}
      <div className={cardClass}>
        <div className="relative z-10 flex flex-col h-full justify-between gap-6">
            <div className="flex justify-between items-start">
                <div className={iconBoxClass}>
                    <Database size={18} strokeWidth={3} />
                </div>
                 <span className="text-[8px] font-black px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-widest">
                    L2 State
                </span>
            </div>
            <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Block Height</span>
                <div className="flex items-end gap-8">
                    <div>
                        <div className="text-3xl font-black font-mono text-slate-950 tracking-tighter">
                            {aztecData.blockHeight !== null ? (
                                aztecData.blockHeight
                            ) : (
                                <div className="h-8 w-16 bg-black/5 rounded-xl animate-pulse" />
                            )}
                        </div>
                        <div className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mt-1">Confirmed</div>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Transaction Count Card */}
      <div className={cardClass}>
        <div className="relative z-10 flex flex-col h-full justify-between gap-6">
            <div className="flex justify-between items-start">
                <div className={iconBoxClass}>
                    <Zap size={18} strokeWidth={3} />
                </div>
            </div>
            <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Tx Count</span>
                <div className="flex flex-col">
                    <div className="text-3xl font-black font-mono tracking-tighter text-indigo-600">
                         {aztecData.txCount !== null ? (
                             aztecData.txCount.toLocaleString()
                         ) : (
                             <div className="h-8 w-24 bg-black/5 rounded-xl animate-pulse" />
                         )}
                    </div>
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1 leading-relaxed">
                        Shielded Executions
                    </div>
                </div>
            </div>
        </div>
      </div>
      
       {/* Node Version Card */}
       <div className={cardClass}>
        <div className="absolute top-0 right-0 p-8 opacity-5">
            <Cpu size={100} className="text-slate-900" />
        </div>
        <div className="relative z-10 flex flex-col h-full justify-between gap-6">
            <div className="flex justify-between items-start">
                <div className={iconBoxClass}>
                    <Server size={18} strokeWidth={3} />
                </div>
                 <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Client</span>
                </div>
            </div>
            <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Node Version</span>
                <div className="text-2xl font-black font-mono text-slate-950 tracking-tighter">
                    {aztecData.nodeVersion !== null ? (
                        aztecData.nodeVersion
                    ) : (
                        <div className="h-8 w-20 bg-black/5 rounded-xl animate-pulse" />
                    )}
                </div>
                 <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
                    Chain ID: {aztecData.chainId !== null ? aztecData.chainId : '---'}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
