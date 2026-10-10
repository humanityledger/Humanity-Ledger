"use client";

import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Flame, Zap, BarChart3, RefreshCw } from "lucide-react";

interface CoinData {
  symbol: string;
  name: string;
  volume24h: number;
  chgPct: number;
  liquidation: number;
  openInterest: number;
  price: number;
}

type MetricKey = "volume24h" | "chgPct" | "liquidation" | "openInterest";

const DISPLAY_TOKENS = [
  { symbol: "BTCUSDT", name: "BTC" },
  { symbol: "ETHUSDT", name: "ETH" },
  { symbol: "SOLUSDT", name: "SOL" },
  { symbol: "BNBUSDT", name: "BNB" },
  { symbol: "XRPUSDT", name: "XRP" },
  { symbol: "ADAUSDT", name: "ADA" },
  { symbol: "DOGEUSDT", name: "DOGE" },
  { symbol: "AVAXUSDT", name: "AVAX" },
  { symbol: "DOTUSDT", name: "DOT" },
  { symbol: "LINKUSDT", name: "LINK" },
  { symbol: "MATICUSDT", name: "MATIC" },
  { symbol: "NEARUSDT", name: "NEAR" },
  { symbol: "UNIUSDT", name: "UNI" },
  { symbol: "LTCUSDT", name: "LTC" },
  { symbol: "ATOMUSDT", name: "ATOM" },
  { symbol: "ARBUSDT", name: "ARB" },
  { symbol: "OPUSDT", name: "OP" },
  { symbol: "INJUSDT", name: "INJ" },
  { symbol: "SUIUSDT", name: "SUI" },
  { symbol: "APTUSDT", name: "APT" },
];

const TABS: { key: MetricKey; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: "volume24h", label: "Volume", icon: <BarChart3 size={13} />, desc: "24h Attesting Volume" },
  { key: "chgPct", label: "Chg%", icon: <Activity size={13} />, desc: "24h Price Change" },
  { key: "liquidation", label: "Liquidation", icon: <Flame size={13} />, desc: "24h Liquidations" }
];

function formatValue(value: number, metric: MetricKey): string {
  if (metric === "chgPct") {
    return (value >= 0 ? "+" : "") + value.toFixed(2) + "%";
  }
  if (value >= 1e9) return "$" + (value / 1e9).toFixed(2) + "B";
  if (value >= 1e6) return "$" + (value / 1e6).toFixed(0) + "M";
  if (value >= 1e3) return "$" + (value / 1e3).toFixed(0) + "K";
  return "$" + value.toFixed(0);
}

function getColor(value: number, metric: MetricKey, maxVal: number): { bg: string; glow: string } {
  if (metric === "chgPct") {
    if (value > 5) return { bg: "from-emerald-500 to-emerald-700", glow: "rgba(16,185,129,0.4)" };
    if (value > 2) return { bg: "from-emerald-600 to-emerald-800", glow: "rgba(16,185,129,0.3)" };
    if (value > 0) return { bg: "from-emerald-700 to-emerald-900", glow: "rgba(16,185,129,0.2)" };
    if (value > -2) return { bg: "from-rose-700 to-rose-900", glow: "rgba(244,63,94,0.2)" };
    if (value > -5) return { bg: "from-rose-600 to-rose-800", glow: "rgba(244,63,94,0.3)" };
    return { bg: "from-rose-500 to-rose-700", glow: "rgba(244,63,94,0.4)" };
  }
  const ratio = value / maxVal;
  if (ratio > 0.7) return { bg: "from-violet-500 to-purple-700", glow: "rgba(139,92,246,0.4)" };
  if (ratio > 0.4) return { bg: "from-indigo-500 to-indigo-700", glow: "rgba(99,102,241,0.35)" };
  if (ratio > 0.2) return { bg: "from-emerald-600 to-emerald-800", glow: "rgba(59,130,246,0.3)" };
  if (ratio > 0.1) return { bg: "from-slate-600 to-slate-700", glow: "rgba(148,163,184,0.15)" };
  return { bg: "from-slate-700 to-slate-800", glow: "rgba(100,116,139,0.15)" };
}

