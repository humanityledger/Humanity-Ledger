'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, ArrowLeft, Lock, CheckCircle2, FileText, KeyRound } from 'lucide-react';

export default function WarrantCanaryPage() {
  const CURRENT_PERIOD = 'October 2026 - Q4';
  const VERIFICATION_HASH = '0x9a8f27e5b128c704e67d93821045bcf712e098a54316d8234ea72051bc893a4f';

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#1C1C1E] flex flex-col">
      {/* Top Navbar */}
      <nav className="h-16 border-b border-black/5 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
        <Link href="/" className="flex items-center gap-2 text-sm font-bold text-black/60 hover:text-black transition-colors">
          <ArrowLeft size={16} /> Return to Protocol
        </Link>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#25D366] animate-pulse" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#25D366]">Canary Active</span>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-3xl w-full mx-auto px-6 py-12 flex-1 space-y-10">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#25D366]/10 text-[#25D366] text-xs font-bold uppercase tracking-wider">
            <ShieldCheck size={14} /> Security & Transparency Protocol
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#1C1C1E]">
            Cryptographic Warrant Canary
          </h1>
          <p className="text-sm md:text-base text-black/60 leading-relaxed">
            Humanity Ledger and Ledger Chat publish this statement to affirm our ongoing structural independence, cryptographic integrity, and zero-compromise guarantee.
          </p>
        </div>

        {/* Guarantees Box */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-black/5 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-[#1C1C1E] border-b border-black/5 pb-3">
            Active Period: {CURRENT_PERIOD}
          </h2>

          <div className="space-y-4">
            {[
              {
                title: 'Zero Backdoors Installed',
                desc: 'No government agency, law enforcement entity, or third party has been granted backdoor access to our codebase, infrastructure, or cryptographic primitives.',
              },
              {
                title: 'Zero Secret Subpoenas or NSLs',
                desc: 'We have received zero National Security Letters, FISA court orders, or undisclosed secret warrants demanding user data interception.',
              },
              {
                title: 'Zero Encryption Key Disclosures',
                desc: 'Because private keys are strictly managed client-side by user wallets and XMTP identity vaults, our servers possess zero private keys and cannot decrypt user communications.',
              },
              {
                title: 'Zero Forced Code Modifications',
                desc: 'We have not been compelled by any legal authority to alter our client applications or consensus layer to bypass end-to-end encryption.',
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3.5 p-4 bg-[#F2F2F7] rounded-2xl">
                <CheckCircle2 size={18} className="text-[#25D366] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-[#1C1C1E]">{item.title}</h3>
                  <p className="text-xs text-black/60 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cryptographic Verification Proof */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-black/5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-[#1C1C1E]">
            <KeyRound size={16} className="text-[#25D366]" /> Cryptographic Attestation Block
          </div>
          <p className="text-xs text-black/50 leading-relaxed">
            If this canary is ever removed, fails to be updated on schedule, or contains an invalid verification fingerprint, users should assume our systems have been subject to external legal compulsion.
          </p>

          <div className="p-4 bg-[#1C1C1E] text-white rounded-2xl font-mono text-xs space-y-2 overflow-x-auto">
            <div className="text-white/40">// EIP-191 Canary Signature Digest</div>
            <div>STATUS: CANARY_VALID_UNCOMPROMISED</div>
            <div>PERIOD: {CURRENT_PERIOD}</div>
            <div className="text-[#25D366] break-all">ROOT_HASH: {VERIFICATION_HASH}</div>
            <div className="text-white/40">// Verified by Humanity Ledger Governance Multi-Sig</div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-black/40 space-y-2 pb-8">
          <p>Next scheduled attestation: January 2027</p>
          <p>© 2026 Humanity Ledger Protocol. Non-Custodial, Sovereign-Grade Communication.</p>
        </div>
      </div>
    </div>
  );
}
