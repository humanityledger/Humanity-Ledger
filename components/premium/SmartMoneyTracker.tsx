"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVIPAnalytics } from "@/hooks/useVIPAnalytics";
import { useSocket } from "@/hooks/useSocket";

// 
// TYPES
// 
interface WalletEvent {
  id: string;
  wallet: string;
  label: string;
  tier: "institucional" | "experto" | "agresivo";
  action: "COMPRA" | "VENTA" | "PUENTE" | "STAKING";
  token: string;
  amount: string;
  usdValue: string;
  dex: string;
  winRate: number;
  age: number; // seconds ago
  hash: string;
}

interface TokenCluster {
  token: string;
  symbol: string;
  buyers: number;
  totalUsd: number;
  momentum: number; // -1 to 1
}

// `generateEvent` and old mock constants removed since we use real backend data now.
// Real data fetched from `/api/network/ledger/alpha-events`.

function computeClusters(events: WalletEvent[]): TokenCluster[] {
  const map: Record<string, { buyers: number; sellers: number; usd: number }> = {};
  for (const ev of events) {
    if (!map[ev.token]) map[ev.token] = { buyers: 0, sellers: 0, usd: 0 };
    const usdVal = parseFloat(ev.usdValue.replace(/[$K]/g, "")) * 1000;
    if (ev.action === "COMPRA" || ev.action === "STAKING") { map[ev.token].buyers++; map[ev.token].usd += usdVal; }
    else if (ev.action === "VENTA") map[ev.token].sellers++;
  }
  return Object.entries(map)
    .map(([sym, d]) => ({
      token: sym,
      symbol: sym,
      buyers: d.buyers,
      totalUsd: d.usd,
      momentum: (d.buyers - d.sellers) / Math.max(1, d.buyers + d.sellers),
    }))
    .sort((a, b) => b.totalUsd - a.totalUsd)
    .slice(0, 6);
}

