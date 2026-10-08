"use client";

/**
 * DeadmanSwitchPanel  Full Sovereign-Grade Dashboard Component
 *
 * Shows live on-chain state from SystemDeadmanSwitch.sol
 * All buttons fire real Polygon transactions via wagmi.
 */

import { useState, useEffect }         from "react";
import { motion, AnimatePresence }     from "framer-motion";
import {
  HeartPulse, ShieldAlert, Clock, Wallet, User,
  AlertTriangle, CheckCircle2, Loader2, ExternalLink,
  Settings2, Pause, Play, RefreshCw, Zap, Lock
} from "lucide-react";
import { toast } from "sonner";
import { useDeadmanSwitch, DEADMAN_CONTRACT_ADDRESS } from "@/hooks/useDeadmanSwitch";
import { type Address }               from "viem";
import { polygonAmoy }                from "viem/chains";

//  HELPERS 

function shortAddr(addr?: string) {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return "";
  return `${addr.slice(0, 6)}${addr.slice(-4)}`;
}

function formatDays(secs: bigint) {
  const d = Number(secs) / 86_400;
  if (d >= 1) return `${d.toFixed(1)} days`;
  return `${Math.round(Number(secs) / 3600)} hours`;
}

function unixToDate(ts: bigint) {
  return new Date(Number(ts) * 1000).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric"
  });
}

const AMOY_SCAN = (addr: string) => `https://amoy.polygonscan.com/address/${addr}`;

//  RING ARC 

