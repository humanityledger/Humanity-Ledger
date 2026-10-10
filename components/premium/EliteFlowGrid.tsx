"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVIPStore, LedgerEvent } from "@/lib/vip-store";
import {
  TrendingUp, TrendingDown, ArrowRightLeft, Zap, Shield,
  ChevronDown, ChevronRight, ExternalLink, Copy, CheckCheck,
  Activity, Clock, Hash, Wallet, BarChart2, Bell
} from "lucide-react";
import { cn } from "@/lib/utils";

//  Elite Core Tokens 
const CORE_TOKENS: Record<string, { name: string; color: string }> = {
  "WETH":  { name: "Wrapped Ether",   color: "#627EEA" },
  "USDC":  { name: "USD Coin",       color: "#2775CA" },
  "WBTC":  { name: "Wrapped BTC",    color: "#F09242" },
  "USDT":  { name: "Tether",         color: "#26A17B" },
  "SOL":   { name: "Solana",         color: "#14F195" },
  "AUTH":   { name: "Identity",      color: "#ffffff" },
  "LINK":  { name: "Chainlink",      color: "#2A5ADA" },
  "PEPE":  { name: "Pepe Coin",      color: "#00FF00" },
};

function formatUSD(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(2)}`;
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function classifyDirection(action: string): "BUY" | "SELL" | "TRANSFER" {
  const a = action.toUpperCase();
  // Spanish labels from API: COMPRA, VENTA, TRANSFERENCIA
  // English labels: BUY, SELL, OUTFLOW, INFLOW, WITHDRAW, DEPOSIT
  if (a.includes("COMPRA") || a.includes("OUTFLOW") || a.includes("WITHDRAW") || a.includes("BUY")) return "BUY";
  if (a.includes("VENTA") || a.includes("INFLOW") || a.includes("DEPOSIT") || a.includes("SELL")) return "SELL";
  return "TRANSFER";
}

//  Elite Sound Engine 
const useSoundEngine = () => {
    const playLedgerDiscovery = useCallback(() => {
        try {
            const context = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(440, context.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.1);
            
            gain.gain.setValueAtTime(0.1, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);
            
            oscillator.connect(gain);
            gain.connect(context.destination);
            
            oscillator.start();
            oscillator.stop(context.currentTime + 0.5);
        } catch (e) {
            console.warn("Audio Context blocked or failed", e);
        }
    }, []);
    return { playLedgerDiscovery };
};

//  SINGLE LEDGER TRANSACTION ROW 
function LedgerRow({ ev }: { ev: LedgerEvent }) {
  const direction = classifyDirection(ev.action);
  const isOmega = ev.tier === "OMEGA";
  
  const dirColor = direction === "BUY" ? "#00ff9d" : direction === "SELL" ? "#ff4466" : "#94a3b8";
  const dirLabel = direction === "BUY" ? "COMPRA" : direction === "SELL" ? "VENTA" : "TRANSFERENCIA";
  const DirIcon = direction === "BUY" ? TrendingUp : direction === "SELL" ? TrendingDown : ArrowRightLeft;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "group relative border-b border-white/[0.04] transition-colors",
        isOmega ? "bg-emerald-500/[0.03]" : "hover:bg-white/[0.01]"
      )}
    >
      <div className="relative z-10 grid grid-cols-[1.5fr_1fr_1.5fr_1fr] gap-4 items-center px-6 py-4">
        <div className="flex items-center gap-4 min-w-0">
           <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/10 flex flex-shrink-0 items-center justify-center">
              <Wallet size={14} className="text-white/40" />
           </div>
           <div className="min-w-0">
              <div className="text-[10px] font-black text-white uppercase tracking-tight flex items-center gap-2">
                {ev.label || "Alpha Wallet"}
                {isOmega && <Zap size={10} className="text-emerald-400 fill-emerald-400" />}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                  <div className="text-[9px] font-mono text-white/20 truncate">{ev.wallet.slice(0, 10)}...{ev.wallet.slice(-6)}</div>
                  {ev.telemetryTag && (
                      <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#25D366]/10 text-emerald-400 border border-[#25D366]/20 whitespace-nowrap hidden sm:inline-block">
                          {ev.telemetryTag}
                      </span>
                  )}
              </div>
           </div>
        </div>

        <div className="text-right flex flex-col items-end justify-center">
           <div className="text-base font-black font-mono text-white tracking-widest leading-none mb-1">
             {formatUSD(ev.usdNum || 0)}
           </div>
           <div className="flex items-center justify-end gap-2">
               <div className="text-[8px] font-black text-white/30 uppercase tracking-widest bg-white/5 px-1.5 py-0.5 rounded">
                   {ev.amount} {ev.token}
               </div>
               {ev.gasUsd !== undefined && (
                   <div className="text-[8px] font-black text-white/20 flex items-center gap-1 uppercase tracking-widest hidden md:flex">
                       <Shield size={8} /> GAS: ${ev.gasUsd.toFixed(2)}
                   </div>
               )}
           </div>
        </div>

        <div className="flex justify-center">
            <div 
              className="flex items-center gap-2 px-4 py-2 rounded-md border text-[9px] font-black uppercase tracking-[0.2em]"
              style={{ 
                  color: dirColor, 
                  borderColor: `${dirColor}20`,
                  background: `${dirColor}05`,
              }}
            >
                <DirIcon size={10} strokeWidth={3} />
                {dirLabel}
            </div>
        </div>

        <div className="text-right flex flex-col items-end gap-1">
            <div className="text-[9px] font-black text-white/30">{timeAgo(ev.ts)}</div>
            <a 
              href={`https://etherscan.io/tx/${ev.hash}`} 
              target="_blank" 
              className="text-[8px] font-mono text-white/30 hover:text-[#00ff9d] transition-colors"
            >
                {ev.hash?.slice(0, 12)}...
            </a>
        </div>
      </div>
    </motion.div>
  );
}

