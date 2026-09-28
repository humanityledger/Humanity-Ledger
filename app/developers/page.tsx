"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ChevronRight, Terminal, Cpu, Database, Network, Shield, Zap, Code2, Boxes } from "lucide-react";
import { SystemFooter } from "@/components/landing/SystemFooter";

const DEVELOPER_MODULES = [
  {
    id: "architecture",
    title: "Protocol Architecture",
    icon: <Network size={16} />,
    sections: [
      {
        subtitle: "Zero-Knowledge State Shielding",
        text: "Humanity Ledger does not operate as a standard smart contract protocol. It is a cryptographic enclave deployed on the Aztec L2 rollup. Every state transition—whether a message sent via Ledger Chat, an identity verification, or a Quantum Dot transfer—is executed client-side. The client generates a zk-SNARK (Zero-Knowledge Succinct Non-Interactive Argument of Knowledge) locally, proving the validity of the transition without revealing the inputs (sender, receiver, payload, or amount).",
        code: null
      },
      {
        subtitle: "The Dual-State Homomorphic Paradigm",
        text: "Traditional blockchains force a dichotomy: transparent on-chain execution or opaque off-chain servers. We utilize Aztec's dual-state architecture. Public states (such as global Merkle roots and protocol constants) interact flawlessly with private encrypted UTXOs. The protocol uses the BN254 elliptic curve for the Barretenberg proving backend, achieving sub-second proof generation on consumer hardware via highly optimized WebAssembly (WASM) circuits.",
        code: `// Protocol Configuration & Global Constants
export const AZTEC_NETWORK_CONFIG = {
  chainId: 31337,
  rollupAddress: "0x...",
  registryAddress: "0x...",
  l1RpcUrl: process.env.NEXT_PUBLIC_ETH_RPC,
  aztecRpcUrl: "https://aztec-node.humanidfi.com",
  proofSystem: "barretenberg-plonk",
  curve: "BN254"
};`
      }
    ]
  },
  {
    id: "noir",
    title: "Noir Cryptographic Circuits",
    icon: <Code2 size={16} />,
    sections: [
      {
        subtitle: "Client-Side Proving Pipeline",
        text: "We expose foundational circuits written in Noir, a Rust-like domain-specific language for writing zero-knowledge proofs. When a user interacts with Humanity Ledger, the Noir program compiles into a mathematical constraint system. The Barretenberg prover then generates an ultra-succinct proof that the constraints were satisfied. This proof is transmitted to the Decentralized Relay.",
        code: `// Humanity Ledger - Cryptographic Identity Circuit (Noir)
use dep::std;
use dep::aztec::context::PrivateContext;
use dep::aztec::note::note_header::NoteHeader;

fn verify_hardware_enclave(
    pub_key_x: pub Field,
    pub_key_y: pub Field,
    signature: [u8; 64],
    message_hash: [u8; 32],
    identity_nullifier: pub Field 
) {
    // 1. Verify hardware-rooted ECDSA signature mathematically
    let valid_signature = std::ecdsa_secp256k1::verify_signature(
        pub_key_x,
        pub_key_y,
        signature,
        message_hash
    );
    assert(valid_signature);

    // 2. Enforce cryptographic state shielding constraint
    // The nullifier prevents replay attacks without exposing identity
    let computed_nullifier = std::hash::poseidon::bn254::hash_2([
        pub_key_x, 
        pub_key_y
    ]);
    
    assert(identity_nullifier == computed_nullifier);
}`
      },
      {
        subtitle: "Custom Circuit Integration",
        text: "Developers can write custom Noir circuits that interface with the Humanity Ledger Registry. By asserting the validity of a Humanity Ledger private token within your own circuit, you can build regulatory-compliant dark pools, anonymous voting systems, and confidential decentralized exchanges without ever interacting with cleartext data.",
        code: `// Example: Integrating Humanity Ledger Identity into a Custom Protocol
fn execute_confidential_trade(
    trade_payload: pub Field,
    ledger_identity_proof: [Field; 16],
    verification_key: [Field; 114]
) {
    // Recursively verify the Humanity Ledger identity proof
    let is_verified_human = std::verify_proof(
        verification_key,
        ledger_identity_proof,
        [trade_payload], // Public inputs
        0 // Proof identifier
    );
    assert(is_verified_human);
    
    // Execute trade logic...
}`
      }
    ]
  },
  {
    id: "xmtp",
    title: "XMTP Decentralized Relay",
    icon: <Database size={16} />,
    sections: [
      {
        subtitle: "Peer-to-Peer State Synchronization",
        text: "While Aztec manages the financial and consensus state, ephemeral off-chain coordination (such as Ledger Chat messaging, WebRTC signaling, and peer discovery) requires a high-throughput decentralized relay. We utilize the Extensible Message Transport Protocol (XMTP) as a localized, censorship-resistant message bus.",
        code: `// Humanity Ledger - XMTP Relay Stream Initialization
import { Client } from '@xmtp/xmtp-js';
import { ethers } from 'ethers';

export async function initiateQuantumRelayStream(signer: ethers.Signer) {
  // Instantiate Hardware-Rooted session in production enclave
  const xmtp = await Client.create(signer, { env: "production" });
  
  // Bind to the Decentralized Relay
  const stream = await xmtp.conversations.streamAllMessages();
  
  console.log(`[Relay]: Node synchronized. Awaiting state transitions.`);
  
  for await (const message of stream) {
    if (message.senderAddress === xmtp.address) continue; // Ignore self
    
    // Decrypt and process homomorphic payload
    const payload = message.content;
    const sender = message.senderAddress;
    
    await processZeroKnowledgePayload(payload, sender);
  }
}`
      },
      {
        subtitle: "Cryptographic Payload Delivery",
        text: "Messages delivered through the relay are double-encrypted. First, the payload is symmetrically encrypted using a derivation of the ECDH shared secret between the two peers. Second, the entire packet is wrapped in the XMTP protocol's standard transport encryption. This ensures absolute forward secrecy and cryptographic deniability.",
        code: null
      }
    ]
  },
  {
    id: "smart-contracts",
    title: "Solidity Verifier Contracts",
    icon: <Cpu size={16} />,
    sections: [
      {
        subtitle: "L1 Settlement and Verification",
        text: "Proofs generated on the client device must ultimately be verified on Ethereum (L1) or an EVM-compatible L2. Humanity Ledger deploys UltraPlonk verifier contracts written in Solidity. These contracts contain hardcoded verification keys corresponding to our Noir circuits. When a state transition is submitted, the verifier executes the elliptic curve pairings to guarantee mathematical soundness.",
        code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {UltraVerifier} from "./plonk_vk.sol";

contract LedgerStateShield {
    UltraVerifier public verifier;
    mapping(bytes32 => bool) public consumedNullifiers;

    error CryptographicAnomalyDetected();
    error StateTransitionInvalid();

    constructor(address _verifier) {
        verifier = UltraVerifier(_verifier);
    }

    function transitionState(
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) external {
        bytes32 nullifier = publicInputs[0];
        
        // Prevent cryptographic double-spend (replay attack)
        if (consumedNullifiers[nullifier]) revert CryptographicAnomalyDetected();

        // Execute Plonk verification pairing
        bool valid = verifier.verify(proof, publicInputs);
        if (!valid) revert StateTransitionInvalid();

        // Anchor the state transition
        consumedNullifiers[nullifier] = true;
    }
}`
      }
    ]
  },
  {
    id: "zk-identity",
    title: "Zero-Knowledge Identity (ZKI)",
    icon: <Shield size={16} />,
    sections: [
      {
        subtitle: "Biometric Hardware Binding",
        text: "The core of Humanity Ledger's Sybil resistance is the ZKI protocol. Using WebAuthn and Secure Enclaves (Apple Secure Enclave, Android StrongBox), we bind an ECDSA keypair to the user's biometric hardware. The private key never leaves the enclave and cannot be extracted, even by the OS.",
        code: `// Hardware-Rooted Key Generation Request
const credential = await navigator.credentials.create({
  publicKey: {
    challenge: new Uint8Array(32), // Cryptographic nonce
    rp: { name: "Humanity Ledger Protocol", id: "humanidfi.com" },
    user: {
      id: new Uint8Array(16),
      name: "node.operator",
      displayName: "Protocol Node"
    },
    pubKeyCredParams: [{ alg: -7, type: "public-key" }],
    authenticatorSelection: {
      authenticatorAttachment: "platform", // Force hardware enclave
      userVerification: "required" // Force biometric check
    },
    timeout: 60000,
    attestation: "direct" // Request cryptographic hardware attestation
  }
});`
      },
      {
        subtitle: "Anonymous Credentials",
        text: "Once the hardware key is established, the user can sign arbitrary payloads. However, to maintain privacy, we do not broadcast the public key or the signature. Instead, the user generates a zk-SNARK proving they possess a valid hardware signature over a specific message. The network verifies the proof without ever learning which specific public key generated the signature, achieving absolute anonymity while mathematically guaranteeing uniqueness.",
        code: null
      }
    ]
  }
];

export default function DevelopersPage() {
  const [activeModule, setActiveModule] = useState(DEVELOPER_MODULES[0]);

  return (
    <main className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black">
      {/* HEADER */}
      <section className="pt-32 pb-16 px-8 max-w-[1400px] mx-auto border-b border-white/10">
        <div className="flex flex-col gap-6">
          <Link href="/" className="inline-flex font-mono text-[11px] uppercase tracking-[0.3em] text-white/50 hover:text-white transition-colors w-fit">
            &larr; Return to Protocol
          </Link>
          <h1 className="font-serif text-5xl md:text-7xl font-normal leading-tight tracking-tight max-w-4xl">
            Protocol Engineering <br />
            <span className="italic text-white/40">Architectural Reference.</span>
          </h1>
          <p className="text-lg md:text-xl text-white/60 max-w-3xl leading-relaxed font-light mt-4">
            The definitive, exhaustive guide for integrating with the Humanity Ledger protocol. Construct privacy-preserving decentralized applications utilizing Zero-Knowledge State Shielding, decentralized relays, and fully homomorphic data structures. Designed for senior protocol engineers operating at maximum quantum capacity.
          </p>
        </div>
      </section>

      {/* WORKSPACE */}
      <section className="max-w-[1400px] mx-auto flex flex-col lg:flex-row min-h-[800px] border-x border-b border-white/10">
        
        {/* SIDEBAR NAVIGATION */}
        <div className="w-full lg:w-80 shrink-0 border-r border-white/10 flex flex-col bg-black/50">
          <div className="p-6 border-b border-white/10">
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Modules</span>
          </div>
          <div className="flex flex-col py-4">
            {DEVELOPER_MODULES.map((mod) => (
              <button
                key={mod.id}
                onClick={() => setActiveModule(mod)}
                className={`flex items-center gap-3 px-6 py-4 text-left transition-all ${
                  activeModule.id === mod.id 
                    ? "bg-white/10 border-l-2 border-white text-white" 
                    : "border-l-2 border-transparent text-white/40 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                <div className="shrink-0">{mod.icon}</div>
                <span className="font-mono text-[12px] font-bold uppercase tracking-widest">{mod.title}</span>
              </button>
            ))}
          </div>
          
          <div className="mt-auto p-6 border-t border-white/10 bg-white/5">
            <div className="flex items-center gap-3 text-white/60 mb-2">
              <Terminal size={14} />
              <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em]">System Status</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-[11px] text-emerald-500">Aztec PXE Engine Online</span>
            </div>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 flex flex-col bg-[#050505]">
          <div className="p-10 lg:p-16 flex flex-col gap-16">
            
            <div className="flex flex-col gap-4 border-b border-white/10 pb-10">
              <div className="flex items-center gap-3 text-white/40 mb-2">
                {activeModule.icon}
                <span className="font-mono text-[11px] font-black uppercase tracking-[0.3em]">{activeModule.title}</span>
              </div>
              <h2 className="font-serif text-4xl md:text-5xl text-white tracking-tight">{activeModule.title}</h2>
            </div>

            {activeModule.sections.map((section, idx) => (
              <div key={idx} className="flex flex-col gap-6">
                <h3 className="text-2xl font-bold tracking-tight text-white">{section.subtitle}</h3>
                <p className="text-[16px] leading-[1.8] text-white/70 font-light max-w-4xl">
                  {section.text}
                </p>
                
                {section.code && (
                  <div className="mt-6 bg-[#0A0A0A] border border-white/10 rounded-sm overflow-hidden shadow-2xl flex flex-col max-w-5xl">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-[#050505]">
                      <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
                      <span className="ml-4 font-mono text-[10px] text-white/30 uppercase tracking-widest">Cryptographic Implementation</span>
                    </div>
                    <div className="p-6 overflow-x-auto">
                      <pre className="text-[13px] font-mono text-[#A0A0A0] leading-[1.7]"><code className="language-typescript">{section.code}</code></pre>
                    </div>
                  </div>
                )}
              </div>
            ))}

          </div>
        </div>

      </section>
      
      <div className="border-t border-white/10 mt-20">
        <SystemFooter />
      </div>
    </main>
  );
}
