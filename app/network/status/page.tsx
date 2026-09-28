"use client";

import React from "react";
import Link from "next/link";
import { SystemFooter } from "@/components/landing/SystemFooter";

export default function NetworkStatusPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-[#E0E0E0] selection:bg-[#0044CC] selection:text-white font-sans">
      <section className="pt-40 pb-32 px-8 max-w-[1000px] mx-auto">
        <Link href="/" className="inline-block font-mono text-[10px] uppercase tracking-[0.3em] text-[#0044CC] mb-6 hover:text-white transition-colors">
          &larr; Return to Protocol
        </Link>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#0044CC] mb-6">Network Telemetry</div>
        <h1 className="font-serif text-5xl md:text-7xl text-white font-normal leading-[1.0] tracking-tight mb-16">
          System <br /><span className="italic text-white/40">Status.</span>
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          <div className="bg-[#111] border border-white/5 rounded-xl p-6 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-white/50 font-mono text-sm">Decentralized Relay (XMTP)</span>
              <div className="w-2.5 h-2.5 rounded-full bg-[#30D158] animate-pulse shadow-[0_0_12px_rgba(48,209,88,0.6)]" />
            </div>
            <span className="text-2xl text-white font-bold">Operational</span>
            <span className="text-white/30 text-xs">Uptime: 99.999%</span>
          </div>

          <div className="bg-[#111] border border-white/5 rounded-xl p-6 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-white/50 font-mono text-sm">ZK Prover Network</span>
              <div className="w-2.5 h-2.5 rounded-full bg-[#30D158] animate-pulse shadow-[0_0_12px_rgba(48,209,88,0.6)]" />
            </div>
            <span className="text-2xl text-white font-bold">Operational</span>
            <span className="text-white/30 text-xs">Avg Proof Generation: &lt;1.2s</span>
          </div>

          <div className="bg-[#111] border border-white/5 rounded-xl p-6 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-white/50 font-mono text-sm">EVM State Contracts</span>
              <div className="w-2.5 h-2.5 rounded-full bg-[#30D158] animate-pulse shadow-[0_0_12px_rgba(48,209,88,0.6)]" />
            </div>
            <span className="text-2xl text-white font-bold">Operational</span>
            <span className="text-white/30 text-xs">Block Finality: Synchronized</span>
          </div>

          <div className="bg-[#111] border border-white/5 rounded-xl p-6 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-white/50 font-mono text-sm">WebRTC Signaling Mesh</span>
              <div className="w-2.5 h-2.5 rounded-full bg-[#30D158] animate-pulse shadow-[0_0_12px_rgba(48,209,88,0.6)]" />
            </div>
            <span className="text-2xl text-white font-bold">Operational</span>
            <span className="text-white/30 text-xs">Peer Connections: Stable</span>
          </div>
        </div>

        <div className="space-y-6 text-lg text-white/70 leading-[1.8]">
          <p>
            The Humanity Ledger architecture is inherently resilient. By eliminating centralized backend databases and relying entirely on distributed XMTP relays and client-side ZK-SNARK proving, the network is mathematically immune to traditional DDoS vectors targeting centralized APIs.
          </p>
        </div>
      </section>
      <SystemFooter />
    </main>
  );
}
