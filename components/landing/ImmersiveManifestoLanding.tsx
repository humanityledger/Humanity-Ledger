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
  MessageSquare, Bell, Image, Smile
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

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="flex gap-5">
      <div className="w-9 h-9 rounded-full bg-[#1C1C1E] text-white text-[13px] font-black flex items-center justify-center shrink-0 mt-0.5 shadow-md">
        {n}
      </div>
      <div className="flex flex-col gap-1">
        <h4 className="text-[17px] font-bold text-[#1C1C1E]">{title}</h4>
        <p className="text-[15px] font-medium text-[#1C1C1E]/60 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

// ─── App Store Badge (Official look — matches Apple's badge exactly) ──────────
function AppStoreBadge() {
  return (
    <a
      href="#"
      className="inline-flex items-center gap-[10px] bg-black text-white px-[14px] py-[8px] rounded-[10px] border border-white/[0.12] hover:bg-[#111] active:scale-[0.97] transition-all select-none"
      style={{ height: '50px', minWidth: '148px' }}
    >
      {/* Official Apple logo — correct viewBox so the leaf doesn't clip */}
      <svg width="20" height="24" viewBox="0 0 170 209" fill="white" xmlns="http://www.w3.org/2000/svg">
        <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.2-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.75 3.35-4.94.21-9.84-1.96-14.72-6.52-3.13-2.73-7.05-7.41-11.76-14.03-5.04-7.08-9.19-15.29-12.43-24.65-3.47-10.11-5.21-19.9-5.21-29.38 0-10.86 2.35-20.23 7.06-28.1 3.7-6.31 8.63-11.3 14.82-14.99 6.19-3.69 12.87-5.57 20.07-5.69 3.94 0 9.1 1.22 15.53 3.61 6.41 2.4 10.52 3.62 12.32 3.62 1.35 0 5.92-1.43 13.68-4.27 7.33-2.65 13.52-3.75 18.6-3.32 13.75 1.11 24.08 6.52 30.95 16.26-12.29 7.45-18.37 17.87-18.25 31.22.11 10.41 3.88 19.07 11.3 25.95 3.36 3.19 7.11 5.65 11.27 7.4-.9 2.62-1.86 5.12-2.88 7.52zM113.22 3.48c0 8.16-2.98 15.78-8.92 22.84-7.17 8.38-15.84 13.23-25.23 12.47-.12-.98-.19-2-.19-3.07 0-7.83 3.41-16.21 9.46-23.07 3.02-3.48 6.86-6.37 11.52-8.69 4.65-2.29 9.05-3.55 13.18-3.77.12 1.1.18 2.2.18 3.29z"/>
      </svg>
      <div className="flex flex-col text-left leading-none">
        <span className="text-[10px] font-normal opacity-75 tracking-wide mb-[2px]">Download on the</span>
        <span className="text-[19px] font-semibold tracking-[-0.3px]">App Store</span>
      </div>
    </a>
  );
}

// ─── Google Play Badge (Official look — matches Google's badge exactly) ────────
function GooglePlayBadge() {
  return (
    <a
      href="#"
      className="inline-flex items-center gap-[10px] bg-black text-white px-[14px] py-[8px] rounded-[10px] border border-white/[0.12] hover:bg-[#111] active:scale-[0.97] transition-all select-none"
      style={{ height: '50px', minWidth: '162px' }}
    >
      {/* Official Google Play triangle logo */}
      <svg width="24" height="27" viewBox="0 0 40 45" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1.5 0.7L22.1 21.3L1.5 41.9C0.6 41.4 0 40.5 0 39.4V2.2C0 1.1 0.6 0.2 1.5 0.7Z" fill="#4CAF50"/>
        <path d="M33.1 15L22.1 21.3L29.7 28.9L40.6 22.7C41.8 22 41.8 20.7 40.6 20L33.1 15Z" fill="#FFC107"/>
        <path d="M1.5 41.9L22.1 21.3L29.7 28.9L4.2 43.6C2.9 44.4 1.5 43.4 1.5 41.9Z" fill="#F44336"/>
        <path d="M1.5 0.7L22.1 21.3L29.7 13.7L4.2 -1C2.9 -1.8 1.5 -0.8 1.5 0.7Z" fill="#2196F3"/>
      </svg>
      <div className="flex flex-col text-left leading-none">
        <span className="text-[10px] font-normal opacity-75 tracking-[0.08em] uppercase mb-[2px]">Get it on</span>
        <span className="text-[19px] font-semibold tracking-[-0.3px]">Google Play</span>
      </div>
    </a>
  );
}


