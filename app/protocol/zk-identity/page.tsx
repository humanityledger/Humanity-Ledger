"use client";

import React from "react";
import Link from "next/link";
import { SystemFooter } from "@/components/landing/SystemFooter";

export default function ZKIdentityPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-[#E0E0E0] selection:bg-[#0044CC] selection:text-white font-sans">
      <section className="pt-40 pb-32 px-8 max-w-[1000px] mx-auto">
        <Link href="/" className="inline-block font-mono text-[10px] uppercase tracking-[0.3em] text-[#0044CC] mb-6 hover:text-white transition-colors">
          &larr; Return to Root
        </Link>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#0044CC] mb-6">Identity Layer</div>
        <h1 className="font-serif text-5xl md:text-7xl text-white font-normal leading-[1.0] tracking-tight mb-16">
          Zero-Knowledge <br /><span className="italic text-white/40">Identity.</span>
        </h1>
        
        <div className="space-y-12 text-lg text-white/70 leading-[1.8]">
          <div>
            <h3 className="text-2xl text-white font-serif mb-4">01. Hardware-Rooted Keys</h3>
            <p>
              Your digital identity is no longer an email address in a centralized database; it is a cryptographic keypair stored inside your device's secure hardware enclave (Secure Enclave / Titan M). By utilizing WebAuthn and FIDO2 standards, authentication is deterministic and immune to remote phishing or brute-force extraction.
            </p>
          </div>

          <div>
            <h3 className="text-2xl text-white font-serif mb-4">02. Programmable Privacy (Aztec)</h3>
            <p>
              While standard blockchains expose all transactions and social graphs to the public, Humanity Ledger utilizes the Aztec network's programmable privacy frameworks. You can mathematically prove your identity, wallet balances, or group memberships using Zero-Knowledge proofs (ZK-SNARKs) without ever revealing your public address to the recipient or the network.
            </p>
          </div>

          <div>
            <h3 className="text-2xl text-white font-serif mb-4">03. Social Graph Obfuscation</h3>
            <p>
              Interactions on the network generate cryptographic nullifiers rather than plaintext sender/receiver pairs. A third-party observer analyzing the decentralized relay can only see that mathematically valid data is moving; they cannot determine who is communicating with whom.
            </p>
          </div>
        </div>
      </section>
      <SystemFooter />
    </main>
  );
}
