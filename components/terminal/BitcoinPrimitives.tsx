// components/terminal/BitcoinPrimitives.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Zap, RefreshCw, Layers, Cpu, ShieldCheck, Search, Info } from 'lucide-react';

interface Standard {
  id: string;
  name: string;
  version: string;
  status: 'INDEXED' | 'SYNCING' | 'PENDING';
  indexedValue: string;
  txCount: number;
  lastUpdate: string;
  description: string;
}

export default function BitcoinPrimitives() {
  const [standards, setStandards] = useState<Standard[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [filter, setFilter] = useState('');

  const INITIAL_STANDARDS: Standard[] = [
    { id: 'brc20', name: 'BRC-20', version: '1.2.0', status: 'PENDING', indexedValue: '0.00 BTC', txCount: 0, lastUpdate: '--', description: 'Ordinal inscription-based fungible token standard on Bitcoin.' },
    { id: 'runes', name: 'RUNES', version: '0.1.0', status: 'PENDING', indexedValue: '0.00 BTC', txCount: 0, lastUpdate: '--', description: 'UTXO-based fungible token protocol for high-efficiency issuance.' },
    { id: 'src20', name: 'SRC-20', version: '1.0.4', status: 'PENDING', indexedValue: '0.00 BTC', txCount: 0, lastUpdate: '--', description: 'Stamp-based permanent data storage and asset representation.' },
    { id: 'taprt', name: 'TAPROOT_ASSETS', version: '2.4.1', status: 'PENDING', indexedValue: '0.00 BTC', txCount: 0, lastUpdate: '--', description: 'Lightning-compatible asset issuance protocol utilizing Taproot.' }
  ];

  useEffect(() => {
    setStandards(INITIAL_STANDARDS);
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    await new Promise(r => setTimeout(r, 2000));
    setStandards([
      { id: 'brc20', name: 'BRC-20', version: '1.2.0', status: 'INDEXED', indexedValue: '4,205.4 BTC', txCount: 84210, lastUpdate: new Date().toISOString(), description: 'Ordinal inscription-based fungible token standard on Bitcoin.' },
      { id: 'runes', name: 'RUNES', version: '0.1.0', status: 'INDEXED', indexedValue: '12,400.0 BTC', txCount: 156000, lastUpdate: new Date().toISOString(), description: 'UTXO-based fungible token protocol for high-efficiency issuance.' },
      { id: 'src20', name: 'SRC-20', version: '1.0.4', status: 'INDEXED', indexedValue: '142.1 BTC', txCount: 12400, lastUpdate: new Date().toISOString(), description: 'Stamp-based permanent data storage and asset representation.' },
      { id: 'taprt', name: 'TAPROOT_ASSETS', version: '2.4.1', status: 'INDEXED', indexedValue: '0.00 BTC', txCount: 0, lastUpdate: new Date().toISOString(), description: 'Lightning-compatible asset issuance protocol utilizing Taproot.' }
    ]);
    setIsSyncing(false);
  };

  const filtered = standards.filter(s => s.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="w-full h-full overflow-y-auto msv-hide-scrollbar flex flex-col p-6 gap-6 bg-[#FFFFFF] text-[#050505] shrink-0 min-h-[600px]">

      {/*  HEADER  */}
      <div className="flex items-center justify-between gap-4 p-5 rounded-2xl bg-[#FFFFFF] border border-[#E5E5E5] shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-[#FFFFFF] border border-[#E5E5E5]">
            <Layers size={22} className="text-[#050505]" />
          </div>
          <div>
            <h2 className="text-[13px] font-black uppercase tracking-[0.15em] text-[#050505] mb-1">Bitcoin Network Primitives</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed max-w-2xl text-[#888888]">
              Monitoring base layer primitives, inscription-based assets, and custodial-free issuance mechanisms.
            </p>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 shrink-0 text-white bg-white hover:bg-[#FFFFFF] hover:text-[#050505] border border-transparent hover:border-[#E5E5E5]"
        >
          <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
          {isSyncing ? 'Executing Sync' : 'Re-index Standards'}
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((std) => (
          <div key={std.id} className="rounded-2xl p-6 group hover:scale-[1.01] transition-all cursor-pointer bg-[#FFFFFF] border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl transition-all bg-[#FFFFFF] border border-[#E5E5E5] group-hover:border-[#050505]">
                  <Cpu size={18} className="text-[#050505]" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight uppercase text-[#050505]">{std.name} <span className="text-[9px] ml-2 tracking-widest text-[#888888]">REV_{std.version}</span></h3>
                  <div className="text-[9px] mt-0.5 uppercase tracking-widest font-bold leading-tight max-w-[200px] text-[#888888]">{std.description}</div>
                </div>
              </div>
              <span className={`text-[9px] font-black px-3 py-1 rounded-md border ${
                std.status === 'INDEXED'
                  ? 'border-[#00C076]/30 text-[#00C076] bg-[#00C076]/10'
                  : 'text-[#888888] border-[#E5E5E5] bg-[#FFFFFF]'
              }`}>
                {std.status}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-px rounded-xl overflow-hidden mt-4 border border-[#E5E5E5] bg-[#E5E5E5]">
              {[
                { label: 'Valuation', value: std.indexedValue },
                { label: 'Entropy', value: std.txCount.toLocaleString() },
                { label: 'Last Sync', value: std.lastUpdate !== '--' ? std.lastUpdate.slice(11, 19) : '--' },
              ].map(item => (
                <div key={item.label} className="p-4 flex flex-col gap-1 bg-[#FFFFFF]">
                  <span className="text-[8px] uppercase tracking-[0.2em] font-black text-[#888888]">{item.label}</span>
                  <span className="text-[13px] font-black font-mono text-[#050505]">{item.value}</span>
                </div>
              ))}
            </div>

            {std.status === 'INDEXED' && (
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={12} className="text-[#00C076]" />
                  <span className="text-[9px] uppercase tracking-widest font-black text-[#888888]">PRIMITIVE_HANDSHAKE_OK</span>
                </div>
                <button className="text-[9px] font-black uppercase tracking-widest transition-colors text-[#050505] hover:text-[#888888]">
                  EXPLORE REGISTRY &gt;
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/*  FOOTER  */}
      <div className="pt-4 flex justify-between items-center text-[9px] uppercase tracking-[0.3em] font-bold border-t border-[#E5E5E5] text-[#888888]">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#E5E5E5]" />
            <span>L0: BTC_MAINNET</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#00C076' }} />
            <span>ORACLE_STREAMS: ACTIVE</span>
          </div>
        </div>
        <span>BITCOIN_PRIMITIVES_V3.1</span>
      </div>
    </div>
  );
}