// ─── Main ────────────────────────────────────────────────────────────────────
export function ImmersiveManifestoLanding({ onOpenScanner }: ImmersiveManifestoLandingProps) {
  return (
    <div className="w-full bg-white font-sans selection:bg-[#2C6BED]/20">
      <LandingNav />

      {/* ═══ SECTION 1 — HERO ═══════════════════════════════════════════════════ */}
      <section className="relative flex items-center bg-white pt-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_100%_at_50%_-20%,rgba(44,107,237,0.07),rgba(255,255,255,0))] pointer-events-none" />
        <div className="absolute top-0 w-full h-[1px] bg-gradient-to-r from-transparent via-black/8 to-transparent" />

        <div className="max-w-7xl mx-auto px-5 md:px-10 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center py-20 lg:py-28">

          {/* Left: Copy */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="flex flex-col items-center text-center lg:items-start lg:text-left lg:col-span-7 relative z-10"
          >


            <h1 className="text-[52px] md:text-[72px] lg:text-[88px] font-black leading-[0.95] tracking-[-0.04em] text-[#050505] mb-6">
              The private<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2C6BED] to-[#6E95F5]">messenger</span><br />
              you always wanted.
            </h1>

            <p className="text-[18px] md:text-[21px] font-medium leading-[1.6] text-[#1C1C1E]/60 mb-10 max-w-[520px]">
              Ledger Chat is the private messenger for people who value their freedom.
              No phone number. No blockchain fees to send messages. No surveillance. Just signal.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mb-8">
              <Link
                href="/chat"
                className="bg-[#1A1A1A] hover:bg-black text-white font-bold text-[16px] px-8 py-4 rounded-2xl transition-all shadow-[0_8px_24px_rgba(0,0,0,0.12)] flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95"
              >
                <MessageCircle size={20} />
                Open Ledger Chat
              </Link>
              <Link
                href="#how-it-works"
                className="bg-white hover:bg-[#F6F7F9] text-[#050505] border border-black/10 font-bold text-[16px] px-8 py-4 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95"
              >
                How it works
              </Link>
            </div>

            {/* App Store + Google Play badges */}
            <div className="flex flex-row flex-wrap gap-3 justify-center lg:justify-start mb-10">
              <AppStoreBadge />
              <GooglePlayBadge />
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap justify-center lg:justify-start items-center gap-x-6 gap-y-3">
              {[
                { icon: <Lock size={14} />, label: "End to end encrypted" },
                { icon: <Shield size={14} />, label: "No phone number needed" },
                { icon: <Globe size={14} />, label: "Works on any device" },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2 text-[13px] font-bold text-[#1C1C1E]/45">
                  <span className="text-[#1C1C1E]/60">{f.icon}</span>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: Phone mockup with Lottie */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: EASE }}
            className="relative w-full flex items-center justify-center lg:col-span-5"
          >
            <div className="relative w-full max-w-[400px] mx-auto">
              <div className="absolute inset-0 bg-[#2C6BED] blur-[100px] opacity-8 rounded-full" />
              <div className="relative bg-white/40 backdrop-blur-3xl border border-white/60 rounded-[48px] shadow-[0_40px_100px_rgba(44,107,237,0.10),inset_0_2px_10px_rgba(255,255,255,0.8)] p-2">
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

      {/* ═══ SECTION 2 — WHAT IS LEDGER CHAT ════════════════════════════════════ */}
      <section className="bg-[#F6F7F9] py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-5 md:px-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="text-[38px] md:text-[54px] font-bold tracking-tight text-[#1C1C1E] mb-5 leading-tight">
              What is Ledger Chat?
            </h2>
            <p className="text-[18px] md:text-[20px] font-medium text-[#1C1C1E]/55 max-w-2xl mx-auto leading-relaxed">
              Ledger Chat is a private messaging app built from the ground up to keep your conversations
              between you and the people you choose. Nothing more.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <MessageCircle size={26} strokeWidth={2} />,
                color: "text-[#2C6BED]",
                bg: "bg-[#2C6BED]/8",
                title: "Private by default.",
                desc: "Every message you send is locked on your device before it travels anywhere. Only the person you are writing to holds the key to read it. No one else — not us, not any government, not any server — can read your messages.",
              },
              {
                icon: <Fingerprint size={26} strokeWidth={2} />,
                color: "text-[#30D158]",
                bg: "bg-[#30D158]/10",
                title: "No phone number required.",
                desc: "You connect to Ledger Chat using a digital wallet — a small file on your device that acts as your identity. You do not need a SIM card, a phone number, or an email address. Your account belongs entirely to you.",
              },
              {
                icon: <Globe size={26} strokeWidth={2} />,
                color: "text-purple-600",
                bg: "bg-purple-500/8",
                title: "No servers store your data.",
                desc: "Messages travel directly between people rather than through a central company server. This means there is no database of your conversations that can be hacked, sold, or handed to anyone.",
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

      {/* ═══ SECTION 3 — HOW IT WORKS (Step by Step) ════════════════════════════ */}
      <section id="how-it-works" className="bg-white py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-5 md:px-10 grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="flex flex-col gap-10"
          >
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.2em] text-[#2C6BED] mb-4">Step by step</p>
              <h2 className="text-[38px] md:text-[52px] font-bold tracking-tight text-[#1C1C1E] mb-5 leading-tight">
                How to start<br />chatting in minutes.
              </h2>
              <p className="text-[17px] font-medium text-[#1C1C1E]/55 leading-relaxed">
                You do not need any technical knowledge. Anyone who can use a smartphone can set up
                Ledger Chat in under three minutes.
              </p>
            </div>

            <div className="flex flex-col gap-8">
              <Step
                n="1"
                title="Download the app."
                desc="Ledger Chat is free forever. No subscription, no blockchain fees to chat. There are no hidden fees or premium tiers for private messaging."
              />
              <Step
                n="2"
                title="Create your identity."
                desc="Tap 'Create Wallet' when the app opens. Your device generates a unique key pair in under a second. This is your account. Write down the recovery phrase shown to you and store it safely — this is the only thing that can restore your account."
              />
              <Step
                n="3"
                title="Find someone to talk to."
                desc="Share your Ledger Chat address with a friend, or search for someone by their address directly in the app. You can also scan a QR code in person to add a contact instantly."
              />
              <Step
                n="4"
                title="Start the conversation."
                desc="Tap on a contact and start writing. Your message is encrypted the moment you press Send. It arrives on their device and only their device. You can also make voice and video calls in the same conversation."
              />
            </div>

            <div className="flex flex-row gap-3 flex-wrap">
              <AppStoreBadge />
              <GooglePlayBadge />
            </div>
          </motion.div>

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

      {/* ═══ SECTION 4 — HOW IT DIFFERS FROM OTHER APPS ═════════════════════════ */}
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
              Most messaging apps are built around advertising revenue. Ledger Chat is built
              around you.
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
              ["Messages encrypted End to end", true, true, false],
              ["No ads, ever", true, true, false],
              ["No company can read your messages", true, false, false],
              ["No data collected about you", true, false, false],
              ["Send money in a conversation", true, false, false],
              ["Voice and video calls", true, true, true],
              ["Group communities", true, true, true],
              ["Account never tied to your real identity", true, false, false],
            ].map(([label, lc, wa, tg], i) => (
              <div key={String(label)} className={`grid grid-cols-4 px-6 py-4 items-center ${i % 2 === 0 ? '' : 'bg-[#FAFAFA]'} border-b border-black/[0.03] last:border-0`}>
                <span className="text-[15px] font-medium text-[#1C1C1E]/80">{String(label)}</span>
                <div className="flex justify-center">
                  {lc ? <Check size={18} strokeWidth={3} className="text-[#30D158]" /> : <span className="text-black/20 text-lg">—</span>}
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

      {/* ═══ SECTION 4.5 — ACCESSIBILITY & THE NEXT STEP ═══════════════════════ */}
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
                <p className="text-[12px] font-black uppercase tracking-[0.2em] text-[#2C6BED] mb-4">The Next Step in Humanity</p>
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
                    <CheckCircle2 size={20} className="text-[#30D158]" />
                  </div>
                  <h4 className="text-[17px] font-bold text-[#1C1C1E] mb-2">No passwords</h4>
                  <p className="text-[15px] font-medium text-[#1C1C1E]/60">Your device itself unlocks the app using your face or fingerprint. Nothing to remember, nothing to lose.</p>
                </div>
                <div className="bg-[#F6F7F9] p-6 rounded-2xl">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                    <Smile size={20} className="text-[#2C6BED]" />
                  </div>
                  <h4 className="text-[17px] font-bold text-[#1C1C1E] mb-2">Comfortable to read</h4>
                  <p className="text-[15px] font-medium text-[#1C1C1E]/60">Clean typography, high contrast colors, and an interface that scales perfectly if you need larger text.</p>
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
              <div className="absolute inset-0 bg-gradient-to-tr from-[#2C6BED]/5 to-transparent" />
              <div className="text-center relative z-10 max-w-sm">
                <h3 className="text-[24px] font-bold text-[#1C1C1E] mb-4">"It just works."</h3>
                <p className="text-[16px] font-medium text-[#1C1C1E]/55">
                  We have taken the most advanced security in the world and hidden it entirely behind an interface that feels as familiar and welcoming as writing a letter.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 5 — FEATURES ════════════════════════════════════════════════ */}
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
              <FeatureCheck text="Send money to anyone in your contacts, instantly and for free" />
              <FeatureCheck text="React to messages with any emoji" />
              <FeatureCheck text="Share your location safely for a limited time only" />
              <FeatureCheck text="Create polls to collect opinions from a group" />
              <FeatureCheck text="Start encrypted audio and video calls from any conversation" />
              <FeatureCheck text="Use a QR code to add contacts when you meet in person" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ SECTION 6 — PLATFORM REQUIREMENTS ══════════════════════════════════ */}
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
                color: "text-[#2C6BED]",
                bg: "bg-[#2C6BED]/8",
              },
              {
                icon: <Smartphone size={28} />,
                title: "Android",
                sub: "Requires Android 10 or later",
                badge: "Google Play — Coming Soon",
                color: "text-[#30D158]",
                bg: "bg-[#30D158]/8",
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

      {/* ═══ SECTION 7 — WHAT IS NEW ═════════════════════════════════════════════ */}
      <section className="bg-white py-24 md:py-32">
        <div className="max-w-4xl mx-auto px-5 md:px-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-14"
          >
            <p className="text-[12px] font-black uppercase tracking-[0.2em] text-[#2C6BED] mb-4">Latest updates</p>
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
                title: "Communities with rich announcements",
                desc: "Group administrators can now write and publish formatted announcements with images, bold text, and bullet points — similar to a publication inside the group.",
                color: "bg-[#2C6BED] text-white",
              },
              {
                tag: "Improved",
                title: "Group invite links that you control",
                desc: "Share a single link to invite people to a group. If you change your mind, revoke the link in one tap and it stops working immediately. Private groups block new entries automatically when you close them.",
                color: "bg-[#30D158] text-white",
              },
              {
                tag: "New",
                title: "Communities with free and paid channels",
                desc: "Create a community with multiple channels. Choose which are free for everyone and which require a one-time unlock or monthly subscription. No competitor offers this combination with crypto-native payments in the same space.",
                color: "bg-purple-600 text-white",
              },
              {
                tag: "Improved",
                title: "Total Control in Your Hands",
                desc: "Every option in the Settings screen now has a visible effect on your account. Change your theme, adjust your privacy level, toggle notifications or message previews, and see the result immediately.",
                color: "bg-orange-500 text-white",
              },
              {
                tag: "Security",
                title: "End to end encrypted by default, no setup required",
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
                className="flex gap-5 bg-[#FAFAFA] border border-black/[0.05] rounded-2xl px-6 py-5 items-start hover:border-black/10 transition-colors"
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

      {/* ═══ SECTION 8 — FEATURE GRID ════════════════════════════════════════════ */}
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
                { icon: <MessageSquare size={22} />, label: "Private Messages", color: "text-[#2C6BED] bg-[#2C6BED]/8" },
                { icon: <Mic size={22} />, label: "Voice Calls", color: "text-[#30D158] bg-[#30D158]/8" },
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

      {/* ═══ SECTION 9 — BOTTOM CTA ══════════════════════════════════════════════ */}
      <section className="bg-white py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-5 md:px-10 flex flex-col items-center text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="flex flex-col items-center"
          >
            <div className="w-20 h-20 mx-auto mb-8 bg-[#1C1C1E] rounded-3xl flex items-center justify-center shadow-xl">
              <MessageCircle size={34} className="text-white" strokeWidth={1.8} />
            </div>
            <h2 className="text-[42px] md:text-[60px] font-bold tracking-tight text-[#1C1C1E] mb-6 leading-tight">
              Ready to start?
            </h2>
            <p className="text-[18px] font-medium text-[#1C1C1E]/55 mb-10 max-w-xl mx-auto leading-relaxed">
              Ledger Chat is free, requires no sign up form, no email, and no phone number.
              Open it in your browser right now. Mobile apps for iOS &amp; Android are coming soon.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 bg-[#1C1C1E] hover:bg-black text-white font-bold text-[17px] px-10 py-4 rounded-2xl transition-all shadow-lg active:scale-95"
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
              Free forever. No ads. No subscriptions. No data sold.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <SystemFooter />
    </div>
  );
}



