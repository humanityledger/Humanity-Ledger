import React from 'react';
import Link from 'next/link';

export default function StoryPage() {
  return (
    <div className="w-full min-h-screen bg-white text-slate-900 py-16 font-sans">
      <div className="w-full max-w-[800px] mx-auto px-6">
        <div className="mb-16 border-b border-slate-200 pb-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-6">
            The History of the Ledger
          </h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto">
            From fragmented data to a unified, privacy-native protocol.
          </p>
        </div>

        <div className="relative border-l-2 border-slate-200 ml-4 md:ml-10 space-y-16 pb-16">
          
          <div className="relative pl-8">
            <div className="absolute w-4 h-4 rounded-full bg-[#0088cc] -left-[9px] top-1 border-4 border-white shadow-sm" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Q1 2026</h3>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">The Aztec Integration</h2>
            <p className="text-slate-600 leading-relaxed text-lg">
              Recognizing the fundamental flaw in public ledgers, the project completely pivots its architecture. The Humanity Ledger integrates the Aztec Network, rewriting its core logic in Noir to enable Zero Knowledge execution. legacy centralised protocols and all centralised biometric vectors are purged from the system.
            </p>
          </div>

          <div className="relative pl-8">
            <div className="absolute w-4 h-4 rounded-full bg-slate-300 -left-[9px] top-1 border-4 border-white shadow-sm" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Late 2025</h3>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">The Scalability Ceiling</h2>
            <p className="text-slate-600 leading-relaxed text-lg">
              As the public grid expanded, the limitations of transparent L2s became obvious. Mempool surveillance and front running compromised the integrity of the ecosystem. The search for a "Privacy-First" execution environment begins.
            </p>
          </div>

          <div className="relative pl-8">
            <div className="absolute w-4 h-4 rounded-full bg-slate-300 -left-[9px] top-1 border-4 border-white shadow-sm" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Mid 2025</h3>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">The First Deployment</h2>
            <p className="text-slate-600 leading-relaxed text-lg">
              The initial versions of the protocol were deployed as a set of analytical dashboards. It proved the demand for high-integrity, unalterable data flows, but the privacy models were rudimentary.
            </p>
          </div>

          <div className="relative pl-8">
            <div className="absolute w-4 h-4 rounded-full bg-slate-300 -left-[9px] top-1 border-4 border-white shadow-sm" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Early 2025</h3>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">The Genesis Concept</h2>
            <p className="text-slate-600 leading-relaxed text-lg">
              The project is born out of a necessity to index and protect sensitive information cryptographically. The first whitepapers are drafted focusing on censorship resistance and absolute data permanence.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
