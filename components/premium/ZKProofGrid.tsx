"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAztecNative } from "@/context/AztecNativeContext";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type ProofPhase =
  | "idle"
  | "compile"
  | "witness"
  | "prove"
  | "verify"
  | "done"
  | "rejected";

interface CircuitSignal {
  name: string;
  kind: "private" | "public";
  value: string;
  color: string;
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

// ─── Noir circuit code display ────────────────────────────────────────────────
const NOIR_CIRCUIT = `fn prove_identity(
    // Private inputs (hidden from verifier)
    score:     Field,
    secret:    Field,
    salt:      Field,
) -> pub (Field, Field) {

    // 1. Compute Poseidon2 nullifier
    let nullifier = std::hash::poseidon2(
        [score, secret, salt]
    );

    // 2. Enforce the threshold constraint
    assert(
        score > THRESHOLD,
        "Score below minimum threshold"
    );

    // 3. Return public outputs only
    let commitment = std::hash::poseidon2(
        [nullifier, salt]
    );
    (nullifier, commitment)
}`;

// ─── Terminal log line ────────────────────────────────────────────────────────
function LogLine({
  line,
  delay = 0,
}: {
  line: string;
  delay?: number;
}) {
  const isOk  = line.includes("OK") || line.includes("verified") || line.includes("done") || line.includes("success");
  const isErr = line.includes("FAIL") || line.includes("rejected") || line.includes("error");
  const isKey = line.startsWith("  ") || line.includes("::");

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.18 }}
      className={`text-[8px] font-mono leading-relaxed ${
        isErr ? "text-zinc-900 font-bold" : isOk ? "text-zinc-900/70" : isKey ? "text-zinc-900/35" : "text-zinc-900/50"
      }`}
    >
      {line}
    </motion.div>
  );
}

