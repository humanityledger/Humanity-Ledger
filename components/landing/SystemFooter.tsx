import Link from "next/link";
import React from "react";
import { HLLogo } from "@/components/shared/HLLogo";

export function SystemFooter() {
  return (
    <footer className="w-full bg-white border-t border-black/10 py-16 px-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Top row */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10 mb-14">
          
          {/* Brand column */}
          <div className="col-span-2 md:col-span-2 flex flex-col gap-4">
            <Link href="/" aria-label="Humanity Ledger home">
              <HLLogo size={32} theme="dark" />
            </Link>
            <p className="text-[14px] text-black/50 font-medium leading-relaxed max-w-[240px]">
              The sovereign, decentralized messaging network. Private by default. Built for 2027.
            </p>
          </div>

          {/* Protocol */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[13px] font-black uppercase tracking-widest text-black/40 mb-1">Protocol</h4>
            <Link href="/chat" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Ledger Chat</Link>
            <Link href="/protocol" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Wallet Identity</Link>
            <Link href="/protocol/decentralized-relay" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Message Relay</Link>
            <Link href="/developers" className="text-[14px] font-medium text-[#0A0A0A] hover:text-[#25D366] transition-colors">Developer Hub &rarr;</Link>
          </div>

          {/* Network */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[13px] font-black uppercase tracking-widest text-black/40 mb-1">Network</h4>
            <Link href="/network/explorer" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Block Explorer</Link>
            <Link href="/network/status" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Network Status</Link>
            <Link href="/network/governance" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Governance</Link>
            <Link href="/blog" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Blog</Link>
          </div>

          {/* Security & Cryptography */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[13px] font-black uppercase tracking-widest text-black/40 mb-1">Cryptography</h4>
            <Link href="/docs/whitepaper" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Whitepaper</Link>
            <a href="https://aztec.network" target="_blank" rel="noopener noreferrer" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Network Architecture</a>
            <Link href="/security/audits" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Security Audits</Link>
            <a href="https://github.com/humanityledger" target="_blank" rel="noopener noreferrer" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">GitHub</a>
          </div>

          {/* Compliance */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[13px] font-black uppercase tracking-widest text-black/40 mb-1">Compliance</h4>
            <Link href="/privacy" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Privacy Posture</Link>
            <Link href="/terms" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Terms of Operation</Link>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t border-black/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[13px] text-black/40 font-medium text-center md:text-left">
            © 2026 Humanity Ledger. Not a financial institution. Not affiliated with Humanity Protocol.
          </p>
        </div>

      </div>
    </footer>
  );
}


