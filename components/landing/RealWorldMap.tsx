"use client";

import React, { useState, memo, useCallback, useEffect, useRef } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ── Tier colours (dark navy = highest activity) ──────────────────────────────
const TIER_COLORS: Record<string, string> = {
  tier1: "#111111",
  tier2: "#333333",
  tier3: "#555555",
  tier4: "#777777",
  tier5: "#999999",
  tier6: "#AAAAAA",
  tier7: "#CCCCCC",
  tier8: "#DDDDDD",
  none: "#F5F5F5",
};

const TIER_LABELS: Record<string, string> = {
  tier1: ">500k wallets",
  tier2: ">100k wallets",
  tier3: ">5k wallets",
  tier4: ">1k wallets",
  tier5: ">500 wallets",
  tier6: ">100 wallets",
  tier7: ">10 wallets",
  tier8: ">0 wallets",
  none: "No connections",
};

type Tier =
  | "tier1"
  | "tier2"
  | "tier3"
  | "tier4"
  | "tier5"
  | "tier6"
  | "tier7"
  | "tier8"
  | "none";

function getLevel(n: number): Tier {
  if (n >= 500000) return "tier1";
  if (n >= 100000) return "tier2";
  if (n >= 5000) return "tier3";
  if (n >= 1000) return "tier4";
  if (n >= 500) return "tier5";
  if (n >= 100) return "tier6";
  if (n >= 10) return "tier7";
  if (n > 0) return "tier8";
  return "none";
}

interface Tooltip {
  name: string;
  tier: Tier;
  count: number;
  x: number;
  y: number;
}

interface RealWorldMapProps {
  fullPage?: boolean;
  isDark?: boolean;
}

let cachedCountryData: Record<string, number> = {};
let cachedStats = { total: 0, regions: 0 };

