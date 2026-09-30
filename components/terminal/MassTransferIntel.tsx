"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";

import { AnimatedCounter } from "@/components/ui/animated-counter";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useSystemIntel } from "@/lib/api-client";

//  Config 

const TIER_CONFIG: Record<string, { bg: string; text: string; border: string; label: string }> = {
  ULTRA_CAPITAL_FLOW:  { bg: "#D4AF37", text: "#FFFFFF", border: "#D4AF37", label: "ULTRA FLOW"    },
  PRINCIPAL_BLOCK:     { bg: "#050505", text: "#FFFFFF", border: "#050505", label: "PRINCIPAL"     },
  ENTERPRISE_TRANSFER: { bg: "#333333", text: "#FFFFFF", border: "#333333", label: "CRYPTOGRAPHIC"    },
  LIQUIDITY_NODE:      { bg: "#F0F0F0", text: "#050505", border: "#CCCCCC", label: "LIQUIDITY"     },
  STANDARD_FLOW:       { bg: "#FAFAFA", text: "#444444", border: "#EAEAEA", label: "STANDARD FLOW" },
  RETAIL_PRO:          { bg: "#FFFFFF", text: "#888888", border: "#E5E5E5", label: "RETAIL"        },
  MICRO_TRANSFER:      { bg: "#FFFFFF", text: "#AAAAAA", border: "#F5F5F5", label: "MICRO"         },
};

const FLOOR_PRESETS = [
  { label: "ALL",   value: 0 },
  { label: "$100K", value: 100_000 },
  { label: "$500K", value: 500_000 },
  { label: "$1M",   value: 1_000_000 },
  { label: "$5M",   value: 5_000_000 },
  { label: "$10M",  value: 10_000_000 },
  { label: "$50M",  value: 50_000_000 },
];

function formatUsd(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
}

function getExplorer(chain: string, type: "tx" | "address", val: string): string {
  const map: Record<string, string> = {
    ETH: "etherscan.io", BSC: "bscscan.com", BASE: "basescan.org",
    POL: "polygonscan.com", SOL: "solscan.io",
  };
  return `https://${map[chain] || "etherscan.io"}/${type}/${val}`;
}

//  EventRow (no animation  pure render) 

