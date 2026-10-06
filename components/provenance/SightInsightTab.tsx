'use client';

import { motion } from 'framer-motion';
import { Eye, Shield, Activity, Zap, TrendingUp, Network, Globe } from 'lucide-react';
import { useState, useEffect } from 'react';

const stats = [
  { id: 1, label: 'Quantum Shielded Txs', value: '1.2M', trend: '+14,000%', color: 'text-green-500' },
  { id: 2, label: 'Active ZK Relayers', value: '4,096', trend: '+8,500%', color: 'text-[#25D366]' },
  { id: 3, label: 'Global Node Density', value: '89.4%', trend: '+3,200%', color: 'text-purple-500' },
  { id: 4, label: 'Data Encryption Depth', value: 'Tier 5', trend: 'MAX', color: 'text-orange-500' },
];

export function SightInsightTab() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="w-full min-h-[60vh] flex flex-col items-center">
      {/* Header Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative w-full max-w-4xl rounded-2xl overflow-hidden bg-black text-white p-8 mb-12 shadow-2xl"
      >
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
        <div className="relative z-10 flex flex-col items-center text-center">
          <Eye size={48} className="mb-4 text-white/80" />
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-[0.2em] mb-4">
            Sight Insight
          </h1>
          <p className="text-sm md:text-base font-medium tracking-widest text-white/60 max-w-2xl">
            Abysmal Quantum Growth Engine • Aztec Vision Achieved
          </p>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="flex flex-col items-center justify-center p-6 bg-white border border-black/5 rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-2">{stat.label}</span>
            <span className="text-4xl font-black tracking-tighter text-[#050505] mb-2">{stat.value}</span>
            <span className={`text-[11px] font-bold tracking-widest ${stat.color}`}>
              {stat.trend}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Network Topology */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.5 }}
        className="w-full max-w-4xl bg-white border border-black/10 rounded-2xl p-8 shadow-lg relative overflow-hidden"
      >
        <div className="absolute -right-20 -top-20 opacity-[0.03]">
          <Network size={400} />
        </div>
        
        <h3 className="text-lg font-black uppercase tracking-widest mb-6 flex items-center gap-2">
          <Activity size={18} />
          Telemetry & Abysmal Growth
        </h3>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-black/5 pb-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center">
                <Shield className="text-white" size={16} />
              </div>
              <div>
                <p className="text-sm font-bold tracking-wide">Aztec Privacy Layer Integration</p>
                <p className="text-[10px] uppercase tracking-widest text-black/50">Fully shielded execution on Testnet v5</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-black bg-green-100 text-green-800 px-3 py-1 rounded-full uppercase tracking-wider">Active</span>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-black/5 pb-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center">
                <Globe className="text-white" size={16} />
              </div>
              <div>
                <p className="text-sm font-bold tracking-wide">Global Decentralised Relayers</p>
                <p className="text-[10px] uppercase tracking-widest text-black/50">Mempool censorship resistance</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-black bg-blue-100 text-blue-800 px-3 py-1 rounded-full uppercase tracking-wider">Expanding</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center">
                <Zap className="text-white" size={16} />
              </div>
              <div>
                <p className="text-sm font-bold tracking-wide">Stratospheric Performance Engine</p>
                <p className="text-[10px] uppercase tracking-widest text-black/50">Zero-latency dynamic imports & hot signatures</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-black bg-purple-100 text-purple-800 px-3 py-1 rounded-full uppercase tracking-wider">Optimized</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

