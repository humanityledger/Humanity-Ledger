"use client";

import React from "react";
import Link from "next/link";
import { SystemFooter } from "@/components/landing/SystemFooter";

export default function ZKExplorerPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-[#E0E0E0] selection:bg-[#0044CC] selection:text-white font-sans">
      <section className="pt-40 pb-32 px-8 max-w-[1000px] mx-auto">
        <Link href="/" className="inline-block font-mono text-[10px] uppercase tracking-[0.3em] text-[#0044CC] mb-6 hover:text-white transition-colors">
          &larr; Return to Protocol
        </Link>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#0044CC] mb-6">Network Diagnostics</div>
        <h1 className="font-serif text-5xl md:text-7xl text-white font-normal leading-[1.0] tracking-tight mb-8">
          Zero-Knowledge <br /><span className="italic text-white/40">Block Explorer.</span>
        </h1>
        
        <div className="bg-[#111] border border-red-500/20 rounded-xl p-8 mb-12">
          <h2 className="text-xl font-bold text-red-400 mb-2">ACCESS DENIED BY MATHEMATICS</h2>
          <p className="text-white/60 font-mono text-sm">
            Unlike traditional blockchains (e.g., Ethereum, Bitcoin) where all state transitions, balances, and message payloads are public, the Humanity Ledger operates on a strict Zero-Knowledge architecture (Aztec Noir).
          </p>
        </div>

        <div className="space-y-12 text-lg text-white/70 leading-[1.8]">
          <div>
            <h3 className="text-2xl text-white font-serif mb-4">What You Cannot See</h3>
            <p>
              By design, our network explorer cannot display wallet addresses, message contents, transaction amounts, or communication graphs. All state is shielded using client-side SNARK proofs before being submitted to the decentralized relay.
            </p>
          </div>

          <div>
            <h3 className="text-2xl text-white font-serif mb-4">What You Can Verify</h3>
            <p>
              The explorer only allows you to verify the cryptographic validity of a specific transaction hash. You can confirm that a state transition occurred and was mathematically valid, without knowing what the transition was or who executed it.
            </p>
          </div>

          <div className="mt-8">
            <input 
              type="text" 
              placeholder="Enter TxHash or Nullifier..." 
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg px-6 py-4 text-white font-mono text-sm focus:outline-none focus:border-[#0044CC] transition-colors"
              disabled
            />
            <p className="text-[12px] text-white/40 font-mono mt-3">
              Explorer module is currently restricted to local testnet validation. Mainnet indexing will deploy in Q1 2027.
            </p>
          </div>
        </div>
      </section>
      <SystemFooter />
    </main>
  );
}
