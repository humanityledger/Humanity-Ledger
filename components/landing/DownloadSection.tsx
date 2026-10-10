"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, Monitor, Apple, Globe, Wallet, CheckCircle2,
  ChevronDown, Shield, Zap, Lock, Smartphone, MessageCircle, Users
} from "lucide-react";
import { toast } from "sonner";

// ─── Download Links ────────────────────────────────────────────────────────────
// Update these URLs when new releases are published to GitHub Releases
const RELEASES = {
  windows: "#", // Replaced with toast notification until uploaded
  mac: "#",     // Replaced with toast notification until uploaded
  web: "/chat",
};

// ─── FAQ Data ─────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "What is Ledger Chat?",
    a: "Ledger Chat is a privacy-first messaging platform built on top of Humanity Ledger. Every message, call, and file is encrypted end-to-end using your wallet identity. No phone number, no email, no personal data required — just your wallet.",
  },
  {
    q: "Do I need a crypto wallet to use it?",
    a: "Yes. Ledger Chat uses your Ethereum-compatible wallet (MetaMask, Coinbase Wallet, Rabby, etc.) or a regular email address as your unique identity. This means no centralized database can link your conversations to your personal information.",
  },
  {
    q: "How do I connect my wallet?",
    a: "Click \"Launch App\" or open the desktop app. On the welcome screen, tap \"Connect Wallet\" and approve the signature request in your wallet. No transaction or gas fee is needed — it is just a signature to prove you own the address.",
  },
  {
    q: "Is the desktop app free to download?",
    a: "Yes. The Windows and macOS desktop apps are completely free. They are open-source and available directly from our GitHub releases page. No subscription, no account creation, no hidden fees.",
  },
  {
    q: "Is my data stored on a server?",
    a: "Messages are relayed through an encrypted transport layer but are never stored in plaintext on any server. Only the two parties in a conversation can read the content. Ledger Chat has no access to the contents of your messages.",
  },
  {
    q: "Can I make video and voice calls?",
    a: "Yes. Ledger Chat supports peer-to-peer encrypted voice calls and video calls using WebRTC. The media stream goes directly between devices and is never routed through our infrastructure.",
  },
  {
    q: "Does it work on mobile?",
    a: "Yes. Ledger Chat is a fully responsive web app. Open humanidfi.com/chat on any mobile browser. Native iOS and Android apps are currently in development and will be released before January 2027.",
  },
  {
    q: "What wallets are supported?",
    a: "Any Ethereum-compatible wallet works: MetaMask, Coinbase Wallet, Rabby, Rainbow, Trust Wallet, WalletConnect-compatible wallets, and more. You can also sign in with a Google account if you prefer not to use a wallet.",
  },
  {
    q: "How is Ledger Chat different from WhatsApp or Telegram?",
    a: "WhatsApp is owned by Meta and collects metadata. Telegram stores messages on centralized servers (unless using Secret Chats). Ledger Chat is wallet-native, permissionless, and open-source. No company controls your identity or your data.",
  },
  {
    q: "Is the Windows installer safe to run?",
    a: "Yes. The installer is signed and published directly from the Humanity Ledger GitHub repository. Windows may show a SmartScreen warning for new publishers — click \"More info\" and then \"Run anyway\" to proceed. You can always verify the file hash on our GitHub releases page.",
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
    color: "bg-indigo-100 text-indigo-600",
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
            className="overflow-hidden"
          >
            <p className="text-[14px] md:text-[15px] text-[#1C1C1E]/60 leading-relaxed pb-5 pr-8">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Section ─────────────────────────────────────────────────────────────
export function DownloadSection() {
  return (
    <>
      {/* ═══ DOWNLOAD SECTION ════════════════════════════════════════════════════ */}
      <section id="download" className="bg-[#F6F7F9] py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-14"
          >
            <p className="text-[12px] font-black uppercase tracking-[0.2em] text-[#25D366] mb-3">Desktop App</p>
            <h2 className="text-[36px] md:text-[52px] font-bold tracking-tight text-[#1C1C1E] leading-tight mb-4">
              Download Ledger Chat
            </h2>
            <p className="text-[17px] text-[#1C1C1E]/50 font-medium max-w-xl mx-auto leading-relaxed">
              The native desktop experience. Faster, richer, and always on. Free and open-source.
            </p>
          </motion.div>

          {/* Download Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            <motion.button
              onClick={() => toast.info('The Windows desktop app is currently compiling. Please use the Web App for now.', { duration: 4000 })}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0 }}
              className="bg-white rounded-3xl p-8 flex flex-col items-center text-center border border-black/[0.05] hover:border-[#25D366]/40 hover:shadow-xl transition-all group cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#0078D4]/10 flex items-center justify-center mb-5 group-hover:bg-[#0078D4]/20 transition-colors">
                <Monitor size={32} className="text-[#0078D4]" />
              </div>
              <h3 className="text-[20px] font-bold text-[#1C1C1E] mb-1">Windows</h3>
              <p className="text-[13px] text-black/40 font-medium mb-6">Windows 10 / 11 — 64-bit</p>
              <div className="w-full mt-auto flex items-center justify-center gap-2 bg-[#1C1C1E] group-hover:bg-black text-white font-bold text-[14px] py-3.5 rounded-2xl transition-all">
                <Download size={16} />
                Download .exe
              </div>
              <p className="text-[11px] text-black/30 mt-3">Free installer · ~120 MB</p>
            </motion.button>

            <motion.button
              onClick={() => toast.info('The macOS desktop app is currently compiling. Please use the Web App for now.', { duration: 4000 })}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.07 }}
              className="bg-white rounded-3xl p-8 flex flex-col items-center text-center border border-black/[0.05] hover:border-[#25D366]/40 hover:shadow-xl transition-all group cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#1C1C1E]/8 flex items-center justify-center mb-5 group-hover:bg-[#1C1C1E]/15 transition-colors">
                <Apple size={32} className="text-[#1C1C1E]" />
              </div>
              <h3 className="text-[20px] font-bold text-[#1C1C1E] mb-1">macOS</h3>
              <p className="text-[13px] text-black/40 font-medium mb-6">macOS 12 Monterey or later</p>
              <div className="w-full mt-auto flex items-center justify-center gap-2 bg-[#1C1C1E] group-hover:bg-black text-white font-bold text-[14px] py-3.5 rounded-2xl transition-all">
                <Download size={16} />
                Download .dmg
              </div>
              <p className="text-[11px] text-black/30 mt-3">Free installer · ~130 MB</p>
            </motion.button>

            {/* Web App */}
            <motion.a
              href={RELEASES.web}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.14 }}
              className="bg-gradient-to-br from-[#25D366] to-[#20bd59] rounded-3xl p-8 flex flex-col items-center text-center hover:shadow-xl hover:shadow-[#25D366]/20 transition-all group cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mb-5 group-hover:bg-white/30 transition-colors">
                <Globe size={32} className="text-white" />
              </div>
              <h3 className="text-[20px] font-bold text-white mb-1">Web App</h3>
              <p className="text-[13px] text-white/70 font-medium mb-6">Any browser. No install needed.</p>
              <div className="w-full mt-auto flex items-center justify-center gap-2 bg-white text-[#1C1C1E] font-bold text-[14px] py-3.5 rounded-2xl transition-all group-hover:bg-white/90">
                <MessageCircle size={16} />
                Open in Browser
              </div>
              <p className="text-[11px] text-white/50 mt-3">Works on mobile too</p>
            </motion.a>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
            {[
              { icon: <Shield size={15} />, text: "Open Source" },
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
              No sign-up form, no email verification, no password. Four steps and you are live.
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
