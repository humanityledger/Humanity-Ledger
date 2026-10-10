"use client";

import React, { useEffect, useState } from "react";
import { motion, Variants } from "framer-motion";

// ─── Animation Presets ───────────────────────────────────────────────────────
const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 90, damping: 18 } },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ number, label }: { number: string; label: string }) {
  return (
    <motion.div variants={item} className="flex items-center gap-4 mb-10">
      <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-white font-black font-mono text-sm shadow-lg shrink-0">
        {number}
      </div>
      <h2 className="text-lg md:text-2xl font-black tracking-tight uppercase whitespace-nowrap">{label}</h2>
      <div className="flex-1 h-px bg-gradient-to-r from-black/15 to-transparent ml-2" />
    </motion.div>
  );
}

function Tag({ children, color = "gray" }: { children: React.ReactNode; color?: "gray" | "blue" | "green" | "purple" | "amber" | "rose" }) {
  // All color variants resolve to strict monochrome — zero color noise
  const colors = {
    gray:   "bg-black/[0.04] border-black/[0.08] text-black/70",
    blue:   "bg-black/[0.04] border-black/[0.08] text-black/70",
    green:  "bg-black/[0.05] border-black/[0.10] text-black/80",
    purple: "bg-black/[0.04] border-black/[0.08] text-black/70",
    amber:  "bg-black/[0.04] border-black/[0.08] text-black/65",
    rose:   "bg-black/[0.04] border-black/[0.08] text-black/65",
  };
  return (
    <span className={`px-3 py-1.5 border rounded-lg text-[10px] md:text-xs font-bold font-mono ${colors[color]}`}>
      {children}
    </span>
  );
}

function NodeCard({
  label,
  title,
  subtitle,
  tags,
  accent = false,
}: {
  label: string;
  title: string;
  subtitle: string;
  tags: { text: string; color?: any }[];
  accent?: boolean;
}) {
  return (
    <motion.div
      variants={item}
      className={`flex flex-col p-6 md:p-8 border rounded-3xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 group relative overflow-hidden ${
        accent
          ? "bg-black text-white border-black"
          : "bg-white text-black border-black/[0.07]"
      }`}
    >
      <div className={`text-[10px] font-mono font-black uppercase tracking-[0.3em] mb-3 ${accent ? "text-white/50" : "text-black/40"}`}>
        {label}
      </div>
      <h3 className={`text-xl md:text-2xl font-black mb-1 leading-tight ${accent ? "text-white" : "text-black"}`}>{title}</h3>
      <p className={`text-xs font-mono mb-6 ${accent ? "text-white/50" : "text-black/50"}`}>{subtitle}</p>
      <div className="flex flex-wrap gap-2 mt-auto">
        {tags.map((t, i) => (
          <Tag key={i} color={accent ? "gray" : t.color}>{t.text}</Tag>
        ))}
      </div>
    </motion.div>
  );
}