// Binary split treemap algorithm that guarantees 100% space fill
function computeTreemap(
  items: { name: string; value: number }[],
  width: number,
  height: number
): { x: number; y: number; w: number; h: number; name: string; value: number }[] {
  const result: { x: number; y: number; w: number; h: number; name: string; value: number }[] = [];
  
  function partition(
    nodes: { name: string; value: number }[],
    x: number, y: number, w: number, h: number
  ) {
    if (nodes.length === 0) return;
    if (nodes.length === 1) {
      result.push({ ...nodes[0], x, y, w, h });
      return;
    }

    const total = nodes.reduce((sum, n) => sum + Math.abs(n.value), 0);
    if (total === 0) return;

    let halfSum = total / 2;
    let currentSum = 0;
    let splitIndex = 0;

    for (let i = 0; i < nodes.length; i++) {
        currentSum += Math.abs(nodes[i].value);
        if (currentSum >= halfSum && i < nodes.length - 1) {
            // Find closest split
            const diffThis = Math.abs(currentSum - halfSum);
            const diffNext = Math.abs((currentSum + Math.abs(nodes[i+1].value)) - halfSum);
            if (diffThis <= diffNext || i === 0) {
                splitIndex = i + 1;
            } else {
                splitIndex = i + 2;
            }
            break;
        }
    }

    if (splitIndex === 0 || splitIndex >= nodes.length) splitIndex = Math.max(1, Math.floor(nodes.length / 2));

    const leftNodes = nodes.slice(0, splitIndex);
    const rightNodes = nodes.slice(splitIndex);

    const leftTotal = leftNodes.reduce((sum, n) => sum + Math.abs(n.value), 0);
    const splitRatio = leftTotal / total;

    if (w >= h) {
        // split vertically
        const leftWidth = w * splitRatio;
        partition(leftNodes, x, y, leftWidth, h);
        partition(rightNodes, x + leftWidth, y, w - leftWidth, h);
    } else {
        // split horizontally
        const topHeight = h * splitRatio;
        partition(leftNodes, x, y, w, topHeight);
        partition(rightNodes, x, y + topHeight, w, h - topHeight);
    }
  }

  partition(items, 0, 0, width, height);
  return result;
}

const HeatmapCell = memo(({ 
  coin, 
  cell, 
  activeTab, 
  maxVal, 
  isHovered, 
  setHoveredCoin 
}: { 
  coin: any; 
  cell: any; 
  activeTab: MetricKey; 
  maxVal: number; 
  isHovered: boolean; 
  setHoveredCoin: (name: string | null) => void; 
}) => {
  const GAP = 3;
  if (!cell || cell.w < 2 || cell.h < 2) return null;
  const { bg, glow } = getColor(coin[activeTab], activeTab, Math.abs(maxVal));
  const w = cell.w - GAP;
  const h = cell.h - GAP;
  const showLabel = w > 40 && h > 30;
  const showValue = w > 55 && h > 50;
  const showPrice = w > 80 && h > 70;

  return (
    <motion.g
      initial={false}
      animate={{ 
          x: cell.x + GAP / 2, 
          y: cell.y + GAP / 2,
          opacity: 1
      }}
      transition={{ type: "spring", bounce: 0, duration: 0.8 }}
      onMouseEnter={() => setHoveredCoin(coin.name)}
      onMouseLeave={() => setHoveredCoin(null)}
      style={{ cursor: "default" }}
    >
      <defs>
        <linearGradient id={`grad-${coin.name}`} x1="0%" y1="0%" x2="100%" y2="100%">
          {bg.includes("violet") && <>
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#6d28d9" />
          </>}
          {bg.includes("indigo") && !bg.includes("violet") && <>
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#4338ca" />
          </>}
          {bg.includes("blue") && <>
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </>}
          {bg.includes("slate-6") && !bg.includes("slate-7") && <>
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#334155" />
          </>}
          {bg.includes("slate-7") && <>
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
          </>}
          {bg.includes("emerald-5") && <>
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </>}
          {bg.includes("emerald-6") && !bg.includes("emerald-5") && <>
            <stop offset="0%" stopColor="#059669" />
            <stop offset="100%" stopColor="#065f46" />
          </>}
          {bg.includes("emerald-7") && <>
            <stop offset="0%" stopColor="#047857" />
            <stop offset="100%" stopColor="#064e3b" />
          </>}
          {bg.includes("rose-5") && <>
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#e11d48" />
          </>}
          {bg.includes("rose-6") && !bg.includes("rose-5") && <>
            <stop offset="0%" stopColor="#e11d48" />
            <stop offset="100%" stopColor="#9f1239" />
          </>}
          {bg.includes("rose-7") && <>
            <stop offset="0%" stopColor="#be123c" />
            <stop offset="100%" stopColor="#881337" />
          </>}
        </linearGradient>
        {isHovered && (
          <filter id={`glow-${coin.name}`}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        )}
      </defs>

      <rect
        x={0} y={0}
        width={w} height={h}
        rx={6} ry={6}
        fill={`url(#grad-${coin.name})`}
        opacity={isHovered ? 1 : 0.88}
        stroke={isHovered ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)"}
        strokeWidth={isHovered ? 1.5 : 0.5}
      />

      <rect
        x={1} y={1}
        width={w - 2} height={Math.min(h * 0.4, 30)}
        rx={5}
        fill="rgba(255,255,255,0.07)"
      />

      {showLabel && (
        <text
          x={w / 2} y={showPrice ? h * 0.35 : showValue ? h * 0.4 : h / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize={Math.min(w * 0.22, Math.min(h * 0.3, 28))}
          fontWeight="900"
          fontFamily="monospace"
          style={{ userSelect: "none", willChange: "transform, opacity" }}
        >
          {coin.name}
        </text>
      )}
      {showValue && (
        <text
          x={w / 2} y={showPrice ? h * 0.6 : h * 0.65}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.8)"
          fontSize={Math.min(w * 0.1, 13)}
          fontWeight="700"
          fontFamily="monospace"
          style={{ userSelect: "none", willChange: "transform, opacity" }}
        >
          {formatValue(coin[activeTab], activeTab)}
        </text>
      )}
      {showPrice && (
        <text
          x={w / 2} y={h * 0.8}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.45)"
          fontSize={Math.min(w * 0.08, 10)}
          fontWeight="600"
          fontFamily="monospace"
          style={{ userSelect: "none", willChange: "transform, opacity" }}
        >
          ${coin.price >= 1000 ? (coin.price / 1000).toFixed(1) + "K" : coin.price.toFixed(2)}
        </text>
      )}
    </motion.g>
  );
});
HeatmapCell.displayName = "HeatmapCell";

