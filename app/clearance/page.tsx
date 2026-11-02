"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Navigation, Scale, FileText, ArrowRight } from 'lucide-react';

const OTC_COUNTERS = [
  { id: 'itrust', name: 'iTrustCapital', tier: 'System IRA', minDeposit: 100000, fee: '1% Attest', color: '#1A365D' },
  { id: 'galaxy', name: 'Galaxy Digital OTC', tier: 'Sovereign Dark-Pool', minDeposit: 5000000, fee: 'Bespoke', color: '#000000' },
  { id: 'falconx', name: 'FalconX Prime', tier: 'Execution Desk', minDeposit: 1000000, fee: 'Spread Base', color: '#4F46E5' }
];

export default function ClearanceTab() {
  const [selectedDesk, setSelectedDesk] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#020202] text-white p-12 relative overflow-hidden font-sans">
      {/* Dark-Pool Aesthetic Grid */}
      <div className="absolute inset-0 pattern-grid-lg opacity-[0.02]" />

      <header className="relative z-10 mb-20 max-w-4xl">
        <div className="flex items-center gap-3 mb-4">
          <Lock size={16} className="text-red-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-red-500">
            Clearance Clearance Level 9
          </span>
        </div>
        <h1 className="text-6xl font-black uppercase tracking-tighter mb-4">Ledger Clearance / OTC</h1>
        <p className="text-sm font-medium tracking-wide opacity-50 max-w-2xl leading-relaxed">
          Access heavily vetted, sovereign-grade Over-The-Counter (OTC) desks and System IRA gateways. Bypassing public order books eliminates slippage on high-velocity wealth transfers.
        </p>
      </header>

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Desks Selection */}
        <div className="col-span-1 md:col-span-2 space-y-4">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 mb-6 border-b border-white/10 pb-2">Sovereign Routing Endpoints</h2>
          {OTC_COUNTERS.map((desk) => (
            <div 
              key={desk.id}
              role="button"
              onClick={() => setSelectedDesk(desk.id)}
              className={`flex items-center justify-between p-6 rounded-2xl border transition-all ${selectedDesk === desk.id ? 'border-red-500/50 bg-white/5' : 'border-white/10 bg-white hover:border-white/30'}`}
            >
              <div className="flex items-center gap-6">
                <div className="w-2 h-12 rounded-full" style={{ backgroundColor: desk.color }} />
                <div>
                  <h3 className="text-2xl font-black uppercase mb-1">{desk.name}</h3>
                  <span className="text-[10px] font-mono tracking-widest text-white/50">{desk.tier}</span>
                </div>
              </div>

              <div className="text-right">
                <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 mb-1">Minimum Ticket</p>
                <p className="font-mono text-lg">
                  ${(desk.minDeposit / 1000).toLocaleString()}k+
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Action / Clearance Routing */}
        <div className="col-span-1">
          <AnimatePresence mode="wait">
            {selectedDesk ? (
              <motion.div 
                key="active"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white border border-white/10 p-8 rounded-3xl sticky top-12"
              >
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6">
                  <Navigation size={20} className="text-white" />
                </div>
                <h3 className="text-xl font-black uppercase mb-2">Initialize Routing</h3>
                <p className="text-xs tracking-wide opacity-50 mb-8 leading-relaxed">
                  You are about to be routed via the System Bridge. This connection is cryptographically signed to ensure you receive zero-slippage execution and exclusive white-glove onboarding.
                </p>

                <div className="space-y-4 mb-8 border-y border-white/10 py-6">
                  <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-widest">
                    <span className="opacity-50">System Audit Log</span>
                    <span className="text-green-500">Verified</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-widest">
                    <span className="opacity-50">Routing Status</span>
                    <span className="text-indigo-400 animate-pulse">Ready</span>
                  </div>
                </div>

                <a 
                  href={`https://bridge.system.network/otc/${selectedDesk}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-white text-black py-4 rounded-xl flex items-center justify-center gap-3 font-black uppercase text-xs tracking-widest hover:bg-gray-200 transition-colors"
                >
                  Confirm Execution Flow <ArrowRight size={14} />
                </a>
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center p-8 opacity-30 border border-white/5 border-dashed rounded-3xl"
              >
                <Scale size={32} className="mb-4" />
                <p className="text-[10px] font-mono uppercase tracking-widest">Select a desk to initialize system routing framework</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