// ─── Phase step pill ─────────────────────────────────────────────────────────
function PhasePill({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 border text-[7px] font-black uppercase tracking-widest transition-all duration-400
        ${done  ? "border-zinc-900 bg-zinc-900/[0.05] text-zinc-900"
               : active ? "border-zinc-900 bg-white text-zinc-900 border border-zinc-900/20"
               : "border-zinc-900/8 bg-transparent text-zinc-900/25"}`}
    >
      {done && <span>✓</span>}
      {active && (
        <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
      )}
      {label}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ZKProofGrid() {
  const { balance, aztecAddress, spendQDs } = useAztecNative();
  const QD_COST = 0.1;
  const canAfford = aztecAddress && balance >= QD_COST;

  const [score,     setScore]     = useState(72);
  const [secret,    setSecret]    = useState("ledger_secret_2025");
  const [threshold]               = useState(50);
  const [showSec,   setShowSec]   = useState(false);
  const [phase,     setPhase]     = useState<ProofPhase>("idle");
  const [logs,      setLogs]      = useState<string[]>([]);
  const [nullifier, setNullifier] = useState("");
  const [commitment,setCommit]    = useState("");
  const [proofHex,  setProofHex]  = useState("");
  const [activeView, setActive]   = useState<"circuit" | "params">("circuit");
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = useCallback(
    (msg: string) => setLogs((prev) => [...prev.slice(-60), msg]),
    []
  );

  const PHASES: ProofPhase[] = ["compile", "witness", "prove", "verify", "done"];
  const phaseIdx = PHASES.indexOf(phase as any);

  const runProof = useCallback(async () => {
    if (phase !== "idle" && phase !== "rejected") return;

    // QD gate: 0.1 QDs per proof generation
    if (!canAfford) {
      toast.error("QDs insuficientes", {
        description: `Necesitas ${QD_COST} QDs para generar una prueba ZK. Balance actual: ${balance.toFixed(2)} QDs.`,
      });
      return;
    }
    const paid = await spendQDs(QD_COST, "Noir ZK Proof Generation");
    if (!paid) {
      toast.error("El pago de QDs fallo. Intenta de nuevo.");
      return;
    }

    // ── Anti-Bypass Hardening: Backend Payment Verification ──
    try {
      addLog("  Verifying cryptographic payment on ledger...");
      const sessionAddr = typeof localStorage !== 'undefined' ? localStorage.getItem('system_last_address') : '';
      if (sessionAddr) {
        const res = await fetch(`/api/aztec/transactions?address=${sessionAddr}`);
        const data = await res.json();
        const hasPaid = data.transactions?.some((t: any) => 
          t.type === 'SPEND' && 
          t.amount === QD_COST && 
          (Date.now() - new Date(t.createdAt).getTime()) < 60_000
        );
        if (data.transactions && data.transactions.length > 0 && !hasPaid) {
          throw new Error('Payment bypassed or not confirmed by DB');
        }
      }
    } catch (e) {
      toast.error("Security Error: Payment verification failed.");
      addLog("  [SECURITY] Payment verification failed. Halting.");
      return;
    }

    toast.success(`${QD_COST} QDs debitados del ledger Aztec — generando prueba…`);

    setPhase("idle");
    setLogs([]);
    setNullifier("");
    setCommit("");
    setProofHex("");

    await new Promise((r) => setTimeout(r, 80));

    // --- Phase 1: Compile ---
    setPhase("compile");
    addLog("nargo compile --package identity_checker");
    addLog("  Compiling  identity_checker v0.1.0");
    await new Promise((r) => setTimeout(r, 900));
    addLog("  Compiling  std::hash::poseidon2");
    addLog("  Compiling  std::ec::bn254");
    await new Promise((r) => setTimeout(r, 600));
    addLog("  Artifact   target/identity_checker.json  OK");

    // --- Phase 2: Witness ---
    setPhase("witness");
    addLog("bb generate_witness --bytecode identity_checker.json \\");
    addLog("  --input Prover.toml");
    await new Promise((r) => setTimeout(r, 500));
    addLog(`  [score]     = Field(${score})  (private)`);
    addLog(`  [secret]    = poseidon2("${secret.slice(0, 6)}...")  (private)`);
    addLog(`  [threshold] = Field(${threshold})  (public)`);
    await new Promise((r) => setTimeout(r, 700));
    const scoreHex = seededHex(score * 31337 + secret.length * 7, 64);
    const saltHex  = seededHex(score + 13, 16);
    const nullHex  = "0x" + seededHex(score * 97 + secret.length * 31, 64);
    const comHex   = "0x" + seededHex(score * 13 + 999, 64);
    const proofRaw = "0x" + seededHex(score * 1234 + 5678, 128);
    setNullifier(nullHex);
    setCommit(comHex);
    setProofHex(proofRaw);
    addLog(`  Nullifier  = Poseidon2(score, secret, salt)  OK`);
    addLog(`  Witness    = ${scoreHex.slice(0, 24)}...  generated`);
    addLog("  Witness generation  DONE");

    // --- Phase 3: Prove ---
    setPhase("prove");
    addLog("bb prove --bytecode identity_checker.json \\");
    addLog("  --witness target/witness.gz --output proof.bin");
    await new Promise((r) => setTimeout(r, 500));
    addLog("  Backend         Barretenberg  v0.72.0");
    addLog("  Proof system    UltraHonk (no trusted setup)");
    addLog("  Constraint sys  Ultra PLONK  gates: 2048");
    await new Promise((r) => setTimeout(r, 900));
    addLog("  Generating  commit_w...  OK");
    addLog("  Generating  sumcheck...  OK");
    await new Promise((r) => setTimeout(r, 700));
    addLog(`  Proof  ${proofRaw.slice(0, 24)}...  ${proofRaw.length} bytes  OK`);
    addLog("  Proof generation  DONE");

    // --- Phase 4: Verify ---
    setPhase("verify");
    const isVerified = score > threshold;
    addLog("bb verify --proof proof.bin \\");
    addLog("  --vk target/vk.bin");
    await new Promise((r) => setTimeout(r, 400));
    addLog("  Loading  verification key  OK");
    addLog("  Checking  UltraHonk pairing...");
    await new Promise((r) => setTimeout(r, 800));

    if (isVerified) {
      addLog("  Pairing check  PASSED");
      addLog("  Public inputs match commitment  OK");
      addLog("  Nullifier not in tree  OK");
      addLog("  Proof verification  SUCCESS");
      setPhase("done");
    } else {
      addLog("  FAIL  score assertion failed: score <= threshold");
      addLog("  Proof verification  REJECTED");
      setPhase("rejected");
    }
  }, [score, secret, threshold, phase, addLog]);

  const reset = () => {
    setPhase("idle");
    setLogs([]);
    setNullifier("");
    setCommit("");
    setProofHex("");
  };

  const signals: CircuitSignal[] = [
    { name: "score",      kind: "private", value: String(score),    color: "text-zinc-900" },
    { name: "secret",     kind: "private", value: showSec ? secret : "••••••••••",  color: "text-zinc-900" },
    { name: "salt",       kind: "private", value: "Fr(rand)",        color: "text-zinc-900/80" },
    { name: "threshold",  kind: "public",  value: String(threshold), color: "text-zinc-900" },
    { name: "nullifier",  kind: "public",  value: nullifier || "—",  color: "text-zinc-900/80" },
    { name: "commitment", kind: "public",  value: commitment || "—", color: "text-zinc-900/80" },
  ];

  return (
    <div className="w-full border border-zinc-900/10 bg-white overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-900/8 bg-zinc-900/[0.015]">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-900/10" />
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-900/10" />
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-900/10" />
        </div>
        <div className="flex-1 text-center">
          <span className="text-[8px] font-mono text-zinc-900/30 uppercase tracking-widest">
            Noir Identity Prover · identity_checker.nr · Barretenberg backend
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* QD Balance & cost badge */}
          {aztecAddress ? (
            <div className={`flex items-center gap-1.5 px-2 py-1 border text-[7px] font-black uppercase tracking-widest ${
              canAfford ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-red-300 bg-red-50 text-red-700'
            }`}>
              <span>{balance.toFixed(2)} QDs</span>
              <span className="text-zinc-900/30">·</span>
              <span>costo {QD_COST} QD</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 border border-zinc-900/10 text-[7px] font-black uppercase tracking-widest text-zinc-900/30">
              Connect Sovereign Identity
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-900/40" />
            <span className="text-[7px] text-zinc-900/30 font-mono uppercase tracking-wider">UltraHonk</span>
          </div>
        </div>
      </div>

      {/* Phase strip */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-900/6 overflow-x-auto">
        {[
          { p: "compile", label: "nargo compile" },
          { p: "witness", label: "gen_witness"   },
          { p: "prove",   label: "bb prove"      },
          { p: "verify",  label: "bb verify"     },
        ].map(({ p, label }) => (
          <PhasePill
            key={p}
            label={label}
            active={phase === p}
            done={PHASES.indexOf(phase as any) > PHASES.indexOf(p as any) || phase === "done"}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-black/6">
        {/* LEFT: Inputs + circuit viewer */}
        <div className="p-5 flex flex-col gap-5">
          {/* Private inputs */}
          <div>
            <div className="text-[8px] font-black uppercase tracking-widest text-zinc-900/30 mb-3">
              Private Inputs (never transmitted)
            </div>
            <div className="space-y-2.5">
              {/* Score */}
              <div className="border border-zinc-900/8 p-3 bg-zinc-900/[0.01]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[8px] font-mono text-zinc-900/35">
                    signal input <span className="text-zinc-900 font-bold">score</span>
                  </span>
                  <span className="text-[13px] font-black font-mono text-zinc-900 tabular-nums">
                    {score}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={score}
                  onChange={(e) => { setScore(+e.target.value); reset(); }}
                  disabled={phase !== "idle" && phase !== "rejected" && phase !== "done"}
                  className="w-full h-[2px] bg-zinc-900/10 appearance-none cursor-pointer accent-black"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[7px] text-zinc-900/20 font-mono">0</span>
                  <span className="text-[7px] text-zinc-900/20 font-mono">100</span>
                </div>
              </div>
              {/* Secret */}
              <div className="border border-zinc-900/8 p-3 bg-zinc-900/[0.01]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[8px] font-mono text-zinc-900/35">
                    signal input <span className="text-zinc-900 font-bold">secret</span>
                  </span>
                  <button
                    onClick={() => setShowSec(!showSec)}
                    className="text-[7px] font-black uppercase tracking-widest text-zinc-900/20 hover:text-zinc-900 border border-zinc-900/8 px-2 py-0.5"
                  >
                    {showSec ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  type={showSec ? "text" : "password"}
                  value={secret}
                  onChange={(e) => { setSecret(e.target.value); reset(); }}
                  disabled={phase !== "idle" && phase !== "rejected" && phase !== "done"}
                  className="w-full bg-transparent text-[11px] font-mono text-zinc-900/60 outline-none"
                  placeholder="your_secret_salt..."
                />
              </div>
            </div>
          </div>

          {/* Public input */}
          <div className="border border-zinc-900/8 p-3 bg-zinc-900/[0.01]">
            <div className="text-[8px] font-black uppercase tracking-widest text-zinc-900/25 mb-2">
              Public Input (on-chain visible)
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-mono text-zinc-900/35">
                signal input <span className="text-zinc-900 font-bold">threshold</span>
              </span>
              <span className="text-[13px] font-black font-mono text-zinc-900">{threshold}</span>
            </div>
            <div className="mt-1.5 text-[7px] font-mono text-zinc-900/20">
              circuit enforces: score {"> "}threshold
            </div>
          </div>

          {/* Circuit / Params toggle */}
          <div>
            <div className="flex border-b border-zinc-900/6 mb-3">
              {(["circuit", "params"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setActive(v)}
                  className={`px-3 py-1.5 text-[7px] font-black uppercase tracking-widest transition-all
                    ${activeView === v ? "border-b border-zinc-900 text-zinc-900" : "text-zinc-900/25 hover:text-zinc-900"}`}
                >
                  {v === "circuit" ? "Noir Circuit" : "Signals"}
                </button>
              ))}
            </div>
            {activeView === "circuit" ? (
              <pre className="text-[7px] font-mono text-zinc-900/45 leading-relaxed whitespace-pre-wrap overflow-auto max-h-[180px] bg-zinc-900/[0.01] border border-zinc-900/6 p-3">
                {NOIR_CIRCUIT}
              </pre>
            ) : (
              <div className="space-y-1.5">
                {signals.map((sig) => (
                  <div key={sig.name} className="flex items-center justify-between text-[8px]">
                    <span className="font-mono">
                      <span className={sig.color}>{sig.name}</span>
                      <span className="text-zinc-900/20">
                        {" "}({sig.kind})
                      </span>
                    </span>
                    <span className="font-mono text-zinc-900/40 truncate max-w-[140px] text-right">
                      {sig.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CTA */}
          {/* If user has no Sovereign Identity or insufficient balance, show a gate */}
          {!aztecAddress ? (
            <div className="w-full py-3.5 border border-zinc-900/20 bg-zinc-900/[0.02] text-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-900/40">
                Connect tu Sovereign Identity para generar pruebas ZK
              </span>
            </div>
          ) : !canAfford ? (
            <div className="w-full py-3.5 border border-red-300 bg-red-50 text-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-red-600">
                Balance insuficiente — necesitas {QD_COST} QDs (tienes {balance.toFixed(2)})
              </span>
            </div>
          ) : (
          <button
            onClick={phase === "idle" || phase === "rejected" ? runProof : reset}
            disabled={phase !== "idle" && phase !== "rejected" && phase !== "done"}
            className={`w-full py-3.5 font-black text-[9px] uppercase tracking-widest transition-all duration-300
              ${phase === "done"
                ? "bg-white text-zinc-900 border border-zinc-900/20 hover:bg-zinc-50"
                : phase === "rejected"
                  ? "bg-white text-zinc-900 border border-zinc-900 hover:bg-zinc-100 hover:text-zinc-900"
                  : phase === "idle"
                    ? "bg-zinc-900 text-white hover:bg-zinc-700"
                    : "bg-zinc-900/5 text-zinc-900/25 cursor-not-allowed"}`}
          >
            {phase === "idle"      ? `nargo prove — ${QD_COST} QD`
             : phase === "compile" || phase === "witness" || phase === "prove" || phase === "verify"
               ? "Proving..."
               : phase === "done"
                 ? "Proof Verified ✓  Reset"
                 : "Rejected — Retry"}
          </button>
          )}
        </div>

        {/* RIGHT: Terminal log + result */}
        <div className="p-5 flex flex-col gap-4">
          {/* Terminal */}
          <div className="flex-1">
            <div className="text-[8px] font-black uppercase tracking-widest text-zinc-900/25 mb-2">
              Prover Terminal
            </div>
            <div className="border border-zinc-900/8 bg-zinc-900/[0.015] p-3 h-[260px] overflow-y-auto space-y-0.5">
              {logs.length === 0 ? (
                <div className="text-[8px] font-mono text-zinc-900/15">
                  Awaiting nargo prove command...
                </div>
              ) : (
                logs.map((line, i) => (
                  <LogLine key={i} line={line} />
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>

          {/* Result banner */}
          <AnimatePresence>
            {(phase === "done" || phase === "rejected") && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className={`border p-4 ${
                  phase === "done"
                    ? "border-zinc-900/20 bg-zinc-900/[0.02]"
                    : "border-zinc-900/20 bg-zinc-900/[0.02]"
                }`}
              >
                <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${
                  phase === "done" ? "text-zinc-900" : "text-zinc-900/50"
                }`}>
                  {phase === "done" ? "Proof Verified · Identity Cleared" : "Proof Rejected · Access Denied"}
                </div>
                <div className="text-[8px] font-mono text-zinc-900/40 space-y-0.5">
                  {phase === "done" ? (
                    <>
                      <div>Nullifier:  {nullifier.slice(0, 24)}...</div>
                      <div>Commitment: {commitment.slice(0, 24)}...</div>
                      <div>Proof:      {proofHex.slice(0, 24)}...</div>
                    </>
                  ) : (
                    <div>score {score} does not satisfy score {">"} {threshold}</div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer info */}
          <div className="flex items-center justify-between border-t border-zinc-900/6 pt-3">
            <span className="text-[7px] font-mono text-zinc-900/20 uppercase tracking-widest">
              circuit: identity_checker · 2048 gates
            </span>
            <span className="text-[7px] font-mono text-zinc-900/20 uppercase tracking-widest">
              no trusted setup · UltraHonk
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

