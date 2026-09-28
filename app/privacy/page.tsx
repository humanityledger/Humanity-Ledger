"use client";

import React from "react";
import Link from "next/link";
import { SystemFooter } from "@/components/landing/SystemFooter";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-[#E0E0E0] selection:bg-[#0044CC] selection:text-white font-sans">
      <section className="pt-40 pb-32 px-8 max-w-[1000px] mx-auto">
        <Link href="/" className="inline-block font-mono text-[10px] uppercase tracking-[0.3em] text-[#0044CC] mb-6 hover:text-white transition-colors">
          &larr; Return to Protocol
        </Link>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#0044CC] mb-6">Cryptographic Privacy Assertion</div>
        <h1 className="font-serif text-5xl md:text-7xl text-white font-normal leading-[1.0] tracking-tight mb-16">
          Zero-Knowledge <br /><span className="italic text-white/40">Data Posture.</span>
        </h1>
        
        <div className="space-y-12 text-lg text-white/70 leading-[1.8]">
          <div>
            <h3 className="text-2xl text-white font-serif mb-4">01. Architectural Denial of Data</h3>
            <p>
              The Humanity Ledger does not "protect" your data; it fundamentally denies its existence within our infrastructure. Through Zero-Knowledge State Shielding and Hardware-Rooted Authentication, all cryptographic proofs are generated client-side. We cannot access, decrypt, or leak what we do not hold. 
            </p>
          </div>

          <div>
            <h3 className="text-2xl text-white font-serif mb-4">02. Ephemeral Key Exchanges</h3>
            <p>
              Any transient telemetry or relay traffic routing through our decentralized relay network utilizes X25519 ephemeral key handshakes. Session states are obliterated deterministically immediately upon disconnection. 
            </p>
          </div>

          <div>
            <h3 className="text-2xl text-white font-serif mb-4">03. Protocol Sovereignty</h3>
            <p>
              You hold the private keys. End-to-end encryption guarantees that even in the event of a total systemic compromise of our relay nodes, the cryptographic integrity of your communications and state transitions remains mathematically unbreakable.
            </p>
          </div>
        </div>
      </section>
      <SystemFooter />
    </main>
  );
}