export const RealWorldMap = memo(function RealWorldMap({
  fullPage = false,
  isDark = false,
}: RealWorldMapProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  // countryName → wallet count
  const [countryData, setCountryData] = useState<Record<string, number>>(cachedCountryData);
  const [stats, setStats] = useState(cachedStats);

  // ── Poll real wallet-connection data every 15 s ───────────────────────────
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await fetch("/api/network/wallet-connections", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const { byCountry, total, activeRegions } = await res.json();
        if (!mounted) return;

        if (byCountry) {
          cachedCountryData = byCountry;
          setCountryData(byCountry);
        }
        setStats((prev) => {
          const newStats = {
            total: prev.total > (total ?? 0) ? prev.total : (total ?? 0),
            regions: activeRegions ?? (byCountry ? Object.keys(byCountry).length : 0),
          };
          cachedStats = newStats;
          return newStats;
        });
      } catch {}
    };

    load();
    const id = setInterval(load, 15_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);


  // ── Tooltip ───────────────────────────────────────────────────────────────
  const handleMouseMove = useCallback(
    (geo: any, evt: React.MouseEvent | React.TouchEvent) => {
      const name: string = geo.properties?.name ?? "Unknown";
      const count = countryData[name] ?? 0;
      const rect = wrapperRef.current?.getBoundingClientRect();
      
      let clientX, clientY;
      if ('touches' in evt) {
        clientX = evt.touches[0].clientX;
        clientY = evt.touches[0].clientY;
      } else {
        clientX = (evt as React.MouseEvent).clientX;
        clientY = (evt as React.MouseEvent).clientY;
      }

      const x = rect ? clientX - rect.left : clientX;
      const y = rect ? clientY - rect.top : clientY;
      
      setTooltip({ name, tier: getLevel(count), count, x, y });
    },
    [countryData]
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  return (
    <div
      className={`relative overflow-hidden ${
        fullPage ? "w-full flex flex-col h-full" : "w-full rounded-xl"
      }`}
      style={{
        backgroundColor: isDark ? "transparent" : "#fff",
        border: fullPage ? "none" : isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)"
      }}
    >
      {/* ── Map ── */}
      <div
        ref={wrapperRef}
        className="relative w-full"
        style={{
           // On mobile, aspect-video can become too small. 
           // We use an intrinsic aspect ratio trick or fallback min-height via CSS.
           minHeight: "320px",
           display: "flex",
           alignItems: "center",
           justifyContent: "center",
           backgroundColor: isDark ? "transparent" : "#fff"
        }}
      >
          <ComposableMap
          projection="geoNaturalEarth1"
          projectionConfig={{ scale: 160, center: [0, 0] }}
          width={800}
          height={400}
          style={{ width: "100%", height: "100%", maxHeight: "100%", display: "block" }}
        >
          <ZoomableGroup zoom={1}>
            <Geographies geography={GEO_URL}>
              {({ geographies }: { geographies: any[] }) =>
                geographies.map((geo: any) => {
                  const name: string = geo.properties?.name ?? "";
                  const count = countryData[name] ?? 0;
                  const tier = getLevel(count);
                  const fill = TIER_COLORS[tier];

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseMove={(evt: any) => handleMouseMove(geo, evt)}
                      onTouchStart={(evt: any) => handleMouseMove(geo, evt)}
                      onMouseLeave={handleMouseLeave}
                      onTouchEnd={handleMouseLeave}
                      style={{
                        default: {
                          fill: isDark ? "rgba(255,255,255," + (tier === "tier1" ? 1 : tier === "tier2" ? 0.8 : tier === "tier3" ? 0.6 : tier === "tier4" ? 0.4 : tier === "tier5" ? 0.3 : tier === "tier6" ? 0.2 : tier === "tier7" ? 0.1 : tier === "tier8" ? 0.05 : 0.02) + ")" : "rgba(0,0,0," + (tier === "tier1" ? 1 : tier === "tier2" ? 0.8 : tier === "tier3" ? 0.6 : tier === "tier4" ? 0.4 : tier === "tier5" ? 0.3 : tier === "tier6" ? 0.2 : tier === "tier7" ? 0.1 : tier === "tier8" ? 0.05 : 0.02) + ")",
                          stroke: isDark ? "rgba(0,0,0,0.5)" : "#ffffff",
                          strokeWidth: 0.5,
                          outline: "none",
                        },
                        hover: {
                          fill: tier === "none" ? "#e5e7eb" : isDark ? "rgba(255,255,255," + (tier === "tier1" ? 1 : tier === "tier2" ? 0.8 : tier === "tier3" ? 0.6 : tier === "tier4" ? 0.4 : tier === "tier5" ? 0.3 : tier === "tier6" ? 0.2 : tier === "tier7" ? 0.1 : tier === "tier8" ? 0.05 : 0.02) + ")" : "rgba(0,0,0," + (tier === "tier1" ? 1 : tier === "tier2" ? 0.8 : tier === "tier3" ? 0.6 : tier === "tier4" ? 0.4 : tier === "tier5" ? 0.3 : tier === "tier6" ? 0.2 : tier === "tier7" ? 0.1 : tier === "tier8" ? 0.05 : 0.02) + ")",
                          stroke: isDark ? "rgba(0,0,0,0.5)" : "#ffffff",
                          strokeWidth: 0.5,
                          outline: "none",
                          cursor: "pointer",
                          opacity: 0.85,
                        },
                        pressed: { fill, outline: "none" },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>

        {/* ── Tooltip ── */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-50"
            style={{
              left: Math.min(tooltip.x + 14, (wrapperRef.current?.offsetWidth ?? 800) - 240),
              top: Math.max(tooltip.y - 8, 0),
            }}
          >
            <div 
              className="shadow-xl rounded-xl p-3 w-56"
              style={{
                backgroundColor: isDark ? "#111118" : "#fff",
                border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.15)",
                color: isDark ? "#fff" : "#000"
              }}
            >
              <p className="text-[13px] font-black leading-tight" style={{ color: isDark ? "#fff" : "#000" }}>{tooltip.name}</p>
              <div className="flex items-center gap-2 mt-2">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ background: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.8)" }}
                />
                <span className="text-[10px] font-bold" style={{ color: isDark ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.6)" }}>
                  {TIER_LABELS[tooltip.tier]}
                </span>
              </div>
              <div 
                className="mt-2 pt-2 flex items-center gap-2"
                style={{ borderTop: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.05)" }}
              >
                {tooltip.count > 0 && (
                  <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse block" />
                )}
                <span className="text-[11px] font-black font-mono" style={{ color: isDark ? "#fff" : "#000" }}>
                  {tooltip.count.toLocaleString()} wallet{tooltip.count !== 1 ? "s" : ""} connected
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Live stats overlay (top-right) ── */}
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex gap-2">
          <div 
            className="backdrop-blur shadow rounded-lg px-2 sm:px-4 py-2 text-center min-w-[80px] sm:min-w-[100px]"
            style={{
              backgroundColor: isDark ? "rgba(17,17,24,0.95)" : "rgba(255,255,255,0.95)",
              border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)"
            }}
          >
            <span className="text-[16px] sm:text-[22px] font-black leading-none block font-mono" style={{ color: isDark ? "#fff" : "#000" }}>
              {stats.total.toLocaleString()}
            </span>
            <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest block mt-0.5" style={{ color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.4)" }}>
              Connected Wallets
            </span>
          </div>
          <div 
            className="backdrop-blur shadow rounded-lg px-2 sm:px-4 py-2 text-center min-w-[80px] sm:min-w-[100px] hidden sm:block"
            style={{
              backgroundColor: isDark ? "rgba(17,17,24,0.95)" : "rgba(255,255,255,0.95)",
              border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)"
            }}
          >
            <span className="text-[16px] sm:text-[22px] font-black leading-none block font-mono" style={{ color: isDark ? "#fff" : "#000" }}>
              {stats.regions}
            </span>
            <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest block mt-0.5" style={{ color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.4)" }}>
              Active Countries
            </span>
          </div>
        </div>

        {/* ── Legend (bottom-left) ── */}
        <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 bg-white/95 backdrop-blur border border-black/10 shadow rounded-lg px-2 py-2 sm:px-3 sm:py-2.5 hidden md:block">
          <p className="text-[8px] font-black uppercase tracking-widest text-black/40 mb-2">
            Wallet Connections
          </p>
          <div className="flex flex-col gap-1">
            {(
              [
                "tier1",
                "tier2",
                "tier3",
                "tier4",
                "tier5",
                "tier6",
                "tier7",
                "tier8",
                "none",
              ] as Tier[]
            ).map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-sm border border-black/10 shrink-0"
                  style={{ background: isDark ? "rgba(255,255,255," + (t === "tier1" ? 1 : t === "tier2" ? 0.8 : t === "tier3" ? 0.6 : t === "tier4" ? 0.4 : t === "tier5" ? 0.3 : t === "tier6" ? 0.2 : t === "tier7" ? 0.1 : t === "tier8" ? 0.05 : 0.02) + ")" : "rgba(0,0,0," + (t === "tier1" ? 1 : t === "tier2" ? 0.8 : t === "tier3" ? 0.6 : t === "tier4" ? 0.4 : t === "tier5" ? 0.3 : t === "tier6" ? 0.2 : t === "tier7" ? 0.1 : t === "tier8" ? 0.05 : 0.02) + ")" }}
                />
                <span className="text-[9px] text-black/60 font-medium">
                  {TIER_LABELS[t]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