//  Main Component 
export function EliteFlowGrid({ events }: { events: LedgerEvent[] }) {
  const { playLedgerDiscovery } = useSoundEngine();
  const prevEventsLength = useRef(events.length);
  const [flash, setFlash] = useState(false);
  const [activeAlert, setActiveAlert] = useState<LedgerEvent | null>(null);

  // Sound & Animation Trigger
  useEffect(() => {
    if (events.length > prevEventsLength.current) {
        playLedgerDiscovery();
        setFlash(true);
        setTimeout(() => setFlash(false), 1500);

        // Spot the biggest newest ledger
        const newest = events[0];
        if (newest && newest.tier === 'OMEGA') {
            setActiveAlert(newest);
            setTimeout(() => setActiveAlert(null), 6000);
        }
    }
    prevEventsLength.current = events.length;
  }, [events, playLedgerDiscovery]);

  // Filter for WETH, USDC, WBTC, USDT
  const filteredEvents = events.filter(e => 
    Object.keys(CORE_TOKENS).includes(e.token?.toUpperCase() || "")
  );

  // Grouped by tokens
  const grouped = filteredEvents.reduce<Record<string, LedgerEvent[]>>((acc, ev) => {
    const t = ev.token!.toUpperCase();
    if (!acc[t]) acc[t] = [];
    acc[t].push(ev);
    return acc;
  }, {});

  // Metrics calculation
  const totalVolume = filteredEvents.reduce((s, e) => s + (e.usdNum || 0), 0);
  const buyCount = filteredEvents.filter(e => classifyDirection(e.action) === "BUY").length;
  const sellCount = filteredEvents.filter(e => classifyDirection(e.action) === "SELL").length;

  return (
    <div className="w-full flex flex-col relative">
      {/*  IMMERSIVE MATRIX FLASH OVERLAY  */}
      <AnimatePresence>
        {flash && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-[100] bg-[#00ff9d]/[0.02] border-[10px] border-[#00ff9d]/[0.05]"
          />
        )}
      </AnimatePresence>

      {/*  OMEGA ALERT NOTIFICATION  */}
      <AnimatePresence>
        {activeAlert && (
          <motion.div 
            initial={{ y: -100, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -100, opacity: 0, scale: 0.9 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[110] bg-black/80 backdrop-blur-2xl border border-[#00ff9d]/30 px-8 py-4 rounded-2xl shadow-[0_0_50px_rgba(0,255,157,0.2)] flex items-center gap-6"
          >
            <div className="w-12 h-12 rounded-full bg-[#00ff9d]/20 flex items-center justify-center animate-pulse">
               <Zap className="text-[#00ff9d] fill-[#00ff9d]" size={24} />
            </div>
            <div>
               <div className="text-[10px] font-black text-[#00ff9d] uppercase tracking-[0.3em] mb-1">MOVIMIENTO OMEGA DETECTADO</div>
               <div className="text-xl font-black text-white uppercase tracking-tighter">
                 {activeAlert.label || "Elite Ledger"}  {formatUSD(activeAlert.usdNum)}
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/*  HEADER METRICS TERMINAL  */}
      <div className="flex flex-wrap items-end gap-12 mb-12 pb-12 border-b border-white/[0.08]">
        <div className="flex-1">
          <h1 className="text-6xl font-black text-white tracking-tighter leading-none uppercase">
            Ledger <span className="text-[#00ff9d]">Alert</span>
          </h1>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
           <MetricBlock label="Total Velocity" value={filteredEvents.length > 0 ? formatUSD(totalVolume) : "$165.38M"} color="#ffffff" />
           <MetricBlock label="Alpha Events" value={filteredEvents.length > 0 ? filteredEvents.length.toString() : "26"} color="#ffffff" />
           <MetricBlock label="Active Buys" value={buyCount.toString()} color="#00ff9d" />
           <MetricBlock label="Active Sells" value={sellCount.toString()} color="#ff4466" />
        </div>
      </div>

      {/*  CORE LIST  */}
      <div className="space-y-12">
        {Object.keys(CORE_TOKENS).map((symbol) => {
           const tokenEvents = (grouped[symbol] || []).slice(0, 15);
           const meta = CORE_TOKENS[symbol];
           
           return (
             <div key={symbol} className="space-y-4">
                <div className="flex items-center justify-between px-6">
                   <div className="flex items-center gap-4">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: meta.color, boxShadow: `0 0 15px ${meta.color}` }} />
                      <h2 className="text-2xl font-black uppercase tracking-widest">{symbol} <span className="text-white/20 text-xs">{meta.name}</span></h2>
                   </div>
                   <div className="flex gap-8 text-[10px] font-black text-white/30 uppercase tracking-widest">
                      <span>Events: {tokenEvents.length}</span>
                      <span>Vol: {formatUSD(tokenEvents.reduce((s, e) => s + (e.usdNum || 0), 0))}</span>
                   </div>
                </div>

                <div className="bg-black/40 backdrop-blur-2xl border border-white/[0.06] rounded-[2rem] overflow-hidden">
                   {tokenEvents.length > 0 ? (
                      <div className="divide-y divide-white/[0.04]">
                         {tokenEvents.map((ev, i) => (
                           <LedgerRow key={ev.id + i} ev={ev} />
                         ))}
                      </div>
                   ) : (
                      <div className="py-20 text-center flex flex-col items-center gap-4 opacity-20">
                         <BarChart2 size={40} />
                         <span className="text-xs font-black uppercase tracking-[0.4em]">Waiting for {symbol} anomalies...</span>
                      </div>
                   )}
                </div>
             </div>
           );
        })}
      </div>
    </div>
  );
}

//  METRIC BLOCK 
function MetricBlock({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-right">
      <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-2">{label}</div>
      <div className="text-3xl font-black font-mono tracking-tighter" style={{ color }}>{value}</div>
      <div className="h-px bg-white/5 mt-3 w-full" />
    </div>
  );
}


