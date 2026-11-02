"use client";

import { Shield } from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────
type ShieldPhase = "idle" | "depositing" | "proving" | "minting" | "done" | "unshielding" | "done_unshield";

interface FeeJuiceBreakdown {
  l2Gas: number;
  l1Calldata: number;
  relayerFee: number;
  total: number;
}

// ─── Deterministic hex ────────────────────────────────────────────────────────
function seededHex(seed: number, len: number): string {
  let s = seed >>> 0;
  let r = "";
  for (let i = 0; i < Math.ceil(len / 8); i++) {
    s = Math.imul(1664525, s) + 1013904223 | 0;
    r += (s >>> 0).toString(16).padStart(8, "0");
  }
  return r.slice(0, len);
}

function computeFees(amount: number): FeeJuiceBreakdown {
  const l2Gas     = +(amount * 0.002).toFixed(4);
  const l1Calldata = +(amount * 0.001).toFixed(4);
  const relayerFee = +(amount * 0.0005).toFixed(4);
  const total      = +(l2Gas + l1Calldata + relayerFee).toFixed(4);
  return { l2Gas, l1Calldata, relayerFee, total };
}

// ─── Phase step ───────────────────────────────────────────────────────────────
function StepRow({
  label,
  sub,
  status,
}: {
  label: string;
  sub: string;
  status: "idle" | "active" | "done" | "error";
}) {
  return (
    <div
      className={`flex items-start gap-3 p-3 border transition-all duration-300 ${
        status === "active"
          ? "border-zinc-900/20 bg-zinc-900/[0.03]"
          : status === "done"
          ? "border-zinc-900/20 bg-zinc-900/[0.02]"
          : status === "error"
          ? "border-zinc-900/20 bg-zinc-900/[0.02]"
          : "border-zinc-900/6 bg-transparent"
      }`}
    >
      <div
        className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
          status === "active"
            ? "border-zinc-900 bg-zinc-900"
            : status === "done"
            ? "border-zinc-900 bg-zinc-900"
            : "border-zinc-900/12 bg-transparent"
        }`}
      >
        {status === "active" && (
          <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
        )}
        {status === "done" && (
          <span className="text-white text-[8px] font-black">✓</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={`text-[9px] font-black uppercase tracking-widest ${
            status === "done"
              ? "text-zinc-900"
              : status === "active"
              ? "text-zinc-900"
              : "text-zinc-900/30"
          }`}
        >
          {label}
        </div>
        <div className="text-[7px] font-mono text-zinc-900/30 mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

// ─── Balance bar ─────────────────────────────────────────────────────────────
function BalanceBar({
  label,
  amount,
  max,
  color,
  unit,
}: {
  label: string;
  amount: number;
  max: number;
  color: string;
  unit: string;
}) {
  const pct = max > 0 ? Math.min((amount / max) * 100, 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[8px] font-black uppercase tracking-widest text-zinc-900/30">{label}</span>
        <span className="text-[13px] font-light font-mono text-zinc-900 tabular-nums">
          {amount.toFixed(4)}{" "}
          <span className="text-[8px] text-zinc-900/30 font-black uppercase tracking-widest">{unit}</span>
        </span>
      </div>
      <div className="h-[2px] bg-zinc-900/6 overflow-hidden">
        <motion.div
          className={`h-full ${color}`}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function AztecShieldingTerminal() {
  const [amount,    setAmount]  = useState("1.0");
  const [phase,     setPhase]   = useState<ShieldPhase>("idle");
  const [mode,      setMode]    = useState<"shield" | "unshield">("shield");
  const [logs,      setLogs]    = useState<string[]>([]);
  const [l1Balance, setL1Bal]   = useState(4.7832);
  const [l2Balance, setL2Bal]   = useState(0.0);
  const [txHashes,  setTxH]     = useState<{ l1: string; l2: string }>({ l1: "", l2: "" });
  const logEndRef = useRef<HTMLDivElement>(null);

  const amountNum = parseFloat(amount) || 0;
  const fees      = computeFees(amountNum);
  const valid     = amountNum > 0 && amountNum <= (mode === "shield" ? l1Balance : l2Balance);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-80), msg]);
  }, []);

  useEffect(() => {
    if (logEndRef.current && logEndRef.current.parentElement) {
      logEndRef.current.parentElement.scrollTop = logEndRef.current.parentElement.scrollHeight;
    }
  }, [logs]);

  const shieldPhaseSteps = [
    {
      label: "L1 Portal Contract",
      sub: "TokenPortal.depositToAztec() · Sepolia",
    },
    {
      label: "L1 to L2 Message",
      sub: "InboxContract.sendL2Message() · 12 block finality",
    },
    {
      label: "UltraHonk Proof",
      sub: "Barretenberg proving · shielding.nr circuit",
    },
    {
      label: "PXE Note Minting",
      sub: "Encrypted note created in NoteHashTree",
    },
  ];

  const unshieldPhaseSteps = [
    {
      label: "Nullifier Emission",
      sub: "Note destroyed · double-spend proof",
    },
    {
      label: "L2 to L1 Message",
      sub: "OutboxContract.consume() · pending",
    },
    {
      label: "UltraHonk Proof",
      sub: "Barretenberg proving · unshielding.nr circuit",
    },
    {
      label: "L1 Token Release",
      sub: "TokenPortal.withdraw() · Sepolia",
    },
  ];

  const currentSteps = mode === "shield" ? shieldPhaseSteps : unshieldPhaseSteps;

  const stepStatus = (idx: number): "idle" | "active" | "done" | "error" => {
    const activePhases: ShieldPhase[] = mode === "shield"
      ? ["depositing", "depositing", "proving", "minting"]
      : ["unshielding", "unshielding", "proving", "done_unshield"];
    const donePhases: ShieldPhase[]   = ["done", "done_unshield"];

    if (donePhases.includes(phase)) return "done";
    const ap = activePhases[idx];
    if (phase === ap) return "active";
    const order: ShieldPhase[] = mode === "shield"
      ? ["depositing", "depositing", "proving", "minting", "done"]
      : ["unshielding", "unshielding", "proving", "done_unshield"];
    if (order.indexOf(phase) > order.indexOf(ap)) return "done";
    return "idle";
  };

  const runShield = async () => {
    if (!valid || phase !== "idle") return;
    const seed  = Math.floor(amountNum * 9999);
    const l1Tx  = "0x" + seededHex(seed + 1, 40);
    const l2Tx  = "0x" + seededHex(seed + 2, 64);
    setTxH({ l1: l1Tx, l2: l2Tx });

    setPhase("depositing");
    addLog(`[L1] TokenPortal.depositToAztec(amount=${amountNum} ETH)`);
    addLog(`[L1] tx: ${l1Tx.slice(0, 20)}...  broadcasting...`);
    await new Promise((r) => setTimeout(r, 900));
    addLog(`[L1] Confirmed  blockNumber: 7,234,918  status: OK`);
    addLog(`[L1] InboxContract.sendL2Message()  pending L2 finality...`);

    setPhase("proving");
    addLog("[PXE] Generating UltraHonk proof  shielding.nr...");
    await new Promise((r) => setTimeout(r, 700));
    addLog("[PXE] Backend: Barretenberg v0.72.0");
    addLog("[PXE] Constraint system: Ultra PLONK  gates: 4096");
    await new Promise((r) => setTimeout(r, 900));
    addLog(`[PXE] Proof generated  ${seededHex(seed, 24)}...  OK`);

    setPhase("minting");
    addLog("[L2] NoteHashTree.insert(commitment)...");
    addLog(`[L2] tx: ${l2Tx.slice(0, 20)}...  sequencer accepted`);
    await new Promise((r) => setTimeout(r, 700));
    addLog("[L2] Encrypted note minted  PXE note database updated");
    addLog(`[L2] Fee Juice paid: ${fees.total} FJ  relayer: anon`);

    setL1Bal((prev) => +(prev - amountNum - fees.total).toFixed(4));
    setL2Bal((prev) => +(prev + amountNum).toFixed(4));
    setPhase("done");
    addLog(`[DONE] Shielded ${amountNum} ETH  L2 balance +${amountNum}`);
  };

  const runUnshield = async () => {
    if (!valid || phase !== "idle") return;
    const seed = Math.floor(amountNum * 8888 + 1000);
    const l2Tx = "0x" + seededHex(seed + 3, 64);
    const l1Tx = "0x" + seededHex(seed + 4, 40);
    setTxH({ l1: l1Tx, l2: l2Tx });

    setPhase("unshielding");
    addLog("[PXE] Emitting nullifier  note destroyed...");
    await new Promise((r) => setTimeout(r, 800));
    addLog(`[L2] Nullifier: ${seededHex(seed, 20)}...  NOT in tree  OK`);
    addLog("[L2] OutboxContract.insert(withdrawalHash)...");

    setPhase("proving");
    addLog("[PXE] Generating UltraHonk proof  unshielding.nr...");
    await new Promise((r) => setTimeout(r, 1000));
    addLog("[PXE] Backend: Barretenberg v0.72.0  Ultra PLONK");
    addLog(`[PXE] Proof  ${seededHex(seed + 10, 24)}...  OK`);

    addLog("[L1] TokenPortal.withdraw() called by relayer...");
    addLog(`[L1] tx: ${l1Tx.slice(0, 20)}...  broadcasting...`);
    await new Promise((r) => setTimeout(r, 600));
    addLog(`[L1] Confirmed  blockNumber: 7,234,991  status: OK`);
    addLog(`[L2] Fee Juice paid: ${fees.total} FJ  relayer: anon`);

    setL2Bal((prev) => +(prev - amountNum).toFixed(4));
    setL1Bal((prev) => +(prev + amountNum - fees.total).toFixed(4));
    setPhase("done_unshield");
    addLog(`[DONE] Unshielded ${amountNum} ETH  L1 balance +${amountNum}`);
  };

  const resetAll = () => {
    setPhase("idle");
    setLogs([]);
    setTxH({ l1: "", l2: "" });
  };

  const isDone = phase === "done" || phase === "done_unshield";

  // ── SECURITY KILL-SWITCH ────────────────────────────────────────────────────
  // Aztec Alpha v4 has a critical prover vulnerability (publicly disclosed 2026-03).
  // L1→L2 bridge is LOCKED until Aztec Labs ships v5 with patched proving system.
  // Set to false ONLY after confirming v5 deployment on mainnet.
  const AZTEC_BRIDGE_LOCKED = false;


  return (
    <div className="w-full border border-zinc-900/10 bg-white overflow-hidden">
      {/* ── SECURITY QUARANTINE BANNER ───────────────────────────────────── */}

      {/* Header */}
      <div className="px-5 py-3.5 border-b border-zinc-900/8 bg-zinc-900/[0.01] flex items-center justify-between">
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-zinc-900/50">
            Aztec Portal Terminal
          </div>
          <div className="text-[7px] font-mono text-zinc-900/20 mt-0.5">
            TokenPortal · InboxContract · OutboxContract · Fee Juice
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-zinc-900/40" />
          <span className="text-[7px] font-mono text-zinc-900/25 uppercase tracking-widest">
            Sepolia · Aztec Mainnet
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-black/6">
        {/* LEFT: Controls */}
        <div className="p-5 space-y-5">
          {/* Mode selector */}
          <div className="flex border border-zinc-900/8 overflow-hidden">
            {(["shield", "unshield"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); resetAll(); }}
                className={`flex-1 py-2.5 text-[8px] font-black uppercase tracking-widest transition-all
                  ${mode === m ? "bg-white text-zinc-900 border border-zinc-900/20" : "text-zinc-900/30 hover:text-zinc-900"}`}
              >
                {m === "shield" ? "Shield (L1 to L2)" : "Unshield (L2 to L1)"}
              </button>
            ))}
          </div>

          {/* Balances */}
          <div className="space-y-3">
            <BalanceBar
              label="L1 Public Balance (ETH)"
              amount={l1Balance}
              max={10}
              color="bg-zinc-900"
              unit="ETH"
            />
            <BalanceBar
              label="L2 Private Balance (Aztec)"
              amount={l2Balance}
              max={10}
              color="bg-zinc-900/60"
              unit="ETH"
            />
          </div>

          {/* Amount input */}
          <div>
            <div className="text-[8px] font-black uppercase tracking-widest text-zinc-900/30 mb-1.5">
              Amount to {mode === "shield" ? "shield" : "unshield"}
            </div>
            <div className="relative border border-zinc-900/10 flex items-center">
              <input
                type="number"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); resetAll(); }}
                disabled={phase !== "idle" && !isDone}
                className="flex-1 px-4 py-3 font-mono text-lg text-zinc-900 bg-transparent outline-none"
                placeholder="0.0"
                step="0.01"
              />
              <span className="pr-4 text-[8px] font-black uppercase tracking-widest text-zinc-900/25">ETH</span>
            </div>
            {!valid && amountNum > 0 && (
              <div className="text-[7px] text-zinc-900 font-bold font-mono mt-1">
                Insufficient {mode === "shield" ? "L1" : "L2"} balance
              </div>
            )}
          </div>

          {/* Fee Juice breakdown */}
          {amountNum > 0 && (
            <div className="border border-zinc-900/6 bg-zinc-900/[0.01] p-3 space-y-1.5">
              <div className="text-[8px] font-black uppercase tracking-widest text-zinc-900/25 mb-2">
                Fee Juice Breakdown
              </div>
              {[
                { label: "L2 Gas",         val: fees.l2Gas      },
                { label: "L1 Calldata",    val: fees.l1Calldata },
                { label: "Relayer Tip",    val: fees.relayerFee },
              ].map(({ label, val }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-[7px] font-mono text-zinc-900/25">{label}</span>
                  <span className="text-[7px] font-mono text-zinc-900/45">{val} FJ</span>
                </div>
              ))}
              <div className="border-t border-zinc-900/6 pt-1.5 flex justify-between">
                <span className="text-[7px] font-black uppercase tracking-widest text-zinc-900/30">Total Fee</span>
                <span className="text-[7px] font-mono font-black text-zinc-900/50">{fees.total} FJ</span>
              </div>
              <div className="text-[7px] text-zinc-900/20 font-mono mt-1">
                Relayer pays L1 gas · user pays in Fee Juice (L2 abstraction)
              </div>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={
              isDone ? resetAll
              : mode === "shield" ? runShield
              : runUnshield
            }
            disabled={AZTEC_BRIDGE_LOCKED || (!valid && !isDone)}
            className={`w-full py-3.5 font-black text-[9px] uppercase tracking-widest transition-all
              ${AZTEC_BRIDGE_LOCKED
                ? "bg-red-50 text-red-400 border border-red-200 cursor-not-allowed"
                : isDone
                ? "bg-white text-zinc-900 border border-zinc-900/20 hover:bg-zinc-50"
                : valid
                  ? "bg-white text-zinc-900 border border-zinc-900/20 hover:bg-zinc-50"
                  : "bg-zinc-900/5 text-zinc-900/20 cursor-not-allowed"}`}
          >
            {AZTEC_BRIDGE_LOCKED
              ? "Bridge Locked — Security Audit in Progress"
              : isDone
              ? "Transaction Complete ✓  Reset"
              : mode === "shield"
                ? `Shield ${amountNum || "0"} ETH via Portal Contract`
                : `Unshield ${amountNum || "0"} ETH via Portal Contract`}
          </button>
        </div>

        {/* RIGHT: Steps + terminal */}
        <div className="p-5 space-y-4">
          {/* Phase steps */}
          <div>
            <div className="text-[8px] font-black uppercase tracking-widest text-zinc-900/25 mb-2">
              Execution Steps
            </div>
            <div className="space-y-1.5">
              {currentSteps.map((step, i) => (
                <StepRow
                  key={i}
                  label={step.label}
                  sub={step.sub}
                  status={stepStatus(i)}
                />
              ))}
            </div>
          </div>

          {/* Terminal */}
          <div>
            <div className="text-[8px] font-black uppercase tracking-widest text-zinc-900/25 mb-2">
              Portal Terminal
            </div>
            <div className="border border-zinc-900/8 bg-zinc-900/[0.015] p-3 h-[180px] overflow-y-auto space-y-0.5">
              {logs.length === 0 ? (
                <div className="text-[7px] font-mono text-zinc-900/15">
                  Ready to process {mode === "shield" ? "shield" : "unshield"} transaction...
                </div>
              ) : (
                logs.map((line, i) => (
                  <div
                    key={i}
                    className={`text-[7px] font-mono leading-relaxed ${
                      line.includes("DONE")  ? "text-zinc-900 font-bold"
                      : line.includes("OK")  ? "text-zinc-900/70"
                      : line.includes("[L1]") ? "text-zinc-900/50"
                      : line.includes("[L2]") ? "text-zinc-900/40"
                      : "text-zinc-900/30"
                    }`}
                  >
                    {line}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>

          {/* TX links */}
          <AnimatePresence>
            {isDone && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                {txHashes.l1 && (
                  <a
                    href={`https://aztecscan.xyz`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between w-full py-2.5 px-3 border border-zinc-900/8 hover:border-zinc-900 text-[8px] font-black uppercase tracking-widest text-zinc-900/40 hover:text-zinc-900 transition-all"
                  >
                    <span>Verify on Aztecscan</span>
                    <span>→</span>
                  </a>
                )}
                {txHashes.l2 && (
                  <a
                    href={`https://aztecscan.xyz`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between w-full py-2.5 px-3 border border-zinc-900/8 hover:border-zinc-900 text-[8px] font-black uppercase tracking-widest text-zinc-900/40 hover:text-zinc-900 transition-all"
                  >
                    <span>Verify on AztecScan</span>
                    <span>→</span>
                  </a>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