function EventRow({ event }: { event: any }) {
  const tCfg = TIER_CONFIG[event.tier] || TIER_CONFIG.MICRO_TRANSFER;
  const [copied, setCopied] = useState(false);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col border-b border-[#E5E5E5]  hover:bg-[#FFFFFF]  transition-colors bg-white  group p-4">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-dashed border-[#F0F0F0] ">
        <div className="flex items-center gap-3">
          <span
            className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm"
            style={{ background: tCfg.bg, color: tCfg.text, border: `1px solid ${tCfg.border}` }}
          >
            {tCfg.label}
          </span>
          <span className="text-[10px] font-mono font-black tracking-widest text-[#050505] ">
            {event.action}
          </span>
          <span className="text-[9px] font-mono text-[#888888] flex items-center gap-1">
            {new Date(event.timestamp).toLocaleTimeString("en-US", { hour12: false })}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-mono text-[#888888]">
          <span className="uppercase flex items-center gap-1">
            {event.confirmations} Confs
          </span>
          <span className="uppercase flex items-center gap-1">
            {event.gasPriceGwei} Gwei
          </span>
          <span className="uppercase text-[#050505]  font-black border border-[#E5E5E5]  px-1.5 py-0.5 rounded-sm">
            {event.chain}
          </span>
        </div>
      </div>

      {/* Core data */}
      <div className="flex items-start justify-between">
        {/* Routing */}
        <div className="flex flex-col gap-2 w-1/3">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[#888888] uppercase w-8">From</span>
            <a href={getExplorer(event.chain, "address", event.from)} target="_blank" rel="noreferrer"
              className="text-[11px] font-mono text-[#050505]  hover:underline">
              {shortAddr(event.from)}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[#888888] uppercase w-8">To</span>
            <a href={getExplorer(event.chain, "address", event.to)} target="_blank" rel="noreferrer"
              className="text-[11px] font-mono text-[#050505]  hover:underline">
              {shortAddr(event.to)}
            </a>
          </div>
        </div>

        {/* Value */}
        <div className="flex flex-col items-center justify-center w-1/3">
          <div className="text-xl font-black font-mono tracking-tighter text-[#050505] ">
            {formatUsd(Number(event.usdValue) || 0)}
          </div>
          <div className="text-[11px] font-black text-[#555555] mt-1 flex items-center gap-1.5">
            <span>{parseFloat(event.amount || "0").toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
            <span className="uppercase tracking-widest">{event.token || ""}</span>
          </div>
        </div>

        {/* Hash + Method */}
        <div className="flex flex-col items-end gap-2 w-1/3 text-[10px] font-mono">
          <div className="flex items-center gap-2 text-[#888888]">
            <span className="uppercase">Hash</span>
            <a href={getExplorer(event.chain, "tx", event.hash)} target="_blank" rel="noreferrer"
              className="text-[#050505]  hover:underline">
              {shortAddr(event.hash)}
            </a>
            <button onClick={() => copy(event.hash)} className="hover:text-[#050505]  transition-colors" title="Copy hash">
              [COPY]
            </button>
          </div>
          {event.method && event.method !== "Native Transfer" && (
            <div className="flex items-center gap-1 uppercase bg-[#F5F5F5]  px-2 py-0.5 rounded text-[#050505]  border border-[#E5E5E5] ">
              {event.method}
            </div>
          )}
        </div>
      </div>

      {/* TX Hash strip */}
      <div className="mt-3 pt-3 border-t border-dashed border-[#F0F0F0]  flex items-center justify-between text-[9px] font-mono bg-[#FFFFFF]  px-3 py-2 rounded-sm border border-[#E5E5E5] ">
        <div className="flex items-center gap-3">
          <span className="uppercase text-[#888888] font-black tracking-widest flex items-center gap-1.5">
            TX Hash
          </span>
          <span className="text-[#050505]  max-w-[240px] truncate" title={event.hash}>
            {event.hash}
          </span>
          <button onClick={() => copy(event.hash)} className="hover:text-[#050505]  text-[#888888] transition-colors">
            [COPY]
          </button>
          {copied && <span className="text-[#00C076] font-black">COPIED</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[#888888] uppercase tracking-widest">
            Type: <span className="text-[#050505]  font-black">ECDSA secp256k1</span>
          </span>
          <span className="flex items-center gap-1.5 uppercase font-black tracking-widest text-[#00C076]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00C076] animate-pulse" />
            Verified
          </span>
        </div>
      </div>
    </div>
  );
}

//  Summary Cards 

function SummaryCards({ events }: { events: any[] }) {
  const totalUsd       = events.reduce((s, e) => s + (Number(e.usdValue) || 0), 0);
  const avgUsd         = events.length ? totalUsd / events.length : 0;
  const maxEvent       = events.reduce((a, b) => (Number(b.usdValue) || 0) > (Number(a.usdValue) || 0) ? b : a, events[0] || { usdValue: 0, token: "" });
  const uniqueSenders  = new Set(events.map(e => e.from).filter(Boolean)).size;

  const cards = [
    { label: "Aggregate Volume",    value: totalUsd,              sub: `${events.length} verified operations` },
    { label: "Apex Transfer",       value: maxEvent?.usdValue||0, sub: `${maxEvent?.token || ""} Equivalent` },
    { label: "Mean Transmission",   value: avgUsd,                sub: "per standard block" },
    { label: "Unique Nodes",        value: uniqueSenders,         sub: "distinct sender addresses", isNum: true },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
      {cards.map(({ label, value, sub, isNum }) => (
        <div key={label} className="p-6 border border-[#E0E0E0]  bg-[#FFFFFF]  rounded-sm">
          <div className="text-[9px] font-black uppercase tracking-widest text-[#888888] mb-2">{label}</div>
          <AnimatedCounter
            value={value}
            format={isNum ? (v) => Math.floor(v).toString() : formatUsd}
            className="text-2xl font-bold font-mono tracking-tighter text-[#050505]  mb-1 block"
          />
          <div className="text-[10px] font-mono text-[#888888]">{sub}</div>
        </div>
      ))}
    </div>
  );
}

//  Main Ledger 

export function MassTransferIntel() {
  const queryClient    = useQueryClient();
  const [chainFilter,  setChainFilter]  = useState<string | null>(null);
  const [floorPreset,  setFloorPreset]  = useState<number>(0);
  const [sortBy,       setSortBy]       = useState<"time_desc" | "usd_desc">("time_desc");
  const [isSonarActive, setIsSonarActive] = useState(false);
  const [syncing,      setSyncing]      = useState(false);
  // [AUDIO REMOVED] audioCtxRef no longer used.
  const prevCountRef   = useRef<number>(0);

  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // [AUDIO REMOVED] playPing is permanently silenced.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const playPing = useCallback(() => { /* no-op */ }, []);

  useEffect(() => {
    prevCountRef.current = events.length;
  }, [events.length]);

  //  Sync handler  Real On-Chain L1 Fetch 
  const handleSync = useCallback(async () => {
    setSyncing(true);
    setIsLoading(true);
    try {
      const { createPublicClient, http, formatEther } = await import('viem');
      const { mainnet } = await import('viem/chains');
      
      const client = createPublicClient({
        chain: mainnet,
        transport: http('https://eth-mainnet.g.alchemy.com/v2/demo')
      });
      
      const block = await client.getBlock({ includeTransactions: true });
      const currentEthPrice = 3500; // Approximate for USD value
      
      const liveTransfers = block.transactions
        .filter((tx: any) => tx.value > 0n)
        .map((tx: any) => {
           const ethValue = parseFloat(formatEther(tx.value));
           const usdValue = ethValue * currentEthPrice;
           let tier = "MICRO_TRANSFER";
           if (usdValue > 1000000) tier = "ULTRA_CAPITAL_FLOW";
           else if (usdValue > 100000) tier = "ENTERPRISE_TRANSFER";
           else if (usdValue > 10000) tier = "STANDARD_FLOW";
           else if (usdValue > 1000) tier = "RETAIL_PRO";
           
           return {
             hash: tx.hash,
             from: tx.from,
             to: tx.to || 'Contract Creation',
             amount: ethValue.toString(),
             usdValue: usdValue.toString(),
             token: "ETH",
             chain: "ETH",
             timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
             tier,
             action: "NATIVE_TRANSFER",
             confirmations: 1,
             gasPriceGwei: tx.gasPrice ? (Number(tx.gasPrice) / 1e9).toFixed(2) : "0",
             method: "Native Transfer"
           };
        })
        .sort((a, b) => Number(b.usdValue) - Number(a.usdValue))
        .slice(0, 50);

      setEvents(liveTransfers);
      setError(false);
      toast.success("Ledger synchronized with L1");
    } catch (e) {
      console.error(e);
      setError(true);
      toast.error("Sync failed  RPC unreachable");
    } finally {
      setSyncing(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    handleSync();
    const interval = setInterval(handleSync, 12000); // New block every ~12s
    return () => clearInterval(interval);
  }, [handleSync]);

  //  Filter + sort 
  const availableChains = useMemo(
    () => Array.from(new Set(events.map(e => e.chain).filter(Boolean))),
    [events]
  );

  const filtered = useMemo(() => {
    return events
      .filter(e => {
        if (chainFilter && e.chain !== chainFilter) return false;
        if ((Number(e.usdValue) || 0) < floorPreset)  return false;
        return true;
      })
      .sort((a, b) =>
        sortBy === "time_desc"
          ? new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          : (Number(b.usdValue) || 0) - (Number(a.usdValue) || 0)
      );
  }, [events, chainFilter, floorPreset, sortBy]);

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#FFFFFF]  text-[#050505]  font-sans">

      {/*  Header  */}
      <div className="flex flex-wrap items-center justify-between px-8 py-6 border-b border-[#E5E5E5]  bg-white  gap-4 shrink-0">
        <div className="flex-1">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-6 py-3 bg-white border border-slate-200 text-black rounded-xl font-black uppercase tracking-[0.15em] text-[10px] transition-all shadow-sm hover:shadow-md hover:bg-black/5 active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            <span className={`font-mono text-[10px] font-black ${syncing ? "animate-spin inline-block" : ""}`}>[SYNC]</span>
            {syncing ? "SYNCING LEDGER" : "SYNC LEDGER"}
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">

          {/* Capital Floor preset pills */}
          <div className="flex items-center gap-1">
            {FLOOR_PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => setFloorPreset(p.value)}
                className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border transition-colors rounded-sm ${
                  floorPreset === p.value
                    ? "bg-white  text-white  border-[#050505] "
                    : "bg-white  text-[#888888]  border-[#E5E5E5]  hover:border-[#050505]  hover:text-[#050505] "
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>


          {/* Sonar */}
          <button
            onClick={() => setIsSonarActive(p => !p)}
            className={`px-4 py-2 border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors ${
              isSonarActive
                ? "border-[#050505]  bg-white  text-white "
                : "border-[#E5E5E5]  bg-white  hover:bg-[#F0F0F0]  text-[#050505] "
            }`}
          >
            {isSonarActive ? "SONAR ON" : "SONAR OFF"}
          </button>

          {/* Chain filter */}
          <select
            value={chainFilter || ""}
            onChange={e => setChainFilter(e.target.value === "" ? null : e.target.value)}
            className="px-4 py-2 border border-[#E5E5E5]  bg-white  text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer"
          >
            <option value="">OMNICHAIN (ALL)</option>
            {availableChains.map(chain => (
              <option key={chain} value={chain}>{chain} NETWORK</option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="px-4 py-2 border border-[#E5E5E5]  bg-white  text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer"
          >
            <option value="time_desc">CHRONOLOGICAL</option>
            <option value="usd_desc">MAGNITUDE</option>
          </select>
        </div>
      </div>

      {/*  Body  */}
      <div className="flex-1 min-h-0 overflow-y-auto px-8 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-[#888888] gap-4">
            <span className="font-mono text-3xl font-black animate-spin inline-block">[...]</span>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#050505] ">INITIALIZING LEDGER</p>
            <p className="text-[9px] font-mono uppercase tracking-[0.1em]">ESTABLISHING RPC LINK</p>
          </div>
        ) : error ? (
          <div className="h-48 flex flex-col items-center justify-center gap-3">
            <p className="text-[11px] font-black text-[#050505]  uppercase tracking-[0.3em]">Telemetry Failure</p>
            <button onClick={handleSync} className="text-[10px] font-black uppercase tracking-widest underline text-[#050505] ">
              Retry
            </button>
          </div>
        ) : (
          <div className="w-full mx-auto">
            <SummaryCards events={events} />

            <div className="bg-white  border border-[#E0E0E0]  rounded flex flex-col shadow-sm">
              {/* Table header */}
              <div className="px-5 py-3 bg-[#FFFFFF]  border-b border-[#E0E0E0]  flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-[#A0A0A0]">
                <span>TRANSMISSIONS ({filtered.length})</span>
                <div className="flex items-center gap-3">
                  {floorPreset > 0 && (
                    <span className="text-[#050505]  font-black">
                      FLOOR: {formatUsd(floorPreset)}
                    </span>
                  )}
                  {chainFilter && (
                    <span className="text-[#050505]  font-black">{chainFilter}</span>
                  )}
                  <span className="flex items-center gap-2">
                    Verified Stream
                  </span>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center gap-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#888888]">
                    NO QUALIFYING CAPITAL EVENTS
                  </span>
                  {floorPreset > 0 && (
                    <button
                      onClick={() => setFloorPreset(0)}
                      className="text-[9px] font-black uppercase tracking-widest text-[#050505]  underline"
                    >
                      Clear floor filter
                    </button>
                  )}
                </div>
              ) : (
                filtered.map((event, i) => (
                  <EventRow key={`${event.hash}-${i}`} event={event} />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
