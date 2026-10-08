"use client";

import React, { useEffect, useState } from "react";
import { useVIPAnalytics } from "@/hooks/useVIPAnalytics";
import { Activity, Clock, ShieldCheck, Cpu } from "lucide-react";
import { Network } from "lucide-react";

export function LegendaryDownhead() {
  const { stats } = useVIPAnalytics();
  const [latency, setLatency] = useState(0);

  useEffect(() => {
    let isMounted = true;
    
    const measureLatency = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const start = performance.now();
        await fetch("/api/network/live", { method: "HEAD", cache: "no-store", signal: controller.signal });
        clearTimeout(timeoutId);
        const end = performance.now();
        if (isMounted) setLatency(Math.round(end - start));
      } catch {
        if (isMounted) setLatency(0); // indicates failure/offline
      }
    };

    measureLatency();
    const interval = setInterval(measureLatency, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="w-full flex justify-center pb-6 z-50 mt-12">
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col md:flex-row items-center divide-y md:divide-y-0 md:divide-x divide-white/10 overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)]">
        
        {/* Navigation Breadcrumbs */}
        <div className="flex items-center gap-6 px-8 py-4">
          <a href="/vip" className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#00ff9d] hover:text-white transition-colors flex items-center gap-2">
            <Cpu size={14} /> VIP Dashboard
          </a>
          <span className="text-white/20">/</span>
          <a href="/portfolio" className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-white/50 hover:text-white transition-colors">
            Portfolio
          </a>
          <span className="text-white/20">/</span>
          <a href="/terms" className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-white/50 hover:text-white transition-colors">
            Términos
          </a>
        </div>

        {/* Active Metrics Terminal */}
        <div className="flex items-center gap-6 px-8 py-4 bg-white/[0.02]">
          
          {/* Status */}
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-white/60">
            <div className="w-2 h-2 rounded-full bg-[#00ff9d] animate-pulse" />
            L1 Status
          </div>

          {/* Block */}
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-white/60">
            <Activity size={12} className="text-emerald-400" />
            <span className="text-white font-bold">{stats.currentBlock || "Sync..."}</span>
          </div>

          {/* Gas */}
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-white/60">
            <ShieldCheck size={12} className="text-purple-400" />
            <span className="text-white font-bold">{stats.baseFee ? stats.baseFee.toFixed(1) : "---"}</span> Gwei
          </div>

          {/* Latency */}
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-white/60">
            <Network size={12} className="text-emerald-400" />
            <span className="text-white font-bold">{latency}</span> ms
          </div>

        </div>
      </div>
    </div>
  );
}


