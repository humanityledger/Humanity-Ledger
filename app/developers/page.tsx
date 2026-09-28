"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { SystemFooter } from "@/components/landing/SystemFooter";

export default function DevelopersPage() {
  const [activeTab, setActiveTab] = useState("noir");

  return (
    <main className="min-h-screen bg-[#050505] text-[#E0E0E0] selection:bg-[#0044CC] selection:text-white font-sans">
      {/* HEADER SECTION */}
      <section className="pt-40 pb-20 px-8 max-w-[1400px] mx-auto border-b border-white/10">
        <Link href="/" className="inline-block font-mono text-[10px] uppercase tracking-[0.3em] text-[#0044CC] mb-6 hover:text-white transition-colors">
          &larr; Return to Protocol
        </Link>
        <h1 className="font-serif text-6xl md:text-8xl text-white font-normal leading-[1.0] tracking-tight mb-8">
          Hardware-Rooted <br /><span className="italic text-white/40">Authentication.</span>
        </h1>
        <p className="text-xl text-white/60 max-w-3xl leading-[1.8]">
          The Humanity Ledger Developer Hub. Construct privacy-preserving decentralized applications utilizing Zero-Knowledge State Shielding, decentralized relays, and fully homomorphic data structures.
        </p>
      </section>

      {/* CODE BLOCK SECTION (AZTEC STYLE) */}
      <section className="py-32 px-8 max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16">
        <div>
          <h2 className="font-serif text-4xl text-white mb-6">Cryptographic Primitives</h2>
          <p className="text-white/60 mb-10 leading-[1.7]">
            Integrate seamlessly with our zero-knowledge backend. We expose foundational circuits written in Noir, allowing developers to generate deterministic validity proofs client-side without exposing underlying state to the Decentralized Relay network.
          </p>
          
          <div className="flex flex-col gap-4 font-mono text-sm">
            <button onClick={() => setActiveTab("noir")} className={`text-left px-6 py-4 border-l-2 transition-colors ${activeTab === "noir" ? "border-[#0044CC] text-white bg-white/5" : "border-white/10 text-white/40 hover:text-white/80"}`}>
              01. Zero-Knowledge State Shielding (Noir)
            </button>
            <button onClick={() => setActiveTab("solidity")} className={`text-left px-6 py-4 border-l-2 transition-colors ${activeTab === "solidity" ? "border-[#0044CC] text-white bg-white/5" : "border-white/10 text-white/40 hover:text-white/80"}`}>
              02. State Verification (Solidity)
            </button>
            <button onClick={() => setActiveTab("xmtp")} className={`text-left px-6 py-4 border-l-2 transition-colors ${activeTab === "xmtp" ? "border-[#0044CC] text-white bg-white/5" : "border-white/10 text-white/40 hover:text-white/80"}`}>
              03. Decentralized Relay Stream (XMTP)
            </button>
          </div>
        </div>

        {/* CODE WINDOW */}
        <div className="bg-[#0A0A0A] border border-white/10 rounded-sm overflow-hidden shadow-2xl flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-[#050505]">
            <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
          </div>
          <div className="p-6 overflow-x-auto text-sm font-mono text-[#A0A0A0] leading-[1.6]">
            {activeTab === "noir" && (
              <pre><code>{`// Humanity Ledger - ZK Identity Shielding
use dep::std;

fn main(
    pub_key_x: pub Field,
    pub_key_y: pub Field,
    signature: [u8; 64],
    message_hash: [u8; 32],
    identity_nullifier: pub Field 
) {
    // Verify hardware-rooted ECDSA signature
    let valid_signature = std::ecdsa_secp256k1::verify_signature(
        pub_key_x,
        pub_key_y,
        signature,
        message_hash
    );
    assert(valid_signature);

    // Enforce state shielding constraint
    let computed_nullifier = std::hash::poseidon::bn254::hash_2([
        pub_key_x, 
        pub_key_y
    ]);
    
    assert(identity_nullifier == computed_nullifier);
}`}</code></pre>
            )}
            {activeTab === "solidity" && (
              <pre><code>{`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {UltraVerifier} from "./plonk_vk.sol";

contract LedgerStateShield {
    UltraVerifier public verifier;
    mapping(bytes32 => bool) public consumedNullifiers;

    error StateTransitionInvalid();

    function transitionState(
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) external {
        bytes32 nullifier = publicInputs[0];
        if (consumedNullifiers[nullifier]) revert StateTransitionInvalid();

        bool valid = verifier.verify(proof, publicInputs);
        if (!valid) revert StateTransitionInvalid();

        consumedNullifiers[nullifier] = true;
    }
}`}</code></pre>
            )}
            {activeTab === "xmtp" && (
              <pre><code>{`// Decentralized Relay Initialization
import { Client } from '@xmtp/xmtp-js';
import { ethers } from 'ethers';

async function initiateRelayStream() {
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();

  // Instantiate Hardware-Rooted session
  const xmtp = await Client.create(signer, { env: "production" });
  
  // Listen to Decentralized Relay
  const stream = await xmtp.conversations.stream();
  
  for await (const conversation of stream) {
    console.log(\`[Relay]: Incoming state sync from \${conversation.peerAddress}\`);
    // Decrypt and process homomorphic payload
  }
}`}</code></pre>
            )}
          </div>
        </div>
      </section>

      <SystemFooter />
    </main>
  );
}