function PipelineNode({
  icon,
  title,
  sub,
  detail,
  style = "rect",
}: {
  icon: string;
  title: string;
  sub: string;
  detail: string;
  style?: "rect" | "circle" | "rounded" | "dark";
}) {
  const shapes: Record<string, string> = {
    rect:    "w-full max-w-[260px] h-28 bg-white border-2 border-dashed border-black/40 rounded-2xl",
    circle:  "w-28 h-28 md:w-32 md:h-32 bg-white border-[3px] border-black rounded-full",
    rounded: "w-full max-w-[260px] h-28 bg-white border-2 border-black rounded-2xl",
    dark:    "w-28 h-28 md:w-32 md:h-32 bg-black rounded-[2rem]",
  };
  const textColor = style === "dark" ? "text-white" : "text-black";
  return (
    <div className="relative z-10 flex flex-col items-center group w-full">
      <div className={`flex flex-col items-center justify-center shadow-md group-hover:scale-105 transition-all duration-400 ${shapes[style]}`}>
        <span className={`font-mono font-black text-xl md:text-2xl ${textColor}`}>{icon}</span>
      </div>
      <div className="mt-5 p-4 bg-white border border-black/5 rounded-xl shadow-sm text-center w-full max-w-[260px]">
        <span className="block text-[10px] font-mono text-black/40 uppercase tracking-[0.2em] font-bold">{sub}</span>
        <span className="block text-sm font-bold mt-1 text-black/80">{title}</span>
        <span className="block text-[10px] font-mono text-black/40 mt-1">{detail}</span>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function NetworkMapPanel() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="w-full h-full min-h-0 flex flex-col bg-[#FDFCFB] overflow-x-hidden overflow-y-auto no-scrollbar relative font-sans text-[#050505] select-none">

      {/* Dotted grid background */}
      <div
        className="absolute inset-0 z-0 opacity-[0.13] pointer-events-none"
        style={{ backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "32px 32px" }}
      />
      {/* Ambient glows */}
      <div className="absolute top-0 left-1/4 w-[700px] h-[700px] bg-emerald-100/25 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[700px] h-[700px] bg-emerald-100/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 w-[500px] h-[500px] bg-violet-100/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

      <div className="relative z-10 w-full min-h-full p-6 md:p-12 lg:p-20 flex flex-col items-center">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-[1400px] mb-20 md:mb-28 flex flex-col items-center md:items-start text-center md:text-left"
        >
          <div className="text-[10px] md:text-xs font-mono font-black uppercase tracking-[0.4em] text-black/40 mb-4 px-4 py-1.5 border border-black/10 rounded-full bg-white/50 backdrop-blur-sm shadow-sm inline-block">
            System Topology
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-[80px] font-black tracking-tighter leading-none text-black drop-shadow-sm">
            Architecture <span className="text-black/25">Map</span>
          </h1>

          {/* [PHASE 4] Tor/I2P Awareness Banner */}
          {typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6 px-4 py-3 bg-black text-white text-xs md:text-sm font-mono rounded-xl border border-white/20 shadow-xl max-w-2xl flex items-center gap-3"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>
                <strong className="text-emerald-400 uppercase tracking-widest mr-2">Local Node Detected:</strong>
                Para máxima privacidad y resistencia a la censura, recomendamos ejecutar este nodo local sobre la red <strong className="text-white">Tor</strong> o <strong className="text-white">I2P</strong>.
              </span>
            </motion.div>
          )}
          <p className="mt-6 text-sm md:text-base text-black/55 font-medium max-w-2xl leading-relaxed">
            A high-level technical overview of the humanidfi.com infrastructure, spanning from dual-client synchronisation through the Noir ZK proving pipeline to the core Aztec Protocol on Ethereum L1.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="w-full max-w-[1400px] flex flex-col gap-24 lg:gap-32 pb-32"
        >

          {/* ══════════════════════════════════════════════════
              SECTION 1 — CLIENT BOUNDARY
              PC Web Client + QR Sync + Mobile Authenticator
          ══════════════════════════════════════════════════ */}
          <div className="relative flex flex-col w-full">
            <div className="absolute -inset-8 md:-inset-12 bg-white/40 backdrop-blur-md rounded-[3rem] border border-white/60 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.05)] z-0" />
            <div className="relative z-10 w-full">
              <SectionHeader number="1" label="Client Boundary" />

              {/* Desktop + QR + Mobile row */}
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto_1fr] items-center gap-12 lg:gap-16 w-full">

                {/* ── Desktop Web Client ── */}
                <motion.div variants={item} className="flex flex-col p-8 md:p-10 border border-black/[0.07] rounded-3xl bg-white shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                    <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24"><path d="M4 6h16v12H4zM2 6c0-1.1.9-2 2-2h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm4 2v2h2V8H6z"/></svg>
                  </div>

                  <div className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-black/40 mb-3">Web Domain (PC)</div>
                  <h3 className="text-2xl md:text-3xl font-black mb-1">Ledger Web Client</h3>
                  <p className="text-xs text-black/50 font-mono mb-6">humanidfi.com • Browser Context</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-[#F9F9F9] border border-black/5 rounded-2xl">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-black/40 mb-2">Runtime</div>
                      <div className="flex flex-wrap gap-2">
                        <Tag color="gray">Next.js 15</Tag>
                        <Tag color="gray">Tailwind</Tag>
                        <Tag color="gray">Framer Motion</Tag>
                      </div>
                    </div>
                    <div className="p-4 bg-[#F9F9F9] border border-black/5 rounded-2xl">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-black/40 mb-2">Wallet Layer</div>
                      <div className="flex flex-wrap gap-2">
                        <Tag color="blue">Wagmi + Viem</Tag>
                        <Tag color="blue">WalletConnect v2</Tag>
                        <Tag color="blue">MetaMask / Rabby</Tag>
                      </div>
                    </div>
                    <div className="p-4 bg-[#F9F9F9] border border-black/5 rounded-2xl">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-black/40 mb-2">ZK Engine</div>
                      <div className="flex flex-wrap gap-2">
                        <Tag color="purple">Aztec PXE</Tag>
                        <Tag color="purple">WASM Prover</Tag>
                        <Tag color="purple">Barretenberg</Tag>
                        <Tag color="purple">Honk / UltraPlonk</Tag>
                      </div>
                    </div>
                    <div className="p-4 bg-[#F9F9F9] border border-black/5 rounded-2xl">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-black/40 mb-2">Security</div>
                      <div className="flex flex-wrap gap-2">
                        <Tag color="rose">Humanity Ledger Edge</Tag>
                        <Tag color="rose">SIWE Auth</Tag>
                        <Tag color="rose">Rate Limiting</Tag>
                        <Tag color="rose">Session State</Tag>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-black rounded-2xl text-white">
                    <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/40 mb-2">Signing Flow</div>
                    <div className="flex flex-wrap gap-2">
                      <Tag color="gray">ECDSA Signing</Tag>
                      <Tag color="gray">Schnorr Signatures</Tag>
                      <Tag color="gray">Aztec Spend Key</Tag>
                      <Tag color="gray">Local Witness Gen</Tag>
                    </div>
                  </div>
                </motion.div>

                {/* ── QR / ECDH Bridge ── */}
                <motion.div variants={item} className="flex flex-col items-center justify-center relative w-full xl:w-auto shrink-0 py-10 xl:py-0">
                  <div className="hidden xl:block absolute top-1/2 left-[-120px] w-[120px] h-[2px] bg-gradient-to-r from-black/15 to-black/70" />
                  <div className="hidden xl:block absolute top-1/2 right-[-120px] w-[120px] h-[2px] bg-gradient-to-l from-black/15 to-black/70" />
                  <div className="xl:hidden absolute top-[-50px] left-1/2 w-[2px] h-[50px] bg-gradient-to-b from-black/15 to-black/70" />
                  <div className="xl:hidden absolute bottom-[-50px] left-1/2 w-[2px] h-[50px] bg-gradient-to-t from-black/15 to-black/70" />

                  <div className="w-20 h-20 bg-black text-white rounded-full flex flex-col items-center justify-center shadow-[0_0_40px_rgba(0,0,0,0.2)] z-10 relative group cursor-crosshair hover:scale-110 transition-transform duration-500">
                    <div className="absolute inset-0 rounded-full border border-white/20 animate-ping opacity-20" />
                    <span className="font-mono font-black text-lg">QR</span>
                  </div>
                  <div className="mt-5 text-center">
                    <div className="text-[10px] font-mono font-bold text-black uppercase tracking-widest">Out-of-band Sync</div>
                    <div className="text-[9px] font-mono text-black/40 uppercase tracking-widest mt-1">X25519 ECDH</div>
                    <div className="text-[9px] font-mono text-black/40 uppercase tracking-widest mt-0.5">WebSocket Tunnel</div>
                  </div>
                </motion.div>

                {/* ── Mobile Native Authenticator ── */}
                <motion.div variants={item} className="flex flex-col p-8 md:p-10 border border-black/[0.07] rounded-3xl bg-white shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                    <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24"><path d="M7 2h10a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2zm0 2v16h10V4H7zm4 13h2v2h-2v-2z"/></svg>
                  </div>

                  <div className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-black/40 mb-3">Mobile Domain</div>
                  <h3 className="text-2xl md:text-3xl font-black mb-1">Native Authenticator</h3>
                  <p className="text-xs text-black/50 font-mono mb-6">iOS &amp; Android • Secure Enclave</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-[#F9F9F9] border border-black/5 rounded-2xl">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-black/40 mb-2">iOS</div>
                      <div className="flex flex-wrap gap-2">
                        <Tag color="blue">Secure Enclave</Tag>
                        <Tag color="blue">Face ID / Touch ID</Tag>
                        <Tag color="blue">WebKit PXE</Tag>
                        <Tag color="blue">Keychain</Tag>
                      </div>
                    </div>
                    <div className="p-4 bg-[#F9F9F9] border border-black/5 rounded-2xl">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-black/40 mb-2">Android</div>
                      <div className="flex flex-wrap gap-2">
                        <Tag color="green">Android Keystore</Tag>
                        <Tag color="green">StrongBox</Tag>
                        <Tag color="green">Biometric API</Tag>
                        <Tag color="green">Chrome PXE</Tag>
                      </div>
                    </div>
                    <div className="p-4 bg-[#F9F9F9] border border-black/5 rounded-2xl sm:col-span-2">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-black/40 mb-2">Capabilities</div>
                      <div className="flex flex-wrap gap-2">
                        <Tag color="purple">No Custody</Tag>
                        <Tag color="purple">Signature Gen</Tag>
                        <Tag color="purple">QR Session Link</Tag>
                        <Tag color="purple">Push Notifications</Tag>
                        <Tag color="purple">Delegation to PC</Tag>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-black rounded-2xl text-white">
                    <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/40 mb-2">Enclave Routing</div>
                    <div className="flex flex-wrap gap-2">
                      <Tag color="gray">ZK Delegation</Tag>
                      <Tag color="gray">Encrypted WebSocket</Tag>
                      <Tag color="gray">State Read-only</Tag>
                      <Tag color="gray">TX Auth</Tag>
                    </div>
                  </div>
                </motion.div>

              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              SECTION 2 — AZTEC PRIVACY LAYER & NOIR CIRCUITS
          ══════════════════════════════════════════════════ */}
          <div className="relative flex flex-col w-full">
            <div className="absolute -inset-8 md:-inset-12 bg-violet-50/30 backdrop-blur-md rounded-[3rem] border border-violet-100/60 shadow-[0_20px_60px_-20px_rgba(109,40,217,0.05)] z-0" />
            <div className="relative z-10 w-full">
              <SectionHeader number="2" label="Aztec Privacy Layer — Noir Circuits" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <NodeCard
                  label="ZK Prover (Client)"
                  title="Noir Circuits"
                  subtitle="WASM — Client-Side Witness Generation"
                  tags={[
                    { text: "UltraPlonk", color: "purple" },
                    { text: "Honk", color: "purple" },
                    { text: "Witness Gen", color: "purple" },
                    { text: "Proof Compression", color: "purple" },
                  ]}
                />
                <NodeCard
                  label="State Management"
                  title="Private State Trees"
                  subtitle="Note Discovery · Viewing Key Scanning"
                  tags={[
                    { text: "Note Encryption", color: "green" },
                    { text: "Nullifiers", color: "green" },
                    { text: "PXE Tree", color: "green" },
                    { text: "Commitment DB", color: "green" },
                  ]}
                />
                <NodeCard
                  label="Cryptographic Logs"
                  title="Encrypted Logs"
                  subtitle="Viewing Key Decryption · Event Reconstruction"
                  tags={[
                    { text: "Incoming Notes", color: "blue" },
                    { text: "Log Decryption", color: "blue" },
                    { text: "Aztec Sequencer", color: "blue" },
                    { text: "Private History", color: "blue" },
                  ]}
                />
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              SECTION 3 — CORE PRODUCTS & IDENTITY
          ══════════════════════════════════════════════════ */}
          <div className="relative flex flex-col w-full">
            <div className="absolute -inset-8 md:-inset-12 bg-white/40 backdrop-blur-md rounded-[3rem] border border-white/60 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.05)] z-0" />
            <div className="relative z-10 w-full">
              <SectionHeader number="3" label="Core Products & Identity" />

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

                {/* Identity */}
                <motion.div variants={item} className="flex flex-col p-7 rounded-3xl bg-black text-white shadow-2xl hover:-translate-y-1 transition-all duration-500 col-span-1 md:col-span-2">
                  <div className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-white/40 mb-3">Cryptographic Identity System</div>
                  <h3 className="text-2xl font-black mb-1">Humanity Ledger Identity</h3>
                  <p className="text-xs text-white/50 font-mono mb-6">Indexed Wallet Signature · Gold Ticket · Beta Supply: max 200</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/30 mb-2">Signing Flow</div>
                      <div className="flex flex-wrap gap-2">
                        <Tag color="gray">ECDSA Verify</Tag>
                        <Tag color="gray">SIWE Message</Tag>
                        <Tag color="gray">Schnorr Aztec</Tag>
                        <Tag color="gray">Session Cookie</Tag>
                      </div>
                    </div>
                    <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/30 mb-2">ZK Proofs</div>
                      <div className="flex flex-wrap gap-2">
                        <Tag color="gray">Noir Circuit</Tag>
                        <Tag color="gray">Unique Nullifier</Tag>
                        <Tag color="gray">Sybil Resistance</Tag>
                        <Tag color="gray">On-chain Attest.</Tag>
                      </div>
                    </div>
                    <div className="p-4 bg-white/5 border border-white/10 rounded-2xl sm:col-span-2">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/30 mb-2">Supply & Minting</div>
                      <div className="flex flex-wrap gap-2">
                        <Tag color="gray">Max 200 Genesis</Tag>
                        <Tag color="gray">1 per Wallet</Tag>
                        <Tag color="gray">Gold Ticket NFT</Tag>
                        <Tag color="gray">QDs Reward</Tag>
                        <Tag color="gray">Prisma DB Lock</Tag>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Studio Provenance */}
                <motion.div variants={item} className="flex flex-col p-7 rounded-3xl bg-white border border-black/[0.07] shadow-xl hover:-translate-y-1 transition-all duration-500">
                  <div className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-black/40 mb-3">ZK Anchoring</div>
                  <h3 className="text-2xl font-black mb-1">Studio Provenance</h3>
                  <p className="text-xs text-black/50 font-mono mb-6">ZK Product Passports · Asset Registry</p>
                  <div className="flex flex-wrap gap-2">
                    <Tag color="amber">Proof of Origin</Tag>
                    <Tag color="amber">Noir Circuit</Tag>
                    <Tag color="amber">Hash Attestation</Tag>
                    <Tag color="amber">Immutable Anchor</Tag>
                    <Tag color="amber">Private Metadata</Tag>
                  </div>
                </motion.div>

                {/* Portfolio */}
                <motion.div variants={item} className="flex flex-col p-7 rounded-3xl bg-white border border-black/[0.07] shadow-xl hover:-translate-y-1 transition-all duration-500">
                  <div className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-black/40 mb-3">Private Asset Mgmt</div>
                  <h3 className="text-2xl font-black mb-1">Portfolio</h3>
                  <p className="text-xs text-black/50 font-mono mb-6">Aztec QDs · Private Ledger · Note Scanning</p>
                  <div className="flex flex-wrap gap-2">
                    <Tag color="green">QDs Balance</Tag>
                    <Tag color="green">Private Notes</Tag>
                    <Tag color="green">State Tree Scan</Tag>
                    <Tag color="green">Aztec Address</Tag>
                    <Tag color="green">Prisma Ledger</Tag>
                  </div>
                </motion.div>

                {/* Ledger Chat */}
                <NodeCard
                  label="P2P Encrypted Messaging"
                  title="LedgerChat"
                  subtitle="XMTP Protocol · E2EE · On-chain Identity"
                  tags={[
                    { text: "XMTP SDK", color: "blue" },
                    { text: "E2EE", color: "blue" },
                    { text: "Wallet-to-Wallet", color: "blue" },
                    { text: "No Central Server", color: "blue" },
                  ]}
                />

                {/* Token */}
                <NodeCard
                  label="Economic Layer"
                  title="Token & Governance"
                  subtitle="QDs · CoreDots · CoreLedger · Optimism"
                  tags={[
                    { text: "ERC-20 (QDs)", color: "amber" },
                    { text: "Base L2", color: "amber" },
                    { text: "Optimism L2", color: "amber" },
                    { text: "Snapshot DAO", color: "amber" },
                  ]}
                />

                {/* Roadmap */}
                <NodeCard
                  label="Live Telemetry"
                  title="Roadmap"
                  subtitle="GitHub Sync · Audit Schedules · Status"
                  tags={[
                    { text: "GitHub API", color: "gray" },
                    { text: "Live Status", color: "gray" },
                    { text: "Audit Tracker", color: "gray" },
                  ]}
                />

                {/* Privacy */}
                <NodeCard
                  label="Cryptographic Hygiene"
                  title="Privacy Console"
                  subtitle="IndexedDB Audit · Atomic Purge · Key Wipe"
                  tags={[
                    { text: "Local Key Audit", color: "rose" },
                    { text: "Zero-Fill Purge", color: "rose" },
                    { text: "Session Control", color: "rose" },
                  ]}
                />

              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              SECTION 4 — DATA & INDEXING LAYER
          ══════════════════════════════════════════════════ */}
          <div className="relative flex flex-col w-full">
            <div className="absolute -inset-8 md:-inset-12 bg-emerald-50/20 backdrop-blur-md rounded-[3rem] border border-emerald-100/40 shadow-[0_20px_60px_-20px_rgba(59,130,246,0.04)] z-0" />
            <div className="relative z-10 w-full">
              <SectionHeader number="4" label="Data & Indexing Layer" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <NodeCard
                  label="Relational State"
                  title="Prisma + PostgreSQL"
                  subtitle="Railway · Transactions · Users · Tickets"
                  tags={[
                    { text: "Prisma ORM", color: "blue" },
                    { text: "PostgreSQL 16", color: "blue" },
                    { text: "Railway Deploy", color: "blue" },
                    { text: "Upstash Redis", color: "blue" },
                  ]}
                />
                <NodeCard
                  label="Graph Intelligence"
                  title="Neo4j Graph DB"
                  subtitle="Macro-Correlations · Capital Flow Mapping"
                  tags={[
                    { text: "Neo4j AuraDB", color: "purple" },
                    { text: "Cypher Queries", color: "purple" },
                    { text: "Ledger Patterns", color: "purple" },
                  ]}
                />
                <NodeCard
                  label="On-chain Indexing"
                  title="TheGraph Subgraph"
                  subtitle="L1/L2 Event Indexing · Transfers · DeFi"
                  tags={[
                    { text: "TheGraph", color: "green" },
                    { text: "Event Logs", color: "green" },
                    { text: "Alchemy SDK", color: "green" },
                    { text: "Chainlink", color: "green" },
                  ]}
                />
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              SECTION 5 — CORE PROTOCOL PIPELINE
          ══════════════════════════════════════════════════ */}
          <div className="relative flex flex-col w-full">
            <div className="absolute -inset-8 md:-inset-12 bg-white/40 backdrop-blur-md rounded-[3rem] border border-white/60 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.05)] z-0" />
            <div className="relative z-10 w-full">
              <SectionHeader number="5" label="Core Protocol Pipeline" />

              <motion.div
                variants={item}
                className="relative w-full rounded-3xl bg-white border border-black/10 shadow-[0_30px_100px_-20px_rgba(0,0,0,0.1)] p-8 md:p-14 grid grid-cols-1 lg:grid-cols-4 gap-12 lg:gap-6 items-start overflow-visible"
              >
                {/* Animated horizontal line (desktop) */}
                <div className="hidden lg:block absolute top-[6.5rem] left-[12.5%] right-[12.5%] h-[4px] bg-black/10 rounded-full z-0 overflow-hidden">
                  <motion.div
                    className="w-1/3 h-full bg-gradient-to-r from-transparent via-black to-transparent opacity-50"
                    animate={{ x: ["-100%", "300%"] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  />
                </div>
                {/* Animated vertical line (mobile) */}
                <div className="lg:hidden absolute left-1/2 top-[10%] bottom-[10%] w-[4px] bg-black/10 -translate-x-1/2 rounded-full z-0 overflow-hidden">
                  <motion.div
                    className="h-1/3 w-full bg-gradient-to-b from-transparent via-black to-transparent opacity-50"
                    animate={{ y: ["-100%", "300%"] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  />
                </div>

                <PipelineNode
                  style="rect"
                  icon="Client PXE"
                  title="Private State"
                  sub="Execution Environment"
                  detail="Local note scanning"
                />
                <PipelineNode
                  style="circle"
                  icon="ZK"
                  title="Proof Generation"
                  sub="Cryptography"
                  detail="Noir + Barretenberg"
                />
                <PipelineNode
                  style="rounded"
                  icon="Aztec L2"
                  title="Rollup Layer"
                  sub="Network"
                  detail="Public/Private composable"
                />
                <PipelineNode
                  style="dark"
                  icon="L1"
                  title="Ethereum Mainnet"
                  sub="Settlement"
                  detail="Global finality"
                />
              </motion.div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              SECTION 6 — BASE CRYPTOGRAPHIC LAYER
          ══════════════════════════════════════════════════ */}
          <div className="relative flex flex-col w-full">
            <div className="absolute -inset-8 md:-inset-12 bg-black/[0.02] backdrop-blur-md rounded-[3rem] border border-black/[0.05] z-0" />
            <div className="relative z-10 w-full">
              <SectionHeader number="6" label="Base Cryptographic Layer" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <NodeCard
                  label="Layer 2 — Privacy"
                  title="Aztec L2 Network"
                  subtitle="Public / Private Composability"
                  accent
                  tags={[
                    { text: "ZK Rollup" },
                    { text: "Sequencer" },
                    { text: "Prover Network" },
                    { text: "Private State" },
                    { text: "Note Commitments" },
                  ]}
                />
                <NodeCard
                  label="Layer 2 — EVM"
                  title="Optimism & Base L2"
                  subtitle="Token Infrastructure · QDs · Governance"
                  tags={[
                    { text: "Optimism Mainnet", color: "blue" },
                    { text: "Base Mainnet", color: "blue" },
                    { text: "Viem + Ethers", color: "blue" },
                    { text: "CoreDots.sol", color: "blue" },
                  ]}
                />
                <NodeCard
                  label="Layer 1 — Settlement"
                  title="Ethereum Mainnet"
                  subtitle="Global Settlement · Smart Contracts · IPFS"
                  tags={[
                    { text: "Ethereum L1", color: "gray" },
                    { text: "IPFS / Arweave", color: "gray" },
                    { text: "Hardhat Deploy", color: "gray" },
                    { text: "Solidity 0.8", color: "gray" },
                  ]}
                />
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              SECTION 7 — L1 <-> L2 MESSAGE BOXES (AZTEC REGISTRY)
          ══════════════════════════════════════════════════ */}
          <div className="relative flex flex-col w-full">
             <div className="absolute -inset-8 md:-inset-12 bg-indigo-50/40 backdrop-blur-md rounded-[3rem] border border-indigo-100 z-0" />
             <div className="relative z-10 w-full">
                <SectionHeader number="7" label="L1 <-> L2 Message Registry" />

                <motion.div variants={item} className="w-full bg-white border border-slate-200 rounded-[2rem] shadow-xl p-8 md:p-12 overflow-hidden relative">
                   <div className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-10">
                      
                      {/* L1 Side */}
                      <div className="flex-1 w-full bg-slate-50 border border-slate-200 rounded-3xl p-6 relative">
                         <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Ethereum Mainnet (L1)</div>
                         
                         <div className="space-y-4">
                            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm hover:border-slate-400 transition-colors cursor-default relative overflow-hidden group">
                               <div className="absolute right-0 top-0 bottom-0 w-1 bg-emerald-400" />
                               <h4 className="font-black text-sm text-slate-800 mb-1 flex items-center gap-2">L1 Inbox <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[8px] uppercase">Active</span></h4>
                               <p className="text-xs font-mono text-slate-500">Consumes L1-&gt;L2 messages via Rollup</p>
                            </div>
                            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm hover:border-slate-400 transition-colors cursor-default relative overflow-hidden">
                               <div className="absolute right-0 top-0 bottom-0 w-1 bg-indigo-400" />
                               <h4 className="font-black text-sm text-slate-800 mb-1">L1 Outbox</h4>
                               <p className="text-xs font-mono text-slate-500">Resolves L2-&gt;L1 state proofs</p>
                            </div>
                         </div>
                      </div>

                      {/* Bridging Animation (Center) */}
                      <div className="shrink-0 flex flex-col items-center justify-center gap-4 py-8 lg:py-0 w-full lg:w-48 relative">
                          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-200 -translate-x-1/2 hidden lg:block" />
                          <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-200 -translate-y-1/2 block lg:hidden" />
                          
                          <motion.div 
                              className="w-16 h-16 bg-black text-white rounded-2xl flex items-center justify-center shadow-2xl relative z-10"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 20, ease: "linear", repeat: Infinity }}
                          >
                             <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                 <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                             </svg>
                          </motion.div>
                          <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-white px-2 relative z-10">
                              Message Bridge
                          </div>
                          
                          {/* Data packets */}
                          <motion.div 
                             className="absolute z-20 w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
                             animate={{ x: [-100, 100], opacity: [0, 1, 1, 0] }}
                             transition={{ duration: 2, ease: "easeInOut", repeat: Infinity, repeatDelay: 1 }}
                          />
                          <motion.div 
                             className="absolute z-20 w-3 h-3 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.8)]"
                             animate={{ x: [100, -100], opacity: [0, 1, 1, 0] }}
                             transition={{ duration: 2, ease: "easeInOut", repeat: Infinity, repeatDelay: 1, delay: 1 }}
                          />
                      </div>

                      {/* L2 Side */}
                      <div className="flex-1 w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 relative">
                         <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-6">Aztec Mainnet (L2)</div>
                         
                         <div className="space-y-4">
                            <div className="bg-black/50 border border-slate-700 p-4 rounded-2xl shadow-sm hover:border-slate-500 transition-colors cursor-default relative overflow-hidden group">
                               <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400" />
                               <h4 className="font-black text-sm !text-white mb-1">L2 Outbox</h4>
                               <p className="text-xs font-mono !text-slate-300">Pushes messages to L1 via Rollup Block</p>
                            </div>
                            <div className="bg-black/50 border border-slate-700 p-4 rounded-2xl shadow-sm hover:border-slate-500 transition-colors cursor-default relative overflow-hidden">
                               <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-400" />
                               <h4 className="font-black text-sm !text-white mb-1 flex items-center gap-2">L2 Inbox <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 text-[8px] uppercase">Active</span></h4>
                               <p className="text-xs font-mono !text-slate-300">Reads cross-chain calls securely</p>
                            </div>
                         </div>
                      </div>

                   </div>
                </motion.div>
             </div>
          </div>

        </motion.div>
      </div>
    </div>
  );
}

