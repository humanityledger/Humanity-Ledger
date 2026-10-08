"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import Link from "next/link";

const EASE = [0.16, 1, 0.3, 1] as const;

const PRODUCTS = [
  {
    id: "ledger-chat",
    label: "LedgerChat",
    tag: "Encrypted Messaging",
    tagColor: "bg-violet-100 text-violet-700",
    href: "/developer",
    cta: "Open LedgerChat",
    description:
      "End-to-end encrypted P2P messaging gated by your Humanity Ledger ZK identity. No phone number, no IP, no metadata — just a cryptographic handshake.",
    mobileSteps: [
      {
        label: "Connect",
        desc: "Scan QR with Humanity Ledger identity",
        icon: "📱",
        color: "bg-violet-50 border-violet-100",
        dot: "bg-violet-500",
      },
      {
        label: "Handshake",
        desc: "ZK proof exchanges silently",
        icon: "🔐",
        color: "bg-purple-50 border-purple-100",
        dot: "bg-purple-500",
      },
      {
        label: "Chat",
        desc: "Messages encrypted on-device",
        icon: "💬",
        color: "bg-indigo-50 border-indigo-100",
        dot: "bg-indigo-500",
      },
    ],
    pcDemo: {
      title: "Ledger Chat — Encrypted Session",
      subtitle: "Humanity Ledger identity Verified · No IP Logged",
      messages: [
        { side: "left", text: "Your ZK identity has been verified.", time: "14:32", system: true },
        { side: "left", text: "This session is end-to-end encrypted. No server can read this.", time: "14:32", system: false },
        { side: "right", text: "Perfect. Share the document hash?", time: "14:33", system: false },
        { side: "left", text: "0x7f3a...c91b — verified on-chain.", time: "14:33", system: false },
      ],
    },
  },
  {
    id: "studio-provenance",
    label: "Studio Provenance",
    tag: "On-Chain Registry",
    tagColor: "bg-emerald-100 text-emerald-700",
    href: "/portfolio",
    cta: "Open Studio",
    description:
      "Register real-world assets on Humanity Ledger L2. The existence proof is public and verifiable. Ownership and valuation remain encrypted — only your keys reveal them.",
    mobileSteps: [
      {
        label: "Photograph",
        desc: "Capture asset documentation",
        icon: "📷",
        color: "bg-emerald-50 border-emerald-100",
        dot: "bg-emerald-500",
      },
      {
        label: "Hash",
        desc: "On-device SHA-256 fingerprint",
        icon: "🔑",
        color: "bg-teal-50 border-teal-100",
        dot: "bg-teal-500",
      },
      {
        label: "Register",
        desc: "Proof posted to Humanity Ledger L2",
        icon: "✅",
        color: "bg-green-50 border-green-100",
        dot: "bg-green-500",
      },
    ],
    pcDemo: {
      title: "Studio Provenance — Registry Dashboard",
      subtitle: "3 Assets · All Proofs Verified · Ownership: Encrypted",
      messages: [
        { side: "left", text: "Asset #001 — Fine Art · Hash: 0xa3d1... · Status: Registered", time: "12:01", system: true },
        { side: "left", text: "Asset #002 — Real Estate Title · Hash: 0xb7c2... · Status: Pending", time: "12:01", system: false },
        { side: "right", text: "Verify Asset #001 ownership.", time: "12:02", system: false },
        { side: "left", text: "ZK Proof generated. Ownership verified. No data exposed.", time: "12:02", system: false },
      ],
    },
  },
  {
    id: "portfolio-terminal",
    label: "Portfolio Terminal",
    tag: "Shielded Analytics",
    tagColor: "bg-emerald-100 text-emerald-700",
    href: "/terminal",
    cta: "Open Terminal",
    description:
      "Multi-chain asset tracking inside your Private Execution Environment. Track balances across Ethereum, Humanity Ledger L2, and more — your data never leaves your device.",
    mobileSteps: [
      {
        label: "Connect",
        desc: "Link wallets locally via PXE",
        icon: "🔗",
        color: "bg-emerald-50 border-emerald-100",
        dot: "bg-[#25D366]",
      },
      {
        label: "Decrypt",
        desc: "Balances decrypted on-device",
        icon: "🛡️",
        color: "bg-sky-50 border-sky-100",
        dot: "bg-sky-500",
      },
      {
        label: "Analyse",
        desc: "Shielded charts & analytics",
        icon: "📊",
        color: "bg-indigo-50 border-indigo-100",
        dot: "bg-indigo-500",
      },
    ],
    pcDemo: {
      title: "Portfolio Terminal — PXE View",
      subtitle: "3 Chains · Decrypted Locally · Block Explorer Sees: Nothing",
      messages: [
        { side: "left", text: "ETH: 12.40 · USDC: 4,210 · Private HL: [ENCRYPTED]", time: "09:00", system: true },
        { side: "left", text: "PXE decrypted 3 private notes. Total private balance unlocked.", time: "09:00", system: false },
        { side: "right", text: "Export portfolio report?", time: "09:01", system: false },
        { side: "left", text: "PDF generated client-side. Zero server contact.", time: "09:01", system: false },
      ],
    },
  },
];

