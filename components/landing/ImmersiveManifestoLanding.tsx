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
      
      <LedgerShowcase />

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
                  <p className="text-[15px] font-medium text-[#1C1C1E]/60">Your device itself unlocks the app using your face or fingerprint. Nothing to remember, nothing to lose.</p>
                </div>
                <div className="bg-[#F6F7F9] p-6 rounded-2xl">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                    <Smile size={20} className="text-[#25D366]" />
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
              <div className="absolute inset-0 bg-gradient-to-tr from-[#25D366]/5 to-transparent" />
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

      {/* ═══ SECTION 7 — PROTOCOL EXPLAINED ═══════════════════════════════════ */}
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
            {/* Protocol steps */}
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
                desc: "Communities live in a PostgreSQL database for their structure (channels, members, roles, posts). Chat inside a Community channel travels over XMTP with the same end-to-end encryption as direct messages. Paid channel access is verified on-chain — the admin's wallet receives the payment, not Humanity Ledger.",
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

      {/* ═══ SECTION 7.5 — LATEST UPDATES ═══════════════════════════════════ */}
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