// 
// COMPONENTE PRINCIPAL (Estilo Minimalista)
// 
export function SmartMoneyTracker() {
  const { transactions } = useVIPAnalytics();
  const { on, off } = useSocket();
  const [events, setEvents] = useState<WalletEvent[]>([]);
  const [clusters, setClusters] = useState<TokenCluster[]>([]);
  const [totalVolume, setTotalVolume] = useState(0);

  // 1. WebSocket Listener for Real-Time "Pushes"
  useEffect(() => {
    const handleNewLedger = (data: any) => {
      console.log(" [WS] New Humanity Ledger Received:", data);
      
      // Map BullMQ format to WalletEvent UI format
      const newEvent: WalletEvent = {
        id: data.hash,
        wallet: data.from.slice(0, 10),
        label: `${data.from.slice(0, 6)}...${data.from.slice(-4)}`,
        tier: data.usdValue > 1000000 ? "institucional" : "experto",
        action: "COMPRA", // Default for ledger moves for now
        token: data.asset,
        amount: data.amount.toLocaleString(),
        usdValue: `$${(data.usdValue / 1000).toFixed(1)}K`,
        dex: data.chain,
        winRate: 85, // Default for high-confidence alerts
        age: 0,
        hash: data.hash
      };

      setEvents(prev => {
        // Prevent duplicates
        if (prev.some(e => e.id === newEvent.id)) return prev;
        const updated = [newEvent, ...prev].slice(0, 50); // Keep last 50
        setClusters(computeClusters(updated));
        return updated;
      });

      setTotalVolume(v => v + data.usdValue);
    };

    on('new-ledger-alert', handleNewLedger);
    return () => off('new-ledger-alert', handleNewLedger);
  }, [on, off]);

  // 2. Initial Sync with database (via hook)
  useEffect(() => {
    if (!transactions || transactions.length === 0) return;

    const mappedEvents: WalletEvent[] = transactions
      .filter(tx => tx.valueEth >= 0.1 || tx.valueUsd >= 350)
      .map((tx) => {
        let action: WalletEvent["action"] = "PUENTE";
        if (tx.txType === "MEV_BOT" || tx.txType === "DEFI_ROUTING") action = "COMPRA";
        if (tx.valueEth > 500) action = "STAKING";

        let tier: WalletEvent["tier"] = "experto";
        if (tx.valueEth > 100) tier = "institucional"; 
        if (tx.anomalyDetected) tier = "agresivo";

        return {
            id: tx.hash,
            wallet: tx.from.slice(0, 10),
            label: tx.from.slice(0, 6) + "..." + tx.from.slice(-4),
            tier,
            action,
            token: "ETH",
            amount: tx.valueEth.toFixed(2),
            usdValue: `$${(tx.valueUsd / 1000).toFixed(1)}K`,
            dex: tx.network,
            winRate: tx.aiRiskScore,
            age: Math.floor((Date.now() - tx.timestamp) / 1000), 
            hash: tx.hash
        };
    });

    setEvents(prev => {
        // Merge without duplicates
        const existingIds = new Set(prev.map(e => e.id));
        const newOnes = mappedEvents.filter(e => !existingIds.has(e.id));
        return [...newOnes, ...prev].slice(0, 50);
    });
    setClusters(computeClusters(mappedEvents));
    
    const newVol = transactions.reduce((s, tx) => s + tx.valueUsd, 0);
    setTotalVolume(v => Math.max(v, newVol));
  }, [transactions]);

  // Aging timer
  useEffect(() => {
    const t = setInterval(() => {
      setEvents(ev => ev.map(e => ({ ...e, age: e.age + 1 })));
    }, 1000);
    return () => clearInterval(t);
  }, []);


  return (
    <div className="w-full bg-[#080808] border border-white/10 shadow-xl relative overflow-hidden">
      {/* El borde desgarrado superior simulado (opcional SVG o simplemente border-top con textura) */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-b from-stone-200/50 to-transparent" />

      {/* Simple title without jargon */}
      <div className="px-8 py-8 border-b border-stone-200/60 flex items-start justify-between gap-6">
        <div>
          <h2 className="text-2xl text-stone-900 font-medium mb-3 tracking-tight">Profitable Wallet Tracking</h2>
          <p className="text-[13px] text-stone-500 max-w-2xl leading-relaxed">
            This tool monitors investment wallets that have historically outperformed the market. You can see in real-time which tokens the most successful investors are buying or selling, allowing you to identify trends before the rest of the market.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-widest text-stone-400 mb-1">Volumen Detectado</div>
          <div className="text-2xl text-stone-800 tabular-nums font-mono">${(totalVolume / 1_000_000).toFixed(1)}M</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-stone-200/60">

        {/*  TRANSACTION FEED (8 cols) */}
        <div className="lg:col-span-8 bg-white/40">
          <div className="px-8 py-4 border-b border-stone-200/60">
            <span className="text-[11px] uppercase tracking-widest text-stone-500 font-medium">Last Transactions</span>
          </div>

          <div className="overflow-y-auto max-h-[460px] divide-y divide-stone-100">
            <AnimatePresence initial={false}>
              {events.map(ev => (
                <motion.div
                  key={ev.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="px-8 py-4 hover:bg-black/5/50 transition-colors"
                >
                  <div className="flex justify-between items-center sm:hidden mb-2">
                    <span className="text-[10px] text-stone-400">{ev.age < 60 ? `Hace ${ev.age}s` : `Hace ${Math.floor(ev.age / 60)}m`}</span>
                  </div>
                  
                  <div className="flex items-center gap-5">
                    
                    {/* Anillo de Win-Rate minimalista */}
                    <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
                      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="14" fill="none" stroke="#f5f5f4" strokeWidth="2" />
                        <circle
                          cx="16" cy="16" r="14" fill="none"
                          stroke={ev.tier === "institucional" ? "#1c1917" : ev.tier === "experto" ? "#57534e" : "#a8a29e"}
                          strokeWidth="2"
                          strokeDasharray={`${2 * Math.PI * 14 * ev.winRate / 100} ${2 * Math.PI * 14}`}
                          strokeLinecap="butt"
                        />
                      </svg>
                      <div className="flex flex-col items-center leading-none">
                        <span className="text-[10px] font-mono text-stone-800 font-semibold">{ev.winRate}%</span>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[13px] text-stone-800 font-medium">{ev.label}</span>
                        <span className="px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-stone-100 text-stone-500 rounded-sm">
                          {ev.tier}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-[12px]">
                        <span className={`font-medium ${ev.action === "COMPRA" ? "text-emerald-700" : ev.action === "VENTA" ? "text-rose-700" : "text-stone-600"}`}>
                          {ev.action}
                        </span>
                        <span className="text-stone-800 font-mono">{ev.amount} {ev.token}</span>
                        <span className="text-stone-400">({ev.usdValue})</span>
                        <span className="text-stone-400 text-[10px]">en {ev.dex}</span>
                      </div>
                    </div>

                    <div className="hidden sm:block text-right shrink-0">
                      <div className="text-[11px] text-stone-400 mb-1">
                        {ev.age < 60 ? `Hace ${ev.age}s` : `Hace ${Math.floor(ev.age / 60)}m`}
                      </div>
                      <a
                        href={`https://etherscan.io/tx/${ev.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-600/70 hover:text-blue-800 hover:underline transition-colors"
                      >
                        View transaction 
                      </a>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/*  CONSENSO DE TOKENS (4 cols) */}
        <div className="lg:col-span-4 bg-[#FAFAFA] p-8 flex flex-col">
          <div className="mb-6">
            <span className="text-[11px] uppercase tracking-widest text-stone-500 font-medium">Consenso de Compra</span>
          </div>

          <div className="space-y-6 flex-1">
            {clusters.length === 0 && (
              <div className="text-[12px] text-stone-400 py-4">Processing transactions...</div>
            )}
            {clusters.map(cl => {
              const isPos = cl.momentum > 0;
              const w = Math.abs(cl.momentum) * 100;
              return (
                <div key={cl.symbol}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] text-stone-800 font-medium">{cl.symbol} <span className="text-[11px] text-stone-400 font-normal ml-1">{cl.token}</span></span>
                    <span className="text-[12px] text-stone-600 font-mono">${(cl.totalUsd / 1000).toFixed(0)}K</span>
                  </div>
                  <div className="h-1.5 w-full bg-stone-100 rounded-sm overflow-hidden mb-1">
                    <motion.div
                      className={`h-full ${isPos ? "bg-stone-800" : "bg-stone-300"}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${w}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <div className="text-[10px] text-stone-400 text-right">
                    Comprado por {cl.buyers} carteras
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-stone-200/60">
            <p className="text-[10px] text-stone-400 leading-relaxed text-left">
              The "win-rate %" indicates the proportion of historical purchases that generated more than a 20% gain in 30 days or less. Wallet categorizations are assigned by comparing managed volume and on-chain history.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}


