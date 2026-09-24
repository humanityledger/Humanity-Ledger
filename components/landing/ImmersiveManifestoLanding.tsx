"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { HLLogo } from "@/components/shared/HLLogo";
import { SystemFooter } from "./SystemFooter";
import { RemoteLottie } from "@/components/ui/RemoteLottie";
import {
  Lock, Shield, EyeOff, Check, MessageCircle,
  Fingerprint, Flame, Globe, Mic, Video, Bot, BarChart2,
  Wallet, Users
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
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}
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
        scrolled
          ? "bg-white/95 backdrop-blur-xl border-b border-black/[0.06] py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 md:px-10 flex items-center justify-between">
        <Link href="/" className="flex items-center" aria-label="Humanity Ledger home">
          <img
            src="/logo-text.png"
            alt="Humanity Ledger"
            style={{ height: 28, width: 'auto', objectFit: 'contain', display: 'block' }}
          />
        </Link>

        <div className="hidden md:flex items-center gap-7">
          {[
            { label: "Features", href: "/docs/ledger-chat" },
            { label: "How It Works", href: "/docs/architecture" },
            { label: "Privacy", href: "/docs/privacy" },
            { label: "Blog", href: "/blog" },
            { label: "Docs", href: "/docs/terms" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-[15px] font-medium text-[#1C1C1E]/70 hover:text-[#1C1C1E] transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {connectedAddress ? (
            <>
              <span className="hidden sm:block text-[13px] font-mono text-black/40 border border-black/10 rounded-full px-3 py-1">
                {fmtAddr(connectedAddress)}
              </span>
              <Link
                href="/chat"
                className="bg-[#2C6BED] hover:bg-[#1A5AE3] text-white font-bold text-[14px] px-5 py-2.5 rounded-full transition-all shadow-sm"
              >
                Open Chat
              </Link>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[13px] px-4 py-2.5 rounded-full transition-all disabled:opacity-50"
              >
                {disconnecting ? "…" : "Disconnect"}
              </button>
            </>
          ) : (
            <Link
              href="/connect"
              className="bg-[#2C6BED] hover:bg-[#1A5AE3] text-white font-bold text-[14px] px-5 py-2.5 rounded-full transition-all shadow-sm"
            >
              Get Ledger Chat
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

// ─── Feature pill ─────────────────────────────────────────────────────────────
function FeatureCheck({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-5 h-5 rounded-full bg-[#2C6BED]/10 flex items-center justify-center shrink-0 mt-0.5">
        <Check size={12} className="text-[#2C6BED]" strokeWidth={3} />
      </div>
      <span className="text-[16px] font-medium text-[#1C1C1E]/80 leading-snug">{text}</span>
    </div>
  );
}

// ─── Step item ────────────────────────────────────────────────────────────────
function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="flex gap-5">
      <div className="w-9 h-9 rounded-full bg-[#2C6BED] text-white font-black text-[15px] flex items-center justify-center shrink-0">
        {n}
      </div>
      <div className="flex flex-col gap-1">
        <h4 className="text-[17px] font-bold text-[#1C1C1E]">{title}</h4>
        <p className="text-[15px] font-medium text-[#1C1C1E]/60 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export function ImmersiveManifestoLanding({ onOpenScanner }: ImmersiveManifestoLandingProps) {
  return (
    <div className="w-full bg-white font-sans selection:bg-[#2C6BED]/20">
      <LandingNav />

      {/* ═══ SECTION 1 — HERO ═══════════════════════════════════════════════════ */}
      <section className="relative flex items-center bg-white pt-20 overflow-hidden">
        {/* Ambient gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_100%_at_50%_-20%,rgba(44,107,237,0.12),rgba(255,255,255,0))] pointer-events-none" />
        <div className="absolute top-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#2C6BED]/20 to-transparent" />

        <div className="max-w-7xl mx-auto px-5 md:px-10 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center py-20 lg:py-28">
          
          {/* Left: Copy */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="flex flex-col items-center text-center lg:items-start lg:text-left lg:col-span-7 relative z-10"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="flex items-center gap-2.5 mb-8 bg-white border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.04)] rounded-full px-5 py-2.5"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-[#30D158] animate-pulse shadow-[0_0_12px_rgba(48,209,88,0.6)]" />
              <span className="text-[13px] font-bold text-[#1C1C1E] uppercase tracking-[0.1em]">
                Global Release Jan 2027
              </span>
            </motion.div>

            <h1 className="text-[56px] md:text-[80px] lg:text-[96px] font-black leading-[0.95] tracking-[-0.04em] text-[#050505] mb-6">
              Privacy<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2C6BED] to-[#6E95F5]">redefined.</span>
            </h1>
            
            <p className="text-[19px] md:text-[22px] font-medium leading-[1.6] text-[#1C1C1E]/60 mb-10 max-w-[540px]">
              Ledger Chat is free, instantly fast, and built for people who want to own their conversations completely. End-to-end encrypted and powered by your wallet.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mb-10">
              <Link
                href="/chat"
                className="bg-[#050505] hover:bg-[#1A1A1A] text-white font-bold text-[16px] px-8 py-4 rounded-2xl transition-all shadow-[0_8px_24px_rgba(0,0,0,0.12)] flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95"
              >
                <MessageCircle size={20} />
                Open Ledger Chat
              </Link>
              <Link
                href="/docs/ledger-chat"
                className="bg-white hover:bg-[#F6F7F9] text-[#050505] border border-black/10 font-bold text-[16px] px-8 py-4 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95"
              >
                Learn How It Works
              </Link>
            </div>

            <div className="flex flex-wrap justify-center lg:justify-start items-center gap-x-8 gap-y-4">
              {[
                { icon: <Lock size={16} />, label: "End-to-End Encrypted" },
                { icon: <EyeOff size={16} />, label: "No Trackers" },
                { icon: <Wallet size={16} />, label: "Wallet Auth" },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2 text-[14px] font-bold text-[#1C1C1E]/50">
                  <span className="text-[#1C1C1E]">{f.icon}</span>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: Lottie animation */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: EASE }}
            className="relative w-full flex items-center justify-center lg:col-span-5"
          >
            <div className="relative w-full max-w-[420px] mx-auto">
              {/* Glow */}
              <div className="absolute inset-0 bg-[#2C6BED] blur-[100px] opacity-10 rounded-full" />
              {/* Card */}
              <div className="relative bg-white/40 backdrop-blur-3xl border border-white/60 rounded-[48px] shadow-[0_40px_100px_rgba(44,107,237,0.12),inset_0_2px_10px_rgba(255,255,255,0.8)] p-2">
                <div className="bg-white rounded-[40px] overflow-hidden" style={{ aspectRatio: '4/5', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0,0,0,0.04)' }}>
                  <RemoteLottie
                    path="/lottie/texting.json"
                    loop
                    width="100%"
                    height="100%"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ SECTION 2 — WHY LEDGER CHAT ══════════════════════════════════════ */}
      <section className="bg-[#F6F7F9] py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-5 md:px-10">

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 flex items-center justify-center">
                <RemoteLottie path="/lottie/messaging-loader.json" loop width={64} height={64} />
              </div>
            </div>
            <h2 className="text-[38px] md:text-[54px] font-bold tracking-tight text-[#1C1C1E] mb-5">
              Why Ledger Chat?
            </h2>
            <p className="text-[18px] md:text-[20px] font-medium text-[#1C1C1E]/55 max-w-2xl mx-auto leading-relaxed">
              Because your messages belong to you, not to a corporation with investors to please.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <EyeOff size={26} strokeWidth={2} />,
                color: "text-[#2C6BED]",
                bg: "bg-[#2C6BED]/8",
                title: "No Ads. No Trackers. No Compromise.",
                desc: "We earn zero revenue from your conversations. We do not sell your data. Ledger Chat is sustained by users who believe privacy is a right, not a product.",
              },
              {
                icon: <Shield size={26} strokeWidth={2} />,
                color: "text-purple-600",
                bg: "bg-purple-500/8",
                title: "Privacy Is the Foundation.",
                desc: "Every single message is encrypted end-to-end before it leaves your device. Not even Humanity Ledger can read your conversations.",
              },
              {
                icon: <Fingerprint size={26} strokeWidth={2} />,
                color: "text-[#30D158]",
                bg: "bg-[#30D158]/10",
                title: "Your Identity Is Your Wallet.",
                desc: "No phone number. No email. No government ID required. Your crypto wallet is your passport. Sovereignty guaranteed by mathematics, not promises.",
              },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i * 0.1}
                variants={fadeUp}
                className="bg-white rounded-3xl p-8 border border-black/[0.05] shadow-sm hover:shadow-md transition-shadow"
              >
                <div className={`w-14 h-14 ${card.bg} ${card.color} rounded-2xl flex items-center justify-center mb-6`}>
                  {card.icon}
                </div>
                <h3 className="text-[20px] font-bold text-[#1C1C1E] mb-4 leading-snug">{card.title}</h3>
                <p className="text-[16px] font-medium text-[#1C1C1E]/60 leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 3 — HOW IT WORKS ════════════════════════════════════════ */}
      <section className="bg-white py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-5 md:px-10 grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">

          {/* Text */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="flex flex-col gap-10"
          >
            <div>
              <h2 className="text-[38px] md:text-[52px] font-bold tracking-tight text-[#1C1C1E] mb-5 leading-tight">
                Connecting the world,<br />privately.
              </h2>
              <p className="text-[17px] font-medium text-[#1C1C1E]/55 leading-relaxed">
                Getting started takes under 60 seconds. No forms to fill. No verification emails.
                Just your wallet and a world of private conversations waiting for you.
              </p>
            </div>

            <div className="flex flex-col gap-8">
              <Step
                n="1"
                title="Connect your wallet."
                desc="Your crypto wallet becomes your identity. MetaMask, Rainbow, Coinbase Wallet — all supported."
              />
              <Step
                n="2"
                title="Set up your profile."
                desc="Create a display name and avatar. No phone number. No email address. Ever."
              />
              <Step
                n="3"
                title="Start talking."
                desc="Find anyone by wallet address. Every message is encrypted end-to-end before it leaves your device."
              />
              <Step
                n="4"
                title="Total control."
                desc="Burn messages on read, set self-destruct timers, revoke sent messages, and send crypto payments in-chat."
              />
            </div>

            <Link
              href="/connect"
              className="inline-flex items-center gap-2 bg-[#1C1C1E] hover:bg-black text-white font-bold text-[15px] px-7 py-3.5 rounded-xl transition-all self-start"
            >
              Start now — it is free
            </Link>
          </motion.div>

          {/* Map Lottie */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASE }}
            className="w-full bg-[#F6F7F9] rounded-[40px] overflow-hidden flex items-center justify-center p-6"
            style={{ aspectRatio: '1/1' }}
          >
            <RemoteLottie path="/lottie/map-world.json" loop width="100%" height="100%" />
          </motion.div>
        </div>
      </section>

      {/* ═══ SECTION 4 — FEATURES ════════════════════════════════════════════ */}
      <section className="bg-[#F6F7F9] py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-5 md:px-10 grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">

          {/* Lottie */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: EASE }}
            className="w-full max-w-[480px] mx-auto bg-white rounded-[40px] border border-black/[0.05] shadow-md overflow-hidden flex items-center justify-center p-8"
            style={{ aspectRatio: '1/1' }}
          >
            <RemoteLottie path="/lottie/message-icon.json" loop width="100%" height="100%" />
          </motion.div>

          {/* Feature list */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="flex flex-col gap-8"
          >
            <div>
              <h2 className="text-[38px] md:text-[52px] font-bold tracking-tight text-[#1C1C1E] mb-5 leading-tight">
                Beyond Messaging.
              </h2>
              <p className="text-[17px] font-medium text-[#1C1C1E]/55 leading-relaxed">
                Ledger Chat includes everything you expect from the world's top messaging apps,
                and adds features that no other app offers today.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <FeatureCheck text="Wallet identity — no phone number required" />
              <FeatureCheck text="In-chat Quantum Dot payments — built-in micro-transactions" />
              <FeatureCheck text="Cryptographic message signing — mathematically guaranteed authenticity" />
              <FeatureCheck text="Burn on Read — messages auto-destroy after viewing" />
              <FeatureCheck text="Voice notes with a real-time waveform visualizer" />
              <FeatureCheck text="Group chats with verified membership" />
              <FeatureCheck text="AI Ghost Mode — smart auto-replies protect your time" />
              <FeatureCheck text="Polls, stickers, animated GIFs, and a personal file vault" />
              <FeatureCheck text="HD video and voice calls — no central server" />
              <FeatureCheck text="Desktop QR session linking — start on mobile, continue on PC" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ SECTION 5 — FEATURE GRID ════════════════════════════════════════ */}
      <section className="bg-white py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          <div className="flex flex-col items-center">

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: EASE }}
              className="w-40 h-40 mb-10 flex items-center justify-center"
            >
              <RemoteLottie path="/lottie/typing.json" loop width={160} height={160} />
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
                Ledger Chat has every feature the most popular messaging apps in the world offer —
                and then adds capabilities that no other app provides today.
              </p>
            </motion.div>

            {/* Feature grid */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl"
            >
              {[
                { icon: <MessageCircle size={22} />, label: "Encrypted Messages", color: "text-[#2C6BED] bg-[#2C6BED]/8" },
                { icon: <Mic size={22} />, label: "HD Voice Calls", color: "text-[#30D158] bg-[#30D158]/8" },
                { icon: <Video size={22} />, label: "Video Calls", color: "text-purple-600 bg-purple-500/8" },
                { icon: <Wallet size={22} />, label: "Crypto Payments", color: "text-orange-500 bg-orange-500/8" },
                { icon: <Flame size={22} />, label: "Disappearing Messages", color: "text-red-500 bg-red-500/8" },
                { icon: <Bot size={22} />, label: "AI Ghost Mode", color: "text-cyan-600 bg-cyan-500/8" },
                { icon: <BarChart2 size={22} />, label: "Polls and Votes", color: "text-emerald-600 bg-emerald-500/8" },
                { icon: <Users size={22} />, label: "Group Chats", color: "text-indigo-600 bg-indigo-500/8" },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  custom={i * 0.05}
                  variants={fadeUp}
                  className="bg-[#F6F7F9] rounded-2xl p-5 flex flex-col items-center gap-3 text-center border border-black/[0.04] hover:border-black/10 transition-colors"
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

      {/* ═══ SECTION 6 — BOTTOM CTA ══════════════════════════════════════════ */}
      <section className="bg-[#F0F4FF] py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-5 md:px-10 flex flex-col items-center text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <div className="w-20 h-20 mx-auto mb-8 bg-[#2C6BED]/10 rounded-3xl flex items-center justify-center">
              <MessageCircle size={36} className="text-[#2C6BED]" strokeWidth={1.5} />
            </div>
            <h2 className="text-[42px] md:text-[60px] font-bold tracking-tight text-[#1C1C1E] mb-6 leading-tight">
              Ready to own your<br />conversations?
            </h2>
            <p className="text-[18px] font-medium text-[#1C1C1E]/55 mb-10 max-w-xl mx-auto leading-relaxed">
              Join the sovereign messaging network. Free forever. No ads. No surveillance. Just you and the people you trust.
            </p>

            <Link
              href="/connect"
              className="inline-flex items-center gap-2 bg-[#2C6BED] hover:bg-[#1A5AE3] text-white font-bold text-[18px] px-10 py-5 rounded-2xl transition-all shadow-lg shadow-[#2C6BED]/25 mb-6"
            >
              <MessageCircle size={20} />
              Get Ledger Chat
            </Link>

            <p className="text-[14px] font-medium text-[#1C1C1E]/40">
              Available on iOS, Android, and Web. Free forever.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <SystemFooter />
    </div>
  );
}
