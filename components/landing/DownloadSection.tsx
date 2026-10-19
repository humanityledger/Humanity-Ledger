"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, Monitor, Apple, Globe, Wallet, CheckCircle2,
  ChevronDown, Zap, Lock, Smartphone, MessageCircle, Users, Terminal
} from "lucide-react";
import { toast } from "sonner";

// ─── Download Links ────────────────────────────────────────────────────────────
// Windows installer is served directly from our CDN / server.
// macOS and Linux users have instant zero-install access via Web App.
const RELEASES = {
  windows: "/releases/Ledger-Chat-Setup-Windows.exe",
  mac:     "/chat",
  linux:   "/chat",
  web:     "/chat",
};

// ─── FAQ Data ─────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "What is Ledger Chat?",
    a: "Ledger Chat is a privacy first messaging platform built on top of Humanity Ledger. Every message, call, and file is encrypted end to end using your wallet identity. No phone number, no email, no personal data required, just your wallet.",
  },
  {
    q: "Do I need a crypto wallet to use it?",
    a: "Yes. Ledger Chat uses your Ethereum compatible wallet (MetaMask, Coinbase Wallet, Rabby, etc.) or a regular email address as your unique identity. This means no centralized database can link your conversations to your personal information.",
  },
  {
    q: "How do I connect my wallet?",
    a: "Click \"Launch App\" or open the desktop app. On the welcome screen, tap \"Connect Wallet\" and approve the signature request in your wallet. No transaction or gas fee is needed, it is just a signature to prove you own the address.",
  },
  {
    q: "Is the desktop app free to download?",
    a: "Yes. The Windows and macOS desktop apps are completely free. They are open source and available directly from our platform. No subscription, no account creation, no hidden fees.",
  },
  {
    q: "Is my data stored on a server?",
    a: "Messages are relayed through an encrypted transport layer but are never stored in plaintext on any server. Only the two parties in a conversation can read the content. Ledger Chat has no access to the contents of your messages.",
  },
  {
    q: "Can I make video and voice calls?",
    a: "Yes. Ledger Chat supports peer to peer encrypted voice calls and video calls using WebRTC. The media stream goes directly between devices and is never routed through our infrastructure.",
  },
  {
    q: "Does it work on mobile?",
    a: "Yes. Ledger Chat is a fully responsive web app. Open humanidfi.com/chat on any mobile browser. Native iOS and Android apps are currently in development and will be released before January 2027.",
  },
  {
    q: "What wallets are supported?",
    a: "Any Ethereum compatible wallet works: MetaMask, Coinbase Wallet, Rabby, Rainbow, Trust Wallet, WalletConnect compatible wallets, and more. You can also sign in with a Google account if you prefer not to use a wallet.",
  },
  {
    q: "How is Ledger Chat different from WhatsApp or Telegram?",
    a: "WhatsApp is owned by Meta and collects metadata. Telegram stores messages on centralized servers (unless using Secret Chats). Ledger Chat is wallet native, permissionless, and open source. No company controls your identity or your data.",
  },
  {
    q: "Is the Windows installer safe to run?",
    a: "Yes. The installer is built and signed directly from the Humanity Ledger repository. Windows may show a SmartScreen notice for new publishers, click \"More info\" and then \"Run anyway\" to proceed.",
  },
];

// ─── Wallet Setup Steps ───────────────────────────────────────────────────────
const WALLET_STEPS = [
  {
    num: "01",
    title: "Install a wallet",
    desc: "Download MetaMask, Coinbase Wallet, or any Ethereum wallet as a browser extension or mobile app.",
    color: "bg-[#F6851B]/10 text-[#F6851B]",
  },
  {
    num: "02",
    title: "Open Ledger Chat",
    desc: "Launch the desktop app or visit humanidfi.com/chat in your browser. Click \"Connect Wallet\".",
    color: "bg-[#25D366]/10 text-[#25D366]",
  },
  {
    num: "03",
    title: "Sign the message",
    desc: "Your wallet will ask you to sign a message to prove ownership. No transaction. No gas fee. Free.",
    color: "bg-[#25D366]/15 text-[#25D366]",
  },
  {
    num: "04",
    title: "Start messaging",
    desc: "You are in. Share your wallet address with friends, search contacts, and start encrypted conversations immediately.",
    color: "bg-[#1C1C1E]/10 text-[#1C1C1E]",
  },
];

