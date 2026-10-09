"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { HLLogo } from "@/components/shared/HLLogo";
import { SystemFooter } from "./SystemFooter";
import { RemoteLottie } from "@/components/ui/RemoteLottie";
import {
  Lock, Shield, Check, MessageCircle,
  Fingerprint, Globe, Mic, Video, BarChart2,
  Wallet, Users, Smartphone, ArrowRight,
  MessageSquare, Bell, Image, Zap, ShieldCheck
} from "lucide-react";

export interface ImmersiveManifestoLandingProps {
  onOpenScanner?: () => void;
  hideMap?: boolean;
}

const EASE = [0.16, 1, 0.3, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (d: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: EASE, delay: d },
  }),
};

// ─── Cursor Radial Glow Background ───────────────────────────────────────────
function CursorGlowBackground({ dark = false }: { dark?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const springX = useSpring(mouseX, { stiffness: 60, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 60, damping: 20 });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  }, [mouseX, mouseY]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("mousemove", handleMouseMove);
    return () => el.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  const glowColor = dark ? "rgba(37,211,102,0.08)" : "rgba(37,211,102,0.07)";

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bgGradient = useTransform(
    [springX, springY],
    (values: number[]) =>
      `radial-gradient(900px circle at ${values[0] * 100}% ${values[1] * 100}%, ${glowColor}, transparent 60%)`
  );

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {/* Static noise grain */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />
      {/* Cursor radial glow */}
      <motion.div
        className="absolute inset-0"
        style={{ background: bgGradient }}
      />
      {/* Subtle dot grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.055)"} 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />
      {/* Ambient blobs */}
      <div
        className={`absolute -top-64 -right-64 w-[700px] h-[700px] rounded-full blur-[120px] opacity-[0.06] ${dark ? "bg-[#25D366]" : "bg-[#25D366]"}`}
      />
      <div
        className={`absolute -bottom-64 -left-64 w-[500px] h-[500px] rounded-full blur-[120px] opacity-[0.04] ${dark ? "bg-white" : "bg-black"}`}
      />
    </div>
  );
}