// ── Preview Mobile Phone Shell ──────────────────────────────────────────────
function MobileShell({ product }: { product: typeof PRODUCTS[0] }) {
  return (
    <div className="relative mx-auto w-[220px] h-[420px] md:w-[240px] md:h-[460px]">
      {/* Phone body */}
      <div className="absolute inset-0 bg-slate-900 rounded-[36px] shadow-[0_40px_80px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.06)] overflow-hidden">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-6 bg-slate-900 rounded-b-2xl z-20" />
        {/* Screen content */}
        <div className="absolute inset-0 bg-white rounded-[36px] overflow-hidden flex flex-col">
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pt-8 pb-2 bg-white">
            <span className="text-[9px] font-bold text-slate-700">9:41</span>
            <div className="flex gap-1 items-center">
              <div className="w-3 h-1.5 rounded-sm bg-slate-800 relative">
                <div className="absolute inset-0.5 right-0.5 bg-emerald-500 rounded-sm" style={{width:'66%'}} />
              </div>
            </div>
          </div>

          {/* App header */}
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-[11px] font-black text-slate-800">{product.label}</p>
            <p className="text-[9px] text-slate-400">{product.tag}</p>
          </div>

          {/* Steps */}
          <div className="flex-1 px-3 py-3 space-y-2 overflow-hidden">
            {product.mobileSteps.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.3, duration: 0.5, ease: EASE }}
                className={`flex items-center gap-2.5 border rounded-xl p-2.5 ${step.color}`}
              >
                <span className="text-lg leading-none">{step.icon}</span>
                <div>
                  <p className="text-[10px] font-bold text-slate-800">{step.label}</p>
                  <p className="text-[8.5px] text-slate-500 leading-tight">{step.desc}</p>
                </div>
                <div className={`ml-auto w-2 h-2 rounded-full ${step.dot} opacity-80`} />
              </motion.div>
            ))}

            {/* "Live" indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="flex items-center justify-center gap-1.5 pt-2"
            >
              <motion.div
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ repeat: Infinity, duration: 1.6 }}
                className="w-1.5 h-1.5 bg-emerald-500 rounded-full"
              />
              <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-wider">Live</span>
            </motion.div>
          </div>

          {/* Home indicator */}
          <div className="flex justify-center pb-2">
            <div className="w-20 h-1 bg-slate-200 rounded-full" />
          </div>
        </div>
      </div>

      {/* Side button */}
      <div className="absolute right-[-3px] top-20 w-1 h-10 bg-slate-700 rounded-l-sm" />
      <div className="absolute left-[-3px] top-16 w-1 h-7 bg-slate-700 rounded-r-sm" />
      <div className="absolute left-[-3px] top-26 w-1 h-7 bg-slate-700 rounded-r-sm" />
    </div>
  );
}