// ─── FAQItem Component ────────────────────────────────────────────────────────
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-black/[0.06] last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-5 text-left gap-4"
      >
        <span className="text-[15px] md:text-[16px] font-semibold text-[#1C1C1E] leading-snug pr-2">{q}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }} className="shrink-0">
          <ChevronDown size={20} className="text-black/40" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="pb-5 pt-1 text-[15px] text-[#1C1C1E]/60 leading-relaxed pr-8">
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DownloadSection() {
  return (
    <>
      {/* --- DOWNLOAD SECTION -------------------------------------------------------- */}
      <section id="download" className="bg-[#F6F7F9] py-20 md:py-32 relative overflow-hidden">
        
        {/* Background ambient glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#25D366]/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-5 md:px-10 relative z-10">
          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-16"
          >
            <p className="text-[13px] font-black uppercase tracking-[0.2em] text-[#25D366] mb-3">Native Experience</p>
            <h2 className="text-[40px] md:text-[56px] font-bold tracking-tight text-[#1C1C1E] leading-tight mb-5">
              Download Humanity Ledger
            </h2>
            <p className="text-[18px] text-[#1C1C1E]/50 font-medium max-w-2xl mx-auto leading-relaxed">
              Experience the absolute pinnacle of decentralised communication. Crystal clear UI, offline crypto sharing, and sub-millisecond responsiveness.
            </p>
          </motion.div>

          {/* Download Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            
            {/* WINDOWS */}
            <motion.a
              href={RELEASES.windows}
              download="Ledger-Chat-Setup-Windows.exe"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0 }}
              className="bg-white rounded-[32px] p-8 flex flex-col items-center text-center border border-black/[0.04] hover:border-[#0078D4]/40 hover:shadow-2xl hover:shadow-[#0078D4]/10 transition-all duration-300 group cursor-pointer relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#0078D4]/0 via-[#0078D4]/0 to-[#0078D4]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="w-20 h-20 rounded-3xl bg-[#0078D4]/5 flex items-center justify-center mb-6 group-hover:bg-[#0078D4]/10 transition-colors group-hover:scale-110 duration-500">
                <svg width="36" height="36" viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0 12.4019L37.1994 7.20239V41.6026H0V12.4019ZM41.6026 6.40213L88 0V41.6026H41.6026V6.40213ZM0 46.4029H37.1994V80.8034L0 75.6039V46.4029ZM41.6026 46.4029H88V88L41.6026 81.603V46.4029Z" fill="#0078D4"/>
                </svg>
              </div>
              <h3 className="text-[22px] font-black text-[#1C1C1E] mb-1">Windows</h3>
              <p className="text-[13px] text-black/40 font-semibold mb-8">Windows 10 &amp; 11</p>
              <div className="w-full mt-auto flex items-center justify-center gap-2.5 bg-[#F2F2F7] group-hover:bg-[#0078D4] text-[#1C1C1E] group-hover:text-white font-bold text-[15px] py-4 rounded-2xl transition-all duration-300">
                <Download size={18} className="group-hover:animate-bounce" />
                Download .exe
              </div>
              <p className="text-[11px] font-medium text-black/30 mt-4">v1.0.0 (64 bit) · 93.7 MB</p>
            </motion.a>

            {/* macOS */}
            <motion.a
              href="/chat"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              className="bg-white rounded-[32px] p-8 flex flex-col items-center text-center border border-black/[0.04] hover:border-black/20 hover:shadow-2xl hover:shadow-black/10 transition-all duration-300 group cursor-pointer relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-black/0 via-black/0 to-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="w-20 h-20 rounded-3xl bg-black/5 flex items-center justify-center mb-6 group-hover:bg-black/10 transition-colors group-hover:scale-110 duration-500">
                <svg width="34" height="42" viewBox="0 0 170 209" fill="#1C1C1E" xmlns="http://www.w3.org/2000/svg">
                  <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.2-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.75 3.35-4.94.21-9.84-1.96-14.72-6.52-3.13-2.73-7.05-7.41-11.76-14.03-5.04-7.08-9.19-15.29-12.43-24.65-3.47-10.11-5.21-19.9-5.21-29.38 0-10.86 2.35-20.23 7.06-28.1 3.7-6.31 8.63-11.3 14.82-14.99 6.19-3.69 12.87-5.57 20.07-5.69 3.94 0 9.1 1.22 15.53 3.61 6.41 2.4 10.52 3.62 12.32 3.62 1.35 0 5.92-1.43 13.68-4.27 7.33-2.65 13.52-3.75 18.6-3.32 13.75 1.11 24.08 6.52 30.95 16.26-12.29 7.45-18.37 17.87-18.25 31.22.11 10.41 3.88 19.07 11.3 25.95 3.36 3.19 7.11 5.65 11.27 7.4-.9 2.62-1.86 5.12-2.88 7.52zM113.22 3.48c0 8.16-2.98 15.78-8.92 22.84-7.17 8.38-15.84 13.23-25.23 12.47-.12-.98-.19-2-.19-3.07 0-7.83 3.41-16.21 9.46-23.07 3.02-3.48 6.86-6.37 11.52-8.69 4.65-2.29 9.05-3.55 13.18-3.77.12 1.1.18 2.2.18 3.29z"/>
                </svg>
              </div>
              <h3 className="text-[22px] font-black text-[#1C1C1E] mb-1">macOS</h3>
              <p className="text-[13px] text-black/40 font-semibold mb-8">Apple Silicon &amp; Intel</p>
              <div className="w-full mt-auto flex items-center justify-center gap-2.5 bg-[#F2F2F7] group-hover:bg-black text-[#1C1C1E] group-hover:text-white font-bold text-[15px] py-4 rounded-2xl transition-all duration-300">
                <Globe size={18} />
                Open Web App
              </div>
              <p className="text-[11px] font-medium text-black/30 mt-4">Native App in Signing</p>
            </motion.a>

            {/* LINUX */}
            <motion.a
              href="/chat"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              className="bg-white rounded-[32px] p-8 flex flex-col items-center text-center border border-black/[0.04] hover:border-[#E95420]/40 hover:shadow-2xl hover:shadow-[#E95420]/10 transition-all duration-300 group cursor-pointer relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#E95420]/0 via-[#E95420]/0 to-[#E95420]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="w-20 h-20 rounded-3xl bg-[#E95420]/5 flex items-center justify-center mb-6 group-hover:bg-[#E95420]/10 transition-colors group-hover:scale-110 duration-500">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#E95420" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m8 8-4 4 4 4"/><path d="m16 8 4 4-4 4"/><path d="m14 4-4 16"/>
                </svg>
              </div>
              <h3 className="text-[22px] font-black text-[#1C1C1E] mb-1">Linux</h3>
              <p className="text-[13px] text-black/40 font-semibold mb-8">Ubuntu, Debian, Fedora</p>
              <div className="w-full mt-auto flex items-center justify-center gap-2.5 bg-[#F2F2F7] group-hover:bg-[#E95420] text-[#1C1C1E] group-hover:text-white font-bold text-[15px] py-4 rounded-2xl transition-all duration-300">
                <Globe size={18} />
                Open Web App
              </div>
              <p className="text-[11px] font-medium text-black/30 mt-4">Native App in Signing</p>
            </motion.a>

            {/* WEB APP */}
            <motion.a
              href="/chat"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
              className="bg-gradient-to-br from-[#25D366] to-[#20bd59] rounded-[32px] p-8 flex flex-col items-center text-center hover:shadow-2xl hover:shadow-[#25D366]/30 transition-all duration-300 group cursor-pointer relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
              <div className="w-20 h-20 rounded-3xl bg-white/20 flex items-center justify-center mb-6 group-hover:bg-white/30 transition-colors group-hover:scale-110 duration-500">
                <Globe size={36} className="text-white" />
              </div>
              <h3 className="text-[22px] font-black text-white mb-1">Web App</h3>
              <p className="text-[13px] text-white/80 font-medium mb-8">No installation required</p>
              <div className="w-full mt-auto flex items-center justify-center gap-2.5 bg-white text-[#1C1C1E] font-bold text-[15px] py-4 rounded-2xl transition-all duration-300 group-hover:bg-white/90">
                <MessageCircle size={18} />
                Open Browser
              </div>
              <p className="text-[11px] font-medium text-white/50 mt-4">Works on any device</p>
            </motion.a>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
            {[
              { icon: <Terminal size={15} />, text: "Open Source" },
              { icon: <Lock size={15} />, text: "No account required" },
              { icon: <Zap size={15} />, text: "No subscription fees" },
              { icon: <CheckCircle2 size={15} />, text: "Always free" },
            ].map((b) => (
              <div key={b.text} className="flex items-center gap-1.5 text-[12px] font-semibold text-black/40">
                {b.icon}
                {b.text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW TO CONNECT YOUR WALLET ══════════════════════════════════════════ */}
      <section className="bg-white py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-center mb-14"
          >
            <p className="text-[12px] font-black uppercase tracking-[0.2em] text-[#25D366] mb-3">Getting Started</p>
            <h2 className="text-[36px] md:text-[48px] font-bold tracking-tight text-[#1C1C1E] leading-tight mb-4">
              How to connect your wallet
            </h2>
            <p className="text-[17px] text-[#1C1C1E]/50 font-medium max-w-xl mx-auto leading-relaxed">
              No signup form, no email verification, no password. Four steps and you are live.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {WALLET_STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.08 }}
                className="bg-[#F6F7F9] rounded-3xl p-7 flex flex-col gap-4 relative overflow-hidden"
              >
                {/* Step number (background decoration) */}
                <span className="absolute top-4 right-5 text-[52px] font-black text-black/[0.04] leading-none select-none">{step.num}</span>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black ${step.color}`}>
                  {step.num}
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-[#1C1C1E] mb-2">{step.title}</h3>
                  <p className="text-[14px] text-[#1C1C1E]/55 leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Compatible Wallets strip */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-12 flex flex-col items-center gap-4"
          >
            <p className="text-[12px] font-semibold uppercase tracking-widest text-black/30">Compatible with</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {["MetaMask", "Coinbase Wallet", "Rainbow", "Rabby", "Trust Wallet", "WalletConnect", "Google (Email)"].map((w) => (
                <span key={w} className="bg-[#F6F7F9] border border-black/[0.06] px-4 py-2 rounded-full text-[13px] font-semibold text-[#1C1C1E]/60">
                  {w}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ FAQ ═════════════════════════════════════════════════════════════════ */}
      <section id="faq" className="bg-[#F6F7F9] py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-5 md:px-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-center mb-12"
          >
            <p className="text-[12px] font-black uppercase tracking-[0.2em] text-[#25D366] mb-3">FAQ</p>
            <h2 className="text-[36px] md:text-[48px] font-bold tracking-tight text-[#1C1C1E] leading-tight mb-4">
              Frequently asked questions
            </h2>
            <p className="text-[17px] text-[#1C1C1E]/50 font-medium leading-relaxed">
              Everything you need to know before getting started.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="bg-white rounded-3xl px-6 md:px-10 py-2 shadow-sm border border-black/[0.04]"
          >
            {FAQS.map((faq) => (
              <FAQItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </motion.div>

          {/* Still have questions */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-8 bg-white rounded-3xl p-8 border border-black/[0.04] flex flex-col sm:flex-row items-center gap-6 shadow-sm"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#25D366]/10 flex items-center justify-center shrink-0">
              <MessageCircle size={28} className="text-[#25D366]" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-[17px] font-bold text-[#1C1C1E] mb-1">Still have questions?</h3>
              <p className="text-[14px] text-[#1C1C1E]/50">
                Reach us on our community forum or open a support ticket. We respond within 24 hours.
              </p>
            </div>
            <a
              href="/support"
              className="shrink-0 bg-[#1C1C1E] hover:bg-black text-white font-bold text-[14px] px-6 py-3 rounded-xl transition-all active:scale-95"
            >
              Contact Support
            </a>
          </motion.div>
        </div>
      </section>
    </>
  );
}
