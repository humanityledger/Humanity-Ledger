"use client";

import React from "react";
import Link from "next/link";
import { SystemFooter } from "@/components/landing/SystemFooter";

export default function DecentralizedRelayPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-[#E0E0E0] selection:bg-[#0044CC] selection:text-white font-sans">
      <section className="pt-40 pb-32 px-8 max-w-[1000px] mx-auto">
        <Link href="/" className="inline-block font-mono text-[10px] uppercase tracking-[0.3em] text-[#0044CC] mb-6 hover:text-white transition-colors">
          &larr; Return to Root
        </Link>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#0044CC] mb-6">Transport Layer</div>
        <h1 className="font-serif text-5xl md:text-7xl text-white font-normal leading-[1.0] tracking-tight mb-16">
          Decentralized <br /><span className="italic text-white/40">Relay.</span>
        </h1>
        
        <div className="space-y-12 text-lg text-white/70 leading-[1.8]">
          <div>
            <h3 className="text-2xl text-white font-serif mb-4">01. Unbreakable Routing</h3>
            <p>
              Traditional messaging architectures rely on centralized servers to route and store messages, creating single points of failure and surveillance bottlenecks. Humanity Ledger replaces this with a Decentralized Relay protocol. Encrypted packets are routed across a distributed network of independent nodes.
            </p>
          </div>

          <div>
            <h3 className="text-2xl text-white font-serif mb-4">02. XMTP Integration</h3>
            <p>
              By utilizing the Extensible Message Transport Protocol (XMTP), Humanity Ledger ensures that all communications are end-to-end encrypted by default. Nodes in the relay network are cryptographically incapable of inspecting the payload or the metadata of the messages they transport. They simply validate the transaction constraints and pass the encrypted bytes forward.
            </p>
          </div>

          <div>
            <h3 className="text-2xl text-white font-serif mb-4">03. Ephemeral Storage Nodes</h3>
            <p>
              Messages destined for offline peers are temporarily held in decentralized, highly-available storage nodes. These packets remain in their fully encrypted state. Once the target peer comes online and retrieves the payload, it is mathematically obliterated from the transport layer. There is no central database to subpoena.
            </p>
          </div>
        </div>
      </section>
      <SystemFooter />
    </main>
  );
}
