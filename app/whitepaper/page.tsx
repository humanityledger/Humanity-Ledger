import React from 'react';
import { Metadata } from 'next';
import DocLayout from '@/components/layout/DocLayout';

export const metadata: Metadata = {
  title: 'Humanity Ledger Whitepaper | Cryptographic Thesis',
  description: 'The formal cryptographic and economic thesis behind Humanity Ledger, detailing zero-knowledge proofs, UTXO models, and Aztec L2 architecture.',
};

export default function WhitepaperPage() {
  return (
    <DocLayout 
      title="Humanity Ledger Whitepaper" 
      category="Technical" 
      description="A formal cryptographic thesis on establishing a privacy-preserving, quantum-resistant Layer 2 protocol for humanity's sovereign data and value." 
      lastUpdated="October 19, 2026"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-slate-300 font-serif leading-relaxed">
        
        {/* Title Page */}
        <header className="mb-24 text-center border-b border-slate-700 pb-16">
          <div className="inline-block px-4 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-sans text-slate-400 mb-8 tracking-widest uppercase shadow-lg shadow-purple-500/10">
            DRAFT PAPER v4.0.0 — CONFIDENTIAL
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-white tracking-tight mb-8 font-sans">
            Humanity Ledger: <br/>
            <span className="text-purple-400">The Cryptographic Horizon</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-3xl mx-auto italic">
            Abstract: We propose a decentralized, privacy-first Layer 2 protocol built atop the Aztec Network. By intertwining Zero-Knowledge Succinct Non-Interactive Arguments of Knowledge (zk-SNARKs) with an encrypted Unspent Transaction Output (UTXO) model, we construct a system that guarantees absolute financial and informational sovereignty. Our protocol transcends traditional scaling limits, operating natively on pairing-friendly elliptic curves and offering unparalleled throughput via recursive Honk proofs, ensuring quantum-resistant data availability for a global populace.
          </p>
        </header>

        {/* 1. INTRODUCTION */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-8 border-l-4 border-purple-500 pl-4 font-sans uppercase tracking-wider">1. Introduction</h2>
          <p className="mb-6">
            The fundamental architecture of Web3—specifically the Ethereum base layer (L1)—is predicated on a paradigm of radical transparency. Every state transition, balance, and smart contract interaction is globally broadcast and immutably recorded. While this transparency provides unprecedented auditability, it intrinsically violates the privacy requirements necessary for institutional adoption and sovereign individual action.
          </p>
          <p className="mb-6">
            The Humanity Ledger addresses this dichotomy. It does not merely obfuscate data; it encrypts state transitions client-side and utilizes advanced zk-SNARKs to prove the validity of these transitions to the base layer without revealing the underlying inputs. The result is a network where the <em>integrity</em> of the system is public, but the <em>data</em> is private.
          </p>
        </section>

        {/* 2. MATHEMATICAL FOUNDATIONS */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-8 border-l-4 border-purple-500 pl-4 font-sans uppercase tracking-wider">2. Mathematical Foundations</h2>
          <p className="mb-6">
            Our protocol's security reduces to the hardness of the Discrete Logarithm Problem (DLP) over specific pairing-friendly curves. Specifically, we utilize the BN254 curve for on-chain proof verification (due to native Ethereum precompiles) and the Grumpkin curve for deriving account keys and encrypting note payloads. 
          </p>

          <div className="bg-slate-900 p-8 rounded-xl my-10 shadow-inner border border-slate-800 font-sans">
            <h3 className="text-xl font-bold text-purple-400 mb-6">2.1 The Polynomial Commitment Scheme (KZG)</h3>
            <p className="text-slate-300 mb-4">
              At the heart of the Honk proving system is the KZG polynomial commitment scheme. A prover wishes to commit to a polynomial \( P(x) \) of degree \( d \). Given a structured reference string (SRS) generated via a trusted setup:
            </p>
            <div className="bg-[#0a0a0f] p-4 rounded-lg overflow-x-auto text-emerald-400 font-mono text-sm mb-4 border border-slate-800">
              SRS = {'{'} [1]₁, [s]₁, [s²]₁, ..., [s^d]₁, [1]₂, [s]₂ {'}'}
            </div>
            <p className="text-slate-300 mb-4">
              The prover computes the commitment \( C \):
            </p>
            <div className="bg-[#0a0a0f] p-4 rounded-lg overflow-x-auto text-emerald-400 font-mono text-sm mb-4 border border-slate-800">
              C = [P(s)]₁ = Σ (p_i * [s^i]₁) for i=0 to d
            </div>
            <p className="text-slate-300 mb-4">
              To prove an evaluation \( P(z) = y \), the prover computes the quotient polynomial \( Q(x) = (P(x) - y) / (x - z) \) and provides the proof \( \pi = [Q(s)]₁ \). The verifier checks the pairing equation:
            </p>
            <div className="bg-[#0a0a0f] p-4 rounded-lg overflow-x-auto text-emerald-400 font-mono text-sm border border-slate-800">
              e(C - [y]₁, [1]₂) == e(π, [s]₂ - [z]₂)
            </div>
          </div>
        </section>

        {/* 3. STATE MODEL: UTXOs */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-8 border-l-4 border-purple-500 pl-4 font-sans uppercase tracking-wider">3. The Encrypted State Model (UTXO)</h2>
          <p className="mb-6">
            Unlike Ethereum's account-based model, Humanity Ledger primarily utilizes a privacy-preserving Unspent Transaction Output (UTXO) model. State is represented by two append-only Merkle trees: the <strong>Note Hash Tree</strong> and the <strong>Nullifier Tree</strong>.
          </p>
          <ul className="list-decimal pl-6 mb-6 space-y-4">
            <li><strong>Note Hash Tree:</strong> When a user receives funds or state is created, a cryptographic commitment (hash) of the data is added to the Note Hash Tree. The actual payload is encrypted using the recipient's incoming viewing key.</li>
            <li><strong>Nullifier Tree:</strong> To spend or mutate a note, the user generates a ZK proof demonstrating knowledge of the note's private data and computes its deterministic Nullifier. This Nullifier is added to the Nullifier Tree. A smart contract simply checks if a Nullifier already exists to prevent double-spending.</li>
          </ul>
          
          <div className="bg-slate-900 p-8 rounded-xl my-10 shadow-inner border border-slate-800 font-sans">
            <h3 className="text-xl font-bold text-purple-400 mb-4">3.1 Nullifier Derivation Algorithm</h3>
            <p className="text-slate-300 mb-4">
              Nullifiers must be deterministic but mathematically unlinkable to the original note commitment by external observers. We utilize the Poseidon2 algebraic hash function:
            </p>
            <div className="bg-[#0a0a0f] p-4 rounded-lg overflow-x-auto text-pink-400 font-mono text-sm border border-slate-800">
              Nullifier = Poseidon2( Note_Commitment, Nullifier_Secret_Key, Contract_Address )
            </div>
            <p className="text-slate-300 mt-4 text-sm">
              Because only the note owner possesses the <code className="bg-slate-800 px-1 rounded text-pink-300">Nullifier_Secret_Key</code>, only they can compute the correct Nullifier and spend the note.
            </p>
          </div>
        </section>

        {/* 4. RECURSIVE PROVING */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-8 border-l-4 border-purple-500 pl-4 font-sans uppercase tracking-wider">4. Recursive Proving & Scalability</h2>
          <p className="mb-6">
            The processing of individual transactions involves millions of constraints. To scale this, Humanity Ledger utilizes <strong>Recursive SNARKs</strong>. Rather than verifying thousands of proofs on L1 (which would be prohibitively expensive), a network of provers generates "proofs of proofs."
          </p>
          <p className="mb-6">
            1. <strong>User Proof (App Circuit):</strong> The user generates a proof of their private execution on their local device (the PXE).<br/>
            2. <strong>Rollup Circuit:</strong> A decentralized prover aggregates 2 user proofs into a single proof verifying that both user proofs are valid.<br/>
            3. <strong>Merge Circuit:</strong> Provers recursively merge these proofs in a binary tree structure until a single proof remains representing an entire block of transactions.<br/>
            4. <strong>L1 Verification:</strong> Ethereum verifies a single SNARK proof representing state transitions with highly complex compressed computation.
          </p>
        </section>

        {/* 5. QUANTUM RESISTANCE */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-white mb-8 border-l-4 border-purple-500 pl-4 font-sans uppercase tracking-wider">5. Post-Quantum Cryptography Migration</h2>
          <p className="mb-6">
            Current elliptic curve cryptography (ECC) is vulnerable to Shor's algorithm running on a sufficiently powerful quantum computer. The Humanity Ledger architecture is designed with cryptographic agility to facilitate a seamless transition to post-quantum (PQ) primitives.
          </p>
          <p className="mb-6">
            Our multi-phase PQ migration strategy involves replacing the BN254 pairings with lattice-based commitment schemes (such as those based on the Module Learning With Errors (MLWE) problem) and transitioning the underlying proving system from Honk to a hash-based STARK or a lattice-based SNARK. This ensures the <strong>cryptographic resilience</strong> required to secure the ledger for the next century.
          </p>
        </section>

        {/* CONCLUSION */}
        <section className="mb-20 border-t border-slate-700 pt-12">
          <h2 className="text-2xl font-bold text-white mb-6 font-sans">Conclusion</h2>
          <p className="mb-6">
            The Humanity Ledger represents a paradigm shift from transparent accounting to sovereign, privacy-preserving state transition systems. By leveraging the theoretical limits of zero-knowledge cryptography, we establish a protocol capable of scaling human coordination without sacrificing individual liberty.
          </p>
          <div className="mt-12 text-sm text-slate-500 font-sans text-center">
            <p>Authored by the Humanity Ledger Cryptography Team</p>
            <p>October 2026</p>
          </div>
        </section>

      </div>
    </DocLayout>
  );
}
