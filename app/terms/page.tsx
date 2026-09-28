"use client";

import React from "react";
import Link from "next/link";
import { SystemFooter } from "@/components/landing/SystemFooter";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-[#E0E0E0] selection:bg-[#0044CC] selection:text-white font-sans">
      <section className="pt-40 pb-32 px-8 max-w-[1000px] mx-auto">
        <Link href="/" className="inline-block font-mono text-[10px] uppercase tracking-[0.3em] text-[#0044CC] mb-6 hover:text-white transition-colors">
          &larr; Return to Protocol
        </Link>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#0044CC] mb-6">Protocol Interaction Agreement</div>
        <h1 className="font-serif text-5xl md:text-7xl text-white font-normal leading-[1.0] tracking-tight mb-16">
          Sovereign <br /><span className="italic text-white/40">Terms of Operation.</span>
        </h1>
        
        <div className="space-y-12 text-lg text-white/70 leading-[1.8]">
          <div>
            <h3 className="text-2xl text-white font-serif mb-4">01. Cryptographic Liability</h3>
            <p>
              By interacting with the Humanity Ledger, you acknowledge that all state transitions are finalized via smart contracts deployed on a decentralized network. You alone are responsible for the physical and digital security of your hardware-rooted authentication modules and private keys. We cannot reverse, modify, or halt any cryptographic execution.
            </p>
          </div>

          <div>
            <h3 className="text-2xl text-white font-serif mb-4">02. Decentralized Relay Usage</h3>
            <p>
              The application layer serves strictly as an unprivileged conduit to the underlying protocol. Our decentralized relay networks route encrypted packets without inspection or persistent storage. Users agree to utilize the relay layer in accordance with the hardcoded consensus mechanisms and rate-limiting telemetry.
            </p>
          </div>

          <div>
            <h3 className="text-2xl text-white font-serif mb-4">03. Code as Law</h3>
            <p>
              The open-source Zero-Knowledge circuits (Noir) and EVM-compatible contracts dictating system behavior supersede any written text in this document. Any discrepancy between human-readable intent and compiled bytecode is resolved strictly in favor of the bytecode.
            </p>
          </div>
        </div>
      </section>
      <SystemFooter />
    </main>
  );
}
