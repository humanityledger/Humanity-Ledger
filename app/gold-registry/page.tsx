"use client";

import React from 'react';
import { Building, ShieldQuestion } from 'lucide-react';

// A plain directory. The previous version showed "Solvency Verified" and
// reserve figures for these platforms after a setTimeout, with no contract
// call, no proof and no data source behind it (R-14 in
// docs/zk/MASTER_PROMPT.md). Nothing here is verified, so nothing is shown as
// verified.
const PLATFORMS = [
  { id: 'binance', name: 'Binance', typeLabel: 'Centralised exchange', features: ['Spot', 'Futures'] },
  { id: 'uniswap', name: 'Uniswap', typeLabel: 'Decentralised exchange', features: ['AMM', 'Permissionless'] },
  { id: 'ledger', name: 'Ledger Nano', typeLabel: 'Hardware wallet', features: ['Cold storage'] },
  { id: 'aave', name: 'Aave', typeLabel: 'DeFi lending protocol', features: ['Overcollateralised loans'] },
];

export default function GoldRegistryPage() {
  return (
    <div className="min-h-screen bg-transparent text-[#050505] p-6 md:p-12">
      <header className="mb-10">
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase">Platform directory</h1>
        <p className="mt-4 text-sm font-medium tracking-wide opacity-60 max-w-xl leading-relaxed">
          A list of platforms for reference. Humanity Ledger does not verify their reserves or solvency:
          there is no proof-of-reserves check behind this page. Use each platform&apos;s own published
          attestations and audits.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 max-w-4xl text-left">
        {PLATFORMS.map((p) => (
          <div key={p.id} className="bg-white p-6 border border-black/10 rounded-2xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 border border-black/10 rounded-xl flex items-center justify-center">
                  <Building size={20} className="opacity-50" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight">{p.name}</h2>
                  <p className="text-xs font-semibold uppercase tracking-widest opacity-60 mt-1">{p.typeLabel}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {p.features.map((f) => (
                      <span key={f} className="text-[10px] font-mono font-bold uppercase tracking-widest bg-black/5 px-2 py-1 rounded-sm">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-black/70">
                <ShieldQuestion size={16} aria-hidden="true" />
                Reserves: not verified by Humanity Ledger
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