// ─── Magnetic Card ────────────────────────────────────────────────────────────
function MagneticCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springRotateX = useSpring(rotateX, { stiffness: 120, damping: 20 });
  const springRotateY = useSpring(rotateY, { stiffness: 120, damping: 20 });

  const handleMouse = (e: React.MouseEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    rotateX.set(((e.clientY - cy) / rect.height) * -8);
    rotateY.set(((e.clientX - cx) / rect.width) * 8);
  };

  const resetMouse = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouse}
      onMouseLeave={resetMouse}
      style={{
        rotateX: springRotateX,
        rotateY: springRotateY,
        transformStyle: "preserve-3d",
        perspective: 1000,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

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
        scrolled
          ? "bg-white/90 backdrop-blur-2xl border-b border-black/[0.06] shadow-[0_1px_0_rgba(0,0,0,0.04)]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10 h-[68px] flex items-center justify-between">
        <HLLogo size={28} />
        <div className="hidden md:flex items-center gap-8">
          <Link href="#how-it-works" className="text-[14px] font-medium text-black/50 hover:text-black transition-colors tracking-[-0.01em]">How it works</Link>
          <Link href="#features" className="text-[14px] font-medium text-black/50 hover:text-black transition-colors tracking-[-0.01em]">Features</Link>
          <Link href="/docs/whitepaper" className="text-[14px] font-medium text-black/50 hover:text-black transition-colors tracking-[-0.01em]">Whitepaper</Link>
        </div>
        <div className="flex items-center gap-3">
          {connectedAddress ? (
            <>
              <Link href="/chat" className="text-[14px] font-semibold text-black px-4 py-2 rounded-xl hover:bg-black/5 transition-colors">
                Open Chat
              </Link>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-[13px] font-medium text-black/40 hover:text-red-500 transition-colors px-2"
              >
                {disconnecting ? "…" : fmtAddr(connectedAddress)}
              </button>
            </>
          ) : (
            <Link
              href="/connect"
              className="group bg-black hover:bg-[#111] text-white text-[14px] font-semibold px-5 py-2.5 rounded-xl transition-all shadow-[0_2px_12px_rgba(0,0,0,0.18)] active:scale-95 flex items-center gap-2"
            >
              Get Started
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="flex gap-5 group">
      <div className="relative shrink-0 mt-0.5">
        <div className="w-9 h-9 rounded-full bg-black text-white text-[13px] font-black flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.15)] group-hover:shadow-[0_4px_20px_rgba(37,211,102,0.3)] transition-shadow duration-300">
          {n}
        </div>
        <div className="absolute inset-0 rounded-full bg-[#25D366] opacity-0 group-hover:opacity-10 transition-opacity blur-sm" />
      </div>
      <div className="flex flex-col gap-1 pb-8">
        <h4 className="text-[17px] font-bold text-[#0A0A0A] tracking-[-0.02em]">{title}</h4>
        <p className="text-[15px] font-medium text-black/50 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function FeatureCheck({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 group">
      <div className="w-5 h-5 rounded-full border border-[#25D366]/40 bg-[#25D366]/8 flex items-center justify-center shrink-0 mt-[3px] group-hover:bg-[#25D366]/15 transition-colors">
        <Check size={10} strokeWidth={3} className="text-[#25D366]" />
      </div>
      <span className="text-[16px] font-medium text-black/65 leading-snug group-hover:text-black/80 transition-colors">{text}</span>
    </div>
  );
}

function AppStoreBadge() {
  return (
    <a
      href="#"
      className="inline-flex items-center gap-[10px] bg-black text-white px-[14px] py-[8px] rounded-[12px] border border-white/[0.12] hover:bg-[#111] hover:border-white/20 active:scale-[0.97] transition-all select-none shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
      style={{ height: '50px', minWidth: '148px' }}
    >
      <svg width="20" height="24" viewBox="0 0 170 209" fill="white" xmlns="http://www.w3.org/2000/svg">
        <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.2-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.75 3.35-4.94.21-9.84-1.96-14.72-6.52-3.13-2.73-7.05-7.41-11.76-14.03-5.04-7.08-9.19-15.29-12.43-24.65-3.47-10.11-5.21-19.9-5.21-29.38 0-10.86 2.35-20.23 7.06-28.1 3.7-6.31 8.63-11.3 14.82-14.99 6.19-3.69 12.87-5.57 20.07-5.69 3.94 0 9.1 1.22 15.53 3.61 6.41 2.4 10.52 3.62 12.32 3.62 1.35 0 5.92-1.43 13.68-4.27 7.33-2.65 13.52-3.75 18.6-3.32 13.75 1.11 24.08 6.52 30.95 16.26-12.29 7.45-18.37 17.87-18.25 31.22.11 10.41 3.88 19.07 11.3 25.95 3.36 3.19 7.11 5.65 11.27 7.4-.9 2.62-1.86 5.12-2.88 7.52zM113.22 3.48c0 8.16-2.98 15.78-8.92 22.84-7.17 8.38-15.84 13.23-25.23 12.47-.12-.98-.19-2-.19-3.07 0-7.83 3.41-16.21 9.46-23.07 3.02-3.48 6.86-6.37 11.52-8.69 4.65-2.29 9.05-3.55 13.18-3.77.12 1.1.18 2.2.18 3.29z"/>
      </svg>
      <div className="flex flex-col text-left leading-none">
        <span className="text-[10px] font-normal opacity-60 tracking-wide mb-[2px]">Download on the</span>
        <span className="text-[18px] font-semibold tracking-[-0.3px]">App Store</span>
      </div>
    </a>
  );
}

function GooglePlayBadge() {
  return (
    <a
      href="#"
      className="inline-flex items-center gap-[10px] bg-black text-white px-[14px] py-[8px] rounded-[12px] border border-white/[0.12] hover:bg-[#111] hover:border-white/20 active:scale-[0.97] transition-all select-none shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
      style={{ height: '50px', minWidth: '162px' }}
    >
      <svg width="24" height="27" viewBox="0 0 40 45" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1.5 0.7L22.1 21.3L1.5 41.9C0.6 41.4 0 40.5 0 39.4V2.2C0 1.1 0.6 0.2 1.5 0.7Z" fill="#4CAF50"/>
        <path d="M33.1 15L22.1 21.3L29.7 28.9L40.6 22.7C41.8 22 41.8 20.7 40.6 20L33.1 15Z" fill="#FFC107"/>
        <path d="M1.5 41.9L22.1 21.3L29.7 28.9L4.2 43.6C2.9 44.4 1.5 43.4 1.5 41.9Z" fill="#F44336"/>
        <path d="M1.5 0.7L22.1 21.3L29.7 13.7L4.2 -1C2.9 -1.8 1.5 -0.8 1.5 0.7Z" fill="#2196F3"/>
      </svg>
      <div className="flex flex-col text-left leading-none">
        <span className="text-[10px] font-normal opacity-60 tracking-[0.08em] uppercase mb-[2px]">Get it on</span>
        <span className="text-[18px] font-semibold tracking-[-0.3px]">Google Play</span>
      </div>
    </a>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function ImmersiveManifestoLanding({ onOpenScanner }: ImmersiveManifestoLandingProps) {
  return (
    <div className="w-full bg-[#FAFAFA] font-sans selection:bg-[#25D366]/20" style={{ fontFeatureSettings: '"ss01","cv01"' }}>
      <LandingNav />

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1 — HERO
      ══════════════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center bg-white overflow-hidden">
        <CursorGlowBackground />

        {/* Thin top border */}
        <div className="absolute top-0 w-full h-px bg-gradient-to-r from-transparent via-black/8 to-transparent" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 w-full grid grid-cols-1 lg:grid-cols-12 gap-16 items-center py-32 lg:py-40">

          {/* Left copy */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="lg:col-span-7 flex flex-col items-center text-center lg:items-start lg:text-left"
          >
            {/* Eyebrow pill */}
            <div className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full border border-black/[0.08] bg-white/80 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" />
              <span className="text-[12px] font-semibold tracking-[0.08em] uppercase text-black/50">Protocol Active — Mainnet</span>
            </div>

            <h1
              className="text-[58px] md:text-[76px] lg:text-[92px] font-black leading-[0.93] tracking-[-0.04em] text-[#0A0A0A] mb-8"
              style={{ letterSpacing: "-0.04em" }}
            >
              The private<br />
              <span className="relative">
                <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-br from-[#0A0A0A] via-[#25D366] to-[#0A0A0A]">
                  messenger
                </span>
              </span>
              <br />
              you own entirely.
            </h1>

            <p className="text-[19px] md:text-[21px] font-medium leading-[1.65] text-black/45 mb-10 max-w-[520px]">
              Communicate securely, join exclusive communities, and transfer digital assets
              with zero network fees. No phone number. No central servers. No surveillance.
            </p>

            {/* CTA row */}
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mb-10">
              <Link
                href="/chat"
                className="group relative overflow-hidden bg-[#0A0A0A] hover:bg-[#111] text-white font-bold text-[16px] px-8 py-4 rounded-2xl transition-all shadow-[0_8px_32px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.08)] flex items-center justify-center gap-2.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.22)] active:scale-[0.98]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#25D366]/0 via-[#25D366]/10 to-[#25D366]/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                <MessageCircle size={18} />
                <span className="relative">Open Ledger Chat</span>
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="#how-it-works"
                className="bg-white hover:bg-[#F8F8F8] text-[#0A0A0A] border border-black/[0.1] font-semibold text-[16px] px-8 py-4 rounded-2xl transition-all shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex items-center justify-center gap-2 hover:border-black/20 active:scale-[0.98]"
              >
                How it works
              </Link>
            </div>

            {/* App badges */}
            <div className="flex flex-row flex-wrap gap-3 justify-center lg:justify-start mb-10">
              <AppStoreBadge />
              <GooglePlayBadge />
            </div>

            {/* Trust chips */}
            <div className="flex flex-wrap justify-center lg:justify-start items-center gap-x-6 gap-y-2">
              {[
                { icon: <Lock size={13} />, label: "End-to-End Encrypted" },
                { icon: <Shield size={13} />, label: "No phone number required" },
                { icon: <Zap size={13} />, label: "Zero gas fees" },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2 text-[13px] font-semibold text-black/35">
                  <span className="text-black/40">{f.icon}</span>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right — floating phone */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1.1, delay: 0.15, ease: EASE }}
            className="lg:col-span-5 relative w-full flex items-center justify-center"
          >
            <MagneticCard className="relative w-full max-w-[380px] mx-auto">
              {/* Glow */}
              <div className="absolute -inset-8 bg-[#25D366]/10 blur-[80px] rounded-full pointer-events-none" />
              {/* Card */}
              <div className="relative bg-white border border-black/[0.06] rounded-[40px] shadow-[0_32px_80px_rgba(0,0,0,0.10),0_8px_24px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] p-1.5">
                <div
                  className="bg-[#FAFAFA] rounded-[32px] overflow-hidden flex items-center justify-center border border-black/[0.03]"
                  style={{ aspectRatio: "4/5" }}
                >
                  <RemoteLottie path="/lottie/texting.json" loop width="100%" height="100%" />
                </div>
              </div>
              {/* Floating badges */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-4 -right-4 bg-white rounded-2xl px-4 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-black/[0.06] flex items-center gap-2"
              >
                <ShieldCheck size={16} className="text-[#25D366]" />
                <span className="text-[13px] font-bold text-[#0A0A0A]">Fully encrypted</span>
              </motion.div>
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute -bottom-4 -left-4 bg-white rounded-2xl px-4 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-black/[0.06] flex items-center gap-2"
              >
                <Zap size={16} className="text-[#25D366]" />
                <span className="text-[13px] font-bold text-[#0A0A0A]">Zero network fees</span>
              </motion.div>
            </MagneticCard>
          </motion.div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#FAFAFA] to-transparent pointer-events-none" />
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2 — THREE PILLARS
      ══════════════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#FAFAFA] py-28 md:py-36">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-20"
          >
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-black/30 mb-4">Foundation</p>
            <h2 className="text-[40px] md:text-[56px] font-black tracking-[-0.04em] text-[#0A0A0A] mb-5 leading-[0.95]">
              Redesigned from first principles.
            </h2>
            <p className="text-[18px] md:text-[20px] font-medium text-black/45 max-w-xl mx-auto leading-relaxed">
              Ledger Chat is built on decentralized infrastructure with cryptographic guarantees that no corporate platform can match.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: <Lock size={24} strokeWidth={1.8} />,
                accent: "#25D366",
                label: "01",
                title: "Private by default.",
                desc: "Every message is encrypted client-side using the XMTP protocol before it leaves your device. Only the intended recipient holds the cryptographic key to decrypt it. Not us, not any server, not any government.",
              },
              {
                icon: <Fingerprint size={24} strokeWidth={1.8} />,
                accent: "#0A0A0A",
                label: "02",
                title: "Your wallet, your identity.",
                desc: "Authentication is anchored to your cryptographic keypair, eliminating reliance on phone numbers, email addresses, or passwords. Your account is sovereign, portable, and exclusively yours.",
              },
              {
                icon: <Globe size={24} strokeWidth={1.8} />,
                accent: "#25D366",
                label: "03",
                title: "Zero central servers.",
                desc: "Messages are routed through a decentralized node network. We subsidize the underlying infrastructure so you never pay gas fees. There is no central database to breach, monetize, or subpoena.",
              },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i * 0.1}
                variants={fadeUp}
              >
                <MagneticCard className="h-full bg-white rounded-3xl p-8 border border-black/[0.06] shadow-[0_2px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] hover:border-black/10 transition-all duration-500 group cursor-default">
                  <div className="flex flex-col h-full">
                    <div className="flex items-start justify-between mb-8">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 duration-300"
                        style={{ background: `${card.accent}12`, color: card.accent }}
                      >
                        {card.icon}
                      </div>
                      <span className="text-[11px] font-black tracking-[0.12em] text-black/20">{card.label}</span>
                    </div>
                    <h3 className="text-[21px] font-black tracking-[-0.03em] text-[#0A0A0A] mb-4 leading-tight">{card.title}</h3>
                    <p className="text-[15px] font-medium text-black/50 leading-relaxed flex-1">{card.desc}</p>
                    <div className="mt-8 h-px bg-gradient-to-r from-transparent via-black/8 to-transparent" />
                  </div>
                </MagneticCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3 — HOW IT WORKS (Dark)
      ══════════════════════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="relative bg-[#0A0A0A] py-28 md:py-36 overflow-hidden">
        <CursorGlowBackground dark />

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 grid grid-cols-1 lg:grid-cols-2 gap-20 items-start">

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="flex flex-col gap-4 sticky top-32"
          >
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/25">Protocol</p>
            <h2 className="text-[40px] md:text-[54px] font-black tracking-[-0.04em] text-white leading-[0.95]">
              Up and running<br />in 60 seconds.
            </h2>
            <p className="text-[18px] font-medium text-white/40 leading-relaxed max-w-[400px]">
              No crypto expertise required. The protocol is engineered for immediate adoption by anyone, anywhere.
            </p>
            <div className="mt-8">
              <Link
                href="/chat"
                className="group inline-flex items-center gap-2.5 bg-[#25D366] hover:bg-[#22c55e] text-white font-bold text-[16px] px-7 py-3.5 rounded-2xl transition-all shadow-[0_8px_32px_rgba(37,211,102,0.25)] hover:shadow-[0_12px_40px_rgba(37,211,102,0.35)] active:scale-[0.98]"
              >
                Open Ledger Chat
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="flex flex-col"
          >
            <Step
              n="01"
              title="Access the client."
              desc="Ledger Chat is entirely free. We subsidize the decentralized network infrastructure so you never pay gas fees to communicate. Open it now in any browser."
            />
            <Step
              n="02"
              title="Generate your identity."
              desc="Tap 'Create Wallet' to instantly generate a secure cryptographic keypair on your device. This becomes your decentralized identity. Preserve your recovery phrase — it is the sole mechanism for account restoration."
            />
            <Step
              n="03"
              title="Establish connections."
              desc="Share your unique address, scan a QR code in person, or discover peers through the public directory. Connections are cryptographically verified."
            />
            <Step
              n="04"
              title="Communicate and transact."
              desc="Exchange messages, initiate encrypted calls, or route digital assets directly within the conversation. All operations are end-to-end encrypted and settled at zero cost to you."
            />
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4 — COMPARISON TABLE
      ══════════════════════════════════════════════════════════════════════════ */}
      <section className="bg-white py-28 md:py-36">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-black/30 mb-4">Comparison</p>
            <h2 className="text-[40px] md:text-[54px] font-black tracking-[-0.04em] text-[#0A0A0A] mb-5 leading-[0.95]">
              Built different.<br />Uncompromisingly so.
            </h2>
            <p className="text-[18px] font-medium text-black/45 max-w-xl mx-auto leading-relaxed">
              Corporate platforms were engineered around advertising revenue. Ledger Chat was engineered around you.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="bg-white rounded-3xl border border-black/[0.07] shadow-[0_4px_40px_rgba(0,0,0,0.06)] overflow-hidden"
          >
            {/* Header */}
            <div className="grid grid-cols-4 bg-[#FAFAFA] border-b border-black/[0.06] px-8 py-5">
              <div className="text-[11px] font-black uppercase tracking-[0.12em] text-black/25">Capability</div>
              <div className="text-[11px] font-black uppercase tracking-[0.12em] text-[#0A0A0A] text-center">Ledger Chat</div>
              <div className="text-[11px] font-black uppercase tracking-[0.12em] text-black/25 text-center">WhatsApp</div>
              <div className="text-[11px] font-black uppercase tracking-[0.12em] text-black/25 text-center">Telegram</div>
            </div>
            {[
              ["No phone number required", true, false, false],
              ["End-to-End Encrypted by default", true, true, false],
              ["Zero advertisements, ever", true, true, false],
              ["We cannot read your messages", true, false, false],
              ["No data collected or sold", true, false, false],
              ["Send crypto within conversations", true, false, false],
              ["Encrypted voice and video calls", true, true, true],
              ["Community groups and channels", true, true, true],
              ["Zero network fees to message", true, false, false],
              ["No KYC or real-world identity linkage", true, false, false],
            ].map(([label, lc, wa, tg], i) => (
              <div
                key={String(label)}
                className={`grid grid-cols-4 px-8 py-4 items-center border-b border-black/[0.04] last:border-0 ${i % 2 === 1 ? 'bg-[#FAFAFA]/60' : ''}`}
              >
                <span className="text-[15px] font-medium text-[#0A0A0A]/75 pr-4">{String(label)}</span>
                <div className="flex justify-center">
                  {lc
                    ? <div className="w-5 h-5 rounded-full bg-[#25D366]/10 flex items-center justify-center"><Check size={11} strokeWidth={3} className="text-[#25D366]" /></div>
                    : <span className="text-black/15 text-lg leading-none">—</span>}
                </div>
                <div className="flex justify-center">
                  {wa
                    ? <div className="w-5 h-5 rounded-full bg-black/5 flex items-center justify-center"><Check size={11} strokeWidth={3} className="text-black/30" /></div>
                    : <span className="text-black/15 text-lg leading-none">—</span>}
                </div>
                <div className="flex justify-center">
                  {tg
                    ? <div className="w-5 h-5 rounded-full bg-black/5 flex items-center justify-center"><Check size={11} strokeWidth={3} className="text-black/30" /></div>
                    : <span className="text-black/15 text-lg leading-none">—</span>}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 5 — FEATURES
      ══════════════════════════════════════════════════════════════════════════ */}
      <section id="features" className="relative bg-[#FAFAFA] py-28 md:py-36 overflow-hidden">
        <CursorGlowBackground />

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">

          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: EASE }}
            className="w-full max-w-[480px] mx-auto"
          >
            <MagneticCard className="bg-white border border-black/[0.06] rounded-[40px] shadow-[0_8px_48px_rgba(0,0,0,0.07)] overflow-hidden flex items-center justify-center p-10" style={{ aspectRatio: "1/1" } as any}>
              <RemoteLottie path="/lottie/message-icon.json" loop width="100%" height="100%" />
            </MagneticCard>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="flex flex-col gap-8"
          >
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-black/30 mb-4">Capabilities</p>
              <h2 className="text-[40px] md:text-[52px] font-black tracking-[-0.04em] text-[#0A0A0A] mb-5 leading-[0.95]">
                Everything modern.<br />Nothing exploitative.
              </h2>
              <p className="text-[17px] font-medium text-black/45 leading-relaxed">
                Full parity with centralized messengers, entirely stripped of telemetry, tracking, and surveillance architecture.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <FeatureCheck text="Transmit text, high-resolution media, voice notes, and encrypted files" />
              <FeatureCheck text="Establish high-fidelity, peer-to-peer voice and video calls" />
              <FeatureCheck text="Deploy scalable group chats and token-gated community channels" />
              <FeatureCheck text="Autonomous ephemeral messages with configurable burn timers" />
              <FeatureCheck text="Route USDC and ETH peer-to-peer with zero network fees" />
              <FeatureCheck text="Rich emoji reactions with cryptographic verification" />
              <FeatureCheck text="Encrypted, ephemeral location sharing with strict expiry" />
              <FeatureCheck text="Trustless consensus polls within communities" />
              <FeatureCheck text="Secure in-person handshakes via dynamic QR code scanning" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 6 — PLATFORMS (Dark)
      ══════════════════════════════════════════════════════════════════════════ */}
      <section className="relative bg-[#0A0A0A] py-28 md:py-36 overflow-hidden">
        <CursorGlowBackground dark />

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/25 mb-4">Availability</p>
            <h2 className="text-[40px] md:text-[54px] font-black tracking-[-0.04em] text-white mb-5 leading-[0.95]">
              Wherever you are.
            </h2>
            <p className="text-[18px] font-medium text-white/40 max-w-lg mx-auto leading-relaxed">
              The client synchronizes your encrypted state across every authenticated device, seamlessly.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              {
                icon: <Smartphone size={26} strokeWidth={1.6} />,
                title: "iOS",
                sub: "iOS 16 or later",
                badge: "App Store — Coming Soon",
                accent: "#25D366",
              },
              {
                icon: <Smartphone size={26} strokeWidth={1.6} />,
                title: "Android",
                sub: "Android 10 or later",
                badge: "Google Play — Coming Soon",
                accent: "#25D366",
              },
              {
                icon: <Globe size={26} strokeWidth={1.6} />,
                title: "Web Client",
                sub: "Chrome, Safari, Firefox",
                badge: "Live at humanidfi.com",
                accent: "#25D366",
              },
            ].map((p) => (
              <MagneticCard
                key={p.title}
                className="bg-white/[0.04] border border-white/[0.08] rounded-3xl p-8 flex flex-col items-center gap-5 text-center hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-300 group cursor-default"
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 duration-300"
                  style={{ background: `${p.accent}15`, color: p.accent }}
                >
                  {p.icon}
                </div>
                <div>
                  <h3 className="text-[20px] font-black text-white tracking-[-0.03em]">{p.title}</h3>
                  <p className="text-[14px] font-medium text-white/40 mt-1">{p.sub}</p>
                </div>
                <div className="bg-white/[0.06] text-[12px] font-semibold text-white/40 px-4 py-2 rounded-xl w-full text-center border border-white/[0.06]">
                  {p.badge}
                </div>
              </MagneticCard>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 7 — RECENT UPDATES
      ══════════════════════════════════════════════════════════════════════════ */}
      <section className="bg-white py-28 md:py-36">
        <div className="max-w-4xl mx-auto px-6 md:px-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-14"
          >
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-black/30 mb-4">Changelog</p>
            <h2 className="text-[40px] md:text-[54px] font-black tracking-[-0.04em] text-[#0A0A0A] mb-4 leading-[0.95]">
              Continuous refinement.
            </h2>
            <p className="text-[18px] font-medium text-black/45">
              The protocol evolves with each iteration. Our most recent enhancements.
            </p>
          </motion.div>

          <div className="flex flex-col gap-3">
            {[
              {
                tag: "New",
                tagColor: "bg-[#0A0A0A] text-white",
                title: "Rich-text announcement channels",
                desc: "Community administrators can now broadcast formatted, rich-text announcements with embedded media directly to subscriber channels.",
              },
              {
                tag: "Improved",
                tagColor: "bg-[#25D366] text-white",
                title: "Cryptographic invite links",
                desc: "Deterministic community invite links with instant cryptographic revocation. One tap to share, one tap to terminate access permanently.",
              },
              {
                tag: "New",
                tagColor: "bg-[#0A0A0A] text-white",
                title: "Token-gated community channels",
                desc: "Deploy multi-tier community architecture with native token-gating. Configure access thresholds based on USDC, ETH, or NFT ownership.",
              },
              {
                tag: "Improved",
                tagColor: "bg-[#25D366] text-white",
                title: "Granular privacy controls",
                desc: "Comprehensive configuration over cryptographic preferences, metadata exposure, and network-level behavior across all devices.",
              },
              {
                tag: "Security",
                tagColor: "bg-[#0A0A0A] text-white",
                title: "Default end-to-end encryption",
                desc: "All communication channels are encrypted client-side from initialization. Unencrypted fallback modes are explicitly prohibited at the protocol level.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i * 0.06}
                variants={fadeUp}
                className="group flex gap-5 bg-[#FAFAFA] hover:bg-white border border-black/[0.05] hover:border-black/[0.09] rounded-2xl px-7 py-6 items-start transition-all duration-300 hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] cursor-default"
              >
                <span className={`shrink-0 text-[10px] font-black uppercase tracking-[0.1em] px-3 py-1.5 rounded-lg mt-0.5 ${item.tagColor}`}>
                  {item.tag}
                </span>
                <div>
                  <h4 className="text-[16px] font-bold text-[#0A0A0A] mb-1.5 tracking-[-0.02em]">{item.title}</h4>
                  <p className="text-[14px] font-medium text-black/45 leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 8 — FEATURE GRID
      ══════════════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#FAFAFA] py-28 md:py-36">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="text-center mb-16"
          >
            <h2 className="text-[40px] md:text-[54px] font-black tracking-[-0.04em] text-[#0A0A0A] mb-5 leading-[0.95]">
              Uncompromising utility.<br />Sovereign architecture.
            </h2>
            <p className="text-[18px] font-medium text-black/45 max-w-2xl mx-auto leading-relaxed">
              Full parity with centralized messengers, elevated by native peer-to-peer asset routing and decentralized identity.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto"
          >
            {[
              { icon: <MessageSquare size={20} strokeWidth={1.8} />, label: "Private Messages", accent: "#0A0A0A" },
              { icon: <Mic size={20} strokeWidth={1.8} />, label: "Voice Calls", accent: "#25D366" },
              { icon: <Video size={20} strokeWidth={1.8} />, label: "Video Calls", accent: "#0A0A0A" },
              { icon: <Wallet size={20} strokeWidth={1.8} />, label: "Send Crypto", accent: "#25D366" },
              { icon: <Bell size={20} strokeWidth={1.8} />, label: "Burn Timers", accent: "#0A0A0A" },
              { icon: <Image size={20} strokeWidth={1.8} />, label: "Rich Media", accent: "#25D366" },
              { icon: <BarChart2 size={20} strokeWidth={1.8} />, label: "Polls", accent: "#0A0A0A" },
              { icon: <Users size={20} strokeWidth={1.8} />, label: "Communities", accent: "#25D366" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i * 0.05}
                variants={fadeUp}
              >
                <MagneticCard className="bg-white hover:bg-[#FAFAFA] rounded-2xl p-6 flex flex-col items-center gap-3 text-center border border-black/[0.05] hover:border-black/[0.09] hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] transition-all duration-300 cursor-default h-full">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: `${item.accent}10`, color: item.accent }}
                  >
                    {item.icon}
                  </div>
                  <span className="text-[13px] font-bold text-[#0A0A0A]/75 tracking-[-0.01em] leading-tight">{item.label}</span>
                </MagneticCard>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 9 — CTA (Dark)
      ══════════════════════════════════════════════════════════════════════════ */}
      <section className="relative bg-[#0A0A0A] py-28 md:py-40 overflow-hidden">
        <CursorGlowBackground dark />

        {/* Large text watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <span
            className="text-[18vw] font-black tracking-[-0.06em] text-white/[0.02] whitespace-nowrap"
            style={{ lineHeight: 1 }}
          >
            LEDGER
          </span>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 flex flex-col items-center text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="flex flex-col items-center"
          >
            {/* Icon */}
            <div className="w-16 h-16 mx-auto mb-10 bg-[#25D366] rounded-3xl flex items-center justify-center shadow-[0_8px_32px_rgba(37,211,102,0.3)]">
              <MessageCircle size={28} className="text-white" strokeWidth={1.8} />
            </div>

            <h2 className="text-[48px] md:text-[68px] font-black tracking-[-0.04em] text-white mb-6 leading-[0.93]">
              Your conversation.<br />Your sovereignty.
            </h2>
            <p className="text-[19px] font-medium text-white/40 mb-12 max-w-lg mx-auto leading-relaxed">
              Ledger Chat is free, permissionless, and inherently private. Access the decentralized client directly in your browser. No email, no phone number required.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              <Link
                href="/chat"
                className="group relative overflow-hidden inline-flex items-center gap-2.5 bg-white hover:bg-[#F8F8F8] text-[#0A0A0A] font-bold text-[17px] px-10 py-4.5 rounded-2xl transition-all shadow-[0_8px_32px_rgba(255,255,255,0.1)] hover:shadow-[0_12px_48px_rgba(255,255,255,0.15)] active:scale-[0.98]"
              >
                <MessageCircle size={18} />
                Open Ledger Chat
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/communities"
                className="inline-flex items-center gap-2 bg-white/[0.07] hover:bg-white/[0.10] text-white border border-white/[0.12] hover:border-white/[0.18] font-semibold text-[17px] px-10 py-4.5 rounded-2xl transition-all active:scale-[0.98]"
              >
                <Users size={17} />
                Explore Communities
              </Link>
            </div>

            <div className="flex flex-row gap-3 flex-wrap justify-center mb-8">
              <AppStoreBadge />
              <GooglePlayBadge />
            </div>

            <p className="text-[13px] font-medium text-white/20 tracking-wide">
              Permissionless by default. No advertisements. No data sold. No surveillance.
            </p>
          </motion.div>
        </div>
      </section>

      <SystemFooter />
    </div>
  );
}
