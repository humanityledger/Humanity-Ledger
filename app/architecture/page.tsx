import React from 'react';
import { Metadata } from 'next';
import DocLayout from '@/components/layout/DocLayout';

export const metadata: Metadata = {
  title: 'System Architecture | Humanity Ledger',
  description: 'A formal technical specification of the Humanity Ledger infrastructure, detailing network topology, Mini-Apps, and state transition mechanisms.',
};

export default function ArchitecturePage() {
  return (
    <DocLayout 
      title="System Architecture Protocol" 
      category="Technical" 
      description="A rigorous technical dissection of the Humanity Ledger's ecosystem, execution environments, and state transition mechanisms." 
      lastUpdated="August 2026"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-slate-900 font-sans leading-relaxed">
        
        <h1 className="text-5xl font-extrabold mb-6 tracking-tight">System Architecture: <br/><span className="text-emerald-600">The Humanity Ledger Platform</span></h1>
        
        <p className="text-xl text-slate-600 mb-16 leading-relaxed max-w-4xl">
          The Humanity Ledger implements a highly advanced modular platform architecture designed to treat Mini-Apps as first-class citizens. By natively integrating with the Aztec Network, our infrastructure bifurcates execution into two distinct domains: the local Private Execution Environment (PXE) and the public network of Sequencers and Provers.
        </p>

        {/* 1. NETWORK TOPOLOGY */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold mb-8 text-emerald-600 border-b border-slate-200 pb-4">1. Network Topology & Components</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="bg-slate-50 border border-slate-200 p-8 rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
              </div>
              <h3 className="text-xl font-bold mb-3">1. The PXE (Client-Side)</h3>
              <p className="text-sm text-slate-600">
                The Private Execution Environment is a local service running on the user's device (browser extension or local daemon). It securely holds decryption keys, simulates Noir smart contracts locally, decrypts incoming UTXO notes, and generates the initial zero-knowledge proof for a transaction. <em>Private state never leaves the PXE.</em>
              </p>
            </div>
            
            <div className="bg-slate-50 border border-slate-200 p-8 rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg>
              </div>
              <h3 className="text-xl font-bold mb-3">2. Sequencer Network</h3>
              <p className="text-sm text-slate-600">
                Sequencers receive transaction intents containing the user's client-side proofs and public inputs. The sequencer orders these transactions, executes any <em>public</em> functions defined in the smart contract, and proposes a new L2 block (a rollup). Sequencers must stake assets and can be slashed for malicious behavior.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-8 rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </div>
              <h3 className="text-xl font-bold mb-3">3. Prover Marketplace</h3>
              <p className="text-sm text-slate-600">
                A decentralized marketplace of specialized hardware nodes (GPUs/ASICs) that compute the massive Honk recursive proofs required to validate a rollup block. Provers compete to generate proofs for the sequencer's proposed block in exchange for transaction fees.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-8 rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
              </div>
              <h3 className="text-xl font-bold mb-3">4. Ethereum L1 Contracts</h3>
              <p className="text-sm text-slate-600">
                The ultimate source of truth. The L1 infrastructure consists of the <strong>Verifier Contract</strong> (checks the Honk proof), the <strong>Rollup Processor</strong> (updates the state root), and the <strong>Inbox/Outbox</strong> (handles cross-chain messages and asset bridging).
              </p>
            </div>
          </div>
        </section>

        {/* 2. PLATFORM ECOSYSTEM */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold mb-8 text-emerald-600 border-b border-slate-200 pb-4">2. The Humanity Ledger Ecosystem</h2>
          
          <div className="space-y-6">
            <div className="flex">
              <div className="flex-shrink-0 mr-6">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-700 border-2 border-[#25D366]">A</div>
              </div>
              <div>
                <h4 className="text-xl font-bold mb-2">Universal Identity</h4>
                <p className="text-slate-600 text-sm">A centralized abstraction for credentials, proofs, and passports across the platform. Replaces isolated identity models with one unified source of truth for the entire ecosystem.</p>
              </div>
            </div>
            
            <div className="flex">
              <div className="flex-shrink-0 mr-6">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-700 border-2 border-[#25D366]">B</div>
              </div>
              <div>
                <h4 className="text-xl font-bold mb-2">Universal Assets</h4>
                <p className="text-slate-600 text-sm">Canonical abstraction representing ownership, provenance, history, and associated proofs for RWAs, tokens, and certificates.</p>
              </div>
            </div>

            <div className="flex">
              <div className="flex-shrink-0 mr-6">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-700 border-2 border-[#25D366]">C</div>
              </div>
              <div>
                <h4 className="text-xl font-bold mb-2">Mini-App Platform</h4>
                <p className="text-slate-600 text-sm">Mini-Apps interact through strict permission models and defined lifecycles. They consume platform capabilities rather than reinventing core logic.</p>
              </div>
            </div>

            <div className="flex">
              <div className="flex-shrink-0 mr-6">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-700 border-2 border-emerald-500 shadow-sm">D</div>
              </div>
              <div>
                <h4 className="text-xl font-bold text-emerald-600 mb-2">Intelligence & Data Layer</h4>
                <p className="text-slate-600 text-sm">Structured pipelines that transition on-chain events to highly available indexed graphs, maintaining strict boundaries between derived data and canonical blockchain state.</p>
              </div>
            </div>
          </div>
        </section>

      </div>
    </DocLayout>
  );
}

