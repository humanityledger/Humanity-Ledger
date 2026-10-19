"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, TrendingUp, AlertTriangle, ChevronRight, Activity } from 'lucide-react';

const MARKET_PREDICTIONS = [
  { id: '1', title: 'Will the Federal Reserve cut rates in May 2026?', category: 'Macro', volumeUsd: 45000000, yesPct: 62, noPct: 38 },
  { id: '2', title: 'Ethereum ETF Inflows cross $1B before June?', category: 'Crypto', volumeUsd: 12000000, yesPct: 45, noPct: 55 },
  { id: '3', title: 'Solana Flips BNB in Market Cap?', category: 'Chain Wars', volumeUsd: 8500000, yesPct: 22, noPct: 78 },
  { id: '4', title: 'OpenAI releases GPT-5 before Q3?', category: 'Tech/AI', volumeUsd: 31000000, yesPct: 81, noPct: 19 },
];

export default function PredictionGridTab() {
  const [activeFilter, setActiveFilter] = useState('All');

  return (
    <div className="w-full bg-transparent text-[#050505] p-12">
      <header className="mb-14 border-b border-black/10 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <Target size={20} className="text-indigo-600" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Embedded Prediction Grid</span>
          </div>
          <h1 className="text-5xl font-black uppercase tracking-tighter">Global Socio-Political Analytics</h1>
        </div>
        <div className="flex gap-2">
           {['All', 'Macro', 'Crypto', 'Tech/AI', 'Chain Wars'].map(filter => (
             <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-full transition-colors ${activeFilter === filter ? 'bg-black text-white' : 'bg-black/5 text-black/50 hover:bg-black/10'}`}
             >
               {filter}
             </button>
           ))}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {MARKET_PREDICTIONS.filter(m => activeFilter === 'All' || m.category === activeFilter).map((market, i) => (
           <motion.div
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: i * 0.05 }}
             key={market.id}
             className="bg-white/40 backdrop-blur-xl border border-black/5 p-6 rounded-3xl shadow-sm hover:shadow-xl transition-all group flex flex-col justify-between"
           >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md">
                    {market.category}
                  </span>
                  <div className="flex items-center gap-1.5 opacity-40">
                     <Activity size={12} />
                     <span className="text-[10px] font-mono">${(market.volumeUsd / 1000000).toFixed(1)}M Vol</span>
                  </div>
                </div>
                
                <h3 className="text-xl font-bold leading-tight mb-8">
                  {market.title}
                </h3>
              </div>

              <div>
                {/* Bar */}
                <div className="w-full h-2 rounded-full overflow-hidden flex mb-4">
                  <div className="h-full bg-[#00C076] transition-all" style={{ width: `${market.yesPct}%` }} />
                  <div className="h-full bg-red-500 transition-all" style={{ width: `${market.noPct}%` }} />
                </div>
                
                <div className="flex justify-between items-center mb-6">
                  <span className="text-xl font-black text-[#00C076]">{market.yesPct}% <span className="text-[10px] uppercase font-mono tracking-widest opacity-50 ml-1">Yes</span></span>
                  <span className="text-xl font-black text-red-500">{market.noPct}% <span className="text-[10px] uppercase font-mono tracking-widest opacity-50 ml-1">No</span></span>
                </div>

                <a 
                  href={`https://bridge.system.network/predict/${market.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-white/20 backdrop-blur-md text-[#050505] p-3 rounded-xl flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest hover:bg-white/40 transition-colors border border-black/5"
                >
                  Direct Capital Routing <ChevronRight size={14} />
                </a>
              </div>
           </motion.div>
         ))}
      </div>
    </div>
  );
}