export function MarketHeatmap24h() {
  const [activeTab, setActiveTab] = useState<MetricKey>("volume24h");
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [hoveredCoin, setHoveredCoin] = useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 900, h: 400 });

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      // Fetch tickers (Volume + Chg%) and real liquidations in parallel (server-side proxy, no CORS)
      const [tickersRes, liqRes] = await Promise.allSettled([
        fetch("/api/network/live?tickers=1").then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/vip/liquidations-24h"),
      ]);

      // Binance tickers  direct call (may be blocked by CORS in browser)
      let tickers: any[] = [];
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 6000);
        const binRes = await fetch("https://fapi.binance.com/fapi/v1/ticker/24hr", {
          signal: ctrl.signal,
        });
        clearTimeout(tid);
        if (binRes.ok) tickers = await binRes.json();
      } catch {}

      if (!tickers || tickers.length < 5) {
        // No Math.random() fallback  show a real error state
        setError("Binance Futures data unavailable. Retrying...");
        setLoading(false);
        return;
      }

      // Real liquidation data from our server-side API (avoids CORS)
      const liqMap: Record<string, number> = {};
      if (liqRes.status === "fulfilled" && liqRes.value.ok) {
        const liqData = await liqRes.value.json();
        for (const item of liqData.data ?? []) {
          liqMap[item.symbol] = item.liquidationUsd;
        }
      }

      const tickerMap: Record<string, any> = {};
      for (const t of tickers) tickerMap[t.symbol] = t;

      const mapped: CoinData[] = DISPLAY_TOKENS.map((token) => {
        const t = tickerMap[token.symbol];
        if (!t) return null;
        const price = parseFloat(t.lastPrice || "0");
        if (price <= 0) return null;
        return {
          symbol: token.symbol,
          name: token.name,
          volume24h: parseFloat(t.quoteVolume || "0"),
          chgPct: parseFloat(t.priceChangePercent || "0"),
          // Real liquidation data from /api/vip/liquidations-24h
          liquidation: liqMap[token.symbol] ?? 0,
          openInterest: parseFloat(t.quoteVolume || "0") * 0.12,
          price,
        };
      }).filter(Boolean) as CoinData[];

      setCoins(mapped);
      setLastUpdate(new Date());
    } catch (e) {
      console.error("[Heatmap] fetch error", e);
      // Never fall back to Math.random()  show error state
      if (coins.length === 0) {
        setError("Market data temporarily unavailable.");
      }
    } finally {
      setLoading(false);
    }
  }, [coins.length]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15_000); // 15s for live feel
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        setDims({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const sorted = useMemo(() => [...coins].sort((a, b) => (Number(Math.abs(b[activeTab])) || 0) - (Number(Math.abs(a[activeTab])) || 0)), [coins, activeTab]);
  const maxVal = useMemo(() => sorted[0]?.[activeTab] ?? 1, [sorted, activeTab]);

  const totalVal = useMemo(() => {
     const sum = sorted.reduce((acc, c) => acc + (Number(Math.abs(c[activeTab])) || 0), 0);
     return sum || 1; // Prevent division by zero
  }, [sorted, activeTab]);

  const treemapItems = useMemo(() => sorted.map(c => {
    const rawVal = Number(Math.abs(c[activeTab])) || 0;
    // Enforce 2.5% minimum visual weight to ensure elements are always visible
    const minSz = totalVal * 0.025;
    return { name: c.name, value: Math.max(rawVal, minSz) };
  }), [sorted, activeTab, totalVal]);

  const cells = useMemo(() => {
    if (dims.w <= 0 || dims.h <= 0) return [];
    return computeTreemap(treemapItems, dims.w, dims.h);
  }, [treemapItems, dims.w, dims.h]);
  const cellMap = useMemo(() => Object.fromEntries(cells.map(c => [c.name, c])), [cells]);

  const GAP = 3;

  return (
    <div className="bg-[#0d0d0d] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-7 pb-4">
        <div>
          <h2 className="text-lg font-black text-white tracking-tight">
            Heatmap <span className="text-white/30 font-light">24h</span>
          </h2>
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest mt-0.5">
            {TABS.find(t => t.key === activeTab)?.desc} · LIVE BINANCE
          </p>
        </div>

        <div className="flex items-center gap-4">
          {lastUpdate && (
            <span className="text-[10px] font-mono text-white/30">
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchData}
            className="p-2 rounded-xl border border-white/10 hover:border-white/30 transition-all group"
          >
            <RefreshCw size={13} className="text-white/40 group-hover:text-white group-hover:rotate-180 transition-all duration-500" />
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="px-8 pb-4">
        <div className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-2xl w-fit">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                activeTab === tab.key
                  ? "bg-white text-black shadow-sm"
                  : "text-white/40 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Heatmap Canvas */}
      <div
        ref={containerRef}
        className="relative mx-6 mb-6 rounded-2xl overflow-hidden bg-[#0a0a0a] shadow-inner border border-white/5"
        style={{ height: 380 }}
      >
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[var(--aztec-orchid)]/30 border-t-[var(--aztec-orchid)] rounded-full animate-spin" />
              <span className="text-[10px] font-mono text-[var(--aztec-ink)]/40 uppercase tracking-widest">Loading market data</span>
            </div>
          </div>
        ) : (
          <svg width={dims.w} height={dims.h} className="absolute inset-0">
            {sorted.map(coin => (
              <HeatmapCell 
                key={coin.name}
                coin={coin}
                cell={cellMap[coin.name]}
                activeTab={activeTab}
                maxVal={maxVal}
                isHovered={hoveredCoin === coin.name}
                setHoveredCoin={setHoveredCoin}
              />
            ))}
          </svg>
        )}

        {/* Tooltip on hover */}
        <AnimatePresence>
          {hoveredCoin && (() => {
            const coin = coins.find(c => c.name === hoveredCoin);
            if (!coin) return null;
            return (
              <motion.div
                key={hoveredCoin}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-4 right-4 bg-[var(--aztec-ink)]/95 backdrop-blur-xl border border-[var(--aztec-parchment)]/10 rounded-2xl p-4 shadow-2xl min-w-[180px] pointer-events-none z-10"
              >
                <div className="text-xs font-black text-[var(--aztec-parchment)] mb-3 font-mono">{coin.name}</div>
                <div className="space-y-1.5">
                  {TABS.map(tab => (
                    <div key={tab.key} className={`flex items-center justify-between gap-6 text-[10px] font-mono ${tab.key === activeTab ? "text-white" : "text-slate-500"}`}>
                      <span className={`flex items-center gap-1 ${tab.key === activeTab ? "text-violet-400" : ""}`}>
                        {tab.icon}{tab.label}
                      </span>
                      <span className={`font-black ${tab.key === "chgPct" ? (coin.chgPct >= 0 ? "text-emerald-400" : "text-rose-400") : ""}`}>
                        {formatValue(coin[tab.key], tab.key)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-6 text-[10px] font-mono text-slate-500 pt-1 border-t border-white/5">
                    <span>Price</span>
                    <span className="text-white font-black">${coin.price.toLocaleString()}</span>
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>

      {/* Legend */}
        <div className="flex items-center justify-between px-8 pb-6 border-t border-white/5 pt-4">
        {activeTab === "chgPct" ? (
          <div className="flex items-center gap-3">
            {[
              { color: "bg-rose-600", label: "Bear > -5%" },
              { color: "bg-rose-700", label: "-2% to -5%" },
              { color: "bg-slate-600", label: "~0%" },
              { color: "bg-emerald-700", label: "+2% to +5%" },
              { color: "bg-emerald-500", label: "Bull > +5%" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-sm ${l.color}`} />
                <span className="text-[9px] font-mono text-slate-400">{l.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {[
              { color: "bg-slate-700", label: "Low" },
              { color: "bg-emerald-700", label: "Mid" },
              { color: "bg-indigo-600", label: "High" },
              { color: "bg-violet-500", label: "Elite" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-sm ${l.color}`} />
                <span className="text-[9px] font-mono text-slate-400">{l.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

