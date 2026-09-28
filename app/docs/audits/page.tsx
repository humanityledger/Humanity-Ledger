"use client";

import React from "react";
import Link from "next/link";
import { SystemFooter } from "@/components/landing/SystemFooter";

export default function SecurityAuditsPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-[#E0E0E0] selection:bg-[#0044CC] selection:text-white font-sans">
      <section className="pt-40 pb-32 px-8 max-w-[1000px] mx-auto">
        <Link href="/" className="inline-block font-mono text-[10px] uppercase tracking-[0.3em] text-[#0044CC] mb-6 hover:text-white transition-colors">
          &larr; Return to Protocol
        </Link>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#0044CC] mb-6">Security & Cryptography</div>
        <h1 className="font-serif text-5xl md:text-7xl text-white font-normal leading-[1.0] tracking-tight mb-16">
          Formal <br /><span className="italic text-white/40">Verification.</span>
        </h1>
        
        <div className="space-y-12 text-lg text-white/70 leading-[1.8]">
          <div>
            <h3 className="text-2xl text-white font-serif mb-4">01. Smart Contract Audits</h3>
            <p>
              All EVM-compatible contracts responsible for state shielding and verifier logic are subjected to rigorous formal verification. Our smart contract architecture is designed to minimize complexity, ensuring a reduced attack surface. 
            </p>
          </div>

          <div>
            <h3 className="text-2xl text-white font-serif mb-4">02. Zero-Knowledge Circuit Constraints</h3>
            <p>
              The Noir circuits used to generate client-side SNARK proofs undergo continuous internal auditing by our 11-engineer cryptographic collective. We mathematically verify that no constraints are under-defined, preventing malicious proof generation or nullifier collisions.
            </p>
          </div>

          <div>
            <h3 className="text-2xl text-white font-serif mb-4">03. Transport Layer Security</h3>
            <p>
              We inherit the battle-tested security model of the XMTP network for decentralized relaying. All payloads use strictly enforced X25519 key exchanges and AES-256-GCM encryption before leaving the local device enclave.
            </p>
          </div>

          <div className="bg-[#111] border border-white/10 rounded-xl p-8 mt-12">
            <h3 className="text-xl text-white font-serif mb-2">Audit Reports</h3>
            <p className="text-sm font-mono text-white/50 mb-6">Pending publication post-Alpha (Q1 2027).</p>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <span className="text-white/80 font-mono text-sm">Core EVM Verifier</span>
                <span className="text-white/30 text-sm">Under Review</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <span className="text-white/80 font-mono text-sm">Noir ZK Circuits (Identity)</span>
                <span className="text-white/30 text-sm">Under Review</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <span className="text-white/80 font-mono text-sm">WebRTC Signaling Mesh</span>
                <span className="text-white/30 text-sm">Under Review</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <SystemFooter />
    </main>
  );
}
