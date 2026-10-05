"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useAppKit } from '@reown/appkit/react';
import { EmailLoginModal } from '@/components/auth/EmailLoginModal';
import { toast } from 'sonner';

//  Constants 

const FADE_UP: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const STAGGER: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

//  Component 

export function MobileManifesto() {
  const [hasSession, setHasSession] = useState(false);
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const { open } = useAppKit();

  useEffect(() => {
    setHasSession(document.cookie.includes("system_handshake=") || document.cookie.includes("siwe_session="));
  }, []);

  return (
    <div className="relative bg-[#F9F8F6] text-[#0A0A0A] font-sans antialiased overflow-x-hidden min-h-[100dvh] selection:bg-black/10 flex flex-col w-full">

      {/* 
          1. HERO — iOS/Android safe-area aware
          Uses env(safe-area-inset-top) for notch/dynamic island devices.
          min-h uses 100dvh (dynamic viewport height) so Chrome mobile
          navbars do not cut off content at the bottom.
       */}
      <section
        className="px-6 pb-16 border-b border-[#EBEBEB] bg-[#F9F8F6] relative overflow-hidden flex flex-col justify-center"
        style={{
          paddingTop: "max(5rem, calc(env(safe-area-inset-top, 0px) + 5rem))",
          minHeight: "100dvh",
          paddingBottom: "max(4rem, calc(env(safe-area-inset-bottom, 0px) + 4rem))"
        }}
      >
        {/* Subtle background pattern */}
        <div
          className="absolute inset-0 z-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(#0A0A0A 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        
        <motion.div initial="hidden" animate="visible" variants={STAGGER} className="relative z-10 flex flex-col items-center text-center">

          {/* Premium background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none" />

          {/* Partnership badge */}
          <motion.div variants={FADE_UP} className="flex items-center gap-3 mb-8">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-black/10 bg-white shadow-sm backdrop-blur-md">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-[#0A0A0A]/70">
                Sovereign Network
              </span>
            </div>
          </motion.div>

          <motion.h1 variants={FADE_UP} className="text-[40px] sm:text-[48px] font-black tracking-tighter leading-[0.95] text-[#0A0A0A] mb-6 max-w-[320px] mx-auto">
            The Sovereign Gateway
            <br />
            <span className="text-[#0A0A0A]/30">to Humanity Ledger.</span>
          </motion.h1>

          <motion.p variants={FADE_UP} className="text-[15px] text-[#444] leading-[1.6] mb-10 max-w-[340px] mx-auto px-4 font-medium">
            Humanity Ledger operates as the sovereign application layer over Humanity Ledger's zero knowledge execution environment. We abstract the complexity of ZK circuits into a sovereign-grade terminal.
          </motion.p>

          <motion.div variants={FADE_UP} className="w-full max-w-[300px] mx-auto flex flex-col items-center gap-3">
            {!hasSession ? (
              <>
                {/* Apple login */}
                <button
                  onClick={() => toast("Apple Sign In - Available Jan 1, 2027", { icon: '🍎' })}
                  className="flex items-center justify-center gap-2 w-full h-[56px] bg-[#0A0A0A] text-white rounded-2xl text-[14px] font-bold tracking-wide active:scale-[0.98] transition-transform shadow-lg shadow-black/20"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  Continue with Apple
                </button>
                {/* Google login */}
                <button
                  onClick={() => toast("Google Sign In - Available Jan 1, 2027", { icon: '🤖' })}
                  className="flex items-center justify-center gap-2 w-full h-[56px] bg-white border border-black/15 text-black rounded-2xl text-[14px] font-bold tracking-wide active:scale-[0.98] transition-transform shadow-sm"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
                  </svg>
                  Continue with Google
                </button>
              </>
            ) : (
              <button
                onClick={() => window.location.href = '/terminal'}
                className="flex items-center justify-center w-full h-[56px] bg-black text-white rounded-2xl text-[14px] font-bold tracking-wide active:scale-[0.98] transition-transform shadow-lg shadow-black/20"
              >
                Access Dashboard
              </button>
            )}
            <Link
              href="/developers/api-docs"
              className="flex items-center justify-center w-full h-[48px] bg-transparent text-black/50 text-[13px] font-semibold tracking-wide active:scale-[0.98] transition-transform"
            >
              Read the Docs →
            </Link>
          </motion.div>

          {/* Jan 1 2027 Announcement */}
          <motion.div variants={FADE_UP} className="mt-8 bg-white/80 backdrop-blur-md border border-[#EBEBEB] rounded-2xl p-4 shadow-sm w-full max-w-[300px] mx-auto text-center">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0A0A0A] mb-1">
              Live Now · Mobile Coming
            </div>
            <p className="text-[9px] font-mono text-[#666] uppercase tracking-[0.1em] leading-relaxed">
              Mobile apps for iOS & Android coming soon
            </p>
          </motion.div>

        </motion.div>
      </section>

      {/* Email OTP Login Modal — handles the full 3-step flow on mobile */}
      <EmailLoginModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
      />

      {/* 
          2. ARCHITECTURE
       */}
      <section className="px-6 py-20 border-b border-[#EBEBEB] bg-white space-y-16 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none" />
        
        <div className="text-center space-y-4 mb-12 relative z-10">
            <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={FADE_UP} className="text-[36px] font-black tracking-tighter leading-[0.95] text-[#0A0A0A]">
                Client-Side <span className="text-[#0A0A0A]/30">Privacy.</span>
            </motion.h2>
            <motion.p initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={FADE_UP} className="text-[16px] text-[#555] font-medium leading-relaxed max-w-[320px] mx-auto px-2">
                By leveraging the Humanity Ledger Network Private Execution Environment, we shift all computation to your local device.
            </motion.p>
        </div>

        <div className="space-y-6 relative z-10">
          {[
            { num: '01', title: 'Local Proving', desc: 'Your device runs Noir circuits locally, generating a zero knowledge proof before touching the network.' },
            { num: '02', title: 'Encrypted State', desc: 'Balances and identity credentials are stored as encrypted UTXO notes on the Humanity Ledger L2.' },
            { num: '03', title: 'Nullifier Resistance', desc: 'The protocol emits a deterministic nullifier, preventing double spending without linking your identity to the network.' },
          ].map((block, i) => (
            <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={FADE_UP} className="flex flex-col gap-3 bg-[#F9F8F6] p-8 rounded-3xl border border-[#EBEBEB] shadow-sm">
              <span className="font-black text-[12px] text-indigo-500 tracking-widest uppercase">Step {block.num}</span>
              <h3 className="text-[20px] font-black tracking-tight text-[#0A0A0A] leading-none">{block.title}</h3>
              <p className="text-[15px] font-medium text-[#555] leading-[1.6] mt-1">
                  {block.desc}
              </p>
            </motion.div>
          ))}
        </div>

      </section>

      {/* 
          3. Ledger Chat ÔÇö dark section
          All text must be visible on the #0A0A0A background.
          Minimum: white/80 for body, white for headers.
       */}
      <section className="px-6 py-20 bg-[#0A0A0A] text-white">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP}>
          <div className="flex items-center gap-3 mb-12">
            <div className="flex-1 h-px bg-white/20" />
            <span className="font-mono text-[8px] font-black uppercase tracking-[0.3em] text-white/60">LedgerChat</span>
            <div className="flex-1 h-px bg-white/20" />
          </div>

          <h2 className="text-[40px] font-black tracking-tighter uppercase leading-[0.95] text-white mb-6 text-center">
            Sovereign <span className="text-emerald-400">Privacy.</span>
          </h2>

          <div className="space-y-6 font-serif text-[16px] text-white/80 leading-[1.7] text-center max-w-[340px] mx-auto mb-10 px-2">
            <p>
              Centralised messaging platforms are liabilities for sovereign operations. Ledger Chat is built on XMTP ÔÇö encrypted directly with authorized personnel keys.
            </p>
            
            <AnimatePresence>
              {noteExpanded && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-6 overflow-hidden">
                  <p className="pt-2 text-white/70">
                    No telecom provider or unauthorized entity can intercept the data. 
                  </p>
                  <p className="text-white/70">
                    Used daily for secure transfers and cryptographic attestation where perfect sovereign privacy is mandatory.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={() => setNoteExpanded((v) => !v)} className="flex items-center justify-center gap-3 w-full max-w-[300px] mx-auto h-[56px] rounded-2xl bg-white/10 border border-white/20 font-mono text-[11px] font-black tracking-[0.2em] uppercase text-white active:bg-white/15 transition-colors">
            {noteExpanded ? "Collapse" : "Read More"}
            <ChevronDown size={16} className={`transition-transform duration-300 ${noteExpanded ? "rotate-180" : ""}`} />
          </button>
        </motion.div>
      </section>

      {/* 
          4. Humanity Ledger
       */}
      <section
        className="px-6 py-24 bg-[#F9F8F6] border-t border-black/10 text-center flex-1"
        style={{ paddingBottom: "max(6rem, calc(env(safe-area-inset-bottom, 0px) + 6rem))" }}
      >
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={FADE_UP}>
          <span className="inline-block font-mono text-[9px] font-black uppercase tracking-[0.2em] text-[#0A0A0A]/55 mb-6 px-3 py-1.5 border border-black/15 rounded-full">
            Infrastructure Partner
          </span>
          <h2 className="text-[32px] font-black tracking-tighter uppercase leading-[0.95] text-[#0A0A0A] mb-6">
            Powered by <br/><span className="text-[#0A0A0A]/55">Humanity Ledger Network.</span>
          </h2>
          <p className="font-serif text-[15px] text-[#555] leading-[1.6] max-w-[320px] mx-auto px-2">
            The foundation of this absolute transparency and security is built upon the Humanity Ledger Network L2 zk-Rollup. It is the definitive infrastructure for sovereign security.
          </p>
        </motion.div>
      </section>

    </div>
  );
}
