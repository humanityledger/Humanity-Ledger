"use client";

import { Shield, Lock, Cpu, Globe, Key, FileCode, CheckCircle, Activity, Building, Zap } from 'lucide-react';
import React, { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";

// ─── Animation primitives ────────────────────────────────────────────────────

const FADE_UP: any = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};
const STAGGER: any = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

function InViewSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  return (
    <motion.div
      ref={ref}
      variants={STAGGER}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Shared Components (Dark Aztec Theme) ────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={FADE_UP} className="flex items-center gap-3 mb-4">
      <div className="h-[1px] w-8 bg-purple-500/50" />
      <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-purple-400 font-bold">
        {children}
      </span>
    </motion.div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <motion.h2
      variants={FADE_UP}
      className="text-[36px] md:text-[52px] font-black tracking-tighter text-white leading-[1.05] mb-6"
    >
      {children}
    </motion.h2>
  );
}

function SectionBody({ children }: { children: React.ReactNode }) {
  return (
    <motion.p
      variants={FADE_UP}
      className="text-[16px] md:text-[18px] font-light text-white/60 leading-relaxed max-w-[640px] mb-8"
    >
      {children}
    </motion.p>
  );
}

interface NavButtonProps {
  href: string;
  label: string;
  variant?: "primary" | "outline";
}