// ── Preview Desktop Browser Shell ───────────────────────────────────────────
function DesktopShell({ product }: { product: typeof PRODUCTS[0] }) {
  const demo = product.pcDemo;
  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Browser chrome */}
      <div className="bg-slate-100 rounded-t-2xl px-4 py-2.5 border border-slate-200 border-b-0 flex items-center gap-2.5">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 bg-white rounded-lg px-3 py-1 text-[10px] text-slate-400 border border-slate-200 font-mono">
          humanidfi.com / {product.id}
        </div>
      </div>

      {/* App window */}
      <div className="bg-white border border-slate-200 border-t-0 rounded-b-2xl overflow-hidden shadow-2xl shadow-slate-200">
        {/* App header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
          <div>
            <p className="text-sm font-bold text-slate-800">{demo.title}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{demo.subtitle}</p>
          </div>
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="flex items-center gap-1.5"
          >
            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Secure</span>
          </motion.div>
        </div>

        {/* Messages */}
        <div className="p-5 space-y-3 min-h-[200px]">
          {demo.messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.35, duration: 0.5, ease: EASE }}
              className={`flex ${msg.side === "right" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  msg.side === "right"
                    ? "bg-slate-900 text-white rounded-br-sm"
                    : msg.system
                    ? "bg-slate-100 text-slate-500 rounded-bl-sm border border-slate-200"
                    : "bg-indigo-50 text-indigo-900 rounded-bl-sm border border-indigo-100"
                }`}
              >
                <p className="text-[11px] leading-relaxed">{msg.text}</p>
                <p className={`text-[9px] mt-1 ${msg.side === "right" ? "text-white/40" : "text-slate-400"}`}>
                  {msg.time}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Input bar */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-3">
          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-[10px] text-slate-300">
            Type a message...
          </div>
          <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center cursor-pointer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function SeeInActionSection() {
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const product = PRODUCTS[active];

  return (
    <section
      ref={ref}
      className="w-full bg-white border-t border-black/[0.05] py-32 md:py-48 overflow-hidden"
    >
      <div className="w-full max-w-6xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, ease: EASE }}
          className="mb-16 md:mb-20"
        >
          <span className="block text-[10.5px] font-mono uppercase tracking-[0.25em] text-black/55 mb-5">
            See It In Action
          </span>
          <h2
            className="leading-[1.05] tracking-tight text-black mb-4"
            style={{
              fontFamily: "var(--font-aztec-serif), Georgia, serif",
              fontSize: "clamp(2.2rem, 5vw, 4.5rem)",
              fontWeight: 700,
            }}
          >
            Watch it work.
            <br />
            <span style={{ color: "rgba(0,0,0,0.55)" }}>Live, on your screen.</span>
          </h2>
          <p className="text-[15px] text-black/50 max-w-xl leading-relaxed">
            Three products. Each one privacy-first, running client-side, with your keys never leaving your device.
          </p>
        </motion.div>

        {/* Product tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
          className="flex gap-2 mb-12 flex-wrap"
        >
          {PRODUCTS.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActive(i)}
              className={`px-5 py-2.5 rounded-full text-[13px] font-semibold transition-all duration-300 ${
                active === i
                  ? "bg-white text-[#050505] border border-black/[0.06] shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
                  : "bg-transparent text-black/50 hover:bg-black/[0.03] hover:text-black/80"
              }`}
            >
              {p.label}
            </button>
          ))}
        </motion.div>

        {/* Demo area */}
        <AnimatePresence mode="wait">
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.55, ease: EASE }}
          >
            {/* Product meta */}
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-10">
              <span className={`self-start text-[11px] font-bold uppercase tracking-[0.18em] px-3 py-1.5 rounded-full ${product.tagColor}`}>
                {product.tag}
              </span>
              <p className="text-[15px] text-black/55 leading-relaxed max-w-2xl">
                {product.description}
              </p>
            </div>

            {/* Two-column demo: Mobile + Desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center bg-[#fafafa] rounded-3xl border border-black/[0.05] p-8 md:p-14">

              {/* iOS/Android preview */}
              <div className="flex flex-col items-center gap-8">
                <div className="text-center">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/55 mb-2 block">
                    iOS &amp; Android
                  </span>
                  <p className="text-sm font-semibold text-black/60">Mobile Experience</p>
                </div>
                <MobileShell product={product} />
                <div className="flex gap-3">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-black/[0.08] rounded-full">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"/>
                      <path d="M12 8v4l3 3"/>
                    </svg>
                    <span className="text-[10px] text-black/50 font-semibold">Client-side only</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-black/[0.08] rounded-full">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    <span className="text-[10px] text-black/50 font-semibold">No server contact</span>
                  </div>
                </div>
              </div>

              {/* Desktop preview */}
              <div className="flex flex-col items-center gap-8">
                <div className="text-center">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/55 mb-2 block">
                    Web App
                  </span>
                  <p className="text-sm font-semibold text-black/60">Desktop Experience</p>
                </div>
                <DesktopShell product={product} />
                <Link
                  href={product.href}
                  className="flex items-center gap-2 px-7 py-3 bg-white border border-black/[0.06] text-[#050505] rounded-full text-[13px] font-semibold hover:bg-zinc-50 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] hover:-translate-y-0.5"
                >
                  {product.cta}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}


