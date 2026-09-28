"use client";

import React from "react";
import Link from "next/link";
import { SystemFooter } from "@/components/landing/SystemFooter";

export default function GovernancePage() {
  return (
    <main className="min-h-screen bg-[#050505] text-[#E0E0E0] selection:bg-[#0044CC] selection:text-white font-sans">
      <section className="pt-40 pb-32 px-8 max-w-[1000px] mx-auto">
        <Link href="/" className="inline-block font-mono text-[10px] uppercase tracking-[0.3em] text-[#0044CC] mb-6 hover:text-white transition-colors">
          &larr; Return to Protocol
        </Link>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#0044CC] mb-6">Network Governance</div>
        <h1 className="font-serif text-5xl md:text-7xl text-white font-normal leading-[1.0] tracking-tight mb-16">
          Cryptographic <br /><span className="italic text-white/40">Consensus.</span>
        </h1>
        
        <div className="space-y-12 text-lg text-white/70 leading-[1.8]">
          <div>
            <h3 className="text-2xl text-white font-serif mb-4">01. Immutable Code</h3>
            <p>
              Humanity Ledger operates under the principle that code is law. The fundamental cryptographic logic that shields user identity and routes messages is designed to be immutable, ensuring that no central authority—including the founding engineering collective—can arbitrarily modify protocol constraints or access user state.
            </p>
          </div>

          <div>
            <h3 className="text-2xl text-white font-serif mb-4">02. Decentralized Proposals</h3>
            <p>
              Upgrades to peripheral smart contracts or decentralized relay configurations will be handled via an on-chain proposal system. The protocol is designed to transition control to a decentralized autonomous entity post-mainnet launch, utilizing ZK-voting to allow token holders to govern without exposing their voting choices publicly.
            </p>
          </div>

          <div className="mt-8 bg-[#1A1A1A] border border-white/10 rounded-xl p-8 text-center">
            <span className="text-white/40 font-mono text-sm block mb-2">Governance Portal</span>
            <h4 className="text-xl text-white font-bold mb-4">Snapshot & On-Chain Voting</h4>
            <p className="text-sm text-white/60 mb-6 max-w-md mx-auto">
              The on-chain governance module will be activated following the complete deployment of the network's zero-knowledge state shielding infrastructure.
            </p>
            <button disabled className="px-6 py-2 rounded-full bg-white/5 border border-white/10 text-white/30 cursor-not-allowed text-sm font-bold">
              Launching Q2 2027
            </button>
          </div>
        </div>
      </section>
      <SystemFooter />
    </main>
  );
}