function NavButton({ href, label, variant = "primary" }: NavButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 px-6 py-3.5 text-[13.5px] font-bold tracking-wide transition-all active:scale-[0.98] rounded-none";
  const styles =
    variant === "primary"
      ? `${base} bg-white text-black hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.1)]`
      : `${base} border border-white/20 text-white hover:bg-white/[0.05] hover:border-white/40`;
  return (
    <Link href={href} className={styles}>
      {label}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

interface FeatureItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureItem({ icon, title, description }: FeatureItemProps) {
  return (
    <motion.div variants={FADE_UP} className="flex flex-col gap-4 p-6 border border-white/10 bg-[#0A0A0A] hover:border-purple-500/40 hover:bg-[#111111] transition-all duration-300 group">
      <div className="w-12 h-12 border border-white/10 bg-black flex items-center justify-center text-white/70 group-hover:text-purple-400 group-hover:border-purple-500/30 transition-colors">
        {icon}
      </div>
      <h4 className="text-[16px] font-bold text-white tracking-tight">{title}</h4>
      <p className="text-[14px] font-light text-white/50 leading-relaxed">{description}</p>
    </motion.div>
  );
}

// ─── MODULE SHOWCASE SECTIONS ────────────────────────────────────────────────

function ForumShowcase() {
  return (
    <section id="module-forum" className="w-full bg-white border-t border-white/10 py-24 md:py-32 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-900/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="w-full max-w-[1200px] mx-auto px-6 relative z-10">
        <InViewSection>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <div>
              <SectionLabel>Governance & Discourse</SectionLabel>
              <SectionTitle>
                Where sovereign minds<br />
                <span className="text-white/40">deliberate publicly.</span>
              </SectionTitle>
              <SectionBody>
                The Humanity Ledger Forum is a fully on-chain governance and discourse infrastructure. Every topic, proposal, and debate is cryptographically attributed to a verified Humanity Ledger identity — ensuring every voice belongs to a real, Sybil-resistant participant. No bots, no ghost accounts, no anonymous manipulation.
              </SectionBody>
              <motion.p variants={FADE_UP} className="text-[14px] font-mono text-purple-300/70 mb-10 leading-relaxed border-l-2 border-purple-500/30 pl-4">
                Built on the Humanity Ledger ZK stack, participation is permissionless for reading and identity-gated for writing. Escalate discourse directly to on-chain votes.
              </motion.p>
              <motion.div variants={FADE_UP} className="flex flex-wrap items-center gap-4">
                <NavButton href="/forum" label="Enter Forum" />
                <NavButton href="/forum/new" label="Post a Topic" variant="outline" />
              </motion.div>
            </div>
            <motion.div variants={FADE_UP} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FeatureItem
                icon={<Shield size={20} />}
                title="Sybil-Resistant Threads"
                description="Each post is anchored to a verified ZK identity — impossible to duplicate or fabricate."
              />
              <FeatureItem
                icon={<Building size={20} />}
                title="Governance Proposals"
                description="Submit protocol upgrade proposals that escalate directly to Humanity Ledger on-chain voting."
              />
              <FeatureItem
                icon={<Globe size={20} />}
                title="Public Discourse"
                description="Engage with the global Humanity Ledger community on research, security, and strategy."
              />
              <FeatureItem
                icon={<Activity size={20} />}
                title="Live Activity Feed"
                description="Real-time notifications for replies, mentions, and critical governance milestones."
              />
            </motion.div>
          </div>
        </InViewSection>
      </div>
    </section>
  );
}

function DevelopersShowcase() {
  return (
    <section id="module-developers" className="w-full bg-[#000000] border-t border-white/10 py-24 md:py-32 relative overflow-hidden">
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-900/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="w-full max-w-[1200px] mx-auto px-6 relative z-10">
        <InViewSection>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <motion.div variants={FADE_UP} className="order-2 lg:order-1 w-full max-w-full">
              <div className="bg-white border border-white/10 rounded-lg p-6 font-mono text-[13px] leading-7 shadow-2xl overflow-x-auto w-full">
                <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                  <span className="ml-2 text-white/30 text-[11px]">aztec-terminal.ts</span>
                </div>
                <div className="text-white/40">{"// Initialize the sovereign application layer"}</div>
                <div><span className="text-purple-400">import</span> <span className="text-yellow-200">{'{ AztecTerminal }'}</span> <span className="text-purple-400">from</span> <span className="text-green-300">{'@ledger-network/aztec'}</span><span className="text-white/40">;</span></div>
                <div className="mt-2"><span className="text-purple-400">const</span> <span className="text-white">terminal</span> <span className="text-purple-400">{'='}</span> <span className="text-purple-400">new</span> <span className="text-yellow-200">AztecTerminal()</span><span className="text-white/40">;</span></div>
                <div className="mt-5 text-white/40">{"// Execute Noir circuit with maximum privacy"}</div>
                <div><span className="text-purple-400">await</span> <span className="text-white">terminal.</span><span className="text-blue-300">executeShielded</span><span className="text-white/40">({'{'}</span></div>
                <div className="pl-4"><span className="text-white/80">privacy_mode:</span> <span className="text-green-300">"MAXIMUM"</span><span className="text-white/40">,</span></div>
                <div className="pl-4"><span className="text-white/80">circuit:</span> <span className="text-green-300">"noir_identity_proof"</span><span className="text-white/40">,</span></div>
                <div className="pl-4"><span className="text-white/80">pxe_target:</span> <span className="text-green-300">"localhost:8080"</span></div>
                <div className="text-white/40">{'}'})<span className="text-white/40">;</span></div>
              </div>
            </motion.div>
            <div className="order-1 lg:order-2">
              <SectionLabel>Sovereign Application Layer</SectionLabel>
              <SectionTitle>
                The sovereign gateway<br />
                <span className="text-white/40">to Humanity Ledger Network.</span>
              </SectionTitle>
              <SectionBody>
                Humanity Ledger operates as the sovereign application layer over zero knowledge execution environment. We abstract the complexity of ZK circuits into a sovereign-grade terminal — providing high-net-worth individuals and enterprises with complete privacy over their transactions, assets, and communications.
              </SectionBody>
              <motion.div variants={FADE_UP} className="flex flex-wrap items-center gap-4">
                <NavButton href="/developers/api-docs" label="View API Docs" />
                <NavButton href="/developer/sandbox" label="Try Sandbox" variant="outline" />
                <NavButton href="/developer/introduction-to-decentralised-analysis" label="Read Guides" variant="outline" />
              </motion.div>
            </div>
          </div>
        </InViewSection>
      </div>
    </section>
  );
}

function RegistryShowcase() {
  return (
    <section id="module-registry" className="w-full bg-white border-t border-white/10 py-24 md:py-32">
      <div className="w-full max-w-[1200px] mx-auto px-6">
        <InViewSection>
          <div className="text-center mb-16 flex flex-col items-center">
            <SectionLabel>Identity Registry</SectionLabel>
            <SectionTitle>
              Sovereign identity,<br />
              <span className="text-white/40">verified across 195 countries.</span>
            </SectionTitle>
            <SectionBody>
              The Humanity Ledger Identity Registry maps cryptographic attestations to real-world verification standards across every jurisdiction. Using zero knowledge proofs, identities are verified once and proven indefinitely — without repeated document disclosure. This is the compliance layer of the post-KYC era.
            </SectionBody>
            <motion.div variants={FADE_UP} className="flex flex-wrap items-center justify-center gap-4 mt-4">
              <NavButton href="/registry" label="Explore Registry" />
              <NavButton href="/clearance" label="Get Clearance" variant="outline" />
            </motion.div>
          </div>

          <motion.div variants={STAGGER} className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border border-white/10">
            {[
              { value: "195", unit: "Countries", label: "Global coverage" },
              { value: "ZK", unit: "Protocol", label: "Noir circuits" },
              { value: "W3C", unit: "Standard", label: "Verifiable Credentials" },
              { value: "0", unit: "Data Leakage", label: "Private by design" },
            ].map((stat, i) => (
              <motion.div key={i} variants={FADE_UP} className="bg-[#0A0A0A] px-6 py-10 flex flex-col items-center text-center">
                <div className="text-[40px] md:text-[56px] font-black text-white tracking-tighter leading-none mb-2">
                  {stat.value}
                </div>
                <div className="text-[12px] font-mono uppercase tracking-widest text-purple-400 mb-2">
                  {stat.unit}
                </div>
                <div className="text-[13px] font-light text-white/50">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </InViewSection>
      </div>
    </section>
  );
}

function LedgerChatShowcase() {
  return (
    <section id="module-ledger-chat" className="w-full bg-[#000000] border-t border-white/10 py-24 md:py-32 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-900/5 blur-[200px] rounded-full pointer-events-none" />
      <div className="w-full max-w-[1200px] mx-auto px-6 relative z-10">
        <InViewSection>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
            <div>
              <SectionLabel>ZK Encrypted Messaging</SectionLabel>
              <SectionTitle>
                Communication without<br />
                <span className="text-white/40">a trace.</span>
              </SectionTitle>
              <SectionBody>
                Ledger Chat is the first messaging protocol built natively on the Humanity Ledger Private Execution Environment. Messages are encrypted, anchored to your cryptographic identity, and verified without any metadata ever touching a central server. No phone number. No IP logging. No third-party key custody.
              </SectionBody>
              <motion.div variants={FADE_UP} className="mb-10 p-5 border border-white/10 bg-[#0A0A0A] border-l-2 border-l-emerald-500">
                <p className="text-[14px] font-light text-white/70 leading-relaxed">
                  <strong className="text-white font-bold block mb-1">Turing-Shield Compliance:</strong>
                  Ledger Chat enforces hardware-gated identity verification. Every participant is Sybil-resistant, making it structurally impossible to operate anonymously for malicious purposes — unlike traditional messengers where anonymous onboarding allows abuse.
                </p>
              </motion.div>
              <motion.div variants={FADE_UP} className="flex flex-wrap items-center gap-4">
                <NavButton href="/chat" label="Open LedgerChat" />
                <NavButton href="/connect" label="Connect Wallet First" variant="outline" />
              </motion.div>
            </div>
            <motion.div variants={FADE_UP} className="flex flex-col gap-4">
              {[
                {
                  title: "End to End ZK Encryption",
                  desc: "Messages are encrypted using keys derived from your private note. The server processes only nullifiers — never content.",
                  badge: "Humanity Ledger Native",
                },
                {
                  title: "Turing-Shield Identity Gate",
                  desc: "Hardware-anchored verification ensures every participant is a real human. Cybercriminals cannot bypass identity with VPNs.",
                  badge: "Security",
                },
                {
                  title: "No Metadata Retention",
                  desc: "Timestamp, sender, recipient and message size are all shielded. The network has zero knowledge of who said what to whom.",
                  badge: "Privacy",
                },
                {
                  title: "Regulatory Disclosure Keys",
                  desc: "Generate selective viewing keys for legal compliance. Prove you sent a message to a regulator without revealing other conversations.",
                  badge: "Compliance",
                },
              ].map((item, i) => (
                <div key={i} className="flex gap-5 p-6 border border-white/10 bg-[#0A0A0A] hover:bg-[#111111] transition-colors group">
                  <div className="shrink-0 mt-1 text-white/30 group-hover:text-emerald-400 transition-colors">
                    <Lock size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-[15px] font-bold text-white tracking-tight">{item.title}</h4>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 rounded-sm">{item.badge}</span>
                    </div>
                    <p className="text-[14px] font-light text-white/50 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </InViewSection>
      </div>
    </section>
  );
}

function PortfolioShowcase() {
  return (
    <section id="module-portfolio" className="w-full bg-white border-t border-white/10 py-24 md:py-32">
      <div className="w-full max-w-[1200px] mx-auto px-6">
        <InViewSection>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <div>
              <SectionLabel>Private Wealth Layer</SectionLabel>
              <SectionTitle>
                Your entire financial life.<br />
                <span className="text-white/40">Invisible to the world.</span>
              </SectionTitle>
              <SectionBody>
                The Humanity Ledger Terminal is the sovereign operating system for high-net-worth individuals navigating the on-chain economy. Portfolio balances, transaction history, ledger movements, and liquidity flows are all tracked in real-time — and all encrypted. Your wealth management is your business alone.
              </SectionBody>
              <motion.div variants={FADE_UP} className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 mb-10">
                {[
                  "Real-time ledger movement alerts",
                  "Shielded portfolio tracking",
                  "Cross-chain asset aggregation",
                  "DeFi protocol analytics",
                  "Custom price & gas alerts",
                  "Institutional-grade reporting",
                ].map((feat, i) => (
                  <div key={i} className="flex items-center gap-3 text-[14px] font-light text-white/70">
                    <CheckCircle size={14} className="text-purple-400 shrink-0" />
                    {feat}
                  </div>
                ))}
              </motion.div>
              <motion.div variants={FADE_UP} className="flex flex-wrap items-center gap-4">
                <NavButton href="/portfolio" label="Connect & View Portfolio" />
                <NavButton href="/terminal" label="Open Terminal" variant="outline" />
              </motion.div>
            </div>
            <motion.div variants={FADE_UP} className="border border-white/10 bg-[#0A0A0A] p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Shield size={120} />
              </div>
              <div className="text-[11px] font-mono uppercase tracking-widest text-white/40 mb-6 flex items-center justify-between">
                <span>Portfolio Preview</span>
                <span className="flex items-center gap-2 text-purple-400"><Lock size={12}/> ZK-Encrypted</span>
              </div>
              <div className="space-y-5 relative z-10">
                {[
                  { token: "ETH", val: 85, pct: "+4.2%", color: "bg-emerald-500", text: "text-emerald-400" },
                  { token: "BTC", val: 65, pct: "+1.8%", color: "bg-emerald-500", text: "text-emerald-400" },
                  { token: "USDC", val: 50, pct: "±0.0%", color: "bg-white/40", text: "text-white/40" },
                  { token: "ARB", val: 35, pct: "-0.7%", color: "bg-red-500", text: "text-red-400" },
                ].map((row, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <span className="text-[14px] font-bold text-white w-12 shrink-0">{row.token}</span>
                    <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full ${row.color} opacity-80`} style={{ width: `${row.val}%` }} />
                    </div>
                    <span className={`text-[13px] font-mono font-bold w-16 text-right shrink-0 ${row.text}`}>{row.pct}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-6 border-t border-white/10 text-[11px] font-mono text-white/30 text-center tracking-widest uppercase">
                Balances encrypted — connect wallet to reveal
              </div>
            </motion.div>
          </div>
        </InViewSection>
      </div>
    </section>
  );
}

function StudioProvenanceShowcase() {
  return (
    <section id="module-studio" className="w-full bg-[#000000] border-t border-white/10 py-24 md:py-32">
      <div className="w-full max-w-[1200px] mx-auto px-6">
        <InViewSection>
          <div className="text-center flex flex-col items-center mb-16">
            <SectionLabel>ZK Asset Certification</SectionLabel>
            <SectionTitle>
              Provenance without<br />
              <span className="text-white/40">public exposure.</span>
            </SectionTitle>
            <SectionBody>
              Studio Provenance is a zero knowledge certification engine for digital and physical assets. Built on Noir circuits and deployed on the Humanity Ledger rollup, it enables creators, institutions, and collectors to establish irrefutable proof of asset origin, ownership history, and authenticity — all without revealing sensitive metadata to the public ledger.
            </SectionBody>
            <motion.div variants={FADE_UP} className="flex flex-wrap items-center justify-center gap-4 mt-2">
              <NavButton href="/studio/provenance" label="Open Studio" />
              <NavButton href="/developers/api-docs" label="Read Technical Spec" variant="outline" />
            </motion.div>
          </div>

          <motion.div variants={STAGGER} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Submit Asset",
                desc: "Upload your asset metadata — creation date, authorship, and evidence — into the private proving environment.",
                icon: <FileCode size={24} />,
              },
              {
                step: "02",
                title: "ZK Proof Generation",
                desc: "A Noir circuit generates a zero knowledge proof of your asset's provenance, signed by your Humanity Ledger identity.",
                icon: <Cpu size={24} />,
              },
              {
                step: "03",
                title: "On-Chain Certification",
                desc: "The proof is published to the Humanity Ledger rollup, creating a permanent, tamper-proof record verifiable by anyone.",
                icon: <Shield size={24} />,
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={FADE_UP}
                className="p-8 border border-white/10 bg-[#0A0A0A] flex flex-col gap-5 hover:border-purple-500/30 hover:bg-[#111111] transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-mono tracking-widest uppercase text-white/30">Step {item.step}</span>
                  <div className="text-purple-400">
                    {item.icon}
                  </div>
                </div>
                <h4 className="text-[18px] font-bold text-white tracking-tight">{item.title}</h4>
                <p className="text-[14px] font-light text-white/50 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </InViewSection>
      </div>
    </section>
  );
}

function QDSShowcase() {
  return (
    <section id="module-qds" className="w-full bg-white border-t border-white/10 py-24 md:py-32">
      <div className="w-full max-w-[1200px] mx-auto px-6">
        <InViewSection>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <motion.div variants={FADE_UP} className="border border-white/10 p-8 bg-[#0A0A0A] shadow-2xl relative">
              <div className="absolute -top-px -left-px w-20 h-px bg-purple-500" />
              <div className="absolute -top-px -left-px w-px h-20 bg-purple-500" />
              <div className="text-[12px] font-mono uppercase tracking-widest text-white/40 mb-8 flex items-center justify-between">
                <span>QDS Live Signal</span>
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> LIVE</span>
              </div>
              <div className="space-y-6">
                {[
                  { label: "Solvency Score", value: 94, color: "bg-emerald-500" },
                  { label: "Liquidity Depth", value: 78, color: "bg-purple-500" },
                  { label: "Smart Money Flow", value: 87, color: "bg-purple-500" },
                  { label: "Regulatory Risk", value: 12, color: "bg-white/20" },
                ].map((bar, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-[13px] font-mono text-white/60 mb-2">
                      <span>{bar.label}</span>
                      <span className="font-bold text-white">{bar.value}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 overflow-hidden rounded-full">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${bar.value}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.5, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
                        className={`h-full ${bar.color}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-6 border-t border-white/10 text-[11px] font-mono text-white/30 text-center uppercase tracking-widest">
                Real-time Humanity Ledger network scoring engine
              </div>
            </motion.div>
            <div>
              <SectionLabel>Quantum Data Scoring Engine</SectionLabel>
              <SectionTitle>
                On-chain intelligence,<br />
                <span className="text-white/40">quantified.</span>
              </SectionTitle>
              <SectionBody>
                The QDS (Quantum Data Scoring) module is Humanity Ledger's proprietary risk and signal intelligence framework. It aggregates on-chain activity, liquidity flows, smart money positioning, and regulatory exposure into composite scores that institutional investors use to make decisions before the market moves.
              </SectionBody>
              <motion.div variants={FADE_UP} className="flex flex-wrap items-center gap-4">
                <NavButton href="/qds" label="Open QDS Dashboard" />
                <NavButton href="/predictions" label="View Predictions" variant="outline" />
              </motion.div>
            </div>
          </div>
        </InViewSection>
      </div>
    </section>
  );
}

function TokenomicsShowcase() {
  return (
    <section id="module-tokenomics" className="w-full bg-[#000000] border-t border-white/10 py-24 md:py-32">
      <div className="w-full max-w-[1200px] mx-auto px-6">
        <InViewSection>
          <div className="text-center flex flex-col items-center mb-16">
            <SectionLabel>Economic Architecture</SectionLabel>
            <SectionTitle>
              A meritocracy,<br />
              <span className="text-white/40">built in code.</span>
            </SectionTitle>
            <SectionBody>
              Humanity Ledger's economic model is anchored on zero-founder-allocation principles. Token distribution is driven exclusively by verifiable on-chain participation — every credential earned, every governance vote submitted, every ZK proof generated. There is no insider advantage in a system where all merit is public and cryptographic.
            </SectionBody>
            <motion.div variants={FADE_UP} className="flex flex-wrap items-center justify-center gap-4 mt-2">
              <NavButton href="/tokenomics" label="Explore Tokenomics" />
              <NavButton href="/ledger" label="View Humanity Ledger" variant="outline" />
            </motion.div>
          </div>

          <motion.div variants={STAGGER} className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border border-white/10">
            {[
              { value: "0%", label: "Founder Allocation", sub: "100% merit-driven" },
              { value: "ZK", label: "Proof-of-Participation", sub: "Noir-circuit verified" },
              { value: "∞", label: "Sybil Resistance", sub: "One human, one identity" },
              { value: "L2", label: "Humanity Ledger Settlement", sub: "Ethereum-secured" },
            ].map((stat, i) => (
              <motion.div key={i} variants={FADE_UP} className="bg-[#0A0A0A] p-8 flex flex-col items-center text-center">
                <div className="text-[44px] md:text-[56px] font-black text-white tracking-tighter mb-2">{stat.value}</div>
                <div className="text-[12px] font-mono uppercase tracking-widest text-purple-400 mb-2">{stat.label}</div>
                <div className="text-[13px] font-light text-white/50">{stat.sub}</div>
              </motion.div>
            ))}
          </motion.div>
        </InViewSection>
      </div>
    </section>
  );
}

function LegalComplianceShowcase() {
  return (
    <section id="module-legal" className="w-full bg-white border-t border-white/10 py-24 md:py-32">
      <div className="w-full max-w-[1200px] mx-auto px-6">
        <InViewSection>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
            <div>
              <SectionLabel>Institutional Grade</SectionLabel>
              <SectionTitle>
                Privacy-preserving.<br />
                <span className="text-white/40">Regulatory-ready.</span>
              </SectionTitle>
              <SectionBody>
                Humanity Ledger is architected from the ground up to satisfy the most demanding legal and compliance frameworks globally — from EU GDPR and MiCA to US SEC guidance and FATF travel rules. Our compliance layer uses zero knowledge selective disclosure to satisfy auditors and regulators without public exposure of private data.
              </SectionBody>
              <motion.div variants={FADE_UP} className="flex flex-wrap items-center gap-4">
                <NavButton href="/legal/terms" label="Read Terms" />
                <NavButton href="/legal/privacy" label="Privacy Policy" variant="outline" />
                <NavButton href="/legal/security" label="Security" variant="outline" />
              </motion.div>
            </div>
            <motion.div variants={FADE_UP} className="grid grid-cols-1 gap-4">
              {[
                { badge: "EU GDPR", label: "Full data minimization compliance via ZK proof architecture." },
                { badge: "MiCA", label: "Markets in Crypto Assets regulation alignment and disclosure readiness." },
                { badge: "FATF Travel Rule", label: "Selective disclosure keys for cross-border transaction reporting." },
                { badge: "W3C VC", label: "Verifiable Credentials standard — machine-readable, court-admissible." },
                { badge: "AML/KYC", label: "Prove identity compliance without re-submitting documents repeatedly." },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-5 p-5 border border-white/10 bg-[#0A0A0A] hover:border-white/20 transition-all">
                  <span className="shrink-0 text-[10px] font-mono uppercase tracking-widest text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 mt-0.5">{item.badge}</span>
                  <p className="text-[14px] font-light text-white/70 leading-relaxed">{item.label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </InViewSection>
      </div>
    </section>
  );
}

function SupportShowcase() {
  return (
    <section id="module-support" className="w-full bg-[#000000] border-t border-white/10 py-20 md:py-28 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[300px] bg-gradient-to-r from-transparent via-purple-900/10 to-transparent pointer-events-none" />
      <div className="w-full max-w-[1200px] mx-auto px-6 relative z-10">
        <InViewSection>
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-12">
            <div className="max-w-[640px]">
              <SectionLabel>Support & Enterprise</SectionLabel>
              <SectionTitle>
                <span className="text-[32px] md:text-[44px]">Institutional<br />
                  <span className="text-white/40">support infrastructure.</span>
                </span>
              </SectionTitle>
              <SectionBody>
                Enterprise deployments, SLA agreements, custom integration support, and dedicated security consulting. Humanity Ledger provides enterprise-grade onboarding for institutions, DAOs, and regulated entities requiring bespoke zero knowledge infrastructure.
              </SectionBody>
            </div>
            <motion.div variants={FADE_UP} className="flex flex-col gap-4 w-full lg:w-auto shrink-0">
              <NavButton href="/support" label="Contact Support" />
              <NavButton href="/vip" label="VIP Programme" variant="outline" />
              <NavButton href="/partnership" label="Enterprise Partnership" variant="outline" />
            </motion.div>
          </div>
        </InViewSection>
      </div>
    </section>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export function ModuleShowcaseSections() {
  return (
    <div className="w-full bg-black">
      {/* ── Separator ── */}
      <div className="w-full max-w-[1200px] mx-auto px-6 py-12">
        <div className="flex items-center gap-6">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-white/10" />
          <span className="text-[11px] font-mono uppercase tracking-[0.3em] text-white/30 whitespace-nowrap">
            Platform Modules
          </span>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-white/10" />
        </div>
      </div>

      <ForumShowcase />
      <DevelopersShowcase />
      <RegistryShowcase />
      <LedgerChatShowcase />
      <PortfolioShowcase />
      <StudioProvenanceShowcase />
      <QDSShowcase />
      <TokenomicsShowcase />
      <LegalComplianceShowcase />
      <SupportShowcase />
    </div>
  );
}
