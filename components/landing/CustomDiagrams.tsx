"use client";

import React from "react";
import { motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

// ── Shared atoms ───────────────────────────────────────────────────────────────
function DiagramCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`w-full bg-white border border-slate-200/80 rounded-[28px] p-8 md:p-12 shadow-[0_4px_40px_rgba(0,0,0,0.05)] my-12 ${className}`}
    >
      {children}
    </div>
  );
}

function DiagramHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center mb-10">
      <h4 className="text-[18px] font-bold text-slate-900 tracking-tight">{title}</h4>
      <p className="text-slate-400 text-[13px] mt-1.5 font-medium">{subtitle}</p>
    </div>
  );
}

function Node({ label, sub, color = "bg-white border-slate-200", textColor = "text-slate-700" }: {
  label: string;
  sub?: string;
  color?: string;
  textColor?: string;
}) {
  return (
    <div className={`border rounded-xl p-3 text-center shadow-sm ${color}`}>
      <span className={`block text-[12px] font-bold leading-tight ${textColor}`}>{label}</span>
      {sub && <span className="block text-[10px] text-slate-400 mt-0.5 font-medium">{sub}</span>}
    </div>
  );
}

function Arrow({ label, dir = "down", color = "text-slate-300" }: {
  label?: string;
  dir?: "down" | "right" | "up";
  color?: string;
}) {
  const arrows = { down: "↓", right: "→", up: "↑" };
  return (
    <div className={`flex flex-col items-center justify-center gap-0.5 ${color}`}>
      <span className="text-lg leading-none">{arrows[dir]}</span>
      {label && <span className="text-[9px] font-bold uppercase tracking-wider opacity-60 whitespace-nowrap">{label}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Architecture Diagram
// ─────────────────────────────────────────────────────────────────────────────
export function ArchitectureDiagram() {
  return (
    <DiagramCard>
      <DiagramHeader
        title="Aztec Network Architecture"
        subtitle="Combining L1 Security with L2 Programmable Privacy"
      />

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mb-10">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-slate-100 border border-slate-300" />
          <span className="text-[11px] text-slate-500 font-medium">Ethereum L1 — Fully Public</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-indigo-100 border border-indigo-300" />
          <span className="text-[11px] text-slate-500 font-medium">Aztec L2 — Programmable Privacy</span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        {/* ── L1 Column ── */}
        <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h5 className="text-[13px] font-black text-slate-700 uppercase tracking-wider">Ethereum L1</h5>
            <span className="text-[9px] font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full uppercase tracking-widest">Public</span>
          </div>
          <div className="flex flex-col gap-3">
            <Node label="Public State" sub="Ledger" color="bg-white border-slate-200" />
            <Arrow label="executes via" color="text-slate-300" />
            <Node label="Smart Contracts" sub="EVM" color="bg-white border-slate-200" />
          </div>
        </div>

        {/* ── Connector ── */}
        <div className="flex flex-row lg:flex-col justify-center items-center gap-2 py-2 lg:py-8">
          <div className="h-px w-12 lg:h-12 lg:w-px bg-indigo-200" />
          <div className="text-center px-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-indigo-400 whitespace-nowrap block">Rollup Proofs</span>
            <span className="text-[9px] font-black uppercase tracking-wider text-indigo-400 whitespace-nowrap block">& State Roots</span>
          </div>
          <div className="h-px w-12 lg:h-12 lg:w-px bg-indigo-200" />
        </div>

        {/* ── L2 Column ── */}
        <div className="flex-[1.5] bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h5 className="text-[13px] font-black text-indigo-800 uppercase tracking-wider">Aztec L2</h5>
            <span className="text-[9px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full uppercase tracking-widest">Private</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Private env */}
            <div className="bg-white border border-indigo-100 rounded-xl p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-indigo-600 mb-3">Private Env</p>
              <div className="flex flex-col gap-2">
                <Node label="User Device (Noir)" color="bg-indigo-50 border-indigo-200" textColor="text-indigo-800" />
                <Arrow color="text-indigo-200" />
                <Node label="Encrypted State" color="bg-slate-900 border-slate-800" textColor="text-white" />
              </div>
            </div>

            {/* Public env */}
            <div className="bg-white border border-slate-100 rounded-xl p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Public Env</p>
              <div className="flex flex-col gap-2">
                <Node label="Aztec Sequencer" color="bg-slate-50 border-slate-200" textColor="text-slate-700" />
                <Arrow color="text-slate-200" />
                <Node label="Public State" color="bg-slate-50 border-slate-200" textColor="text-slate-700" />
              </div>
            </div>
          </div>

          {/* ZK proof bridge */}
          <div className="mt-4 flex items-center justify-center gap-3 bg-indigo-600 rounded-xl py-3 px-5 shadow-lg shadow-indigo-500/25">
            <span className="text-[10px] font-black text-white uppercase tracking-wider">ZK Proofs — No server access to private state</span>
            <span className="text-white/60">→</span>
          </div>
        </div>
      </div>
    </DiagramCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ZK Rollup Comparison Diagram
// ─────────────────────────────────────────────────────────────────────────────
export function ZkRollupComparisonDiagram() {
  return (
    <DiagramCard>
      <DiagramHeader
        title="Myth vs Reality"
        subtitle="Standard ZK Rollups vs True Privacy Rollups"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ── Standard ZK ── */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h5 className="text-[13px] font-black text-slate-700">Standard ZK Rollups</h5>
            <span className="text-[9px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">No Privacy</span>
          </div>
          <p className="text-[10px] text-slate-400 mb-5 font-medium">e.g. zkSync, Starknet</p>

          <div className="flex flex-col gap-2">
            <Node label="Public Inputs" color="bg-white border-slate-200" />
            <Arrow color="text-slate-300" />
            <Node label="ZK Prover" sub="On server" color="bg-slate-200 border-slate-300" textColor="text-slate-700" />
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-2">
                <Arrow color="text-slate-300" />
                <Node label="Succinct Proof" sub="Scalability" color="bg-white border-slate-200" />
              </div>
              <div className="flex flex-col gap-2">
                <Arrow color="text-slate-300" />
                <Node label="Correct Execution" sub="Integrity" color="bg-white border-slate-200" />
              </div>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center mt-1">
              <span className="text-[11px] font-bold text-red-600">Data is Public — No Privacy</span>
            </div>
          </div>
        </div>

        {/* ── Aztec ── */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 relative">
          <div className="absolute -top-3 -right-3 bg-indigo-600 text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider shadow-lg shadow-indigo-500/40">
            True Privacy
          </div>
          <div className="flex items-center justify-between mb-5">
            <h5 className="text-[13px] font-black text-indigo-900">Aztec Privacy Rollup</h5>
          </div>
          <p className="text-[10px] text-indigo-400 mb-5 font-medium">humanidfi.com</p>

          <div className="flex flex-col gap-2">
            <Node label="Private Inputs" sub="User secrets" color="bg-slate-900 border-slate-800" textColor="text-indigo-300" />
            <Arrow color="text-indigo-200" />
            <Node label="Client-Side ZK Prover" sub="Noir circuits on your device" color="bg-indigo-600 border-indigo-500" textColor="text-white" />
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-2">
                <Arrow color="text-indigo-200" />
                <Node label="Succinct Proof" color="bg-white border-indigo-100" textColor="text-indigo-800" />
              </div>
              <div className="flex flex-col gap-2">
                <Arrow color="text-indigo-200" />
                <Node label="Data Hiding" sub="Confidentiality" color="bg-white border-indigo-100" textColor="text-indigo-800" />
              </div>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center mt-1">
              <span className="text-[11px] font-bold text-emerald-600">Data Encrypted — Full Privacy</span>
            </div>
          </div>
        </div>
      </div>
    </DiagramCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. UTXO Architecture Diagram
// ─────────────────────────────────────────────────────────────────────────────
export function UtxoArchitectureDiagram() {
  return (
    <DiagramCard>
      <DiagramHeader
        title="UTXO Architecture"
        subtitle="Private State Trees and the Nullifier Set"
      />

      <div className="flex flex-col lg:flex-row gap-6 mb-8">
        {/* State Tree */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h5 className="text-[12px] font-black text-slate-700 uppercase tracking-wider">Private State Tree</h5>
            <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Append-Only</span>
          </div>

          {/* Tree visual */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-indigo-100 border-2 border-indigo-300 flex items-center justify-center mb-2">
              <span className="text-[10px] font-black text-indigo-800 text-center leading-tight">State<br/>Root</span>
            </div>
            <div className="w-px h-6 bg-indigo-200" />
            <div className="flex gap-8 relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] h-px bg-indigo-200" />
              <div className="flex flex-col items-center">
                <div className="w-px h-4 bg-indigo-200" />
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl px-4 py-2.5 text-center">
                  <p className="text-[11px] font-bold text-indigo-900">Note A</p>
                  <p className="text-[9px] text-emerald-600 font-bold uppercase">Live</p>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-px h-4 bg-indigo-200" />
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl px-4 py-2.5 text-center">
                  <p className="text-[11px] font-bold text-indigo-900">Note B</p>
                  <p className="text-[9px] text-emerald-600 font-bold uppercase">Live</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Arrow between trees */}
        <div className="hidden lg:flex flex-col justify-center items-center gap-1 px-2">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider text-center whitespace-nowrap">Derives via</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider text-center whitespace-nowrap">Secret Key</span>
          <Arrow dir="right" color="text-indigo-300" />
        </div>

        {/* Nullifier Tree */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h5 className="text-[12px] font-black text-slate-700 uppercase tracking-wider">Nullifier Set</h5>
            <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Deletion Tracking</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-slate-300 flex items-center justify-center mb-2">
              <span className="text-[10px] font-black text-slate-700 text-center leading-tight">Nullifier<br/>Root</span>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div className="flex gap-8 relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] h-px bg-slate-200" />
              <div className="flex flex-col items-center">
                <div className="w-px h-4 bg-slate-200" />
                <div className="bg-slate-900 border-2 border-slate-700 rounded-xl px-4 py-2.5 text-center">
                  <p className="text-[10px] font-bold text-white">Nullifier (A)</p>
                  <p className="text-[8px] text-slate-400 font-medium">Prevents Double Spend</p>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-px h-4 bg-slate-200" />
                <div className="border-2 border-dashed border-slate-200 rounded-xl px-4 py-2.5 text-center min-w-[72px]">
                  <p className="text-[10px] text-slate-300 font-medium">Empty Leaf</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-center">
        <p className="text-[12px] text-indigo-800 font-medium">
          <strong className="font-black">Key insight:</strong> To spend Note A, its owner generates a nullifier using their secret key and appends it to the Nullifier Set — permanently preventing double-spend without revealing ownership.
        </p>
      </div>
    </DiagramCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Transaction Lifecycle Diagram
// ─────────────────────────────────────────────────────────────────────────────
const TX_STEPS = [
  { n: 1, color: "bg-indigo-600", title: "Request Private Transaction", desc: "User Device → Private Execution Environment (PXE)" },
  { n: 2, color: "bg-indigo-500", title: "Fetch & Decrypt UTXOs", desc: "PXE queries encrypted state and decrypts locally using your secret key." },
  { n: 3, color: "bg-purple-500", title: "Generate ZK-SNARK Proof", desc: "Private Kernel Circuit (Noir) executes smart contract logic. Proof generated on-device.", highlight: "Raw private data NEVER leaves the device." },
  { n: 4, color: "bg-pink-500", title: "Submit Proof to Sequencer", desc: "Client submits: Proof + Public Inputs + Nullifiers. No secret data in this payload." },
  { n: 5, color: "bg-slate-400", title: "Sequencer Verification", desc: "Aztec Sequencer verifies proofs and checks nullifiers to prevent double-spend." },
  { n: 6, color: "bg-slate-700", title: "L1 Finality", desc: "Rollup Block merged. Proof and State Root updates posted to Ethereum L1." },
];

export function TransactionLifecycleDiagram() {
  return (
    <DiagramCard>
      <DiagramHeader
        title="Transaction Lifecycle"
        subtitle="From Client-Side Proving to L1 Finality"
      />

      <div className="relative pl-8 border-l-2 border-slate-100 space-y-6">
        {TX_STEPS.map((step, i) => (
          <motion.div
            key={step.n}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.5, ease: EASE }}
            className="relative"
          >
            {/* Dot */}
            <div className={`absolute -left-[41px] top-1 w-7 h-7 ${step.color} rounded-full border-4 border-white shadow-md flex items-center justify-center`}>
              <span className="text-[9px] font-black text-white">{step.n}</span>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <h5 className="text-[13px] font-bold text-slate-900 mb-1">{step.title}</h5>
              <p className="text-[12px] text-slate-500 leading-relaxed">{step.desc}</p>
              {step.highlight && (
                <div className="mt-3 bg-slate-950 rounded-lg px-3 py-2 inline-flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0" />
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">{step.highlight}</span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </DiagramCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Privacy Components Diagram
// ─────────────────────────────────────────────────────────────────────────────
export function PrivacyComponentsDiagram() {
  return (
    <DiagramCard>
      <DiagramHeader
        title="Programmable Privacy"
        subtitle="The Two Architectural Pillars of Blockchain Privacy"
      />

      {/* Central concept */}
      <div className="flex justify-center mb-8">
        <div className="bg-slate-900 text-white rounded-2xl px-8 py-4 text-center shadow-xl shadow-slate-900/20">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">Core Concept</p>
          <p className="text-[15px] font-black">Programmable Privacy</p>
        </div>
      </div>

      {/* Arrow down */}
      <div className="flex justify-center mb-6">
        <Arrow color="text-slate-200" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Data Privacy */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-[12px] shadow-md shadow-indigo-500/30">1</div>
            <h5 className="text-[14px] font-black text-indigo-900">Data Privacy</h5>
          </div>
          <ul className="space-y-3">
            {[
              "User owns encrypted state",
              "External parties cannot read",
              "Prevents front-running",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-indigo-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                </div>
                <span className="text-[12px] text-slate-700 font-medium">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Confidentiality */}
        <div className="bg-purple-50 border border-purple-100 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 bg-purple-600 rounded-xl flex items-center justify-center text-white font-black text-[12px] shadow-md shadow-purple-500/30">2</div>
            <h5 className="text-[14px] font-black text-purple-900">Confidentiality</h5>
          </div>
          <ul className="space-y-3">
            {[
              "Smart contracts process encrypted data",
              "Private function execution on-device",
              "Unattainable by unauthorized apps",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full bg-purple-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-1.5 h-1.5 bg-purple-600 rounded-full" />
                </div>
                <span className="text-[12px] text-slate-700 font-medium">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </DiagramCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Execution Flow Diagram
// ─────────────────────────────────────────────────────────────────────────────
export function ExecutionFlowDiagram() {
  return (
    <DiagramCard>
      <DiagramHeader
        title="End-to-End Execution Flow"
        subtitle="How a Noir Smart Contract is executed and verified on Aztec"
      />
      
      <div className="flex flex-col lg:flex-row items-center justify-center gap-0 lg:gap-2">
        <div className="flex-1 min-w-0 w-full lg:w-auto">
          <Node label="Private Function" sub="Noir Smart Contract" color="bg-indigo-50 border-indigo-200" textColor="text-indigo-800" />
        </div>
        <Arrow label="Executes" dir="down" color="text-indigo-300 flex lg:hidden my-1" />
        <Arrow label="Executes" dir="right" color="text-indigo-300 hidden lg:flex shrink-0" />
        
        <div className="flex-1 min-w-0 w-full lg:w-auto">
          <Node label="Private Kernel Circuit" sub="Client-Side ZK Prover" color="bg-amber-50 border-amber-200" textColor="text-amber-800" />
        </div>
        <Arrow label="Submits TX" dir="down" color="text-slate-300 flex lg:hidden my-1" />
        <Arrow label="Submits TX" dir="right" color="text-slate-300 hidden lg:flex shrink-0" />
        
        <div className="flex-1 min-w-0 w-full lg:w-auto">
          <Node label="Sequencer Mempool" sub="Validates Proofs" color="bg-slate-50 border-slate-200" textColor="text-slate-700" />
        </div>
        <Arrow label="Orders" dir="down" color="text-slate-300 flex lg:hidden my-1" />
        <Arrow label="Orders" dir="right" color="text-slate-300 hidden lg:flex shrink-0" />
        
        <div className="flex-1 min-w-0 w-full lg:w-auto">
          <Node label="Rollup Circuit" sub="Aggregates Proofs" color="bg-purple-50 border-purple-200" textColor="text-purple-800" />
        </div>
        <Arrow label="Posts Root" dir="down" color="text-slate-300 flex lg:hidden my-1" />
        <Arrow label="Posts Root" dir="right" color="text-slate-300 hidden lg:flex shrink-0" />
        
        <div className="flex-1 min-w-0 w-full lg:w-auto">
          <Node label="Ethereum L1" sub="Final Verification" color="bg-emerald-50 border-emerald-200" textColor="text-emerald-800" />
        </div>
      </div>

    </DiagramCard>
  );
}

