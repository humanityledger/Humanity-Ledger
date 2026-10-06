"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Server, Zap, Globe, Cpu, Hash } from 'lucide-react';

interface BlockchainStats {
  height: number;
  difficulty: number;
  bestBlockHash: string;
  mempoolSize: number;
  latency: number;
}

export default function NetworkMonitor() {
  const [btcStats, setBtcStats] = useState<BlockchainStats | null>(null);
  const [baseLatency, setBaseLatency] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBtcStats = async () => {
      const start = performance.now();
      try {
        // Use the dedicated endpoint via a proxy or direct if allowed (CORS might block direct, 
        // usually we'd go through an API route to hide the key, but for demo we assume next.config rewrites or backend proxy)
        // For security, we should ideally fetch via our own API route which uses the secret env var.
        const res = await fetch('/api/network/btc-status');
        const data = await res.json();
        
        const end = performance.now();
        setBtcStats({
          height: data.blocks,
          difficulty: data.difficulty,
          bestBlockHash: data.bestBlockHash,
          mempoolSize: data.mempoolSize || 0,
          latency: Math.round(end - start)
        });
      } catch (e) {
        console.error("BTC Node error", e);
      }
    };

    const pingBase = async () => {
        const start = performance.now();
        try {
            await fetch('/api/network/base-status'); // Simple ping
            const end = performance.now();
            setBaseLatency(Math.round(end - start));
        } catch (e) {
            console.error("Base Node error", e);
        }
    };

    fetchBtcStats();
    pingBase();
    const interval = setInterval(() => {
        fetchBtcStats();
        pingBase();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-3xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <img src="/logo-mark.png" alt="Logo" className="w-24 h-24 object-contain" />
        </div>

        <div className="flex items-center gap-5 mb-10 relative z-10">
            <div className="p-4 bg-[#25D366]/10 rounded-2xl border border-[#25D366]/20 shadow-xl backdrop-blur-md">
                <Globe className="text-blue-400" size={32} />
            </div>
            <div>
                <h3 className="text-2xl font-black text-white tracking-tighter uppercase italic">Node Network Core</h3>
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mt-1">DEDICATED NODE UPLINK ESTABLISHED</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* BTC NODE */}
            <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-2xl relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 text-orange-500/10 group-hover:text-orange-500/20 transition-all">
                    <Hash size={80} />
                </div>
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                        <Server size={16} className="text-orange-500" />
                        <span className="text-xs font-black text-orange-500 uppercase tracking-widest">Bitcoin Core</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-[10px] font-mono text-green-500">ONLINE</span>
                    </div>
                </div>
                
                <div className="space-y-3 relative z-10">
                    <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Block Height</div>
                        <div className="text-2xl font-black text-white font-mono">
                            {(btcStats?.height || 0).toLocaleString()}
                        </div>
                    </div>
                    <div className="flex justify-between items-end">
                        <div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Latency</div>
                            <div className="font-mono text-green-400 font-bold">{btcStats?.latency || 0}ms</div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Provider</div>
                            <div className="font-black text-white">GETBLOCK</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* BASE NODE */}
             <div className="p-4 bg-blue-600/5 border border-blue-600/20 rounded-2xl relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 text-blue-600/10 group-hover:text-blue-600/20 transition-all">
                    <Zap size={80} />
                </div>
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                        <Cpu size={16} className="text-[#25D366]" />
                        <span className="text-xs font-black text-[#25D366] uppercase tracking-widest">Base RPC</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-[10px] font-mono text-green-500">50K CU/DAY</span>
                    </div>
                </div>
                
                <div className="space-y-3 relative z-10">
                    <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Throughput Capacity</div>
                        <div className="text-2xl font-black text-white font-mono">
                            NOMINAL
                        </div>
                    </div>
                    <div className="flex justify-between items-end">
                        <div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Ping</div>
                            <div className="font-mono text-green-400 font-bold">{baseLatency}ms</div>
                        </div>
                        <div className="text-right">
                             <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Status</div>
                             <div className="font-black text-blue-400">OPERATIONAL</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}


