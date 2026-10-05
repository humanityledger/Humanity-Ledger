"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { HLLogo } from "@/components/shared/HLLogo";
import { SystemFooter } from "./SystemFooter";
import { RemoteLottie } from "@/components/ui/RemoteLottie";
import {
  Lock, Shield, Check, CheckCircle2, MessageCircle,
  Fingerprint, Globe, Mic, Video, BarChart2,
  Wallet, Users, Smartphone, ArrowRight,
  MessageSquare, Bell, Image, Smile, Zap, QrCode
} from "lucide-react";

export interface ImmersiveManifestoLandingProps {
  onOpenScanner?: () => void;
  hideMap?: boolean;
}

const EASE = [0.16, 1, 0.3, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (d: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE, delay: d },
  }),
};

// ─── Nav ─────────────────────────────────────────────────────────────────────
function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    try {
      const m = document.cookie.match(/system_handshake=(0x[a-fA-F0-9]{40}|email_[^;\s]+)/i);
      if (m?.[1]) setConnectedAddress(m[1].toLowerCase());
    } catch {}
  }, []);

  const fmtAddr = (a: string) =>
    a.startsWith("email_") ? a.replace("email_", "").slice(0, 16) + "…" : `${a.slice(0, 6)}…${a.slice(-4)}`;

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch {}
    try {
      document.cookie = 'system_handshake=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'wallet-auth=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    } catch {}
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('ledger_') || k.startsWith('system_') || k.startsWith('wc@') || k === 'humanid_session')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      localStorage.setItem('__disconnected__', '1');
      sessionStorage.setItem('__disconnected__', '1');
    } catch {}
    window.location.replace('/');
  };

  return (
    <nav
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
        scrolled ? "bg-white/95 backdrop-blur-xl border-b border-black/[0.06] shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 md:px-10 h-16 flex items-center justify-between">
        <HLLogo size={28} />
        <div className="flex items-center gap-3">
          {connectedAddress ? (
            <>
              <Link href="/chat" className="text-[14px] font-bold text-[#1C1C1E] px-4 py-2 rounded-xl hover:bg-black/5 transition-colors">
                Open Chat
              </Link>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-[13px] font-bold text-[#1C1C1E]/50 hover:text-red-500 transition-colors px-2"
              >
                {disconnecting ? "…" : fmtAddr(connectedAddress)}
              </button>
            </>
          ) : (
            <Link
              href="/connect"
              className="bg-[#1C1C1E] hover:bg-black text-white text-[14px] font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
            >
              Get Started
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

// ─── Utility Components ───────────────────────────────────────────────────────
function FeatureCheck({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-5 h-5 rounded-full bg-[#1C1C1E] flex items-center justify-center shrink-0 mt-0.5">
        <Check size={11} strokeWidth={3} className="text-white" />
      </div>
      <span className="text-[16px] font-medium text-[#1C1C1E]/70 leading-snug">{text}</span>
    </div>
  );
}

// ─── App Store Badges ─────────────────────────────────────────────────────────
function AppStoreBadge() {
  return (
    <a
      href="#"
      className="inline-flex items-center gap-[10px] bg-black text-white px-[14px] py-[8px] rounded-[10px] border border-white/[0.12] hover:bg-[#111] active:scale-[0.97] transition-all select-none"
      style={{ height: '50px', minWidth: '148px' }}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
      <div className="flex flex-col text-left leading-none">
        <span className="text-[9px] font-medium opacity-80 tracking-wide">Download on the</span>
        <span className="text-[15px] font-bold tracking-tight">App Store</span>
      </div>
    </a>
  );
}

function GooglePlayBadge() {
  return (
    <a
      href="#"
      className="inline-flex items-center gap-[10px] bg-black text-white px-[14px] py-[8px] rounded-[10px] border border-white/[0.12] hover:bg-[#111] active:scale-[0.97] transition-all select-none"
      style={{ height: '50px', minWidth: '148px' }}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M3.18 23.76a2 2 0 0 1-.93-.22 2 2 0 0 1-1.1-1.77V2.23a2 2 0 0 1 1.1-1.77A2 2 0 0 1 4.4.78l12.84 10.71a1 1 0 0 1 0 1.53L4.4 23.73a2 2 0 0 1-1.22.03z"/></svg>
      <div className="flex flex-col text-left leading-none">
        <span className="text-[9px] font-medium opacity-80 tracking-wide">Get it on</span>
        <span className="text-[15px] font-bold tracking-tight">Google Play</span>
      </div>
    </a>
  );
}

// ─── iPhone Mockup (CSS-only, Signal-style) ───────────────────────────────────
function IPhoneMockup({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative mx-auto shrink-0"
      style={{ width: 260, height: 530 }}
    >
      {/* Device frame */}
      <div
        className="absolute inset-0 rounded-[44px] border-[8px] border-[#1C1C1E] bg-[#1C1C1E] shadow-[0_32px_80px_rgba(0,0,0,0.35),inset_0_0_0_1.5px_rgba(255,255,255,0.1)]"
        style={{ zIndex: 2, pointerEvents: 'none' }}
      >
        {/* Notch */}
        <div className="absolute top-[8px] left-1/2 -translate-x-1/2 w-[90px] h-[22px] bg-[#1C1C1E] rounded-full z-10" />
      </div>
      {/* Screen content */}
      <div
        className="absolute inset-[8px] rounded-[36px] overflow-hidden bg-white"
        style={{ zIndex: 1 }}
      >
        {/* Status bar */}
        <div className="flex items-center justify-between px-5 pt-3 pb-1 bg-white">
          <span className="text-[10px] font-bold text-[#1C1C1E]">11:11</span>
          <div className="flex items-center gap-1">
            <svg width="12" height="9" viewBox="0 0 12 9" fill="#1C1C1E"><rect x="0" y="3" width="2" height="6" rx="0.5"/><rect x="3" y="2" width="2" height="7" rx="0.5"/><rect x="6" y="1" width="2" height="8" rx="0.5"/><rect x="9" y="0" width="2" height="9" rx="0.5"/></svg>
            <svg width="14" height="9" viewBox="0 0 23 11" fill="none"><rect x="0.5" y="0.5" width="20" height="10" rx="2.5" stroke="#1C1C1E" strokeWidth="1.2"/><path d="M22 3.5v3a1.5 1.5 0 0 0 0-3z" fill="#1C1C1E"/><rect x="2" y="2" width="15" height="7" rx="1.5" fill="#1C1C1E"/></svg>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── iPhone screen: Chat ──────────────────────────────────────────────────────
function ChatScreen() {
  return (
    <div className="flex flex-col h-full bg-[#EBE5DC]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-black/[0.06]">
        <div className="w-7 h-7 rounded-full bg-[#25D366] flex items-center justify-center text-white text-[10px] font-black shrink-0">AL</div>
        <div className="flex flex-col">
          <span className="text-[11px] font-bold text-[#1C1C1E]">0xa3f2...b91d</span>
          <span className="text-[9px] text-[#25D366] font-medium">Online · E2E Encrypted 🔒</span>
        </div>
        <div className="ml-auto flex gap-2">
          <div className="w-6 h-6 rounded-full bg-[#F2F2F7] flex items-center justify-center"><Mic size={11} className="text-[#8E8E93]"/></div>
          <div className="w-6 h-6 rounded-full bg-[#F2F2F7] flex items-center justify-center"><Video size={11} className="text-[#8E8E93]"/></div>
        </div>
      </div>
      {/* Messages */}
      <div className="flex-1 flex flex-col gap-2 px-3 py-3 overflow-hidden">
        {/* Received */}
        <div className="self-start max-w-[75%]">
          <div className="bg-white rounded-[16px] rounded-tl-[4px] px-3 py-2 shadow-sm">
            <p className="text-[10px] text-[#1C1C1E] leading-snug">Hey! Did you get my payment?</p>
            <p className="text-[8px] text-[#8E8E93] text-right mt-0.5">11:03</p>
          </div>
        </div>
        {/* Sent */}
        <div className="self-end max-w-[75%]">
          <div className="bg-[#25D366] rounded-[16px] rounded-tr-[4px] px-3 py-2 shadow-sm">
            <p className="text-[10px] text-white leading-snug">Yes! 0.05 ETH received ✓</p>
            <p className="text-[8px] text-white/70 text-right mt-0.5">11:04 ✓✓</p>
          </div>
        </div>
        {/* Received */}
        <div className="self-start max-w-[75%]">
          <div className="bg-white rounded-[16px] rounded-tl-[4px] px-3 py-2 shadow-sm">
            <p className="text-[10px] text-[#1C1C1E] leading-snug">No phone needed. Just our wallets 🔐</p>
            <p className="text-[8px] text-[#8E8E93] text-right mt-0.5">11:06</p>
          </div>
        </div>
        {/* Sent */}
        <div className="self-end max-w-[75%]">
          <div className="bg-[#25D366] rounded-[16px] rounded-tr-[4px] px-3 py-2 shadow-sm">
            <p className="text-[10px] text-white leading-snug">Exactly. End-to-end always 💚</p>
            <p className="text-[8px] text-white/70 text-right mt-0.5">11:07 ✓✓</p>
          </div>
        </div>
        {/* Disappearing badge */}
        <div className="self-center my-1">
          <span className="bg-[#1C1C1E]/10 text-[#1C1C1E] text-[8px] font-semibold px-2 py-0.5 rounded-full">Messages disappear in 24h 🔥</span>
        </div>
      </div>
      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-t border-black/[0.06]">
        <div className="flex-1 bg-[#F2F2F7] rounded-full px-3 py-1.5">
          <span className="text-[9px] text-[#8E8E93]">Message…</span>
        </div>
        <div className="w-6 h-6 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
          <ArrowRight size={11} className="text-white" />
        </div>
      </div>
    </div>
  );
}

// ─── iPhone screen: Crypto Payment ───────────────────────────────────────────
function PaymentScreen() {
  return (
    <div className="flex flex-col h-full bg-[#EBE5DC]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-black/[0.06]">
        <div className="w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center text-white text-[10px] font-black shrink-0">VX</div>
        <div className="flex flex-col">
          <span className="text-[11px] font-bold text-[#1C1C1E]">0xvx91...3a2f</span>
          <span className="text-[9px] text-[#8E8E93]">Ledger Chat · XMTP</span>
        </div>
      </div>
      {/* Messages */}
      <div className="flex-1 flex flex-col gap-2 px-3 py-3 overflow-hidden">
        <div className="self-start max-w-[80%]">
          <div className="bg-white rounded-[16px] rounded-tl-[4px] px-3 py-2 shadow-sm">
            <p className="text-[10px] text-[#1C1C1E]">Can you send me the 50 USDC for dinner?</p>
            <p className="text-[8px] text-[#8E8E93] text-right mt-0.5">20:11</p>
          </div>
        </div>
        {/* Payment bubble */}
        <div className="self-end max-w-[85%]">
          <div className="bg-[#25D366] rounded-[16px] rounded-tr-[4px] px-3 py-2.5 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <Wallet size={11} className="text-white" />
              </div>
              <span className="text-[10px] font-bold text-white">Crypto Payment</span>
            </div>
            <div className="bg-white/20 rounded-xl px-2 py-1.5 mb-1">
              <p className="text-[14px] font-black text-white text-center">50 USDC</p>
              <p className="text-[8px] text-white/80 text-center">≈ $50.00 USD</p>
            </div>
            <p className="text-[8px] text-white/70 mt-1">On-chain · Ethereum · No fees</p>
            <p className="text-[8px] text-white/70 text-right mt-0.5">20:12 ✓✓</p>
          </div>
        </div>
        <div className="self-start max-w-[75%]">
          <div className="bg-white rounded-[16px] rounded-tl-[4px] px-3 py-2 shadow-sm">
            <p className="text-[10px] text-[#1C1C1E]">Got it instantly! No intermediaries 🙌</p>
            <p className="text-[8px] text-[#8E8E93] text-right mt-0.5">20:13</p>
          </div>
        </div>
      </div>
      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-t border-black/[0.06]">
        <div className="flex-1 bg-[#F2F2F7] rounded-full px-3 py-1.5">
          <span className="text-[9px] text-[#8E8E93]">Message or send crypto…</span>
        </div>
        <div className="w-6 h-6 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
          <ArrowRight size={11} className="text-white" />
        </div>
      </div>
    </div>
  );
}

// ─── iPhone screen: Communities ───────────────────────────────────────────────
function CommunitiesScreen() {
  return (
    <div className="flex flex-col h-full bg-[#F2F2F7]">
      {/* Header */}
      <div className="px-3 py-2 bg-white border-b border-black/[0.06]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] font-black text-[#1C1C1E]">Communities</span>
          <div className="w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center">
            <Check size={9} strokeWidth={3} className="text-white" />
          </div>
        </div>
        <div className="bg-[#F2F2F7] rounded-full px-2 py-1">
          <span className="text-[9px] text-[#8E8E93]">Search communities…</span>
        </div>
      </div>
      {/* Community list */}
      <div className="flex-1 overflow-hidden flex flex-col gap-0">
        {[
          { name: "Web3 Builders", tag: "Free", members: "1.2k", color: "bg-blue-500", initials: "WB" },
          { name: "DeFi Signals", tag: "Paid · 0.01 ETH", members: "843", color: "bg-orange-500", initials: "DS" },
          { name: "Ledger DAO", tag: "Free", members: "2.4k", color: "bg-[#25D366]", initials: "LD" },
          { name: "NFT Collectors", tag: "Paid · 5 USDC", members: "317", color: "bg-purple-500", initials: "NC" },
        ].map((c, i) => (
          <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 bg-white border-b border-black/[0.04]">
            <div className={`w-8 h-8 rounded-xl ${c.color} flex items-center justify-center text-white text-[10px] font-black shrink-0`}>
              {c.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#1C1C1E] truncate">{c.name}</span>
                <span className="text-[8px] text-[#8E8E93] shrink-0 ml-1">{c.members} members</span>
              </div>
              <span className={`text-[8px] font-semibold ${c.tag.startsWith('Paid') ? 'text-orange-500' : 'text-[#25D366]'}`}>{c.tag}</span>
            </div>
          </div>
        ))}
      </div>
      {/* Bottom tab */}
      <div className="bg-white border-t border-black/[0.06] flex items-center justify-around px-4 py-2">
        <div className="flex flex-col items-center gap-0.5 opacity-40">
          <MessageSquare size={14} />
          <span className="text-[7px]">Chats</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 text-[#25D366]">
          <Users size={14} />
          <span className="text-[7px] font-bold">Communities</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 opacity-40">
          <Bell size={14} />
          <span className="text-[7px]">Updates</span>
        </div>
      </div>
    </div>
  );
}

// ─── iPhone Showcase Section ──────────────────────────────────────────────────
function LedgerShowcase() {
  const phones = [
    {
      title: "End-to-End Encrypted",
      subtitle: "Every message is private. No server — not even ours — can read it. Your wallet is your identity.",
      screen: <ChatScreen />,
      accent: "text-[#25D366]",
    },
    {
      title: "Native Crypto Payments",
      subtitle: "Send ETH, USDC, or USDT directly inside a conversation. On-chain. Zero intermediaries. Zero fees.",
      screen: <PaymentScreen />,
      accent: "text-orange-500",
    },
    {
      title: "Decentralized Communities",
      subtitle: "Create free or pay-to-enter communities. Revenue goes straight to the admin's wallet, not a platform.",
      screen: <CommunitiesScreen />,
      accent: "text-indigo-500",
    },
  ];

  return (
    <section className="py-24 md:py-32" style={{ background: '#EBE5DC' }}>
      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="text-center mb-16"
        >
          <p className="text-[12px] font-black uppercase tracking-[0.2em] text-[#25D366] mb-4">The App</p>
          <h2 className="text-[38px] md:text-[56px] font-bold tracking-tight text-[#1C1C1E] mb-5 leading-tight">
            The most powerful private messenger.<br className="hidden md:block" /> Built for Web3.
          </h2>
          <p className="text-[18px] font-medium text-[#1C1C1E]/55 max-w-2xl mx-auto leading-relaxed">
            Ledger Chat brings Signal-grade privacy, WhatsApp-level features, and native crypto superpowers — all in one app.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8 items-end justify-items-center">
          {phones.map((phone, i) => (
            <motion.div
              key={phone.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={i * 0.12}
              variants={fadeUp}
              className="flex flex-col items-center gap-8 w-full max-w-[280px]"
            >
              {/* Caption above */}
              <div className="text-center">
                <h3 className={`text-[20px] md:text-[22px] font-bold ${phone.accent} mb-2`}>{phone.title}</h3>
                <p className="text-[14px] font-medium text-[#1C1C1E]/60 leading-relaxed max-w-[220px] mx-auto">{phone.subtitle}</p>
              </div>
              {/* Phone */}
              <IPhoneMockup>
                {phone.screen}
              </IPhoneMockup>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ImmersiveManifestoLanding({ onOpenScanner, hideMap }: ImmersiveManifestoLandingProps) {
  return (
    <div className="flex flex-col w-full min-h-screen bg-white">
      <LandingNav />

      {/* ═══ SECTION 1 — HERO ══════════════════════════════════════════════════ */}
      <section className="relative pt-32 md:pt-40 pb-24 md:pb-32 bg-white overflow-hidden">
        {/* Subtle green ambient */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[#25D366]/4 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-5xl mx-auto px-5 md:px-10 text-center relative z-10">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="flex flex-col items-center gap-6"
          >
            <div className="inline-flex items-center gap-2 bg-[#25D366]/8 border border-[#25D366]/20 rounded-full px-4 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" />
              <span className="text-[12px] font-bold text-[#25D366] uppercase tracking-wider">Public Beta — Live on Web</span>
            </div>

            <h1 className="text-[48px] sm:text-[64px] md:text-[80px] font-bold tracking-tight text-[#1C1C1E] leading-[1.05]">
              Private messaging<br />for the next<br />
              <span className="text-[#25D366]">generation.</span>
            </h1>

            <p className="text-[18px] md:text-[21px] font-medium text-[#1C1C1E]/55 max-w-2xl mx-auto leading-relaxed">
              No phone number. No password. No surveillance.
              Your Ethereum wallet is your identity — and every message is end-to-end encrypted by default.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold text-[17px] px-10 py-4 rounded-2xl transition-all shadow-[0_12px_32px_rgba(37,211,102,0.28)] active:scale-95"
              >
                <MessageCircle size={20} />
                Open Ledger Chat
              </Link>
              <Link
                href="/connect"
                className="inline-flex items-center gap-2 bg-[#F6F7F9] hover:bg-[#EBEBEB] text-[#1C1C1E] font-bold text-[17px] px-10 py-4 rounded-2xl transition-all active:scale-95"
              >
                <Wallet size={18} />
                Connect Wallet
              </Link>
            </div>

            <p className="text-[13px] font-medium text-[#1C1C1E]/35 mt-2">
              Free forever. No ads. No phone number. Open protocol.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ═══ SECTION 2 — STAT STRIP ════════════════════════════════════════════ */}
      <section className="bg-[#F6F7F9] border-y border-black/[0.05] py-10">
        <div className="max-w-5xl mx-auto px-5 md:px-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { val: "100%", label: "End-to-end encrypted" },
            { val: "0", label: "Phone numbers collected" },
            { val: "3", label: "Networks supported: ETH, USDC, USDT" },
            { val: "∞", label: "Messages, calls & communities" },
          ].map((s) => (
            <div key={s.label} className="flex flex-col gap-1">
              <span className="text-[36px] md:text-[42px] font-black text-[#1C1C1E]">{s.val}</span>
              <span className="text-[13px] font-medium text-[#1C1C1E]/50 leading-snug">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SECTION 3 — IPHONE SHOWCASE (Signal-style) ════════════════════════ */}
      <LedgerShowcase />

      {/* ═══ SECTION 4 — HOW IT DIFFERS ═══════════════════════════════════════ */}
      <section className="bg-[#F6F7F9] py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="text-[38px] md:text-[54px] font-bold tracking-tight text-[#1C1C1E] mb-5">
              What makes Ledger Chat different?
            </h2>
            <p className="text-[18px] font-medium text-[#1C1C1E]/55 max-w-2xl mx-auto leading-relaxed">
              Most messaging apps are built around advertising revenue. Ledger Chat is built around you.
            </p>
          </motion.div>

          {/* Comparison table */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="bg-white rounded-3xl border border-black/[0.05] shadow-sm overflow-hidden"
          >
            <div className="grid grid-cols-4 bg-[#FAFAFA] border-b border-black/5 px-6 py-4">
              <div className="text-[13px] font-black uppercase tracking-widest text-black/30">Feature</div>
              <div className="text-[13px] font-black uppercase tracking-widest text-[#1C1C1E] text-center">Ledger Chat</div>
              <div className="text-[13px] font-black uppercase tracking-widest text-black/30 text-center">WhatsApp</div>
              <div className="text-[13px] font-black uppercase tracking-widest text-black/30 text-center">Telegram</div>
            </div>
            {[
              ["No phone number required", true, false, false],
              ["Messages encrypted end-to-end", true, true, false],
              ["No ads, ever", true, true, false],
              ["No company can read your messages", true, false, false],
              ["No data collected about you", true, false, false],
              ["Send crypto in a conversation", true, false, false],
              ["Voice and video calls", true, true, true],
              ["Group communities", true, true, true],
              ["Account never tied to real identity", true, false, false],
            ].map(([label, lc, wa, tg], i) => (
              <div key={String(label)} className={`grid grid-cols-4 px-6 py-4 items-center ${i % 2 === 0 ? '' : 'bg-[#FAFAFA]'} border-b border-black/[0.03] last:border-0`}>
                <span className="text-[15px] font-medium text-[#1C1C1E]/80">{String(label)}</span>
                <div className="flex justify-center">
                  {lc ? <Check size={18} strokeWidth={3} className="text-[#25D366]" /> : <span className="text-black/20 text-lg">—</span>}
                </div>
                <div className="flex justify-center">
                  {wa ? <Check size={18} strokeWidth={3} className="text-black/25" /> : <span className="text-black/20 text-lg">—</span>}
                </div>
                <div className="flex justify-center">
                  {tg ? <Check size={18} strokeWidth={3} className="text-black/25" /> : <span className="text-black/20 text-lg">—</span>}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ SECTION 5 — ACCESSIBILITY ════════════════════════════════════════ */}
      <section className="bg-white py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="flex flex-col gap-8"
            >
              <div>
                <p className="text-[12px] font-black uppercase tracking-[0.2em] text-[#25D366] mb-4">The Next Step in Humanity</p>
                <h2 className="text-[38px] md:text-[52px] font-bold tracking-tight text-[#1C1C1E] mb-6 leading-tight">
                  Ledger Chat is live now on the web.<br />Mobile apps coming to iOS &amp; Android.
                </h2>
                <p className="text-[18px] font-medium text-[#1C1C1E]/60 leading-relaxed mb-6">
                  Technology should adapt to people, not the other way around. We believe privacy is a fundamental human right, but it only works if it is effortless to use.
                </p>
                <p className="text-[18px] font-medium text-[#1C1C1E]/60 leading-relaxed">
                  Ledger Chat eliminates the friction of modern applications. There are no passwords to forget, no complex settings to configure, and no menus hidden behind technical jargon. It is as simple as opening the app and talking.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
                <div className="bg-[#F6F7F9] p-6 rounded-2xl">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                    <CheckCircle2 size={20} className="text-[#25D366]" />
                  </div>
                  <h4 className="text-[17px] font-bold text-[#1C1C1E] mb-2">No passwords</h4>
                  <p className="text-[15px] font-medium text-[#1C1C1E]/60">Your wallet signs a one-time message. Nothing to remember, nothing to lose.</p>
                </div>
                <div className="bg-[#F6F7F9] p-6 rounded-2xl">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                    <Smile size={20} className="text-[#25D366]" />
                  </div>
                  <h4 className="text-[17px] font-bold text-[#1C1C1E] mb-2">Comfortable to read</h4>
                  <p className="text-[15px] font-medium text-[#1C1C1E]/60">Clean typography, high contrast colors, and an interface that scales if you need larger text.</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: EASE }}
              className="w-full bg-[#F6F7F9] rounded-[40px] overflow-hidden flex items-center justify-center p-10 relative"
              style={{ aspectRatio: '4/3' }}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-[#25D366]/5 to-transparent" />
              <div className="text-center relative z-10 max-w-sm">
                <h3 className="text-[24px] font-bold text-[#1C1C1E] mb-4">&ldquo;It just works.&rdquo;</h3>
                <p className="text-[16px] font-medium text-[#1C1C1E]/55">
                  We have taken the most advanced security in the world and hidden it entirely behind an interface that feels as familiar and welcoming as writing a letter.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 6 — FEATURES ════════════════════════════════════════════ */}
      <section className="bg-white py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-5 md:px-10 grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASE }}
            className="w-full max-w-[480px] mx-auto bg-[#F6F7F9] rounded-[40px] border border-black/[0.05] shadow-md overflow-hidden flex items-center justify-center p-8"
            style={{ aspectRatio: '1/1' }}
          >
            <RemoteLottie path="/lottie/message-icon.json" loop width="100%" height="100%" />
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="flex flex-col gap-8"
          >
            <div>
              <h2 className="text-[38px] md:text-[52px] font-bold tracking-tight text-[#1C1C1E] mb-5 leading-tight">
                Everything you need.<br />Nothing you do not.
              </h2>
              <p className="text-[17px] font-medium text-[#1C1C1E]/55 leading-relaxed">
                Ledger Chat gives you every tool you expect from a modern messaging app,
                without the parts designed to keep you tracked or watched.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <FeatureCheck text="Send text, photos, videos, voice messages, and files" />
              <FeatureCheck text="Make clear, private voice and video calls with no quality loss" />
              <FeatureCheck text="Create group chats and communities for up to thousands of people" />
              <FeatureCheck text="Set messages to delete automatically after they are read" />
              <FeatureCheck text="Send ETH, USDC, or USDT to anyone in your contacts, instantly" />
              <FeatureCheck text="React to messages with any emoji" />
              <FeatureCheck text="Share your live location safely for a limited time only" />
              <FeatureCheck text="Create polls to collect opinions from a group" />
              <FeatureCheck text="Use a QR code to add contacts when you meet in person" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ SECTION 7 — PLATFORM AVAILABILITY ════════════════════════════════ */}
      <section className="bg-[#F6F7F9] py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-14"
          >
            <h2 className="text-[38px] md:text-[54px] font-bold tracking-tight text-[#1C1C1E] mb-4">
              Available on all your devices.
            </h2>
            <p className="text-[18px] font-medium text-[#1C1C1E]/55 max-w-xl mx-auto">
              Ledger Chat works on iPhone, Android phones, and any web browser.
              Your conversations stay in sync across all of them automatically.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                icon: <Smartphone size={28} />,
                title: "iPhone",
                sub: "Requires iOS 16 or later",
                badge: "App Store — Coming Soon",
                color: "text-[#25D366]",
                bg: "bg-[#25D366]/8",
              },
              {
                icon: <Smartphone size={28} />,
                title: "Android",
                sub: "Requires Android 10 or later",
                badge: "Google Play — Coming Soon",
                color: "text-[#25D366]",
                bg: "bg-[#25D366]/8",
              },
              {
                icon: <Globe size={28} />,
                title: "Web Browser",
                sub: "Chrome, Safari, Firefox — no download",
                badge: "Available now at humanidfi.com",
                color: "text-purple-600",
                bg: "bg-purple-500/8",
              },
            ].map((p) => (
              <motion.div
                key={p.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="bg-white rounded-3xl p-8 border border-black/[0.05] shadow-sm flex flex-col gap-4 text-center items-center"
              >
                <div className={`w-14 h-14 ${p.bg} ${p.color} rounded-2xl flex items-center justify-center`}>
                  {p.icon}
                </div>
                <div>
                  <h3 className="text-[20px] font-bold text-[#1C1C1E]">{p.title}</h3>
                  <p className="text-[14px] text-black/50 mt-1">{p.sub}</p>
                </div>
                <div className="bg-[#F6F7F9] text-[12px] font-bold text-black/50 px-4 py-2 rounded-lg w-full text-center">
                  {p.badge}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 8 — PROTOCOL EXPLAINED ══════════════════════════════════ */}
      <section className="bg-white py-24 md:py-32">
        <div className="max-w-4xl mx-auto px-5 md:px-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-14"
          >
            <p className="text-[12px] font-black uppercase tracking-[0.2em] text-[#25D366] mb-4">The Protocol</p>
            <h2 className="text-[38px] md:text-[54px] font-bold tracking-tight text-[#1C1C1E] mb-4">
              How Ledger Chat actually works.
            </h2>
            <p className="text-[18px] font-medium text-[#1C1C1E]/55 max-w-2xl mx-auto leading-relaxed">
              Complete transparency about the technology behind your private conversations.
            </p>
          </motion.div>

          <div className="flex flex-col gap-6">
            {[
              {
                n: "01",
                title: "Your wallet is your account.",
                desc: "When you open Ledger Chat, your Ethereum wallet signs a one-time cryptographic message. This proves you control the wallet without revealing your private key. No username, no password, no phone number is ever collected. If you lose access to your wallet, a recovery phrase is all you need.",
                color: "bg-[#25D366]",
              },
              {
                n: "02",
                title: "Messages travel over XMTP — not our servers.",
                desc: "Every message you write is encrypted on your device using your wallet's public key before it leaves. It travels over XMTP, an open decentralized messaging network. Humanity Ledger's own servers never hold, route, or decrypt your messages. The ciphertext is the only thing that ever touches any server.",
                color: "bg-[#128C7E]",
              },
              {
                n: "03",
                title: "Calls are direct — peer to peer.",
                desc: "When you make a voice or video call, the connection is established directly between the two devices using WebRTC. The call offer and answer are negotiated over XMTP, so even the metadata of who is calling whom is end-to-end encrypted. No central media relay server is involved.",
                color: "bg-[#25D366]",
              },
              {
                n: "04",
                title: "Crypto payments are on-chain — no intermediary.",
                desc: "When you send ETH, USDC, or USDT inside a chat, the transaction is signed by your wallet and submitted directly to the Ethereum network. Humanity Ledger never touches your funds, holds a balance on your behalf, or charges a fee. The recipient address you type is exactly what receives the funds.",
                color: "bg-[#128C7E]",
              },
              {
                n: "05",
                title: "Communities are structured but sovereign.",
                desc: "Communities live in a database for their structure (channels, members, roles, posts). Chat inside a Community channel travels over XMTP with the same end-to-end encryption as direct messages. Paid channel access is verified on-chain — the admin's wallet receives the payment, not Humanity Ledger.",
                color: "bg-[#25D366]",
              },
            ].map((item, i) => (
              <motion.div
                key={item.n}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i * 0.07}
                variants={fadeUp}
                className="flex gap-6 bg-[#FAFAFA] border border-black/[0.05] rounded-2xl px-6 py-6 items-start hover:border-black/10 transition-colors"
              >
                <div className={`shrink-0 w-10 h-10 rounded-xl ${item.color} flex items-center justify-center`}>
                  <span className="text-[12px] font-black text-white">{item.n}</span>
                </div>
                <div>
                  <h4 className="text-[17px] font-bold text-[#1C1C1E] mb-2">{item.title}</h4>
                  <p className="text-[15px] font-medium text-[#1C1C1E]/55 leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 9 — LATEST UPDATES ══════════════════════════════════════ */}
      <section className="bg-[#F6F7F9] py-24 md:py-32">
        <div className="max-w-4xl mx-auto px-5 md:px-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-14"
          >
            <p className="text-[12px] font-black uppercase tracking-[0.2em] text-[#25D366] mb-4">Latest updates</p>
            <h2 className="text-[38px] md:text-[54px] font-bold tracking-tight text-[#1C1C1E] mb-4">
              What we have built recently.
            </h2>
            <p className="text-[18px] font-medium text-[#1C1C1E]/55">
              Ledger Chat improves every week. Here is a summary of the most recent additions.
            </p>
          </motion.div>

          <div className="flex flex-col gap-4">
            {[
              {
                tag: "New",
                title: "Padlock loading screen — security made visible",
                desc: "The app now opens with a green padlock that clicks shut as your cryptographic identity is established. A visual metaphor for what the protocol actually does: locking your channel before anyone enters.",
                color: "bg-[#25D366] text-white",
              },
              {
                tag: "New",
                title: "Communities — free and paid channels",
                desc: "Create a community with multiple channels. Choose which are free for everyone and which require a one-time crypto payment to unlock. The payment goes directly to the community admin's wallet — no platform cut, no App Store fees.",
                color: "bg-[#128C7E] text-white",
              },
              {
                tag: "New",
                title: "Native crypto payments — ETH, USDC, USDT",
                desc: "Send real cryptocurrency to anyone in your contacts directly inside the chat interface. Powered by your connected wallet via wagmi v2. The transaction is signed and submitted on-chain. Zero intermediaries. Zero artificial tokens required.",
                color: "bg-[#25D366] text-white",
              },
              {
                tag: "New",
                title: "Live location sharing with OpenStreetMap",
                desc: "Share your real-time position with a contact for a defined time window. The map is rendered using OpenStreetMap — no Google APIs, no third-party tracking. Your location is shared directly to the recipient and is automatically removed from the conversation when time expires.",
                color: "bg-[#128C7E] text-white",
              },
              {
                tag: "Improved",
                title: "Rich post editor for community announcements",
                desc: "Group administrators can write formatted announcements with bold text, headings, and bullet points using a full Tiptap-powered editor. Announcements are stored and surfaced at the top of the community feed.",
                color: "bg-orange-500 text-white",
              },
              {
                tag: "Security",
                title: "End-to-end encrypted by default — no setup required",
                desc: "All conversations in Ledger Chat are encrypted from the moment they start. You do not need to enable anything. There is no plain text fallback mode. Every message is private, always.",
                color: "bg-[#1C1C1E] text-white",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i * 0.07}
                variants={fadeUp}
                className="flex gap-5 bg-white border border-black/[0.05] rounded-2xl px-6 py-5 items-start hover:border-black/10 transition-colors"
              >
                <span className={`shrink-0 text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md mt-0.5 ${item.color}`}>
                  {item.tag}
                </span>
                <div>
                  <h4 className="text-[16px] font-bold text-[#1C1C1E] mb-1">{item.title}</h4>
                  <p className="text-[14px] font-medium text-[#1C1C1E]/55 leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 10 — FEATURE GRID ════════════════════════════════════════ */}
      <section id="notify" className="bg-[#F6F7F9] py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          <div className="flex flex-col items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: EASE }}
              className="w-32 h-32 mb-10 flex items-center justify-center"
            >
              <RemoteLottie path="/lottie/typing.json" loop width={128} height={128} />
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="max-w-3xl text-center"
            >
              <h2 className="text-[38px] md:text-[56px] font-bold tracking-tight text-[#1C1C1E] mb-6 leading-tight">
                Everything you know.<br />And then some.
              </h2>
              <p className="text-[18px] md:text-[20px] font-medium text-[#1C1C1E]/55 leading-relaxed mb-12">
                Ledger Chat has every feature the most popular messaging apps offer, and adds things
                that no other app provides today.
              </p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl"
            >
              {[
                { icon: <MessageSquare size={22} />, label: "Private Messages", color: "text-[#25D366] bg-[#25D366]/8" },
                { icon: <Mic size={22} />, label: "Voice Calls", color: "text-[#25D366] bg-[#25D366]/8" },
                { icon: <Video size={22} />, label: "Video Calls", color: "text-purple-600 bg-purple-500/8" },
                { icon: <Wallet size={22} />, label: "Send Payments", color: "text-orange-500 bg-orange-500/8" },
                { icon: <Bell size={22} />, label: "Message Timers", color: "text-red-500 bg-red-500/8" },
                { icon: <Image size={22} />, label: "Photo and Video", color: "text-cyan-600 bg-cyan-500/8" },
                { icon: <BarChart2 size={22} />, label: "Polls", color: "text-emerald-600 bg-emerald-500/8" },
                { icon: <Users size={22} />, label: "Communities", color: "text-indigo-600 bg-indigo-500/8" },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  custom={i * 0.05}
                  variants={fadeUp}
                  className="bg-white rounded-2xl p-5 flex flex-col items-center gap-3 text-center border border-black/[0.04] hover:border-black/10 transition-colors"
                >
                  <div className={`w-11 h-11 rounded-xl ${item.color} flex items-center justify-center`}>
                    {item.icon}
                  </div>
                  <span className="text-[13px] font-bold text-[#1C1C1E]/80 leading-tight">{item.label}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 11 — BOTTOM CTA ════════════════════════════════════════ */}
      <section className="bg-white py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-5 md:px-10 flex flex-col items-center text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="flex flex-col items-center"
          >
            <div className="w-24 h-24 mx-auto mb-8 bg-[#25D366] rounded-3xl flex items-center justify-center shadow-[0_16px_40px_rgba(37,211,102,0.25)]">
              <Lock size={38} className="text-white" strokeWidth={2} />
            </div>
            <h2 className="text-[42px] md:text-[60px] font-bold tracking-tight text-[#1C1C1E] mb-6 leading-tight">
              Ready to start?
            </h2>
            <p className="text-[18px] font-medium text-[#1C1C1E]/55 mb-10 max-w-xl mx-auto leading-relaxed">
              Ledger Chat is free to use. No sign up form, no email, no phone number, no artificial tokens.
              Connect your wallet and your encrypted channel is ready in seconds.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white font-bold text-[17px] px-10 py-4 rounded-2xl transition-all shadow-[0_12px_32px_rgba(37,211,102,0.28)] active:scale-95"
              >
                <MessageCircle size={20} />
                Open Ledger Chat
              </Link>
              <Link
                href="/communities"
                className="inline-flex items-center gap-2 bg-[#F6F7F9] hover:bg-[#EBEBEB] text-[#1C1C1E] font-bold text-[17px] px-10 py-4 rounded-2xl transition-all active:scale-95"
              >
                <Users size={18} />
                Explore Communities
              </Link>
            </div>

            <div className="flex flex-row gap-3 flex-wrap justify-center mb-6">
              <AppStoreBadge />
              <GooglePlayBadge />
            </div>

            <p className="text-[13px] font-medium text-[#1C1C1E]/35">
              Free forever. No ads. No artificial tokens. No data sold. Open source protocol.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <SystemFooter />
    </div>
  );
}
