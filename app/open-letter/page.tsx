import React from 'react';
import Link from 'next/link';

export default function OpenLetterPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 py-20 font-sans selection:bg-[#0088cc] selection:text-white">
      <div className="max-w-[720px] mx-auto px-6">
        
        {/* Date and Metadata */}
        <div className="mb-12">
          <span className="font-mono text-sm text-slate-500 uppercase tracking-widest block mb-4">May 2026</span>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-[1.1]">
            An Open Letter to the Aztec Network Team
          </h1>
        </div>

        {/* The Letter */}
        <div className="prose prose-lg prose-slate max-w-none prose-p:leading-relaxed prose-p:text-slate-700 prose-headings:font-bold prose-a:text-[#0088cc] prose-a:no-underline hover:prose-a:underline">
          <p>
            To Zac, Joe, and the entire Aztec engineering team:
          </p>

          <p>
            For the past eighteen months, we have been building what we believed was the ultimate public ledger for human identity and economic exchange. We built robust data pipelines, scalable WebSocket architectures, and deep indexing engines. The platform worked beautifully.
          </p>
          
          <p>
            But we realized we had built a panopticon. 
          </p>

          <p>
            By storing every interaction, balance, and reputational score transparently on an L2, we stripped our users of their most fundamental right: the right to transact and interact without permanent, public surveillance. We fell into the same trap as the rest of the Web3 ecosystem, confusing "transparency" with "integrity."
          </p>

          <p>
            Your whitepaper on the privacy trilemma hit us like a physical blow. You articulated exactly what we were feeling but couldn't put into words. Privacy is not a feature you layer on top; it is the foundational architecture. 
          </p>

          <p>
            So we burned it down.
          </p>

          <p>
            We threw away months of perfectly good code. We severed ties with legacy centralised protocols because biometric centralization violates the core ethos of cryptographic privacy. And we completely re-architected the <strong>Humanity Ledger</strong> around Aztec and Noir.
          </p>

          <h3 className="text-2xl mt-12 mb-6">What We Are Building Now</h3>
          
          <p>
            We are building the first fully shielded social and economic ledger. 
          </p>

          <ul className="space-y-4 my-8 list-none pl-0">
            <li className="flex items-start">
              <span className="text-[#0088cc] mr-3 font-bold">1.</span>
              <span><strong>Private Forums:</strong> Where identity is verified via Zero Knowledge proofs (Noir), but the wallet address remains completely hidden.</span>
            </li>
            <li className="flex items-start">
              <span className="text-[#0088cc] mr-3 font-bold">2.</span>
              <span><strong>QDs (Quantum Dots / Core Dots):</strong> A natively private ERC-20 token running on the Ethereum L1 mainnet. Balances can be securely verified; only the total supply of 21M is immutable.</span>
            </li>
            <li className="flex items-start">
              <span className="text-[#0088cc] mr-3 font-bold">3.</span>
              <span><strong>Proof of Reputation:</strong> Generating recursive proofs of a user's past positive interactions without revealing <em>what</em> those interactions were.</span>
            </li>
          </ul>

          <p>
            We are not asking for a grant. We are not asking for marketing support. We are writing this because we believe Aztec is the only technology stack capable of supporting human freedom in the digital age, and we want to be one of the first production-grade applications to prove it.
          </p>

          <p>
            The code is public. The circuits are compiling. The migration is real.
          </p>

          <p>
            Let's build the dark forest together.
          </p>

          {/* Signature */}
          <div className="mt-16 pt-8 border-t border-slate-200">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-full bg-slate-200 overflow-hidden shrink-0 border-2 border-white shadow-sm">
                <img src="/system-shots/photo_2026-05-16_19-57-16.jpg" alt="Founder" className="w-full h-full object-cover grayscale opacity-90" />
              </div>
              <div>
                <strong className="block text-slate-900 font-bold text-lg">humanityledger</strong>
                <span className="text-slate-500 text-sm">Founder, Humanity Ledger</span>
                <div className="mt-2 flex gap-3">
                  <a href="https://twitter.com/humanityledger" target="_blank" rel="noreferrer" className="text-sm text-[#0088cc] font-medium hover:underline">@humanityledger</a>
                  <a href="https://github.com/humanityledger" target="_blank" rel="noreferrer" className="text-sm text-[#0088cc] font-medium hover:underline">GitHub</a>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
