import Link from "next/link";
import React from "react";

export function SystemFooter() {
  return (
    <footer className="w-full bg-white border-t border-black/10 py-16 px-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Top row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-14">
          
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1 flex flex-col gap-4">
            <Link href="/" aria-label="Humanity Ledger home">
              <img
                src="/logo-text.png"
                alt="Humanity Ledger"
                style={{ height: 32, width: 'auto', objectFit: 'contain', display: 'block' }}
              />
            </Link>
            <p className="text-[14px] text-black/50 font-medium leading-relaxed max-w-[200px]">
              The sovereign, decentralized messaging network. Built for 2027.
            </p>
          </div>

          {/* Protocol */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[13px] font-black uppercase tracking-widest text-black/40 mb-1">Protocol</h4>
            <Link href="/protocol/ledger-chat" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Ledger Chat</Link>
            <Link href="/protocol/zk-identity" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">ZK Identity</Link>
            <Link href="/protocol/decentralized-relay" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Decentralized Relay</Link>
            <Link href="/protocol/xmtp" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">XMTP Integration</Link>
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
            <a href="https://aztec.network" target="_blank" rel="noopener noreferrer" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Aztec ZK Rollup</a>
            <Link href="/docs/noir-circuits" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Noir Circuits</Link>
            <Link href="/docs/audits" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Security Audits</Link>
          </div>

          {/* Developers */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[13px] font-black uppercase tracking-widest text-black/40 mb-1">Developers</h4>
            <Link href="/docs/architecture" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Architecture</Link>
            <Link href="/docs/api" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">API Reference</Link>
            <a href="https://github.com/humanityledger" target="_blank" rel="noopener noreferrer" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">GitHub</a>
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
