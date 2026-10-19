"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Terminal, Lock, Activity, Users, Server, Globe, Cpu, ArrowDown, ShieldCheck, Database, Key } from "lucide-react";
import Link from "next/link";
import { SystemFooter } from "@/components/landing/SystemFooter";

//  UTILITIES 
const StaggeredText = ({ text, className }: { text: string; className?: string }) => {
  return (
    <motion.span 
      initial="hidden" 
      whileInView="visible" 
      viewport={{ once: true }} 
      transition={{ staggerChildren: 0.03 }}
      className={className}
    >
      {text.split("").map((char, index) => (
        <motion.span 
          key={index} 
          variants={{ 
            hidden: { opacity: 0, y: 20 }, 
            visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } } 
          }}
          className="inline-block"
        >
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </motion.span>
  );
};

//  COMPONENTS 

// 1. Builder Announcements
const BuilderAnnouncements = () => {
  const [commits, setCommits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    fetch('https://api.github.com/repos/ethereum/go-ethereum/commits?per_page=3')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCommits(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="w-full max-w-[1400px] mx-auto py-32 px-6">
      <div className="flex flex-col md:flex-row justify-between items-start mb-16 gap-8">
        <h2 className="font-serif text-5xl md:text-7xl font-normal text-[#0A0A0A] leading-[1.1] tracking-tight">
          Infrastructure <br /><span className="text-black/40 italic">Releases.</span>
        </h2>
        <div className="w-full border-t flex-1 mt-6 border-black/10" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {loading ? (
           <div className="col-span-3 text-center py-20 font-mono text-[10px] uppercase tracking-widest text-black/40">
             Synchronizing core repository state...
           </div>
        ) : commits.map((c, i) => {
          const dateStr = new Date(c.commit.author.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const sha = c.sha.slice(0, 7);
          const fullMsg = c.commit.message as string;
          const title = fullMsg.split('\n')[0];
          const desc = fullMsg.split('\n').slice(1).join(' ').trim() || "Core protocol architectural update and optimization.";

          return (
            <motion.div 
               key={i}
               initial={{ opacity: 0, y: 30 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               transition={{ duration: 0.6, delay: i * 0.1 }}
               className="group relative bg-white/20 backdrop-blur-md p-8 md:p-12 border border-black/10 hover:border-[#0044CC]/30 transition-all shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,68,204,0.08)] rounded-sm min-h-[480px] flex flex-col justify-between"
            >
               <div className="relative z-10">
                 <div className="font-mono text-[10px] uppercase tracking-[0.2em] font-bold text-black/40 mb-8 flex items-center justify-between gap-2">
                   <div className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-[#0044CC] animate-pulse" /> {dateStr}
                   </div>
                   <span className="text-[#0044CC] bg-[#0044CC]/5 px-2 py-0.5 rounded-sm">SHA: {sha}</span>
                 </div>
                 <h3 className="font-serif text-2xl lg:text-[24px] font-normal text-[#0A0A0A] mb-6 leading-[1.3] group-hover:text-[#0044CC] transition-colors line-clamp-3">
                    {title}
                 </h3>
                 <p className="font-sans text-[#1a1a1a] text-[13px] leading-[1.8] tracking-[0.01em] mb-8 line-clamp-4">
                    {desc}
                 </p>
               </div>
               <a href={c.html_url} target="_blank" rel="noopener noreferrer" className="relative z-10 font-mono text-[10px] font-bold uppercase tracking-widest text-[#0044CC] flex items-center gap-4 hover:gap-6 transition-all cursor-pointer">
                  Inspect Diff <ArrowRight size={14} />
               </a>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// 2. The Full Stack (01-08)
const FullStack = () => {
  const stacks = [
    { num: "01", title: "Cryptographic Identity", desc: "Every session is anchored to provable ownership of a secp256k1 private key. No username, no password. Authentication is a mathematical fact." },
    { num: "02", title: "Ephemeral Key Exchange", desc: "Cross-device authentication uses a one-time X25519 key exchange. The resulting shared secret is used to encrypt the session payload via AES-256-GCM and is discarded immediately after use." },
    { num: "03", title: "Asymmetric Verification", desc: "Edge nodes verify JWTs using Ed25519 public keys. The signing key never leaves the issuing server, eliminating the symmetric key exposure risk present in HS256 schemes." },
    { num: "04", title: "Distributed Telemetry", desc: "A Redis topology enforces per-identity rate limits atomically. Usage ceilings are validated at the edge before any request reaches the application layer." },
    { num: "05", title: "Graph Database Topologies", desc: "Neo4j maps structural relationships between accounts, separating systemic capital flow patterns from isolated transaction events with precision that relational databases cannot match." },
    { num: "06", title: "Heuristic Block Analysis", desc: "Continuous state monitoring evaluates gas expenditure, contract interaction patterns, and timing characteristics to surface sovereign behavioural signals in real time." },
    { num: "07", title: "Encrypted Messaging", desc: "Peer-to-peer communications are end to end encrypted at the protocol layer, anchored to wallet keys. No server holds the decryption material." },
    { num: "08", title: "Zero-Trust Service Layer", desc: "API access is provisioned programmatically by verifying cryptographic subscription proofs. No manual intervention or privileged human access is involved in the authorisation path." }
  ];

  return (
    <div className="w-full max-w-[1400px] mx-auto py-40 px-6">
      <div className="mb-24 px-8 border-l-[3px] border-[#0044CC]">
         <h2 className="font-serif text-5xl lg:text-[72px] font-normal text-[#0A0A0A] leading-[1.0] tracking-tight">
            Core <br/> <span className="text-black/40 italic">Infrastructure.</span>
         </h2>
         <p className="mt-10 font-sans text-[20px] text-[#1a1a1a] max-w-4xl leading-[1.8] tracking-[0.01em]">
            Every system layer is built with precision. We implement a deterministic, cryptographically provable framework designed for high-frequency analytical environments and zero knowledge privacy operations.
         </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-24 gap-x-16 lg:gap-x-32">
        {stacks.map((s, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: (i % 2) * 0.2 }}
            className="group"
          >
            <div className="font-mono text-3xl font-bold text-black/10 mb-6 group-hover:text-[#0044CC] transition-colors duration-500">
               {s.num}
            </div>
            <h3 className="font-serif text-[28px] font-normal text-[#0A0A0A] leading-[1.3] mb-6">
               {s.title}
            </h3>
            <p className="font-sans text-[16px] text-black/70 leading-[1.8] border-l border-black/10 pl-6 group-hover:border-[#0044CC]/30 transition-colors duration-500">
               {s.desc}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// 3. Tools and Libraries Grid
const ToolsAndLibraries = () => {
  return (
    <div className="bg-transparent text-[#0A0A0A] py-40 px-6 border-y border-black/5">
       <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-20">
          <div className="lg:w-1/3">
             <div className="font-mono text-[10px] uppercase tracking-[0.3em] font-bold text-[#0044CC] mb-8">Tools and Repositories</div>
             <h2 className="font-serif text-5xl lg:text-[64px] font-normal leading-[1.0] tracking-tight mb-10 text-balance">
               Build on <br/>the <span className="italic text-black/40">Architecture.</span>
             </h2>
             <p className="font-sans text-xl text-black/60 italic border-l-2 border-[#0044CC] pl-6 py-2 leading-relaxed">
               Access our primary suites for heuristic analytics and cryptographic validation.
             </p>
          </div>

          <div className="lg:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-[#FFFFFF] p-10 hover:bg-black/[0.02] transition-colors border border-black/5 rounded-sm">
                <div className="font-mono text-[10px] font-bold tracking-widest uppercase text-black/40 mb-8 border-b border-black/10 pb-4">On-Chain Analytics</div>
                <div className="space-y-6 font-serif text-[22px] font-normal">
                   <div className="hover:text-[#0044CC] cursor-pointer transition-colors flex items-center justify-between group">
                     Sovereign Dashboard <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                   </div>
                   <div className="hover:text-[#0044CC] cursor-pointer transition-colors flex items-center justify-between group">
                     Cryptographic Ledger Engine <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                   </div>
                </div>
             </div>
             <div className="bg-[#FFFFFF] p-10 hover:bg-black/[0.02] transition-colors border border-black/5 rounded-sm">
                <div className="font-mono text-[10px] font-bold tracking-widest uppercase text-black/40 mb-8 border-b border-black/10 pb-4">Identity Protocols</div>
                <div className="space-y-6 font-serif text-[22px] font-normal">
                   <div className="hover:text-[#0044CC] cursor-pointer transition-colors flex items-center justify-between group">
                     Verification API <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                   </div>
                   <div className="hover:text-[#0044CC] cursor-pointer transition-colors flex items-center justify-between group">
                     Attestation Grid <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                   </div>
                </div>
             </div>
             <div className="bg-[#FFFFFF] p-10 hover:bg-black/[0.02] transition-colors border border-black/5 rounded-sm">
                <div className="font-mono text-[10px] font-bold tracking-widest uppercase text-black/40 mb-8 border-b border-black/10 pb-4">Regulatory Attestation</div>
                <div className="space-y-6 font-serif text-[22px] font-normal">
                   <div className="hover:text-[#0044CC] cursor-pointer transition-colors flex items-center justify-between group">
                     Attestation Automation Toolkit <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                   </div>
                   <div className="hover:text-[#0044CC] cursor-pointer transition-colors flex items-center justify-between group">
                     Data Wiping Specifications <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                   </div>
                </div>
             </div>
             <div className="bg-[#FFFFFF] p-10 hover:bg-black/[0.02] transition-colors border border-black/5 rounded-sm md:row-span-2 flex flex-col justify-between">
                <div>
                   <div className="font-mono text-[10px] font-bold tracking-widest uppercase text-black/40 mb-8 border-b border-black/10 pb-4">Development Environment</div>
                   <div className="mb-10">
                      <div className="font-serif text-[26px] font-normal hover:text-[#0044CC] cursor-pointer transition-colors mb-6">System Sandbox</div>
                      <p className="font-sans text-[15px] leading-[1.8] tracking-[0.01em] text-black/70">
                        An isolated test environment enabling developers to execute zero knowledge circuit tests and REST queries with minimal network latency before mainnet deployment.
                      </p>
                   </div>
                </div>
                <div className="mt-8 pt-8 border-t border-black/5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#0044CC] flex items-center gap-4 hover:gap-6 transition-all cursor-pointer">
                   Explore Documentation <ArrowRight size={14} />
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

// 4. Sandbox Callout
const SandboxSection = () => {
  return (
    <div className="w-full bg-[#FFFFFF]">
       <div className="max-w-[1400px] mx-auto py-40 px-6 flex flex-col md:flex-row items-center gap-20">
          <div className="md:w-1/2">
             <div className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[#0044CC] mb-8">Testing Environment</div>
             <h2 className="font-serif text-5xl md:text-[80px] font-normal text-[#0A0A0A] leading-[1.0] tracking-tight mb-10 text-balance">
                Test.<br/> Validate. <br/><span className="text-black/40 italic">Deploy.</span>
             </h2>
             <p className="font-sans text-[20px] text-black/60 leading-[1.6] mb-12 max-w-md">
               Execute cryptographic validation within our deterministically isolated local environments.
             </p>
             <button className="px-10 py-5 bg-[#0A0A0A] text-white font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-[#222] transition-colors rounded-sm shadow-xl">
                Access Sandbox
             </button>
          </div>
          
          <div className="md:w-1/2 w-full space-y-4">
             {[
               { title: "Instantiate Test Models", sub: "Initialize Graph Databases", icon: Database },
               { title: "Invoke Circuit Witnesses", sub: "Test Proof Generation Locally", icon: ShieldCheck },
               { title: "Query Endpoint Latency", sub: "Benchmark API Constraints", icon: Activity }
             ].map((item, i) => (
                <div key={i} className="group p-8 bg-white/20 backdrop-blur-md border border-black/10 flex items-center justify-between cursor-pointer hover:border-[#0044CC]/40 hover:shadow-lg transition-all rounded-sm">
                   <div className="flex items-center gap-8">
                      <div className="w-14 h-14 bg-[#FFFFFF] border border-black/10 text-[#0A0A0A] rounded-full flex items-center justify-center group-hover:bg-[#0044CC] group-hover:text-white transition-colors">
                         <item.icon size={22} strokeWidth={1.5} />
                      </div>
                      <div>
                         <div className="font-serif text-[22px] font-normal text-[#0A0A0A] mb-2">{item.title}</div>
                         <div className="font-mono text-[10px] uppercase tracking-widest font-bold text-black/40">{item.sub}</div>
                      </div>
                   </div>
                   <ArrowRight size={20} className="text-black/20 group-hover:text-[#0044CC] transition-colors group-hover:translate-x-2" />
                </div>
             ))}
          </div>
       </div>
    </div>
  );
};

// 5. Authentication Lifecycle Diagram
const TransactionDiagram = () => {
  return (
    <div className="bg-[#0A0A0A] text-white py-40 px-6">
      <div className="max-w-[1400px] mx-auto text-center mb-32">
         <div className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[#0044CC] mb-8">System Flow</div>
         <h2 className="font-serif text-5xl md:text-[72px] font-normal leading-[1.05] tracking-tight mb-10">
            Authentication <br/><span className="italic text-white/50">Execution</span>
         </h2>
         <p className="font-sans text-[18px] text-white/60 max-w-4xl mx-auto leading-[1.8] border-b border-white/10 pb-20">
            Review the deterministic sequence mapping a secure cryptographic login.
         </p>
      </div>

      <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 items-stretch">
         {/* 1. Mobile Signer */}
         <div className="border border-white/10 p-10 flex flex-col justify-between hover:bg-white/[0.02] transition-colors group rounded-sm">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 mb-8">Phase 01</div>
            <h3 className="font-serif text-[26px] font-normal text-[#0044CC] mb-6 leading-[1.2]">Client Signer</h3>
            <p className="font-sans text-[14px] text-white/60 mb-12 leading-[1.7]">The client generates a deterministic signature utilizing an elliptic curve keypair without exposing private data.</p>
            <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center font-mono text-xl font-bold group-hover:bg-white group-hover:text-black transition-colors mt-auto">
                <Terminal size={20} strokeWidth={1.5} />
            </div>
         </div>

         {/* 2. QR Mesh Tunnel */}
         <div className="border border-white/10 p-10 flex flex-col justify-between bg-white/[0.02] hover:bg-white/[0.04] transition-colors group col-span-1 lg:col-span-2 rounded-sm">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 mb-8">Phase 02</div>
            <h3 className="font-serif text-[28px] font-normal mb-8">X25519 Ephemeral Handshake</h3>
            <div className="grid grid-cols-2 gap-8">
               <div>
                  <h4 className="font-mono text-[11px] font-bold tracking-widest uppercase text-white/80 mb-3">Key Derivation</h4>
                  <p className="font-sans text-[13px] text-white/50 leading-[1.6]">Clients independently calculate a shared secret employing out-of-band ephemeral materials.</p>
               </div>
               <div>
                  <h4 className="font-mono text-[11px] font-bold tracking-widest uppercase text-white/80 mb-3">AES-GCM Tunnel</h4>
                  <p className="font-sans text-[13px] text-white/50 leading-[1.6]">Data transits through authenticated symmetric encryption.</p>
               </div>
            </div>
         </div>

         {/* 3. EdDSA Middleware */}
         <div className="border border-[#0044CC]/40 p-10 flex flex-col justify-between bg-[#0044CC]/5 hover:bg-[#0044CC]/10 transition-colors group col-span-1 lg:col-span-2 rounded-sm shadow-[0_0_40px_rgb(0,68,204,0.1)]">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[#0044CC] mb-8">Phase 03</div>
            <h3 className="font-serif text-[28px] font-normal mb-6">Asymmetric Verification</h3>
            <p className="font-sans text-[14px] text-white/80 mb-10 leading-[1.7]">Authentication servers confirm signature validity and issue a heavily restricted JSON Web Token (JWT).</p>
            
            <div className="bg-black/50 p-6 rounded-sm border border-white/10 mt-auto">
               <div className="flex items-center justify-between mb-4">
                  <div className="text-[13px] text-white/90 font-mono font-bold">Ed25519 JWT</div>
                  <div className="text-[10px] text-white/40 font-mono uppercase tracking-widest">Stateless Session</div>
               </div>
               <div className="flex items-center justify-between">
                  <div className="text-[13px] text-white/90 font-mono font-bold">SameSite=Lax</div>
                  <div className="text-[10px] text-white/40 font-mono uppercase tracking-widest">Cross-Site Protection</div>
               </div>
            </div>
         </div>

         {/* 4. Redis Tier Limiting */}
         <div className="border border-white/10 p-10 flex flex-col justify-center hover:bg-white/[0.02] transition-colors group col-span-1 md:col-span-3 lg:col-span-3 min-h-[300px] rounded-sm">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 mb-8">Phase 04</div>
            <h3 className="font-serif text-[32px] font-normal mb-10">Telemetry Architecture</h3>
            <div className="flex flex-col md:flex-row gap-8">
               <div className="flex-1 bg-white/[0.03] p-8 border-l-[3px] border-[#0044CC]">
                  <p className="text-[13px] font-mono font-bold uppercase tracking-widest text-white mb-4">Distributed Logging</p>
                  <p className="text-[14px] font-sans text-white/60 leading-[1.6]">In-memory data structures map usage volumes strictly evaluating JWT clearance.</p>
               </div>
               <div className="flex-1 bg-white/[0.03] p-8 border-l-[3px] border-white/20">
                  <p className="text-[13px] font-mono font-bold uppercase tracking-widest text-white mb-4">Isolation Headers</p>
                  <p className="text-[14px] font-sans text-white/60 leading-[1.6]">COOP and COEP responses lock origin data securely.</p>
               </div>
            </div>
         </div>

         {/* 5. Terminal Access */}
         <div className="border border-white/10 p-10 flex flex-col justify-between hover:bg-white/[0.02] transition-colors group col-span-1 md:col-span-2 lg:col-span-2 min-h-[300px] rounded-sm">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 mb-8">Phase 05</div>
            <h3 className="font-serif text-[32px] font-normal text-white mb-8">Verified Connectivity</h3>
            <p className="font-sans text-[15px] text-white/60 mb-10 leading-[1.7]">
               End-user sessions transition to authorized status, unlocking REST endpoints.
            </p>
            <div className="flex items-center gap-6 border-t border-white/10 pt-8 mt-auto">
               <div className="w-12 h-12 flex-shrink-0 bg-white border border-white text-black rounded-full flex items-center justify-center font-bold">
                   <Activity size={20} strokeWidth={1.5} />
               </div>
               <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-white/60">Execution Granted</div>
            </div>
         </div>

      </div>
    </div>
  );
};

// 6. Sovereign Attestation & Cryptography
const ResearchSection = () => {
  return (
    <div className="w-full bg-[#FFFFFF] py-40 px-6 border-y border-black/5">
      <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-20 items-center">
         <div className="lg:w-1/3">
            <h2 className="font-serif text-5xl md:text-[64px] font-normal text-[#0A0A0A] leading-[1.05] tracking-tight mb-12">
               Protocol <br/><span className="italic text-black/40">Attestation.</span>
            </h2>
            <div className="space-y-6">
               {["Data Minimization", "Deterministic Deletion", "Zero-Trust Architecture", "EdDSA Proofs", "X25519 Intercept Guard", "Authenticated Encryption"].map((term, i) => (
                  <div key={i} className="font-mono text-[11px] font-bold tracking-[0.2em] text-black/30 uppercase hover:text-black/80 transition-colors cursor-default select-none">
                     {term}
                  </div>
               ))}
            </div>
         </div>

         <div className="lg:w-2/3 grid grid-cols-1 md:grid-cols-3 gap-y-16 gap-x-12 lg:pl-20">
            <div className="border-t-[3px] border-[#0044CC] pt-8">
               <div className="font-serif text-[80px] font-normal text-[#0A0A0A] leading-[1.0] mb-6">0%</div>
               <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/60 mb-3">Stored Plaintext</div>
               <div className="font-sans text-[14px] text-black/40 leading-relaxed">Cryptographic proof dependencies negate database persistence.</div>
            </div>

            <div className="border-t-[3px] border-black/10 pt-8">
               <div className="font-serif text-[80px] font-normal text-[#0A0A0A] leading-[1.0] mb-6">256</div>
               <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/60 mb-3">Bit Encryption</div>
               <div className="font-sans text-[14px] text-black/40 leading-relaxed">Industry standard Advanced Encryption Standard configurations.</div>
            </div>

            <div className="border-t-[3px] border-black/10 pt-8">
               <div className="font-serif text-[80px] font-normal text-[#0A0A0A] leading-[1.0] mb-6">1</div>
               <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/60 mb-3">Immutable Hash</div>
               <div className="font-sans text-[14px] text-black/40 leading-relaxed">Cryptographically deterministic hashes replace sensitive records.</div>
            </div>
         </div>
      </div>
    </div>
  );
};

// 7. FAQs
const FAQs = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      q: "Why use Ed25519 asymmetric signatures for JWT validation instead of a shared secret?",
      a: "Symmetric schemes like HS256 require every edge node to hold the same secret used to sign tokens. If any one of those nodes is compromised, the entire token infrastructure is at risk. With Ed25519, only the issuing server holds the private signing key. Edge nodes verify using the corresponding public key, so a breach of a verification node reveals nothing exploitable."
    },
    {
      q: "How does the X25519 ephemeral handshake protect the QR session transfer?",
      a: "Standard WebSocket flows are susceptible to local network interception. Our protocol generates a fresh X25519 keypair for every session transfer, computes a shared secret out-of-band, and encrypts the session credentials with AES-256-GCM before transmitting them. The ephemeral keys are discarded once the handshake completes, so past sessions cannot be decrypted even if future keys are compromised."
    },
    {
      q: "What is the purpose of the Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers?",
      a: "These headers instruct the browser to enforce strict memory boundaries within the JavaScript engine. Without them, timing side-channel attacks such as Spectre can read memory across origin boundaries. Enforcing COOP and COEP eliminates the shared memory state that those attacks depend on."
    },
    {
      q: "How is data deletion cryptographically verified?",
      a: "When a deletion request is processed, database records are replaced with their SHA-256 hash. The original data is overwritten and cannot be recovered. The hash serves as a verifiable audit proof that the record existed and was destroyed, without retaining any of the original content."
    }
  ];

  return (
    <div className="w-full bg-transparent text-[#0A0A0A] py-40 px-6">
       <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-24">
          <div className="lg:w-1/3">
             <div className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[#0044CC] mb-8">Documentation</div>
             <h2 className="font-serif text-5xl md:text-[64px] font-normal leading-[1.05] tracking-tight mb-10">
               Protocol <br /> <span className="italic text-black/40">Inquiries.</span>
             </h2>
             <p className="font-sans text-[16px] text-black/60 leading-[1.8]">
               Detailed explanations of the cryptographic paradigms anchoring the backend infrastructure.
             </p>
          </div>
          <div className="lg:w-2/3 border-t border-black/10">
             {faqs.map((f, i) => (
                <div 
                   key={i} 
                   onClick={() => setOpenIndex(openIndex === i ? null : i)}
                   className="py-10 border-b border-black/10 flex justify-between items-start group cursor-pointer hover:border-[#0044CC] transition-all duration-300"
                >
                   <div className="flex-1 pr-12">
                     <h4 className="font-serif text-[24px] font-normal text-[#0A0A0A] group-hover:text-[#0044CC] leading-[1.4] transition-colors">
                       {f.q}
                     </h4>
                     <AnimatePresence>
                        {openIndex === i && (
                           <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-6 text-[#1a1a1a] font-sans text-[16px] leading-[1.8] overflow-hidden"
                           >
                              {f.a}
                           </motion.div>
                        )}
                     </AnimatePresence>
                   </div>
                   <div className={`w-10 h-10 shrink-0 border border-black/10 rounded-full flex items-center justify-center transition-all duration-500 group-hover:border-[#0044CC] ${openIndex === i ? "bg-[#0044CC] text-white rotate-0" : "bg-transparent text-black/30 -rotate-90"}`}>
                      <ArrowDown size={18} strokeWidth={1.5} />
                   </div>
                </div>
             ))}
          </div>
       </div>
    </div>
  );
};

//  MAIN PAGE COMPONENT 
export default function DevelopersPage() {
  return (
    <div className="min-h-screen bg-white text-[#0A0A0A] overflow-x-hidden font-sans selection:bg-black/10 selection:text-[#0A0A0A]">
      
      {/*  TOP NAV SPACER  */}
      <div className="fixed top-0 left-0 right-0 z-50 px-8 py-6 pointer-events-none flex justify-center backdrop-blur-md bg-white/20 border-b border-black/5">
         <Link href="/" className="pointer-events-auto font-mono text-[10px] font-bold uppercase tracking-widest text-black/40 hover:text-black transition-colors flex items-center gap-2">
            <ArrowRight size={12} className="rotate-180" /> Return to Root
         </Link>
      </div>
      
      {/*  HERO SECTION  */}
      <section className="relative min-h-[90vh] flex flex-col justify-center px-6 pt-32 pb-24">
         <div className="max-w-[1400px] mx-auto w-full relative z-10 text-center flex flex-col items-center mt-12">
            
            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-black/60 mb-12 border border-black/10 rounded-full px-6 py-2 bg-white/20 backdrop-blur-md shadow-sm"
            >
               Developer Resources
            </motion.div>

            <h1 className="font-serif text-[clamp(3.5rem,8vw,110px)] font-normal text-[#0A0A0A] leading-[0.95] tracking-tight text-balance max-w-[95vw] mb-12">
               Protocol <br/>
               <span className="italic relative inline-block text-black/40 px-4 mt-2">
                  Architecture.
               </span>
            </h1>

            <motion.p 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ delay: 0.2 }}
               className="font-sans text-[20px] md:text-[24px] text-[#1a1a1a] max-w-4xl leading-[1.7] mb-20 text-balance tracking-[0.01em]"
             >
               The definitive technical reference for builders integrating with Humanity Ledger. This document covers the exact cryptographic models, zero knowledge constraints, and state transition logic that power the underlying architecture. Last updated October 19, 2026.
             </motion.p>

         </div>
      </section>

      {/*  SECTIONS  */}
      <BuilderAnnouncements />
      <FullStack />
      <ToolsAndLibraries />
      <SandboxSection />
      <TransactionDiagram />
      <ResearchSection />
      <FAQs />

      {/*  FOOTER CALLOUT  */}
      <SystemFooter />

    </div>
  );
}
