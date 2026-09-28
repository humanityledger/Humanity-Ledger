"use client";

import React from "react";
import Link from "next/link";
import { SystemFooter } from "@/components/landing/SystemFooter";

export default function LedgerChatProtocolPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-[#E0E0E0] selection:bg-[#0044CC] selection:text-white font-sans">
      <section className="pt-40 pb-32 px-8 max-w-[1000px] mx-auto">
        <Link href="/" className="inline-block font-mono text-[10px] uppercase tracking-[0.3em] text-[#0044CC] mb-6 hover:text-white transition-colors">
          &larr; Return to Root
        </Link>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#0044CC] mb-6">Application Layer</div>
        <h1 className="font-serif text-5xl md:text-7xl text-white font-normal leading-[1.0] tracking-tight mb-16">
          Ledger Chat <br /><span className="italic text-white/40">Architecture.</span>
        </h1>
        
        <div className="space-y-12 text-lg text-white/70 leading-[1.8]">
          <div>
            <h3 className="text-2xl text-white font-serif mb-4">01. SIM-less Connectivity</h3>
            <p>
              Ledger Chat entirely bypasses the traditional telecom stack. By anchoring identity to cryptographic wallet signatures rather than SIM cards or cellular networks, the protocol eliminates SS7 vulnerabilities, SIM-swapping vectors, and centralized telco surveillance.
            </p>
          </div>

          <div>
            <h3 className="text-2xl text-white font-serif mb-4">02. Decentralized WebRTC Mesh</h3>
            <p>
              Voice and HD video calls are established using a decentralized WebRTC mesh. Signaling is negotiated securely over the XMTP network using ephemeral ECDH keys. Once the peer-to-peer connection is established, audio and video streams flow directly between endpoints with deterministic end-to-end encryption. No central server proxies your media.
            </p>
          </div>

          <div>
            <h3 className="text-2xl text-white font-serif mb-4">03. Deterministic Burn-on-Read</h3>
            <p>
              Ephemeral state is strictly enforced. When a message is designated as "Burn-on-Read", the decryption keys for that specific payload are cryptographically shredded from memory immediately after execution. It is mathematically impossible to retrieve the ciphertext's original content post-destruction.
            </p>
          </div>
        </div>
      </section>
      <SystemFooter />
    </main>
  );
}
