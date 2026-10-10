"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Zap, Activity, Waves, TrendingUp, Award, CheckCircle2, X, BrainCircuit, AlertTriangle, Fingerprint } from 'lucide-react';
import { safeToFixed } from '@/lib/utils/number-format';
import { ForensicAnalysis } from '@/lib/services/AIService';

interface LedgerVerificationReportProps {
  address: string;
  label: string;
  category: string;
  influenceScore: number;
  evidence: string[];
  totalValue: number;
  identityTier?: string;
  forensics?: ForensicAnalysis;
  onClose: () => void;
}

export default function LedgerVerificationReport({
  address,
  label,
  category,
  influenceScore,
  evidence,
  totalValue,
  identityTier,
  forensics,
  onClose
}: LedgerVerificationReportProps) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-[#0B0E11] border border-[#25D366]/30 w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_rgba(59,130,246,0.2)] relative"
      >
        {/* Header/Banner */}
        <div className="h-32 bg-gradient-to-r from-emerald-900/40 via-emerald-600/20 to-purple-900/40 relative">
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center">
                    <ShieldCheck size={48} className="text-emerald-400 mb-2 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                    <h2 className="text-xs font-black text-emerald-400 uppercase tracking-[0.3em]">Ledger Identity Verified</h2>
                </div>
            </div>
            <button 
                onClick={onClose}
                className="absolute top-6 right-6 p-2 bg-black/40 hover:bg-white/10 rounded-full text-white transition-all"
            >
                <X size={20} />
            </button>
        </div>

        <div className="p-10 space-y-8">
            {/* Main Identity Section */}
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-4xl font-black text-white tracking-tighter mb-1">{label}</h3>
                    <p className="text-sm font-mono text-gray-500">{address}</p>
                </div>
                <div className="text-right">
                    <div className="text-xs font-bold text-gray-500 uppercase mb-1">Status Institucional</div>
                    <div className="px-4 py-1.5 bg-emerald-600 text-white rounded-full text-sm font-black uppercase shadow-lg shadow-emerald-900/40">
                        {category}
                    </div>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-[1.5rem] p-6">
                    <div className="flex items-center gap-3 text-emerald-400 mb-2">
                        <Zap size={20} />
                        <span className="text-xs font-bold uppercase tracking-widest">Influence Score</span>
                    </div>
                    <div className="text-4xl font-black text-white">{influenceScore}<span className="text-lg text-gray-500 ml-1">/100</span></div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full mt-4 overflow-hidden">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${influenceScore}%` }}
                            className="h-full bg-[#25D366]"
                        />
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-[1.5rem] p-6">
                    <div className="flex items-center gap-3 text-green-400 mb-2">
                        <Waves size={20} />
                        <span className="text-xs font-bold uppercase tracking-widest">Net Worth</span>
                    </div>
                    <div className="text-4xl font-black text-white">
                        ${totalValue >= 1e6 ? safeToFixed(totalValue / 1e6, 2) + 'M' : safeToFixed(totalValue / 1e3, 1) + 'K'}
                    </div>
                    <div className="text-xs font-bold text-gray-500 mt-4 uppercase tracking-tighter">Real On-Chain Liquidity</div>
                </div>
            </div>

            {/* AI Forensic Audit Section */}
            {forensics && (
                <div className="bg-emerald-600/5 border border-[#25D366]/20 rounded-[1.5rem] p-6 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-[#25D366]/10">
                        <div className="flex items-center gap-2 text-emerald-400">
                            <BrainCircuit size={20} />
                            <span className="text-xs font-black uppercase tracking-widest">Deep AI Forensic Audit</span>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                            forensics.riskScore > 60 ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 
                            forensics.riskScore > 30 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 
                            'bg-green-500/20 text-green-400 border border-green-500/30'
                        }`}>
                            Risk Index: {forensics.riskScore}/100
                        </div>
                    </div>
                    
                    <p className="text-sm text-gray-300 font-medium italic">
                        "{forensics.summary}"
                    </p>

                    <div className="grid grid-cols-1 gap-3">
                        {forensics.signals.map((signal: any, idx: number) => (
                            <div key={idx} className="flex gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                                <div className={`shrink-0 mt-0.5 ${
                                    signal.type === 'negative' ? 'text-indigo-400' : 
                                    signal.type === 'positive' ? 'text-green-400' : 'text-emerald-400'
                                }`}>
                                    {signal.type === 'negative' ? <AlertTriangle size={14} /> : 
                                     signal.type === 'positive' ? <Fingerprint size={14} /> : <Activity size={14} />}
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-white uppercase">{signal.title}</div>
                                    <div className="text-[10px] text-gray-400 leading-tight mt-1">{signal.reasoning}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Evidence Section (Consolidated with AI) */}
            <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-400 border-b border-white/10 pb-2 flex items-center gap-2">
                    <Award size={16} className="text-yellow-500" />
                    VERIFICATION EVIDENCE
                </h4>
                <div className="space-y-3">
                    {evidence && evidence.length > 0 ? evidence.map((item, i) => (
                        <motion.div 
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="flex items-center gap-3 text-gray-300"
                        >
                            <CheckCircle2 size={18} className="text-[#25D366] shrink-0" />
                            <span className="text-sm font-medium">{item}</span>
                        </motion.div>
                    )) : (
                         <div className="text-gray-500 text-sm italic">Generando evidencias de comportamiento...</div>
                    )}
                </div>
            </div>

            {/* Verification Footer */}
            <div className="pt-6 border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs font-bold text-gray-500">
                    <div className="flex items-center gap-1">
                        <CheckCircle2 size={14} className="text-green-500" />
                        POAP Verified
                    </div>
                    <div className="flex items-center gap-1">
                        <CheckCircle2 size={14} className="text-green-500" />
                        {identityTier === 'Cryptographic' || identityTier === 'HUMAN' ? 'World ID Verified' : 'History Scanned'}
                    </div>
                </div>
                <button 
                   onClick={onClose}
                   className="bg-white text-black px-8 py-3 rounded-xl font-black hover:bg-emerald-50 transition-colors shadow-xl"
                >
                    ENTENDIDO
                </button>
            </div>
        </div>
      </motion.div>
    </div>
  );
}


