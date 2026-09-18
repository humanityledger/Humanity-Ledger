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

          {/* Features */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[13px] font-black uppercase tracking-widest text-black/40 mb-1">Features</h4>
            <Link href="/docs/ledger-chat" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Ledger Chat</Link>
            <Link href="/docs/privacy" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Privacy & Security</Link>
            <Link href="/docs/cryptography" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Encryption</Link>
            <Link href="/docs/identity" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Wallet Identity</Link>
          </div>

          {/* Company */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[13px] font-black uppercase tracking-widest text-black/40 mb-1">Company</h4>
            <Link href="/company/about" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">About</Link>
            <Link href="/company/changelog" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Changelog</Link>
            <Link href="/blog" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Blog</Link>
            <a href="https://github.com/humanityledger/Humanity-Ledger" target="_blank" rel="noopener noreferrer" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">GitHub</a>
          </div>

          {/* Legal */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[13px] font-black uppercase tracking-widest text-black/40 mb-1">Legal</h4>
            <Link href="/docs/privacy" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Privacy Policy</Link>
            <Link href="/docs/terms" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Terms of Service</Link>
            <Link href="/docs/cookies" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Cookie Policy</Link>
            <Link href="/docs/aml-kyc" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">AML & KYC</Link>
          </div>

          {/* Developers */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[13px] font-black uppercase tracking-widest text-black/40 mb-1">Developers</h4>
            <Link href="/docs/architecture" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Architecture</Link>
            <Link href="/developers/api-docs" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">API Reference</Link>
            <Link href="/docs/audits" className="text-[14px] font-medium text-black/70 hover:text-black transition-colors">Security Audits</Link>
            
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
