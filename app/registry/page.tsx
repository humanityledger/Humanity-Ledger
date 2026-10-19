"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Search,
  RefreshCw,
  ChevronDown,
  ExternalLink,
  Activity,
  Network,
  Wallet,
  CheckCircle2,
  Globe,
  Layers,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { RealWorldMap } from "@/components/landing/RealWorldMap";
import { SystemFooter } from "@/components/landing/SystemFooter";
import { SiweRegistryAdapter } from "@/components/auth/SiweRegistryAdapter";

// ─── Humanity Ledger: Single Aztec Mainnet config ────────────────────────────────
// All registry data comes exclusively from Humanity Ledger internals:
// - Wallets: registered users in our PostgreSQL DB
// - Block Roots: Aztec Mainnet L2 blocks (live RPC)
// - ZK State Commitments: Noir identity proofs created on humanidfi.com

const AZTEC_TESTNET_RPC = process.env.NEXT_PUBLIC_AZTEC_NODE_URL ?? "https://node.aztec.network";
const AZTEC_EXPLORER   = "https://aztecscan.xyz";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface WalletEntry {
  address: string;
  chain: string;
  chainId: number;
  badge: string;
  color: string;
  txCount: number;
  blockNumber: number;
  timestamp: string;
  explorer: string;
  network: "mainnet" | "testnet";
  role: "sender" | "receiver" | "both";
}

interface BlockRoot {
  chain: string;
  badge: string;
  color: string;
  blockNumber: number;
  blockHash: string;
  parentHash: string;
  stateRoot: string;
  timestamp: string;
  txCount: number;
  gasUsedPct: number;
  network: "mainnet" | "testnet";
  isCurrent: boolean;
  explorer: string;
}

// Real ZK proof entry from zkSync Era / Polygon zkEVM
interface ZkEntry {
  chain: string;
  badge: string;
  color: string;
  proofType: "SNARK" | "STARK";
  blockNumber: number;
  // Real stateRoot from block header this IS the ZK-proven state commitment
  stateRoot: string;
  // Real block hash
  blockHash: string;
  // Real parent hash
  parentHash: string;
  // zkSync Era specific: L1 batch number referencing the Aztec Network proof
  l1BatchNumber: number | null;
  // Whether we got a non-empty stateRoot (i.e. proof was actually available)
  proofVerified: boolean;
  txCount: number;
  gasUsedPct: number;
  timestamp: string;
  network: "mainnet" | "testnet";
  isCurrent: boolean;
  explorer: string;
  l1Explorer: string;
}

type TabType = "map" | "wallets" | "block-roots" | "circuit-roots" | "overview" | "aztec-analytics" | "humanidfi-activity";
type NetworkType = "mainnet" | "testnet";

const PER_PAGE = 30;
// 10 real blocks per chain enough data without timing out on slow RPCs
const SCAN_DEPTH = 10n;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function truncate(str: string, head = 8, tail = 6) {
  if (!str) return "–";
  return str.length > head + tail + 3
    ? `${str.slice(0, head)}…${str.slice(-tail)}`
    : str;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).catch(() => {});
  toast.success(`${label} copied`);
}

// ─── Aztec Analytics Component ───────────────────────────────────────────────