function TimerArc({ percent, danger }: { percent: number; danger: boolean }) {
  const r   = 54;
  const circ = 2 * Math.PI * r;
  const dash  = (circ * percent) / 100;

  return (
    <svg viewBox="0 0 120 120" className="w-full max-w-[200px]" style={{ transform: "rotate(-90deg)" }}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="#1e1e2e" strokeWidth="10" />
      <circle
        cx="60" cy="60" r={r} fill="none"
        stroke={danger ? "#ef4444" : "#6366f1"}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ - dash}`}
        style={{ transition: "stroke-dasharray 1s ease, stroke 0.5s" }}
      />
    </svg>
  );
}

//  MAIN COMPONENT 

export function DeadmanSwitchPanel() {
  const {
    status, isLoading, error, contractAddress, refetch,
    sendPing, proposeBackup, confirmBackup, updateTimeout,
    pauseContract, unpauseContract
  } = useDeadmanSwitch();

  const [newBackupInput, setNewBackupInput]   = useState("");
  const [newTimeoutDays, setNewTimeoutDays]   = useState(180);
  const [txPending, setTxPending]             = useState<string | null>(null);
  const [showConfig,  setShowConfig]          = useState(false);

  // Countdown ticker
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  //  Action wrapper 

  const exec = async (label: string, fn: () => Promise<string>) => {
    setTxPending(label);
    const toastId = toast.loading(`Broadcasting: ${label}`);
    try {
      const hash = await fn();
      toast.success(`${label} confirmed!`, {
        id: toastId,
        description: (
          <a
            href={`https://amoy.polygonscan.com/tx/${hash}`}
            target="_blank" rel="noopener noreferrer"
            className="underline text-indigo-400"
          >
            View on PolygonScan 
          </a>
        ),
      });
    } catch (e: any) {
      toast.error(`Transaction failed: ${e?.message?.slice(0, 80)}`, { id: toastId });
    } finally {
      setTxPending(null);
    }
  };

  //  RENDER 

  return (
    <div className="bg-[#0d0d1a] rounded-3xl border border-indigo-900/30 p-8 space-y-6 shadow-2xl shadow-indigo-950/50">

      {/*  Header  */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-950 border border-indigo-800 flex items-center justify-center shadow-lg shadow-indigo-900/40">
            <HeartPulse size={22} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-white font-black text-base uppercase tracking-widest">Deadman's Switch</h2>
            <p className="text-indigo-500 text-[11px] uppercase tracking-widest font-bold">Non-Custodial Inheritance · Polygon</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {contractAddress ? (
            <a
              href={AMOY_SCAN(contractAddress)}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/60 border border-indigo-800/50 text-indigo-400 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-900/50 transition-colors"
            >
              <ExternalLink size={12} /> PolygonScan
            </a>
          ) : (
            <span className="px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-400 text-[10px] font-black uppercase tracking-widest">
              Not Deployed
            </span>
          )}
          <button onClick={() => refetch()} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-slate-400">
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/*  Contract Address Row  */}
      {contractAddress && (
        <div className="flex items-center gap-3 bg-black/30 rounded-2xl px-4 py-3 border border-white/5">
          <Lock size={12} className="text-indigo-500 shrink-0" />
          <span className="font-mono text-indigo-300 text-[11px] truncate">{contractAddress}</span>
          <span className="ml-auto text-[10px] font-bold text-emerald-500 uppercase tracking-widest shrink-0">Verified </span>
        </div>
      )}

      {/*  Loading / Error  */}
      {isLoading && !status && (
        <div className="flex items-center justify-center py-16 text-indigo-500">
          <Loader2 className="animate-spin mr-3" size={20} />
          <span className="text-sm font-bold">Reading on-chain state</span>
        </div>
      )}

      {error && (
        <div className="bg-red-950/30 border border-red-800/40 rounded-2xl px-5 py-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-400 shrink-0" />
          <p className="text-red-300 text-xs font-medium font-mono">{error}</p>
        </div>
      )}

      {/*  Main Status Grid  */}
      {status && !isLoading && (
        <AnimatePresence mode="wait">
          <motion.div
            key="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Alert banners */}
            {status.isExpired && !status.triggered && (
              <div className="bg-red-950/50 border border-red-600/50 rounded-2xl px-5 py-4 flex items-center gap-3 animate-pulse">
                <ShieldAlert size={20} className="text-red-400 shrink-0" />
                <div>
                  <p className="text-red-300 text-sm font-black uppercase tracking-widest">SWITCH ARMED  TIMEOUT ELAPSED</p>
                  <p className="text-red-500 text-xs mt-0.5">The inheritance can be triggered by any address. Ping immediately to reset.</p>
                </div>
              </div>
            )}
            {status.isDangerous && (
              <div className="bg-amber-950/40 border border-amber-700/40 rounded-2xl px-5 py-4 flex items-center gap-3">
                <AlertTriangle size={18} className="text-amber-400 shrink-0" />
                <p className="text-amber-300 text-xs font-bold">Warning: Fewer than 10 days until inheritance triggers. Send a Heartbeat now.</p>
              </div>
            )}
            {status.triggered && (
              <div className="bg-violet-950/40 border border-violet-700/40 rounded-2xl px-5 py-4 flex items-center gap-3">
                <CheckCircle2 size={18} className="text-violet-400 shrink-0" />
                <p className="text-violet-300 text-xs font-bold">Inheritance has been triggered and assets forwarded to the backup wallet.</p>
              </div>
            )}

            {/* Timer Arc + Primary Stats */}
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <div className="relative flex-shrink-0">
                <TimerArc percent={status.percentLeft} danger={status.isDangerous || status.isExpired} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-black font-mono ${status.isDangerous || status.isExpired ? "text-red-400" : "text-white"}`}>
                    {status.isExpired ? "00" : Math.floor(status.daysLeft).toString().padStart(2, "0")}
                  </span>
                  <span className="text-indigo-500 text-[10px] font-black uppercase tracking-widest mt-0.5">Days Left</span>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-2 gap-3 w-full">
                {[
                  { label: "Owner",        val: shortAddr(status.owner),        icon: User },
                  { label: "Backup",       val: shortAddr(status.backup),       icon: Wallet },
                  { label: "Last Ping",    val: unixToDate(status.lastPing),    icon: HeartPulse },
                  { label: "Expires At",   val: unixToDate(status.expiresAt),   icon: Clock },
                  { label: "Timeout",      val: `${Math.round(Number(status.timeoutPeriod) / 86400)} days`, icon: Lock },
                  { label: "Status",       val: status.paused ? "PAUSED" : status.triggered ? "FIRED" : "LIVE", icon: Zap },
                ].map(({ label, val, icon: Icon }) => (
                  <div key={label} className="bg-black/30 rounded-2xl px-4 py-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={11} className="text-indigo-500" />
                      <span className="text-[9px] text-indigo-500 font-black uppercase tracking-widest">{label}</span>
                    </div>
                    <p className="text-white text-xs font-bold font-mono truncate">{val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending Backup Change Banner */}
            {status.pendingBackup && status.pendingBackup !== "0x0000000000000000000000000000000000000000" && (
              <div className="bg-blue-950/30 border border-emerald-700/40 rounded-2xl px-5 py-4 space-y-3">
                <p className="text-emerald-300 text-xs font-bold uppercase tracking-widest">Pending Backup Change</p>
                <p className="text-emerald-400 text-[11px] font-mono">{status.pendingBackup}</p>
                <p className="text-[#25D366] text-[10px]">Becomes effective: {unixToDate(status.pendingBackupTime)}</p>
                {Number(status.pendingBackupTime) * 1000 < Date.now() && (
                  <button
                    disabled={!!txPending}
                    onClick={() => exec("Confirm Backup Wallet", confirmBackup)}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors disabled:opacity-50"
                  >
                    {txPending === "Confirm Backup Wallet" ? <Loader2 size={14} className="animate-spin" /> : "Confirm Now"}
                  </button>
                )}
              </div>
            )}

            {/* PRIMARY ACTION: HEARTBEAT */}
            {!status.triggered && (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                disabled={!!txPending || status.paused}
                onClick={() => exec("Send Heartbeat", sendPing)}
                className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50 ${
                  status.isDangerous || status.isExpired
                    ? "bg-red-600 hover:bg-red-500 text-white shadow-red-900/40 animate-pulse"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/40"
                }`}
              >
                {txPending === "Send Heartbeat"
                  ? <Loader2 size={18} className="animate-spin" />
                  : <HeartPulse size={18} />
                }
                Send Heartbeat
              </motion.button>
            )}

            {/* CONFIGURATION PANEL */}
            <button
              onClick={() => setShowConfig(v => !v)}
              className="flex items-center gap-2 text-indigo-500 hover:text-indigo-300 transition-colors text-[11px] font-black uppercase tracking-widest"
            >
              <Settings2 size={14} /> Configuration {showConfig ? "" : ""}
            </button>

            <AnimatePresence>
              {showConfig && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  {/* Propose Backup */}
                  <div className="bg-black/20 rounded-2xl border border-white/5 p-5 space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                      Propose New Backup Wallet (72 h cooldown)
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        placeholder="0x"
                        value={newBackupInput}
                        onChange={e => setNewBackupInput(e.target.value)}
                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs font-mono placeholder-slate-700 outline-none focus:border-indigo-500/60"
                      />
                      <button
                        disabled={!newBackupInput || !!txPending}
                        onClick={() => exec("Propose Backup", () => proposeBackup(newBackupInput as Address))}
                        className="px-5 py-2.5 bg-indigo-700 hover:bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors disabled:opacity-50"
                      >
                        Propose
                      </button>
                    </div>
                  </div>

                  {/* Timeout */}
                  <div className="bg-black/20 rounded-2xl border border-white/5 p-5 space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                      Inactivity Timeout (min 90 days)
                    </label>
                    <div className="flex gap-3 items-center">
                      <input
                        type="number" min={90} max={365}
                        value={newTimeoutDays}
                        onChange={e => setNewTimeoutDays(Number(e.target.value))}
                        className="w-28 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs font-mono outline-none focus:border-indigo-500/60"
                      />
                      <span className="text-slate-500 text-xs">days</span>
                      <button
                        disabled={newTimeoutDays < 90 || !!txPending}
                        onClick={() => exec("Update Timeout", () => updateTimeout(newTimeoutDays))}
                        className="ml-auto px-5 py-2.5 bg-indigo-700 hover:bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors disabled:opacity-50"
                      >
                        Update
                      </button>
                    </div>
                  </div>

                  {/* Emergency Pause */}
                  <div className="bg-black/20 rounded-2xl border border-red-900/30 p-5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Emergency Halt</p>
                      <p className="text-slate-500 text-[10px] mt-0.5">Freeze all contract operations instantly.</p>
                    </div>
                    <button
                      disabled={!!txPending}
                      onClick={() => exec(status.paused ? "Unpause" : "Pause", status.paused ? unpauseContract : pauseContract)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50 ${
                        status.paused
                          ? "bg-emerald-700 hover:bg-emerald-600 text-white"
                          : "bg-red-700 hover:bg-red-600 text-white"
                      }`}
                    >
                      {status.paused ? <><Play size={12} /> Resume</> : <><Pause size={12} /> Pause</>}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

