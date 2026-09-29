import React from 'react';
import Link from 'next/link';
import { GitCommit, Milestone, ShieldAlert, Cpu } from 'lucide-react';

export default function ChangelogPage() {
  const updates = [
    {
      version: 'v2.0.0-alpha',
      date: 'May 2026',
      title: 'The Aztec Migration',
      description: 'Complete architecture overhaul to support Zero Knowledge execution via Aztec Network.',
      changes: [
        { type: 'major', text: 'Integrated Barretenberg backend for client-side proving.' },
        { type: 'major', text: 'Replaced ECDSA signatures with Noir zk-SNARK circuits.' },
        { type: 'removed', text: 'Removed all centralised biometric dependencies (legacy centralised protocols).' },
        { type: 'security', text: 'Implemented encrypted UTXO state for QDs.' }
      ]
    },
    {
      version: 'v1.4.2',
      date: 'March 2026',
      title: 'Data Integrity Patch',
      description: 'Performance upgrades for the public grid.',
      changes: [
        { type: 'minor', text: 'Optimized WebSocket payload delivery.' },
        { type: 'minor', text: 'Reduced memory footprint of graph database queries by 14%.' },
        { type: 'security', text: 'Added strict rate limiting to core RPC endpoints.' }
      ]
    }
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'major': return <Milestone size={16} className="text-[#0088cc]" />;
      case 'minor': return <GitCommit size={16} className="text-slate-500" />;
      case 'security': return <ShieldAlert size={16} className="text-emerald-500" />;
      case 'removed': return <Cpu size={16} className="text-red-500" />;
      default: return <GitCommit size={16} />;
    }
  };

  return (
    <div className="w-full min-h-screen bg-white text-slate-900 py-16 font-sans">
      <div className="w-full max-w-[800px] mx-auto px-6">
        <div className="mb-16 border-b border-slate-200 pb-8">
          <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-[#0088cc] uppercase tracking-wider">
            Protocol Updates
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-6">
            Changelog
          </h1>
          <p className="text-xl text-slate-500 max-w-2xl">
            A chronological record of cryptographic deployments and system upgrades.
          </p>
        </div>

        <div className="space-y-16">
          {updates.map((update, idx) => (
            <div key={idx} className="relative pl-8 md:pl-0">
              <div className="md:grid md:grid-cols-[200px_1fr] md:gap-8 items-start">
                
                {/* Date & Version */}
                <div className="mb-4 md:mb-0 flex flex-col md:text-right sticky top-24">
                  <span className="text-lg font-bold text-slate-900">{update.version}</span>
                  <span className="text-sm text-slate-500">{update.date}</span>
                </div>

                {/* Content */}
                <div className="bg-black/5 border border-slate-200 rounded-xl p-6 md:p-8">
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">{update.title}</h3>
                  <p className="text-slate-600 mb-8">{update.description}</p>
                  
                  <ul className="space-y-4">
                    {update.changes.map((change, cIdx) => (
                      <li key={cIdx} className="flex items-start gap-3 text-slate-700">
                        <div className="mt-1 shrink-0 bg-white p-1 rounded border border-slate-200">
                          {getIcon(change.type)}
                        </div>
                        <span className="leading-relaxed">{change.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 p-8 border border-slate-200 rounded-xl text-center">
          <h3 className="text-xl font-bold text-slate-900 mb-4">View Full History</h3>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            Every commit is cryptographically signed and available on our public repository.
          </p>
          <a href="https://github.com/humanityledger/Humanity-Ledger" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center px-6 py-3 bg-[#050505] text-white rounded-lg font-medium hover:bg-[#222] transition-colors">
            Open GitHub Repository
          </a>
        </div>
      </div>
    </div>
  );
}
