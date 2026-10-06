"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { 
  Network, Filter, Database, Cpu, Zap, Activity, Shield, 
  BarChart2, Globe, Building2, AlertTriangle, Webhook, 
  Lock, Key, Terminal, Code2 
} from "lucide-react";

const ARCHITECTURE_NODES = [
  { icon: Network, label: "Multi-Chain Ingestion", desc: "Real-time scanning of 8+ chains (Ethereum, L2s) through dedicated low-latency nodes." },
  { icon: Filter, label: "Block Sifting Engine", desc: "Instant filtering of ERC-20 logs to identify native and contract transfer events." },
  { icon: BarChart2, label: "Threshold Analysis", desc: "Real-time USD volume discrimination ($100K - $10B) to isolate Elite flows." },
  { icon: Building2, label: "Labeling System", desc: "Identification of 5,000+ entities (Binance, Coinbase, Kraken) through known wallet signatures." },
  { icon: Cpu, label: "Action Classification", desc: "Advanced heuristics to label movements as Buy, Sell, or Transfer based on interaction." },
  { icon: Shield, label: "Forensic Risk Scoring", desc: "Risk score assignment (0-100) based on exposure to mixers, hacks, and historical behavior." },
  { icon: Globe, label: "Dark Pool Detection", desc: "Radar for off-exchange movements and bridge transfers (Wormhole/LayerZero) in bulk." },
  { icon: AlertTriangle, label: "Anomaly Detection", desc: "Algorithmic scanning of Wash Attesting, Flash Loans, and cascade liquidation patterns." },
  { icon: Zap, label: "Signal Generation", desc: "Confluence of Heikin-Ashi Signals with ledger flows to generate high-conviction alerts." },
  { icon: Database, label: "Analytics Archive", desc: "Persistence in Postgres/Prisma with 12 months of complete history for retroactive analysis." },
  { icon: Activity, label: "Real-Time Stream (SSE)", desc: "Event delivery via Server-Sent Events with sub-500ms latency after detection." },
  { icon: Terminal, label: "Cryptographic API Gateway", desc: "Dedicated REST and WebSocket infrastructure for mass access with IP Whitelisting." },
  { icon: Webhook, label: "Webhook Dispatcher", desc: "Asynchronous alert dispatch to external endpoints with retries and HMAC-SHA256 signatures." },
  { icon: Code2, label: "Portfolio Fusion Engine", desc: "Active balance and USD value calculation integrating real-time prices via GetBlock RPC nodes." },
  { icon: Lock, label: "FIX Protocol Gateway", desc: "HFT (Financial Information eXchange) interface with Checksum validation for Hedge Funds." },
];

export function ArchitectureJourney() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const pathLength = useSpring(scrollYProgress, { stiffness: 400, damping: 90 });

  return (
    <div ref={containerRef} className="relative py-40 bg-white overflow-hidden">
      <div className="max-w-[2560px] mx-auto px-6 mb-32 text-left">
        <motion.div
           initial={{ opacity: 0, y: 30 }}
           whileInView={{ opacity: 1, y: 0 }}
           viewport={{ once: true }}
           className="text-xs font-black uppercase tracking-[0.4em] text-indigo-600 mb-6"
        >
          System DNA
        </motion.div>
        <motion.h2 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-5xl md:text-7xl font-black tracking-tighter text-slate-900 mb-8"
        >
          High-Performance<br />
          <span className="text-slate-200">Architecture</span>
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-slate-500 max-w-2xl mx-auto text-lg leading-relaxed"
        >
          15 levels of deterministic processing that turn blockchain noise into high-frequency Alpha signals.
        </motion.p>
      </div>

      <div className="relative max-w-4xl mx-auto px-6">
        {/* The connecting path line */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[2px] bg-slate-100 hidden md:block">
          <motion.div 
            style={{ scaleY: pathLength }}
            className="w-full h-full bg-gradient-to-b from-[#25D366] via-indigo-500 to-emerald-500 origin-top shadow-[0_10px_30px_rgba(99,102,241,0.2)] transform-gpu"
          />
          
          {/* Energy Surge (Legendary detail) */}
          <motion.div
            style={{ top: useTransform(pathLength, [0, 1], ["0%", "100%"]) }}
            className="absolute left-1/2 -translate-x-1/2 w-1 h-32 bg-gradient-to-b from-transparent via-indigo-400 to-transparent blur-[4px] opacity-40"
          />
          <motion.div
            style={{ top: useTransform(pathLength, [0, 1], ["0%", "100%"]) }}
            className="absolute left-1/2 -translate-x-1/2 w-[1px] h-32 bg-indigo-500 z-10"
          />
        </div>

        <div className="space-y-40 relative">
          {ARCHITECTURE_NODES.map((node, i) => (
            <ArchitectureStep key={i} node={node} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ArchitectureStep({ node, index }: { node: typeof ARCHITECTURE_NODES[0], index: number }) {
  const isEven = index % 2 === 0;
  
  return (
    <motion.div 
      initial={{ opacity: 0, x: isEven ? -50 : 50 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className={`flex items-center gap-12 md:gap-24 ${!isEven ? "md:flex-row-reverse" : ""}`}
    >
      {/* Content */}
      <div className={`flex-1 ${!isEven ? "md:text-right" : "md:text-left"}`}>
        <div className="group relative">
           <div className={`absolute -inset-4 bg-gradient-to-r ${isEven ? 'from-indigo-500/05' : 'to-emerald-500/05'} rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
           <div className="relative">
             <div className="text-[10px] font-black font-mono text-slate-300 mb-3 tracking-[0.2em] uppercase">
               Node 0{index + 1} // System Layer
             </div>
             <h3 className="text-2xl md:text-3xl font-black text-slate-900 mb-4 group-hover:text-indigo-600 transition-all duration-300">
               {node.label}
             </h3>
             <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-md ml-auto mr-auto md:ml-0 md:mr-0 group-hover:text-slate-600 transition-colors">
               {node.desc}
             </p>
           </div>
        </div>
      </div>

      {/* Icon Node */}
      <div className="relative z-10 flex-shrink-0">
        <motion.div 
          whileHover={{ scale: 1.1, rotate: 5 }}
          className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white border border-slate-100 flex items-center justify-center relative overflow-hidden group/icon shadow-xl shadow-slate-200/50"
        >
          <div className="absolute inset-0 bg-black/5 group-hover/icon:bg-indigo-50 transition-colors" />
          <node.icon size={28} className="text-slate-900 group-hover/icon:text-indigo-600 transition-colors relative z-10" />
          
          {/* Animated rings around node when in view */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            whileInView={{ scale: 1.4, opacity: 0.1 }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
            className="absolute inset-0 border border-indigo-500/30 rounded-2xl"
          />
        </motion.div>
      </div>

      {/* Spacer for layout */}
      <div className="flex-1 hidden md:block" />
    </motion.div>
  );
}