function AztecAnalyticsTab({ isDark }: { isDark: boolean }) {
  const [nodeInfo, setNodeInfo] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchData = async () => {
    setFetching(true);
    setFetchError(null);
    try {
      const rpcUrl = process.env.NEXT_PUBLIC_AZTEC_NODE_URL || "https://node.aztec.network";
      const nodeInfoRes = await fetch(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "node_getNodeInfo", params: [] }) });
      const blockRes = await fetch(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "node_getBlockNumber", params: [] }) });
      const nodeInfoData = (await nodeInfoRes.json()).result || {};
      const l2BlockNumber = (await blockRes.json()).result || 0;
      
      let l2ProvenBlockNumber = null;
      try {
        const provenRes = await fetch(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "node_getProvenBlockNumber", params: [] }) });
        l2ProvenBlockNumber = (await provenRes.json()).result;
      } catch (e) {
        // Fallback if not available
        l2ProvenBlockNumber = l2BlockNumber;
      }

      setNodeInfo({
        ...nodeInfoData,
        l2BlockNumber,
        l2ProvenBlockNumber
      });
      setLastFetched(new Date());
    } catch (e: any) {
      setFetchError(
        "The Aztec network node is currently unreachable. Data will appear when a connection is established."
      );
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const border = isDark
    ? "1px solid rgba(255,255,255,0.07)"
    : "1px solid rgba(0,0,0,0.07)";
  const cardBg   = isDark ? "#0d0d17" : "#fff";
  const labelClr = isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.35)";
  const textClr  = isDark ? "#fff" : "#0f172a";
  const subClr   = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)";
  const divClr   = isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.05)";
  const skelBg   = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";

  function Skel({ w = 64 }: { w?: number }) {
    return <div className="h-5 rounded animate-pulse" style={{ width: w, backgroundColor: skelBg }} />;
  }

  const nodeDetails: { label: string; key: string }[] = [
    { label: "Node Version",   key: "nodeVersion"   },
    { label: "Node Type",      key: "nodeType"      },
    { label: "L2 Chain ID",    key: "l2ChainId"     },
    { label: "L1 Chain ID",    key: "l1ChainId"     },
    { label: "Prover Version", key: "proverVersion" },
  ];

  const syncBlock = nodeInfo?.syncedToL1Block;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-[20px] font-black tracking-tight"
          style={{ color: textClr }}
        >
          Aztec Network Analytics
        </h1>
        <p
          className="text-[12px] mt-1.5 max-w-2xl"
          style={{ color: subClr }}
        >
          Live data from the Aztec alpha testnet node. Shows the current L2
          block height, proof status, and protocol details. Data refreshes
          every 30 seconds.
        </p>
      </div>

      {/* Connection error */}
      {fetchError && !fetching && (
        <div
          className="rounded-2xl p-5 mb-6"
          style={{ border, backgroundColor: cardBg }}
        >
          <div
            className="text-[9px] font-black uppercase tracking-[0.14em] mb-1"
            style={{ color: labelClr }}
          >
            Connection
          </div>
          <div
            className="text-[13px] font-bold mb-1"
            style={{ color: textClr }}
          >
            Node unreachable
          </div>
          <p className="text-[11px] mb-4" style={{ color: subClr }}>
            {fetchError}
          </p>
          <button
            onClick={fetchData}
            className="px-4 py-2 rounded-xl text-[11px] font-bold transition-all hover:opacity-70"
            style={{ border, color: textClr }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: "L2 Block Height",
            value:
              nodeInfo?.l2BlockNumber != null
                ? Number(nodeInfo.l2BlockNumber).toLocaleString()
                : "—",
          },
          {
            label: "Proven Block",
            value:
              nodeInfo?.l2ProvenBlockNumber != null
                ? Number(nodeInfo.l2ProvenBlockNumber).toLocaleString()
                : "—",
          },
          {
            label: "Protocol Version",
            value:
              nodeInfo?.protocolVersion != null
                ? String(nodeInfo.protocolVersion)
                : "—",
          },
          {
            label: "L1 Chain",
            value:
              nodeInfo?.l1ChainId != null
                ? `Chain ${nodeInfo.l1ChainId}`
                : "—",
          },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-2xl p-5"
            style={{ border, backgroundColor: cardBg }}
          >
            <div
              className="text-[9px] font-black uppercase tracking-[0.14em] mb-2"
              style={{ color: labelClr }}
            >
              {s.label}
            </div>
            <div
              className="text-[22px] font-black tracking-tight leading-none"
              style={{ color: textClr }}
            >
              {fetching ? <Skel w={80} /> : s.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Node details table */}
      <div
        className="rounded-2xl overflow-hidden mb-6"
        style={{ border, backgroundColor: cardBg }}
      >
        <div
          className="px-5 py-4"
          style={{ borderBottom: divClr }}
        >
          <h2
            className="text-[11px] font-black uppercase tracking-[0.12em]"
            style={{ color: labelClr }}
          >
            Node Details
          </h2>
        </div>
        {nodeDetails.map(({ label, key }) => (
          <div
            key={key}
            className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: divClr }}
          >
            <span
              className="text-[11px] font-bold"
              style={{ color: labelClr }}
            >
              {label}
            </span>
            {fetching ? (
              <Skel w={96} />
            ) : (
              <span
                className="text-[12px] font-mono font-bold"
                style={{ color: textClr }}
              >
                {nodeInfo?.[key] != null ? String(nodeInfo[key]) : "—"}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* L1 sync state, shown only when data is available */}
      {(fetching || syncBlock) && (
        <div
          className="rounded-2xl overflow-hidden mb-6"
          style={{ border, backgroundColor: cardBg }}
        >
          <div
            className="px-5 py-4"
            style={{ borderBottom: divClr }}
          >
            <h2
              className="text-[11px] font-black uppercase tracking-[0.12em]"
              style={{ color: labelClr }}
            >
              L1 Sync State
            </h2>
          </div>
          {[
            {
              label: "L1 Block Number",
              value: syncBlock?.number != null
                ? Number(syncBlock.number).toLocaleString()
                : "—",
            },
            {
              label: "L1 Block Hash",
              value: syncBlock?.hash
                ? truncate(String(syncBlock.hash), 14, 8)
                : "—",
            },
            {
              label: "L1 Block Timestamp",
              value: syncBlock?.timestamp
                ? new Date(
                    Number(syncBlock.timestamp) * 1000
                  ).toUTCString()
                : "—",
            },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: divClr }}
            >
              <span
                className="text-[11px] font-bold"
                style={{ color: labelClr }}
              >
                {label}
              </span>
              {fetching ? (
                <Skel w={120} />
              ) : (
                <span
                  className="text-[12px] font-mono font-bold"
                  style={{ color: textClr }}
                >
                  {value}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Status footer */}
      <div
        className="rounded-2xl p-5"
        style={{ border, backgroundColor: cardBg }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div
              className="text-[9px] font-black uppercase tracking-[0.14em] mb-1"
              style={{ color: labelClr }}
            >
              Network
            </div>
            <div
              className="text-[13px] font-bold"
              style={{ color: textClr }}
            >
              Aztec Mainnet
            </div>
          </div>
          <div>
            <div
              className="text-[9px] font-black uppercase tracking-[0.14em] mb-1"
              style={{ color: labelClr }}
            >
              Status
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: fetching
                    ? "rgba(0,0,0,0.2)"
                    : fetchError
                    ? "rgba(0,0,0,0.2)"
                    : isDark ? "#fff" : "#000",
                  animation: !fetching && !fetchError ? "pulse 2s infinite" : "none",
                }}
              />
              <span
                className="text-[12px] font-bold"
                style={{ color: textClr }}
              >
                {fetching ? "Connecting" : fetchError ? "Offline" : "Connected"}
              </span>
            </div>
          </div>
          <div>
            <div
              className="text-[9px] font-black uppercase tracking-[0.14em] mb-1"
              style={{ color: labelClr }}
            >
              Last Updated
            </div>
            <div
              className="text-[12px] font-mono font-bold"
              style={{ color: textClr }}
            >
              {lastFetched ? lastFetched.toLocaleTimeString() : "—"}
            </div>
          </div>
          <button
            onClick={fetchData}
            className="px-4 py-2 rounded-xl text-[11px] font-bold transition-all hover:opacity-70"
            style={{ border, color: textClr }}
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Humanity Ledger Real Activity Tab ──────────────────────────────────────────────

const EVENT_TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  MINT_IDENTITY:  { label: "Identity Minted",     color: "#10b981", icon: "⬡" },
  IDENTITY_PROOF: { label: "Identity Proof",      color: "#6366f1", icon: "🔐" },
  FORUM_POST:     { label: "Forum Post / Reply",  color: "#f59e0b", icon: "📝" },
  LEDGER_CHAT_SYNC:{ label: "Ledger Chat Activated",color: "#3b82f6", icon: "💬" },
  PORTFOLIO_ACCESS:{ label: "Portfolio Accessed", color: "#8b5cf6", icon: "📊" },
  STUDIO_ACCESS:  { label: "Studio Provenance",   color: "#ec4899", icon: "🎨" },
  ANCHOR:         { label: "Passport Anchored",   color: "#14b8a6", icon: "⚓" },
  SEND:           { label: "QDs Transfer",         color: "#f97316", icon: "→"  },
  RECEIVE:        { label: "QDs Received",         color: "#22c55e", icon: "←"  },
  REBALANCE:      { label: "Rebalance",            color: "#64748b", icon: "⇄"  },
};

interface ActivityTx {
  id: string;
  txHash: string;
  type: string;
  status: string;
  amount: number;
  token: string;
  fromAddress: string;
  toAddress: string;
  timestamp: string;
  chainId: number;
  blockNumber: string;
  explorerUrl: string;
  provenance: boolean;
  fingerprint: string | null;
  actionDetails: any;
}

function LedgerNetworkActivityTab({ isDark }: { isDark: boolean }) {
  const [txs, setTxs] = useState<ActivityTx[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const bg = isDark ? "#09090f" : "#ffffff";
  const cardBg = isDark ? "#0f0f1a" : "#f8f8fa";
  const border = `1px solid ${isDark ? "#1e1e2e" : "#e5e5ea"}`;
  const textClr = isDark ? "#ffffff" : "#0a0a0a";
  const labelClr = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";
  const divClr = `1px solid ${isDark ? "#1e1e2e" : "#f0f0f2"}`;

  const fetchActivity = async (p = 1, t = "") => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "50" });
      if (t) params.set("type", t);
      const res = await fetch(`/api/humanidfi/activity?${params}`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setTxs(data.transactions ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
      setPage(p);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchActivity(1, typeFilter); }, [typeFilter]);

  const meta = (type: string) => EVENT_TYPE_META[type] ?? { label: type, color: "#888", icon: "·" };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap" style={{ border, backgroundColor: cardBg }}>
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.2em] mb-1" style={{ color: labelClr }}>
            Live Activity Feed
          </div>
          <div className="text-[20px] font-black tracking-tight" style={{ color: textClr }}>
            Humanity Ledger Real Transactions
          </div>
          <div className="text-[11px] mt-1" style={{ color: labelClr }}>
            {loading ? "Loading…" : `${total.toLocaleString()} events indexed from humanidfi.com`}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="text-[11px] font-bold rounded-xl px-3 py-2 border outline-none"
            style={{ backgroundColor: bg, color: textClr, borderColor: isDark ? "#1e1e2e" : "#e5e5ea" }}
          >
            <option value="">All Types</option>
            {Object.entries(EVENT_TYPE_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button
            onClick={() => fetchActivity(page, typeFilter)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold transition-all hover:opacity-70"
            style={{ border, color: textClr }}
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      {error ? (
        <div className="rounded-2xl p-8 text-center text-[12px]" style={{ border, backgroundColor: cardBg, color: "#ef4444" }}>
          Error loading activity: {error}
        </div>
      ) : loading ? (
        <div className="rounded-2xl p-12 text-center" style={{ border, backgroundColor: cardBg }}>
          <div className="text-[10px] font-black uppercase tracking-[0.25em] animate-pulse" style={{ color: labelClr }}>
            Indexing Activity…
          </div>
        </div>
      ) : txs.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ border, backgroundColor: cardBg }}>
          <div className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: labelClr }}>
            No activity recorded yet. Actions on humanidfi.com will appear here in real time.
          </div>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border, backgroundColor: cardBg }}>
          {/* Column Headers */}
          <div className="grid grid-cols-[60px_1fr_120px_140px_120px_80px] px-4 py-3 text-[9px] font-black uppercase tracking-[0.15em]" style={{ borderBottom: divClr, color: labelClr }}>
            <span>Type</span>
            <span>Transaction Hash</span>
            <span>From</span>
            <span>Amount</span>
            <span>When</span>
            <span>Status</span>
          </div>
          {txs.map(tx => {
            const m = meta(tx.type);
            const isOpen = expanded === tx.id;
            return (
              <div key={tx.id} style={{ borderBottom: divClr }}>
                {/* Row */}
                <div
                  className="grid grid-cols-[60px_1fr_120px_140px_120px_80px] px-4 py-3 items-center cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setExpanded(isOpen ? null : tx.id)}
                >
                  {/* Type badge */}
                  <span
                    className="text-[10px] font-black px-2 py-0.5 rounded-lg w-fit"
                    style={{ backgroundColor: m.color + "22", color: m.color }}
                  >
                    {m.icon}
                  </span>
                  {/* Hash */}
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold" style={{ color: textClr }}>
                      {truncate(tx.txHash, 10, 8)}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); copyToClipboard(tx.txHash, "Hash"); }}
                      className="opacity-40 hover:opacity-100 transition-opacity"
                    >
                      <Copy size={10} />
                    </button>
                    {tx.explorerUrl && tx.token !== 'ATOMIC_LOG' && (
                      <a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="opacity-40 hover:opacity-100 transition-opacity">
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                  {/* From */}
                  <span className="font-mono text-[10px]" style={{ color: labelClr }}>
                    {truncate(tx.fromAddress, 6, 4)}
                  </span>
                  {/* Amount */}
                  <span className="text-[11px] font-bold" style={{ color: tx.amount > 0 ? m.color : labelClr }}>
                    {tx.amount > 0 ? `${tx.amount.toLocaleString()} ${tx.token}` : "–"}
                  </span>
                  {/* When */}
                  <span className="text-[10px]" style={{ color: labelClr }}>
                    {timeAgo(tx.timestamp)}
                  </span>
                  {/* Status */}
                  <span
                    className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full w-fit"
                    style={{
                      backgroundColor: tx.status === "SUCCESS" || tx.status === "COMPLETED" ? "#10b98122" : "#f5940022",
                      color: tx.status === "SUCCESS" || tx.status === "COMPLETED" ? "#10b981" : "#f59400",
                    }}
                  >
                    {tx.status}
                  </span>
                </div>
                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-6 pb-4 pt-1 text-[11px] space-y-1" style={{ borderTop: divClr }}>
                    <div className="font-black uppercase tracking-wider text-[9px] mb-2" style={{ color: labelClr }}>Event Detail, {m.label}</div>
                    <div className="flex gap-2"><span style={{ color: labelClr }}>Full Hash:</span><span className="font-mono break-all" style={{ color: textClr }}>{tx.txHash}</span></div>
                    <div className="flex gap-2"><span style={{ color: labelClr }}>From:</span><span className="font-mono" style={{ color: textClr }}>{tx.fromAddress}</span></div>
                    <div className="flex gap-2"><span style={{ color: labelClr }}>To:</span><span className="font-mono" style={{ color: textClr }}>{tx.toAddress}</span></div>
                    <div className="flex gap-2"><span style={{ color: labelClr }}>Block:</span><span className="font-mono" style={{ color: textClr }}>{tx.blockNumber}</span></div>
                    <div className="flex gap-2"><span style={{ color: labelClr }}>Time:</span><span style={{ color: textClr }}>{new Date(tx.timestamp).toUTCString()}</span></div>
                    {tx.fingerprint && <div className="flex gap-2"><span style={{ color: labelClr }}>Fingerprint:</span><span className="font-mono break-all text-[10px]" style={{ color: textClr }}>{tx.fingerprint}</span></div>}
                    {tx.actionDetails && (
                      <div>
                        <span style={{ color: labelClr }}>Action Details:</span>
                        <pre className="mt-1 text-[9px] p-2 rounded-lg overflow-auto" style={{ backgroundColor: isDark ? "#07070f" : "#f0f0f4", color: textClr }}>
                          {JSON.stringify(tx.actionDetails, null, 2)}
                        </pre>
                      </div>
                    )}
                    {tx.explorerUrl && tx.token !== 'ATOMIC_LOG' && (
                      <a
                        href={tx.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold mt-1 hover:opacity-70 transition-opacity"
                        style={{ color: m.color }}
                      >
                        <ExternalLink size={10} /> View on Explorer
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            disabled={page <= 1}
            onClick={() => fetchActivity(page - 1, typeFilter)}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-bold disabled:opacity-30 transition-all hover:opacity-70"
            style={{ border, color: textClr }}
          >
            <ChevronLeft size={12} /> Prev
          </button>
          <span className="text-[11px] font-bold" style={{ color: labelClr }}>
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => fetchActivity(page + 1, typeFilter)}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-bold disabled:opacity-30 transition-all hover:opacity-70"
            style={{ border, color: textClr }}
          >
            Next <ChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function RegistryPage() {
  return (
    <SiweRegistryAdapter>
      <RegistryContent />
    </SiweRegistryAdapter>
  );
}

function RegistryContent() {
  // ── UI State
  const [activeTab, setActiveTab] = useState<TabType>("map");
  const [network, setNetwork] = useState<NetworkType>("testnet");
  const isDark = false;
  const [netDropOpen, setNetDropOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  // ── Data State
  const [wallets, setWallets] = useState<WalletEntry[]>([]);
  const [blockRoots, setBlockRoots] = useState<BlockRoot[]>([]);
  // Real ZK proof entries from zkSync Era + Polygon zkEVM
  const [zkEntries, setZkEntries] = useState<ZkEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [zkLoading, setZkLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [stats, setStats] = useState({
    totalWallets: 0,
    totalChains: 0,
    latestBlock: 0,
    totalTxs: 0,
    senders: 0,
    receivers: 0,
  });

  const abortRef = useRef<boolean>(false);
  const netDropRef = useRef<HTMLDivElement>(null);
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // ── Dark mode: toggle class on <html>
  useEffect(() => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
  }, [isDark]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (netDropRef.current && !netDropRef.current.contains(e.target as Node)) {
        setNetDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── ZK Proof Indexer: Humanity Ledger Noir Identity Proofs ─────────────────────
  // Reads golden ticket / identity proofs created on humanidfi.com using Noir.
  // Each entry represents a real ZK proof generated by our Barretenberg backend.

  const runZkIndexer = useCallback(async (_selectedNetwork: NetworkType) => {
    setZkLoading(true);
    const entries: ZkEntry[] = [];

    try {
      // Fetch our internal golden tickets — each one carries a real Noir ZK proof
      const res = await fetch("/api/golden-ticket/list?limit=30");
      if (res.ok) {
        const { tickets } = await res.json();
        for (const t of (tickets ?? [])) {
          let parsed: any = {};
          try { parsed = JSON.parse(t.signatureData || "{}"); } catch {}

          const blockNum = parsed.blockNumber ?? 0;
          const stateRoot = parsed.noteCommitment || parsed.proofHash || parsed.cryptoSignature?.slice(0, 66) || "";
          const blockHash  = parsed.txHash || parsed.aztecTxHash || "";

          entries.push({
            chain: "Humanity Ledger · Aztec Mainnet",
            badge: "WN-ZK",
            color: "#6366f1",
            proofType: "SNARK",
            blockNumber: Number(blockNum),
            stateRoot,
            blockHash,
            parentHash: "",
            l1BatchNumber: null,
            proofVerified: stateRoot.length > 10,
            txCount: 1,
            gasUsedPct: 0,
            timestamp: t.createdAt ?? new Date().toISOString(),
            network: "testnet",
            isCurrent: false,
            explorer: AZTEC_EXPLORER,
            l1Explorer: AZTEC_EXPLORER,
          });
        }
      }
    } catch (e) {
      console.warn("[Registry] ZK indexer failed:", e);
    }

    setZkEntries(entries.sort((a, b) => b.blockNumber - a.blockNumber));
    setZkLoading(false);
  }, []);

  // ── Humanity Ledger Indexer (Wallets + Block Roots) ────────────────────────────
  // Sources: humanidfi.com DB (users, tickets) + Aztec Mainnet L2 blocks.
  // NO external chain scanning. All data is internal to Humanity Ledger.

  const runIndexer = useCallback(async (_selectedNetwork: NetworkType) => {
    abortRef.current = true;
    await new Promise((r) => setTimeout(r, 50));
    abortRef.current = false;

    setLoading(true);
    setProgress(0);
    setWallets([]);
    setBlockRoots([]);
    setPage(1);

    const walletMap = new Map<string, WalletEntry>();
    const roots: BlockRoot[] = [];
    let totalTxs = 0;

    // ── 1. DB: Registered users ────────────────────────────────────────────────
    try {
      const res = await fetch("/api/registry/real-users");
      if (res.ok) {
        const { users } = await res.json();
        for (const u of users) {
          const key = `humanid-${u.walletAddress.toLowerCase()}`;
          walletMap.set(key, {
            address: u.walletAddress,
            chain: "Humanity Ledger · HumanID",
            chainId: 0,
            badge: "WN",
            color: "#6366f1",
            txCount: 1,
            blockNumber: 0,
            timestamp: u.updatedAt,
            explorer: `https://www.humanidfi.com/registry?wallet=`,
            network: "testnet",
            role: "both",
          });
        }
      }
    } catch (e) {
      console.warn("[Registry] Failed to fetch real users", e);
    }
    setProgress(20);
    if (abortRef.current) { setLoading(false); return; }

    // ── 2. DB: Golden ticket holders (Aztec ZK identity) ─────────────────────
    try {
      const res = await fetch("/api/golden-ticket/list?limit=100");
      if (res.ok) {
        const { tickets } = await res.json();
        for (const t of (tickets ?? [])) {
          if (!t.walletAddress) continue;
          const key = `ticket-${t.walletAddress.toLowerCase()}`;
          if (!walletMap.has(key)) {
            walletMap.set(key, {
              address: t.walletAddress,
              chain: "Aztec Mainnet · Identity",
              chainId: 2171337,
              badge: "AZTEC",
              color: "#7C3AED",
              txCount: 1,
              blockNumber: 0,
              timestamp: t.createdAt,
              explorer: AZTEC_EXPLORER,
              network: "testnet",
              role: "both",
            });
          }
        }
      }
    } catch (e) {
      console.warn("[Registry] Failed to fetch tickets", e);
    }
    setProgress(45);
    if (abortRef.current) { setLoading(false); return; }

    // ── 3. DB: Humanity Ledger internal transactions ────────────────────────────
    try {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      const res = await fetch(`/api/humanidfi/activity?${params}`);
      if (res.ok) {
        const data = await res.json();
        for (const tx of (data.transactions ?? [])) {
          totalTxs++;
          if (tx.fromAddress) {
            const key = `wn-from-${tx.fromAddress.toLowerCase()}`;
            if (!walletMap.has(key)) {
              walletMap.set(key, {
                address: tx.fromAddress,
                chain: "Humanity Ledger · Aztec Mainnet",
                chainId: 2171337,
                badge: "WN",
                color: "#10b981",
                txCount: 1,
                blockNumber: Number(tx.blockNumber) || 0,
                timestamp: tx.timestamp,
                explorer: AZTEC_EXPLORER,
                network: "testnet",
                role: "sender",
              });
            } else {
              walletMap.get(key)!.txCount++;
            }
          }
          if (tx.toAddress && tx.toAddress !== tx.fromAddress) {
            const key = `wn-to-${tx.toAddress.toLowerCase()}`;
            if (!walletMap.has(key)) {
              walletMap.set(key, {
                address: tx.toAddress,
                chain: "Humanity Ledger · Aztec Mainnet",
                chainId: 2171337,
                badge: "WN",
                color: "#10b981",
                txCount: 1,
                blockNumber: Number(tx.blockNumber) || 0,
                timestamp: tx.timestamp,
                explorer: AZTEC_EXPLORER,
                network: "testnet",
                role: "receiver",
              });
            } else {
              walletMap.get(key)!.txCount++;
            }
          }
        }
      }
    } catch (e) {
      console.warn("[Registry] Failed to fetch activity", e);
    }
    setProgress(65);
    if (abortRef.current) { setLoading(false); return; }

    // ── 4. Aztec Mainnet: Live L2 block roots ─────────────────────────────────
    try {
      const rpcPayload = (method: string) =>
        JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [] });
      const headers = { "Content-Type": "application/json" };

      const [blockNumRes, nodeRes] = await Promise.all([
        fetch(AZTEC_TESTNET_RPC, { method: "POST", headers, body: rpcPayload("node_getBlockNumber") }),
        fetch(AZTEC_TESTNET_RPC, { method: "POST", headers, body: rpcPayload("node_getNodeInfo") }),
      ]);

      const latestBlockNum: number = (await blockNumRes.json()).result ?? 0;
      const nodeInfo: any = (await nodeRes.json()).result ?? {};

      // Fetch last SCAN_DEPTH L2 blocks from Aztec
      const depth = Math.min(Number(SCAN_DEPTH), latestBlockNum);
      for (let i = 0; i < depth; i++) {
        if (abortRef.current) break;
        const blockN = latestBlockNum - i;
        try {
          const blockRes = await fetch(AZTEC_TESTNET_RPC, {
            method: "POST", headers,
            body: JSON.stringify({ jsonrpc: "2.0", id: blockN, method: "node_getBlock", params: [blockN] }),
          });
          const block: any = (await blockRes.json()).result ?? {};
          const archiveRoot: string = block.archiveRoot ?? block.header?.globalVariables?.blockNumber ?? "";
          roots.push({
            chain: "Aztec Mainnet",
            badge: "AZTEC",
            color: "#7C3AED",
            blockNumber: blockN,
            blockHash: block.hash ?? `aztec-block-${blockN}`,
            parentHash: block.parentBlock ?? "",
            stateRoot: archiveRoot,
            timestamp: block.header?.globalVariables?.timestamp
              ? new Date(Number(block.header.globalVariables.timestamp) * 1000).toISOString()
              : new Date().toISOString(),
            txCount: (block.body?.txEffects ?? []).length,
            gasUsedPct: 0,
            network: "testnet",
            isCurrent: i === 0,
            explorer: AZTEC_EXPLORER,
          });
        } catch (blockErr) {
          console.warn(`[Registry] Aztec block ${blockN} error:`, blockErr);
        }
      }

      // If Aztec node returned no blocks, create a synthetic entry from node_getNodeInfo
      if (roots.length === 0 && latestBlockNum > 0) {
        roots.push({
          chain: "Aztec Mainnet",
          badge: "AZTEC",
          color: "#7C3AED",
          blockNumber: latestBlockNum,
          blockHash: nodeInfo.enr ?? `aztec-block-${latestBlockNum}`,
          parentHash: "",
          stateRoot: nodeInfo.l1ContractAddresses?.rollupAddress ?? "",
          timestamp: new Date().toISOString(),
          txCount: 0,
          gasUsedPct: 0,
          network: "testnet",
          isCurrent: true,
          explorer: AZTEC_EXPLORER,
        });
      }
    } catch (e) {
      console.warn("[Registry] Aztec RPC failed:", e);
    }
    setProgress(90);

    if (!abortRef.current) {
      const finalWallets = Array.from(walletMap.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      const senders   = finalWallets.filter((w) => w.role === "sender"   || w.role === "both").length;
      const receivers = finalWallets.filter((w) => w.role === "receiver" || w.role === "both").length;

      setWallets(finalWallets);
      setBlockRoots(roots.sort((a, b) => b.blockNumber - a.blockNumber));

      setStats({
        totalWallets: finalWallets.length,
        totalChains: 1,  // Single network: Aztec Mainnet
        latestBlock: Math.max(...roots.map((r) => r.blockNumber), 0),
        totalTxs,
        senders,
        receivers,
      });
      setProgress(100);
      setLastRefreshed(new Date());
    }

    setLoading(false);
  }, []);

  const runAll = useCallback((net: NetworkType) => {
    runIndexer(net);
    runZkIndexer(net);
  }, [runIndexer, runZkIndexer]);

  // Initial load + re-run on network change
  useEffect(() => {
    runAll(network);
  }, [network, runAll]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    autoRefreshRef.current = setInterval(() => {
      runAll(network);
    }, 30_000);
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [network, runAll]);

  // ── Filtered + Paginated wallets ──────────────────────────────────────────

  const filteredWallets = wallets.filter((w) => {
    const q = searchQuery.toLowerCase();
    return (
      !q ||
      w.address.toLowerCase().includes(q) ||
      w.chain.toLowerCase().includes(q) ||
      w.badge.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredWallets.length / PER_PAGE));
  const paginatedWallets = filteredWallets.slice(
    (page - 1) * PER_PAGE,
    page * PER_PAGE
  );

  // ── Tab config ────────────────────────────────────────────────────────────

  const TABS: { id: TabType; label: string }[] = [
    { id: "map", label: "Network Map"},
    { id: "humanidfi-activity", label: "⬡ Humanity Ledger Activity"},
    { id: "wallets", label: "Wallets"},
    { id: "block-roots", label: "Block Roots"},
    { id: "circuit-roots", label: "Circuit Roots"},
    { id: "overview", label: "Overview"},
    { id: "aztec-analytics", label: "Aztec Analytics"},
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-full w-full flex flex-col transition-colors duration-300"
      style={{
        backgroundColor: isDark ? "#09090f" : "#ffffff",
        color: isDark ? "#e2e8f0" : "#0f172a",
      }}
    >
      {/* ── Registry Header ─────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-40 w-full"
        style={{
          backgroundColor: isDark
            ? "rgba(9,9,15,0.96)"
            : "rgba(255,255,255,0.97)",
          borderBottom: isDark
            ? "1px solid rgba(255,255,255,0.07)"
            : "1px solid rgba(0,0,0,0.07)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="w-full px-4 min-h-[52px] py-2 flex flex-wrap items-center justify-between gap-3 sm:py-0">

          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <img
              src="/system-shots/PARTNERS/pngtree-3d-silver-atom-symbol-matter-quantum-fiction-photo-picture-image_3222092.jpg"
              alt="Atom"
              className="w-7 h-7 rounded-lg object-cover shadow-sm"
            />
            <div className="hidden sm:block">
              <span
                className="text-[12px] font-black uppercase tracking-[0.12em]"
                style={{ color: isDark ? "#fff" : "#0f172a" }}
              >
                Registry
              </span>
              <span
                className="text-[11px] font-medium ml-1.5"
                style={{ color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.4)" }}
              >
                Explorer
              </span>
            </div>
          </div>

          {/* Center Tabs */}
          <nav className="flex flex-1 items-center justify-center gap-1 overflow-x-auto no-scrollbar px-2 max-w-full">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex flex-1 sm:flex-none justify-center items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-[0.08em] transition-all duration-150 whitespace-nowrap"
                  style={{
                    backgroundColor: active
                      ? isDark
                        ? "rgba(255,255,255,0.15)"
                        : "rgba(0,0,0,0.08)"
                      : "transparent",
                    color: active
                      ? isDark
                        ? "#ffffff"
                        : "#0f172a"
                      : isDark
                      ? "rgba(255,255,255,0.85)"
                      : "rgba(0,0,0,0.55)",
                  }}
                >
                  
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Network Selector */}
            <div className="relative" ref={netDropRef}>
              <button
                onClick={() => setNetDropOpen((p) => !p)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-[0.08em] transition-all"
                style={{
                  border: isDark
                    ? "1px solid rgba(255,255,255,0.1)"
                    : "1px solid rgba(0,0,0,0.1)",
                  backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#fff",
                  color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)",
                }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      network === "mainnet" ? "#10b981" : "#f59e0b",
                  }}
                />
                {network === "mainnet" ? "Mainnet" : "Aztec Mainnet"}
                <ChevronDown
                  size={11}
                  className="transition-transform duration-150"
                  style={{ transform: netDropOpen ? "rotate(180deg)" : "none" }}
                />
              </button>

              <AnimatePresence>
                {netDropOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.1 }}
                    className="absolute right-0 top-full mt-1 w-40 rounded-xl overflow-hidden z-50 shadow-2xl"
                    style={{
                      border: isDark
                        ? "1px solid rgba(255,255,255,0.1)"
                        : "1px solid rgba(0,0,0,0.1)",
                      backgroundColor: isDark ? "#111118" : "#fff",
                    }}
                  >
                    {(["testnet"] as NetworkType[]).map((n) => (
                      <button
                        key={n}
                        onClick={() => {
                          setNetwork(n);
                          setNetDropOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors"
                        style={{
                          backgroundColor:
                            network === n
                              ? isDark
                                ? "rgba(255,255,255,0.06)"
                                : "rgba(0,0,0,0.04)"
                              : "transparent",
                          color:
                            network === n
                              ? isDark
                                ? "#fff"
                                : "#0f172a"
                              : isDark
                              ? "rgba(255,255,255,0.9)"
                              : "rgba(0,0,0,0.5)",
                        }}
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor:
                              n === "mainnet" ? "#10b981" : "#f59e0b",
                          }}
                        />
                        {n === "mainnet" ? "Mainnet" : "Aztec Mainnet"}
                        {network === n && (
                          <CheckCircle2
                            size={11}
                            className="ml-auto"
                            style={{ color: "#000000" }}
                          />
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Refresh + last refreshed */}
            <div className="flex items-center gap-2">
              {lastRefreshed && !loading && (
                <span
                  className="text-[9px] font-mono hidden lg:block"
                  style={{ color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.3)" }}
                >
                  {timeAgo(lastRefreshed.toISOString())}
                </span>
              )}
              <button
                onClick={() => runAll(network)}
                disabled={loading || zkLoading}
                title="Refresh all Network data (wallets + ZK proofs)"
                className="p-2 rounded-lg transition-all disabled:opacity-40"
                style={{
                  border: isDark
                    ? "1px solid rgba(255,255,255,0.1)"
                    : "1px solid rgba(0,0,0,0.1)",
                  backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#fff",
                  color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.55)",
                }}
              >
                <RefreshCw
                  size={13}
                  className={(loading || zkLoading) ? "animate-spin" : ""}
                />
              </button>
            </div>


          </div>
        </div>

        {/* Progress bar */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-[2px] relative overflow-hidden"
              style={{
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(0,0,0,0.05)",
              }}
            >
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, #627EEA, #8247E5, #10b981)",
                }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Page Content ────────────────────────────────────────────────── */}
      <div className="flex-1 w-full px-5 py-6">
        <AnimatePresence mode="wait">

          {/* ══════════════════════════════════════════════════════════════
              TAB: MAP
          ══════════════════════════════════════════════════════════════ */}
          {activeTab === "map" && (
            <motion.div
              key="map"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="w-full"
            >
              <div className="mb-5">
                <h1
                  className="text-[20px] font-black tracking-tight"
                  style={{ color: isDark ? "#fff" : "#0f172a" }}
                >
                  Global Network Activity
                </h1>
                <p
                  className="text-[12px] mt-0.5"
                  style={{
                    color: isDark
                      ? "rgba(255,255,255,0.85)"
                      : "rgba(0,0,0,0.45)",
                  }}
                >
                  Real-time geographical visualization of incoming connections and active nodes across the network.
                </p>
              </div>
              <div className="w-full h-[calc(100dvh-140px)] min-h-[400px] rounded-2xl overflow-hidden relative" style={{ border: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.07)", backgroundColor: isDark ? "#0d0d17" : "#fff" }}>
                <RealWorldMap fullPage={true} isDark={isDark} />
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB: WALLETS
          ══════════════════════════════════════════════════════════════ */}
          {activeTab === "wallets" && (
            <motion.div
              key="wallets"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {/* Header row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                <div>
                  <h1
                    className="text-[20px] font-black tracking-tight"
                    style={{ color: isDark ? "#fff" : "#0f172a" }}
                  >
                    Wallet Registry
                  </h1>
                  <p
                    className="text-[12px] mt-0.5"
                    style={{
                      color: isDark
                        ? "rgba(255,255,255,0.85)"
                        : "rgba(0,0,0,0.45)",
                    }}
                  >
                    {loading
                      ? `Scanning ${network} chains…`
                      : `${filteredWallets.length.toLocaleString()} wallets indexed across ${stats.totalChains} chains live Network`}
                  </p>
                </div>

                {/* Search */}
                <div className="relative shrink-0">
                  <Search
                    size={13}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{
                      color: isDark
                        ? "rgba(255,255,255,0.7)"
                        : "rgba(0,0,0,0.3)",
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search address or chain…"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9 pr-4 py-2 rounded-lg text-[12px] w-full sm:w-64 focus:outline-none transition-all"
                    style={{
                      border: isDark
                        ? "1px solid rgba(255,255,255,0.1)"
                        : "1px solid rgba(0,0,0,0.1)",
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.04)"
                        : "#fff",
                      color: isDark ? "#e2e8f0" : "#0f172a",
                    }}
                  />
                </div>
              </div>

              {/* Table */}
              <div
                className="w-full rounded-2xl overflow-hidden"
                style={{
                  border: isDark
                    ? "1px solid rgba(255,255,255,0.07)"
                    : "1px solid rgba(0,0,0,0.07)",
                  backgroundColor: isDark ? "#0d0d17" : "#fff",
                }}
              >
                <div className="w-full overflow-x-auto">
                  <table
                    className="w-full text-left border-collapse"
                    style={{ minWidth: 720 }}
                  >
                    {/* THEAD */}
                    <thead>
                      <tr
                        style={{
                          borderBottom: isDark
                            ? "1px solid rgba(255,255,255,0.06)"
                            : "1px solid rgba(0,0,0,0.06)",
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.02)"
                            : "rgba(0,0,0,0.02)",
                        }}
                      >
                        {["#", "Address", "Chain", "Block", "Txns", "Role", "Indexed", "Explorer"].map((h) => (
                          <th
                            key={h}
                            className={`px-5 py-3.5 text-[9px] font-black uppercase tracking-[0.15em] ${
                              ["Block", "Txns"].includes(h) ? "text-right" : ""
                            }`}
                            style={{
                              color: isDark
                                ? "rgba(255,255,255,0.75)"
                                : "rgba(0,0,0,0.35)",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    {/* TBODY */}
                    <tbody>
                      {loading && paginatedWallets.length === 0
                        ? Array.from({ length: 10 }).map((_idx, i) => (
                            <tr
                              key={i}
                              className="animate-pulse"
                              style={{
                                borderBottom: isDark
                                  ? "1px solid rgba(255,255,255,0.04)"
                                  : "1px solid rgba(0,0,0,0.04)",
                              }}
                            >
                              {[52, 200, 60, 80, 28, 55, 60, 40].map((w, j) => (
                                <td key={j} className="px-5 py-4">
                                  <div
                                    className="h-3 rounded"
                                    style={{
                                      width: w,
                                      backgroundColor: isDark
                                        ? "rgba(255,255,255,0.07)"
                                        : "rgba(0,0,0,0.07)",
                                    }}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))
                        : paginatedWallets.length === 0
                        ? (
                          <tr>
                            <td
                              colSpan={8}
                              className="px-5 py-20 text-center text-[12px]"
                              style={{
                                color: isDark
                                  ? "rgba(255,255,255,0.75)"
                                  : "rgba(0,0,0,0.35)",
                              }}
                            >
                              {searchQuery
                                ? "No wallets match your search."
                                : "No wallets indexed yet click Refresh."}
                            </td>
                          </tr>
                        )
                        : paginatedWallets.map((w, i) => (
                          <motion.tr
                            key={`${w.address}-${w.chainId}-${i}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.008 }}
                            className="group transition-colors"
                            style={{
                              borderBottom: isDark
                                ? "1px solid rgba(255,255,255,0.04)"
                                : "1px solid rgba(0,0,0,0.04)",
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.backgroundColor = isDark
                                ? "rgba(255,255,255,0.025)"
                                : "rgba(0,0,0,0.018)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                            }}
                          >
                            {/* # */}
                            <td className="px-5 py-4">
                              <span
                                className="text-[10px] font-mono"
                                style={{
                                  color: isDark
                                    ? "rgba(255,255,255,0.2)"
                                    : "rgba(0,0,0,0.2)",
                                }}
                              >
                                {(page - 1) * PER_PAGE + i + 1}
                              </span>
                            </td>

                            {/* Address */}
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[8px] font-black"
                                  style={{
                                    backgroundColor: isDark ? "#fff" : "#000" + "20",
                                    border: `1px solid ${w.color}35`,
                                    color: w.color,
                                  }}
                                >
                                  W
                                </div>
                                <span
                                  className="text-[11px] font-mono"
                                  style={{
                                    color: isDark ? "#e2e8f0" : "#0f172a",
                                  }}
                                >
                                  {truncate(w.address, 10, 8)}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(w.address, "Address")}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  style={{
                                    color: isDark
                                      ? "rgba(255,255,255,0.7)"
                                      : "rgba(0,0,0,0.3)",
                                  }}
                                >
                                  <Copy size={10} />
                                </button>
                              </div>
                            </td>

                            {/* Chain badge */}
                            <td className="px-5 py-4">
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em]"
                                style={{
                                  backgroundColor: isDark ? "#fff" : "#000" + "18",
                                  color: w.color,
                                  border: `1px solid ${w.color}30`,
                                }}
                              >
                                {w.badge}
                              </span>
                            </td>

                            {/* Block */}
                            <td className="px-5 py-4 text-right">
                              <span
                                className="text-[11px] font-mono"
                                style={{
                                  color: isDark
                                    ? "rgba(255,255,255,0.9)"
                                    : "rgba(0,0,0,0.5)",
                                }}
                              >
                                {w.blockNumber > 0 ? `#${w.blockNumber.toLocaleString()}` : "–"}
                              </span>
                            </td>

                            {/* Txns */}
                            <td className="px-5 py-4 text-right">
                              <span
                                className="text-[11px] font-mono font-bold"
                                style={{
                                  color: isDark ? "#fff" : "#0f172a",
                                }}
                              >
                                {w.txCount}
                              </span>
                            </td>

                            {/* Role */}
                            <td className="px-5 py-4">
                              <span
                                className="text-[9px] font-black uppercase tracking-[0.08em] px-1.5 py-0.5 rounded"
                                style={{
                                  backgroundColor:
                                    w.role === "both"
                                      ? isDark
                                        ? "rgba(99,102,241,0.15)"
                                        : "rgba(99,102,241,0.1)"
                                      : w.role === "sender"
                                      ? isDark
                                        ? "rgba(16,185,129,0.15)"
                                        : "rgba(16,185,129,0.1)"
                                      : isDark
                                      ? "rgba(245,158,11,0.15)"
                                      : "rgba(245,158,11,0.1)",
                                  color:
                                    w.role === "both"
                                      ? "#6366f1"
                                      : w.role === "sender"
                                      ? "#10b981"
                                      : "#f59e0b",
                                }}
                              >
                                {w.role}
                              </span>
                            </td>

                            {/* Timestamp */}
                            <td className="px-5 py-4">
                              <span
                                className="text-[11px]"
                                style={{
                                  color: isDark
                                    ? "rgba(255,255,255,0.8)"
                                    : "rgba(0,0,0,0.4)",
                                }}
                              >
                                {timeAgo(w.timestamp)}
                              </span>
                            </td>

                            {/* Explorer link */}
                            <td className="px-5 py-4">
                              <a
                                href={
                                  w.badge === "HUMANID"
                                    ? `${w.explorer}${w.address}` // humanidfi.com/registry?wallet=0x...
                                    : `${w.explorer}/address/${w.address}` // Etherscan/Polygonscan etc.
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-[10px] font-bold transition-opacity"
                                style={{ color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)" }}
                              >
                                {w.badge === "HUMANID" ? "Profile" : "View"} <ExternalLink size={10} />
                              </a>
                            </td>
                          </motion.tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {!loading && totalPages > 1 && (
                  <div
                    className="px-5 py-3.5 flex items-center justify-between"
                    style={{
                      borderTop: isDark
                        ? "1px solid rgba(255,255,255,0.06)"
                        : "1px solid rgba(0,0,0,0.06)",
                    }}
                  >
                    <span
                      className="text-[11px]"
                      style={{
                        color: isDark
                          ? "rgba(255,255,255,0.75)"
                          : "rgba(0,0,0,0.35)",
                      }}
                    >
                      {(page - 1) * PER_PAGE + 1}–
                      {Math.min(page * PER_PAGE, filteredWallets.length)} of{" "}
                      {filteredWallets.length.toLocaleString()}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-1.5 rounded-lg transition-all disabled:opacity-30"
                        style={{
                          border: isDark
                            ? "1px solid rgba(255,255,255,0.1)"
                            : "1px solid rgba(0,0,0,0.1)",
                          color: isDark
                            ? "rgba(255,255,255,0.6)"
                            : "rgba(0,0,0,0.6)",
                        }}
                      >
                        <ChevronLeft size={13} />
                      </button>

                      {Array.from(
                        { length: Math.min(7, totalPages) },
                        (_idx, i) => {
                          const start =
                            page <= 4
                              ? 1
                              : page >= totalPages - 3
                              ? totalPages - 6
                              : page - 3;
                          const pg = Math.max(1, start) + i;
                          if (pg > totalPages) return null;
                          const active = pg === page;
                          return (
                            <button
                              key={pg}
                              onClick={() => setPage(pg)}
                              className="w-7 h-7 rounded-lg text-[11px] font-bold transition-all"
                              style={{
                                backgroundColor: active
                                  ? isDark
                                    ? "#fff"
                                    : "#0f172a"
                                  : "transparent",
                                color: active
                                  ? isDark
                                    ? "#0f172a"
                                    : "#fff"
                                  : isDark
                                  ? "rgba(255,255,255,0.9)"
                                  : "rgba(0,0,0,0.5)",
                                border: active
                                  ? "none"
                                  : isDark
                                  ? "1px solid rgba(255,255,255,0.1)"
                                  : "1px solid rgba(0,0,0,0.1)",
                              }}
                            >
                              {pg}
                            </button>
                          );
                        }
                      )}

                      <button
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={page === totalPages}
                        className="p-1.5 rounded-lg transition-all disabled:opacity-30"
                        style={{
                          border: isDark
                            ? "1px solid rgba(255,255,255,0.1)"
                            : "1px solid rgba(0,0,0,0.1)",
                          color: isDark
                            ? "rgba(255,255,255,0.6)"
                            : "rgba(0,0,0,0.6)",
                        }}
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB: BLOCK ROOTS
          ══════════════════════════════════════════════════════════════ */}
          {activeTab === "block-roots" && (
            <motion.div
              key="block-roots"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              <div className="mb-5">
                <h1
                  className="text-[20px] font-black tracking-tight"
                  style={{ color: isDark ? "#fff" : "#0f172a" }}
                >
                  Block Roots
                </h1>
                <p
                  className="text-[12px] mt-0.5"
                  style={{
                    color: isDark
                      ? "rgba(255,255,255,0.85)"
                      : "rgba(0,0,0,0.45)",
                  }}
                >
                  Historical block roots indexed across all{" "}
                  {network === "mainnet" ? "mainnet" : "testnet"} chains
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {loading && blockRoots.length === 0
                  ? Array.from({ length: 6 }).map((_idx, i) => (
                      <div
                        key={i}
                        className="rounded-2xl p-5 animate-pulse"
                        style={{
                          border: isDark
                            ? "1px solid rgba(255,255,255,0.07)"
                            : "1px solid rgba(0,0,0,0.07)",
                          backgroundColor: isDark ? "#0d0d17" : "#fff",
                        }}
                      >
                        {[140, 200, 180, 160, 100].map((w, j) => (
                          <div
                            key={j}
                            className="h-3 rounded mb-3"
                            style={{
                              width: w,
                              backgroundColor: isDark
                                ? "rgba(255,255,255,0.07)"
                                : "rgba(0,0,0,0.07)",
                            }}
                          />
                        ))}
                      </div>
                    ))
                  : blockRoots.map((root, i) => (
                      <motion.div
                        key={`${root.chain}-${root.blockNumber}-${i}`}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="rounded-2xl p-5 transition-all"
                        style={{
                          border: isDark
                            ? "1px solid rgba(255,255,255,0.07)"
                            : "1px solid rgba(0,0,0,0.07)",
                          backgroundColor: isDark ? "#0d0d17" : "#fff",
                        }}
                      >
                        {/* Card top */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-[9px] font-black uppercase tracking-[0.12em] px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: root.color + "18",
                                color: root.color,
                                border: `1px solid ${root.color}30`,
                              }}
                            >
                              {root.badge}
                            </span>
                            {root.isCurrent && (
                              <span
                                className="text-[9px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: isDark
                                    ? "rgba(16,185,129,0.12)"
                                    : "rgba(16,185,129,0.08)",
                                  color: "#000000",
                                  border: "1px solid rgba(16,185,129,0.25)",
                                }}
                              >
                                Latest
                              </span>
                            )}
                          </div>
                          <span
                            className="text-[10px] font-mono"
                            style={{
                              color: isDark
                                ? "rgba(255,255,255,0.75)"
                                : "rgba(0,0,0,0.35)",
                            }}
                          >
                            {timeAgo(root.timestamp)}
                          </span>
                        </div>

                        {/* Block num */}
                        <div className="mb-4">
                          <div
                            className="text-[9px] font-black uppercase tracking-[0.12em] mb-1"
                            style={{
                              color: isDark
                                ? "rgba(255,255,255,0.7)"
                                : "rgba(0,0,0,0.3)",
                            }}
                          >
                            Block
                          </div>
                          <div
                            className="text-[15px] font-black font-mono"
                            style={{ color: isDark ? "#fff" : "#0f172a" }}
                          >
                            #{root.blockNumber.toLocaleString()}
                          </div>
                        </div>

                        {/* Hash fields */}
                        {[
                          { label: "Block Hash", value: root.blockHash },
                          { label: "State Root", value: root.stateRoot },
                          { label: "Parent Hash", value: root.parentHash },
                        ].map(({ label, value }) => (
                          <div key={label} className="mb-3">
                            <div className="flex items-center justify-between mb-0.5">
                              <span
                                className="text-[9px] font-black uppercase tracking-[0.1em]"
                                style={{
                                  color: isDark
                                    ? "rgba(255,255,255,0.28)"
                                    : "rgba(0,0,0,0.28)",
                                }}
                              >
                                {label}
                              </span>
                              <button
                                onClick={() => copyToClipboard(value, label)}
                                className="opacity-40 hover:opacity-100 transition-opacity"
                                style={{
                                  color: isDark
                                    ? "rgba(255,255,255,0.9)"
                                    : "rgba(0,0,0,0.5)",
                                }}
                              >
                                <Copy size={10} />
                              </button>
                            </div>
                            <span
                              className="text-[10px] font-mono break-all leading-relaxed"
                              style={{
                                color: isDark
                                  ? "rgba(255,255,255,0.9)"
                                  : "rgba(0,0,0,0.5)",
                              }}
                            >
                              {truncate(value || "–", 16, 10)}
                            </span>
                          </div>
                        ))}

                        {/* Stats */}
                        <div
                          className="flex items-center justify-between mt-4 pt-3"
                          style={{
                            borderTop: isDark
                              ? "1px solid rgba(255,255,255,0.06)"
                              : "1px solid rgba(0,0,0,0.06)",
                          }}
                        >
                          <div>
                            <div
                              className="text-[9px] font-black uppercase tracking-[0.1em]"
                              style={{
                                color: isDark
                                  ? "rgba(255,255,255,0.7)"
                                  : "rgba(0,0,0,0.3)",
                              }}
                            >
                              Txns
                            </div>
                            <div
                              className="text-[14px] font-black font-mono"
                              style={{ color: isDark ? "#fff" : "#0f172a" }}
                            >
                              {root.txCount}
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className="text-[9px] font-black uppercase tracking-[0.1em]"
                              style={{
                                color: isDark
                                  ? "rgba(255,255,255,0.7)"
                                  : "rgba(0,0,0,0.3)",
                              }}
                            >
                              Gas
                            </div>
                            <div
                              className="text-[14px] font-black font-mono"
                              style={{ color: isDark ? "#fff" : "#0f172a" }}
                            >
                              {root.gasUsedPct.toFixed(1)}%
                            </div>
                          </div>
                          <a
                            href={`${root.explorer}/block/${root.blockNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] font-bold hover:underline"
                            style={{ color: "#000000" }}
                          >
                            View <ExternalLink size={10} />
                          </a>
                        </div>
                      </motion.div>
                    ))}
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB: ZK CIRCUIT ROOTS REAL DATA
              Source: zkSync Era (chainId 324) + Polygon zkEVM (chainId 1101)
              stateRoot = ZK-proven state commitment from block header
              l1BatchNumber = link to the Ethereum Network proof batch
          ══════════════════════════════════════════════════════════════ */}
          {activeTab === "circuit-roots" && (
            <motion.div
              key="circuit-roots"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {/* Header */}
              <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1
                    className="text-[20px] font-black tracking-tight flex items-center gap-2"
                    style={{ color: isDark ? "#fff" : "#0f172a" }}
                  >
                    
                    ZK State Commitments
                  </h1>
                  <p
                    className="text-[12px] mt-1 max-w-2xl"
                    style={{ color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.45)" }}
                  >
                    Live Network SNARK proofs from{" "}
                    <strong style={{ color: "#000000" }}>zkSync Era</strong> and{" "}
                    <strong style={{ color: "#000000" }}>Polygon zkEVM</strong>.
                    The <code className="text-[10px] font-mono">stateRoot</code> in each block is the real
                    ZK-proven cryptographic commitment to all account state. On zkSync Era,{" "}
                    <code className="text-[10px] font-mono">l1BatchNumber</code> links directly to the
                    Ethereum proof batch that verified this state.
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap shrink-0">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.1em]" style={{ backgroundColor: "#7C3AED18", color: "#7C3AED", border: "1px solid #7C3AED35" }}>
                    AZTEC TESTNET
                  </div>
                </div>
              </div>

              {/* Loading skeleton */}
              {zkLoading && zkEntries.length === 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 4 }).map((_idx, i) => (
                    <div
                      key={i}
                      className="rounded-2xl p-5 animate-pulse"
                      style={{
                        border: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.07)",
                        backgroundColor: isDark ? "#0d0d17" : "#fff",
                      }}
                    >
                      {[120, 200, 180, 160, 100, 80].map((w, j) => (
                        <div key={j} className="h-3 rounded mb-3"
                          style={{ width: w, backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)" }} />
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state RPC unreachable */}
              {!zkLoading && zkEntries.length === 0 && (
                <div
                  className="rounded-2xl p-12 text-center"
                  style={{
                    border: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.07)",
                    backgroundColor: isDark ? "#0d0d17" : "#fff",
                  }}
                >
                  
                  <p className="text-[12px]" style={{ color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.35)" }}>
                    ZK RPC nodes are unreachable check your connection or try refreshing.
                  </p>
                  <button
                    onClick={() => runZkIndexer(network)}
                    className="mt-4 px-4 py-2 rounded-xl text-[11px] font-bold transition-all"
                    style={{
                      backgroundColor: "#1E69FF18",
                      color: "#000000",
                      border: "1px solid #1E69FF30",
                    }}
                  >
                    Retry ZK fetch
                  </button>
                </div>
              )}

              {/* Real ZK entries */}
              {zkEntries.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {zkEntries.map((entry, i) => (
                    <motion.div
                      key={`${entry.chain}-${entry.blockNumber}-zk-${i}`}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.025 }}
                      className="rounded-2xl p-5 transition-all"
                      style={{
                        border: isDark ? `1px solid ${entry.color}22` : `1px solid ${entry.color}18`,
                        backgroundColor: isDark ? "#0d0d17" : "#fff",
                      }}
                    >
                      {/* Card top */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="text-[9px] font-black uppercase tracking-[0.12em] px-2 py-0.5 rounded-full flex items-center gap-1"
                            style={{ backgroundColor: isDark ? "#fff" : "#000" + "18", color: entry.color, border: `1px solid ${entry.color}30` }}
                          >
                            {entry.badge}
                          </span>
                          <span
                            className="text-[9px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: isDark ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.08)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.22)" }}
                          >
                            {entry.proofType}
                          </span>
                          {entry.isCurrent && (
                            <span
                              className="text-[9px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: isDark ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.08)", color: "#000000", border: "1px solid rgba(16,185,129,0.25)" }}
                            >
                              Latest
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono" style={{ color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.35)" }}>
                          {timeAgo(entry.timestamp)}
                        </span>
                      </div>

                      {/* Block + L1 batch numbers */}
                      <div className="flex items-start gap-5 mb-4">
                        <div>
                          <div className="text-[9px] font-black uppercase tracking-[0.12em] mb-1"
                            style={{ color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.3)" }}>Block</div>
                          <div className="text-[15px] font-black font-mono" style={{ color: isDark ? "#fff" : "#0f172a" }}>
                            #{entry.blockNumber.toLocaleString()}
                          </div>
                        </div>
                        {entry.l1BatchNumber !== null && (
                          <div>
                            <div className="text-[9px] font-black uppercase tracking-[0.12em] mb-1"
                              style={{ color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.3)" }}>L1 Batch</div>
                            <div className="text-[13px] font-black font-mono" style={{ color: entry.color }}>
                              #{entry.l1BatchNumber.toLocaleString()}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Cryptographic fields 100% real Network data */}
                      {[
                        { label: "State Root", value: entry.stateRoot, accent: true },
                        { label: "Block Hash", value: entry.blockHash, accent: false },
                        { label: "Parent Hash", value: entry.parentHash, accent: false },
                      ].map(({ label, value, accent }) => (
                        <div key={label} className="mb-3">
                          <div className="flex items-center justify-between mb-0.5">
                            <span
                              className="text-[9px] font-black uppercase tracking-[0.1em]"
                              style={{ color: accent ? entry.color : isDark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.28)" }}
                            >
                              {label}
                            </span>
                            <button
                              onClick={() => copyToClipboard(value || "–", label)}
                              className="opacity-40 hover:opacity-100 transition-opacity"
                              style={{ color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.5)" }}
                            >
                              <Copy size={10} />
                            </button>
                          </div>
                          <span
                            className="text-[10px] font-mono break-all leading-relaxed"
                            style={{ color: accent ? entry.color : isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.5)" }}
                          >
                            {value ? truncate(value, 18, 10) : "–"}
                          </span>
                        </div>
                      ))}

                      {/* Bottom stats */}
                      <div
                        className="flex items-center justify-between mt-4 pt-3 gap-2 flex-wrap"
                        style={{ borderTop: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)" }}
                      >
                        {/* Proof status computed from real stateRoot presence */}
                        <div>
                          <div className="text-[9px] font-black uppercase tracking-[0.1em] mb-0.5"
                            style={{ color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.3)" }}>State</div>
                          <div
                            className="text-[11px] font-black font-mono flex items-center gap-1"
                            style={{ color: entry.proofVerified ? "#10b981" : "#f59e0b" }}
                          >
                            <div className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: entry.proofVerified ? "#10b981" : "#f59e0b" }} />
                            {entry.proofVerified ? "Committed" : "Pending"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] font-black uppercase tracking-[0.1em] mb-0.5"
                            style={{ color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.3)" }}>Gas</div>
                          <div className="text-[13px] font-black font-mono" style={{ color: isDark ? "#fff" : "#0f172a" }}>
                            {entry.gasUsedPct.toFixed(1)}%
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] font-black uppercase tracking-[0.1em] mb-0.5"
                            style={{ color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.3)" }}>Txns</div>
                          <div className="text-[13px] font-black font-mono" style={{ color: isDark ? "#fff" : "#0f172a" }}>
                            {entry.txCount}
                          </div>
                        </div>
                        <a
                          href={`${entry.explorer}/block/${entry.blockNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] font-bold hover:underline ml-auto"
                          style={{ color: entry.color }}
                        >
                          View <ExternalLink size={10} />
                        </a>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}


          {/* ══════════════════════════════════════════════════════════════
              TAB: OVERVIEW
          ══════════════════════════════════════════════════════════════ */}
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              <div className="mb-6">
                <h1
                  className="text-[20px] font-black tracking-tight"
                  style={{ color: isDark ? "#fff" : "#0f172a" }}
                >
                  Registry Overview
                </h1>
                <p
                  className="text-[12px] mt-0.5"
                  style={{
                    color: isDark
                      ? "rgba(255,255,255,0.85)"
                      : "rgba(0,0,0,0.45)",
                  }}
                >
                  {network === "mainnet" ? "Mainnet" : "Testnet"} registry live Network statistics
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
                {[
                  {
                    label: "Wallets",
                    value: stats.totalWallets.toLocaleString(),
                    icon: <Wallet size={13} />,
                    color: "#000000",
                  },
                  {
                    label: "Chains",
                    value: stats.totalChains.toString(),
                    icon: <Network size={13} />,
                    color: "#000000",
                  },
                  {
                    label: "Latest Block",
                    value: stats.latestBlock
                      ? `#${stats.latestBlock.toLocaleString()}`
                      : "–",
                    icon: <Layers size={13} />,
                    color: "#000000",
                  },
                  {
                    label: "Txns Scanned",
                    value: stats.totalTxs.toLocaleString(),
                    icon: <Activity size={13} />,
                    color: "#000000",
                  },
                  {
                    label: "Senders",
                    value: stats.senders.toLocaleString(),
                    icon: <Zap size={13} />,
                    color: "#000000",
                  },
                  {
                    label: "Receivers",
                    value: stats.receivers.toLocaleString(),
                    icon: <Globe size={13} />,
                    color: "#000000",
                  },
                ].map((s: any, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-2xl p-4"
                    style={{
                      border: isDark
                        ? "1px solid rgba(255,255,255,0.07)"
                        : "1px solid rgba(0,0,0,0.07)",
                      backgroundColor: isDark ? "#0d0d17" : "#fff",
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className="text-[9px] font-black uppercase tracking-[0.12em]"
                        style={{
                          color: isDark
                            ? "rgba(255,255,255,0.75)"
                            : "rgba(0,0,0,0.35)",
                        }}
                      >
                        {s.label}
                      </span>
                      <div
                        className="p-1.5 rounded-lg"
                        style={{
                          backgroundColor: s.color + "18",
                          color: s.color,
                        }}
                      >
                        {s.icon}
                      </div>
                    </div>
                    {loading ? (
                      <div
                        className="h-7 w-16 rounded-lg animate-pulse"
                        style={{
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.07)"
                            : "rgba(0,0,0,0.07)",
                        }}
                      />
                    ) : (
                      <div
                        className="text-[22px] font-black tracking-tight leading-none"
                        style={{ color: isDark ? "#fff" : "#0f172a" }}
                      >
                        {s.value}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Chain Breakdown Table */}
              <div
                className="rounded-2xl overflow-hidden mb-6"
                style={{
                  border: isDark
                    ? "1px solid rgba(255,255,255,0.07)"
                    : "1px solid rgba(0,0,0,0.07)",
                  backgroundColor: isDark ? "#0d0d17" : "#fff",
                }}
              >
                <div
                  className="px-5 py-4"
                  style={{
                    borderBottom: isDark
                      ? "1px solid rgba(255,255,255,0.06)"
                      : "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  <h2
                    className="text-[11px] font-black uppercase tracking-[0.12em]"
                    style={{
                      color: isDark
                        ? "rgba(255,255,255,0.9)"
                        : "rgba(0,0,0,0.5)",
                    }}
                  >
                    Chain Breakdown
                  </h2>
                </div>

                {/* Humanity Ledger — Aztec Mainnet single-row breakdown */}
                {(()=>{
                  const aztecRoot = blockRoots.find(r => r.isCurrent);
                  const aztecWallets = wallets.filter(w => w.chainId === 2171337 || w.badge === "AZTEC" || w.badge === "WN");
                  return (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="px-5 py-4 flex items-center justify-between transition-colors"
                      style={{ borderBottom: isDark ? "1px solid rgba(255,255,255,0.04)" : "1px solid rgba(0,0,0,0.04)" }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-[9px] font-black shrink-0"
                          style={{ backgroundColor: "#7C3AED18", border: "1px solid #7C3AED30", color: "#7C3AED" }}
                        >
                          AZTEC
                        </div>
                        <div>
                          <div className="text-[13px] font-bold" style={{ color: isDark ? "#fff" : "#0f172a" }}>
                            Aztec Mainnet
                          </div>
                          <div className="text-[10px] font-mono" style={{ color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.35)" }}>
                            Chain ID: 2171337 · humanidfi.com
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="text-right hidden sm:block">
                          <div className="text-[9px] font-black uppercase tracking-[0.1em] mb-0.5" style={{ color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.3)" }}>Wallets</div>
                          <div className="text-[13px] font-black font-mono" style={{ color: isDark ? "#fff" : "#0f172a" }}>{aztecWallets.length.toLocaleString()}</div>
                        </div>
                        <div className="text-right hidden md:block">
                          <div className="text-[9px] font-black uppercase tracking-[0.1em] mb-0.5" style={{ color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.3)" }}>Latest Block</div>
                          <div className="text-[13px] font-black font-mono" style={{ color: isDark ? "#fff" : "#0f172a" }}>{aztecRoot ? `#${aztecRoot.blockNumber.toLocaleString()}` : "–"}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] font-black uppercase tracking-[0.1em] mb-0.5" style={{ color: isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.3)" }}>Status</div>
                          <div className="flex items-center gap-1.5 justify-end">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: aztecRoot ? "#10b981" : loading ? "#f59e0b" : "rgba(0,0,0,0.2)", animation: aztecRoot ? "pulse 2s infinite" : "none" }} />
                            <span className="text-[11px] font-bold" style={{ color: isDark ? "#fff" : "#0f172a" }}>{aztecRoot ? "Live" : loading ? "Syncing…" : "—"}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })()}
              </div>

              {/* Registry Metadata */}
              <div
                className="rounded-2xl p-5"
                style={{
                  border: isDark
                    ? "1px solid rgba(255,255,255,0.07)"
                    : "1px solid rgba(0,0,0,0.07)",
                  backgroundColor: isDark ? "#0d0d17" : "#fff",
                }}
              >
                <h2
                  className="text-[11px] font-black uppercase tracking-[0.12em] mb-5"
                  style={{
                    color: isDark
                      ? "rgba(255,255,255,0.8)"
                      : "rgba(0,0,0,0.4)",
                  }}
                >
                  Registry Metadata
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                  {[
                    {
                      label: "Network Mode",
                      value:
                        network === "mainnet" ? "Production" : "Testnet",
                    },
                    { label: "Scan Depth", value: `${Number(SCAN_DEPTH)} blocks / chain` },
                    {
                      label: "Index Method",
                      value: "Tx participants (from + to)",
                    },
                    {
                      label: "Deduplication",
                      value: "Address × Chain ID",
                    },
                    { label: "Data Source", value: "Network (Live)" },
                    { label: "Update Mode", value: "On-demand refresh" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div
                        className="text-[9px] font-black uppercase tracking-[0.1em] mb-1"
                        style={{
                          color: isDark
                            ? "rgba(255,255,255,0.7)"
                            : "rgba(0,0,0,0.3)",
                        }}
                      >
                        {label}
                      </div>
                      <div
                        className="text-[12px] font-bold"
                        style={{ color: isDark ? "#fff" : "#0f172a" }}
                      >
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          {/* ══════════════════════════════════════════════════════════════
              TAB: AZTEC ANALYTICS
          ══════════════════════════════════════════════════════════════ */}
          {activeTab === "aztec-analytics" && (
            <motion.div
              key="aztec-analytics"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              <AztecAnalyticsTab isDark={isDark} />
            </motion.div>
          )}
          {/* ══════════════════════════════════════════════════════════════
              TAB: HUMANIDFI REAL ACTIVITY
          ══════════════════════════════════════════════════════════════ */}
          {activeTab === "humanidfi-activity" && (
            <motion.div
              key="humanidfi-activity"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              <LedgerNetworkActivityTab isDark={isDark} />
            </motion.div>
          )}

        </AnimatePresence>
        <SystemFooter />
      </div>
    </div>
  );
}
