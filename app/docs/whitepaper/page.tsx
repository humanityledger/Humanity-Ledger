"use client";

import React from "react";
import Link from "next/link";
import { SystemFooter } from "@/components/landing/SystemFooter";

export default function WhitepaperPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-[#E0E0E0] selection:bg-[#0044CC] selection:text-white font-sans">
      <section className="pt-40 pb-32 px-8 max-w-[1000px] mx-auto">
        <Link href="/" className="inline-block font-mono text-[10px] uppercase tracking-[0.3em] text-[#0044CC] mb-6 hover:text-white transition-colors">
          &larr; Return to Protocol
        </Link>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#0044CC] mb-6">Foundational Research</div>
        <h1 className="font-serif text-5xl md:text-7xl text-white font-normal leading-[1.0] tracking-tight mb-16">
          The Humanity Ledger <br /><span className="italic text-white/40">Yellow Paper.</span>
        </h1>
        
        <div className="space-y-12 text-lg text-white/70 leading-[1.8]">
          <div className="bg-[#111] p-8 rounded-xl border border-white/10">
            <h3 className="text-2xl text-white font-serif mb-4">Abstract</h3>
            <p className="mb-4">
              Modern digital communication networks suffer from an inescapable architectural flaw: reliance on trusted centralized intermediaries for identity verification, message routing, and data storage. This paper proposes the Humanity Ledger—a protocol designed to completely disintermediate digital communication through the synthesis of Zero-Knowledge proofs (Aztec Noir), decentralized message relays (XMTP), and hardware-rooted cryptographic authentication.
            </p>
            <p>
              By abstracting identity into deterministic nullifier hashes and routing end-to-end encrypted payloads through a distributed network, the protocol achieves censorship resistance and absolute data sovereignty, mathematically guaranteeing that user metadata and social graphs cannot be harvested by any network participant.
            </p>
          </div>

          <div>
            <h3 className="text-2xl text-white font-serif mb-4">Availability</h3>
            <p>
              The full mathematical proofs, system topology, and security models are currently undergoing final peer review by our cryptographic collective. The complete technical Yellow Paper (PDF format) will be released alongside the Alpha mainnet launch in January 2027.
            </p>
          </div>
        </div>
      </section>
      <SystemFooter />
    </main>
  );
}
