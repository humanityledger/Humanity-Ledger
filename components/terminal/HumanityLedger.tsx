"use client";

import React, { useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

// ─── Roadmap Data — Humanity Ledger Full Architecture ───────────────────────────

interface RoadmapNode {
  id: string;
  title: string;
  status: 'live' | 'building' | 'planned';
  quarter: string;
  description: string;
  x: number;
  y: number;
}

interface RoadmapEdge {
  from: string;
  to: string;
}

// Column X positions (phases)
const C1 = 80;   // Phase 1 — Core Infrastructure
const C2 = 360;  // Phase 2 — Auth & Membership
const C3 = 640;  // Phase 3 — ZK & Studio
const C4 = 920;  // Phase 4 — Markets & Intelligence (Jul–Sep 2026)
const C5 = 1200; // Phase 5 — Protocol Expansion (Oct–Nov 2026)
const C6 = 1480; // Phase 6 — Genesis December 2026

const NODES: RoadmapNode[] = [

  // ─── PHASE 1: Core Infrastructure (COMPLETED) ────────────────────────────
  {
    id: 'frontend',
    title: 'Next.js 15 App Router',
    status: 'live',
    quarter: 'Completed',
    description: 'Next.js 15 App Router, Tailwind CSS, Framer Motion animations. Full monorepo deployed on Railway with GitHub CI/CD. Responsive across desktop, tablet, and mobile.',
    x: C1, y: 60,
  },
  {
    id: 'db',
    title: 'PostgreSQL + Prisma ORM',
    status: 'live',
    quarter: 'Completed',
    description: 'Production database on Railway. Prisma ORM handles users, sessions, memberships, product passports, transaction history, and Ledger tier data.',
    x: C1, y: 200,
  },
  {
    id: 'evm',
    title: 'EVM Wallet + AppKit',
    status: 'live',
    quarter: 'Completed',
    description: 'Full multi-wallet connectivity via Wagmi, Viem, and WalletConnect AppKit. Supports MetaMask, Trust Wallet, Coinbase Wallet, and mobile deep-link flows on iOS and Android.',
    x: C1, y: 340,
  },
  {
    id: 'railway',
    title: 'Railway Deployment',
    status: 'live',
    quarter: 'Completed',
    description: 'Production infrastructure on Railway: Next.js server, PostgreSQL, Nargo ZK backend, and all API routes deployed with zero-downtime rolling updates.',
    x: C1, y: 480,
  },

  // ─── PHASE 2: Auth, Membership & Terminal (COMPLETED) ────────────────────
  {
    id: 'siwe',
    title: 'SIWE Mobile Auth',
    status: 'live',
    quarter: 'Completed',
    description: 'Sign-In with Ethereum with full iOS/Android support. Fixed critical MetaMask App-Switch Loop and iOS/Android WebKit TDZ crash (React Error 310) — fully stable as of July 26, 2026.',
    x: C2, y: 60,
  },
  {
    id: 'vip',
    title: 'Ledger Tier Access',
    status: 'live',
    quarter: 'Completed',
    description: 'Tiered membership system (Ledger, Orca, Shark, Initiate). Each tier unlocks progressively deeper access: LedgerChat, Studio Provenance creation, sovereign circuit library, and advanced terminal modules. Tiers are verified cryptographically via wallet signature.',
    x: C2, y: 200,
  },
  {
    id: 'terminal',
    title: 'Ledger Terminal',
    status: 'live',
    quarter: 'Completed',
    description: 'Sovereign-grade multi-tab terminal: Portfolio Dashboard, Markets, Roadmap, Governance, LedgerChat, Studio Provenance, Alerts, Session Logs, and ZK Developer Sandbox — all in one shell.',
    x: C2, y: 340,
  },
  {
    id: 'LedgerChat',
    title: 'Ledger Chat + QD Economy',
    status: 'live',
    quarter: 'Completed',
    description: 'End-to-end encrypted P2P messaging. Integrated QD micro-payment economy: messages cost QDs, senders earn daily rewards. Email login via OTP + Google OAuth fully operational.',
    x: C2, y: 480,
  },

  // ─── PHASE 3: ZK Circuits, Studio & Security (COMPLETED) ───────────────
  {
    id: 'zksandbox',
    title: 'Noir ABI Encoding Layer',
    status: 'live',
    quarter: 'Completed',
    description: 'Provides native TypeScript support for Noir ABI Encoding and decoding. Enables the frontend to serialize parameters into ACIR-compatible Witness Maps (Field, Integer, Array, Struct) before delegating proofs to the Aztec RPC.',
    x: C3, y: 60,
  },
  {
    id: 'circuits',
    title: 'ZK-Anchored Identity',
    status: 'live',
    quarter: 'Completed',
    description: 'User identity is anchored to the Aztec Network using deterministic nullifiers instead of raw wallet addresses. Replaces naive signature checks with session-based identity derived from a secure handshake (SIWE + EIP-712).',
    x: C3, y: 200,
  },
  {
    id: 'enclave',
    title: 'Enclave PIN Security',
    status: 'live',
    quarter: 'Completed',
    description: 'Critical security hardening of the Turing Shield Enclave. Patched a full PIN bypass vulnerability. New system uses server-side HMAC-SHA256 verification, constant-time comparison (timing-attack proof), and 5-attempt brute-force lockout.',
    x: C3, y: 340,
  },
  {
    id: 'passportqr',
    title: 'Studio Provenance + QR Wall',
    status: 'live',
    quarter: 'Completed',
    description: 'Product Passport creation engine. Regular users: up to 3 passports; Owners: unlimited. Each passport generates a tamper-proof QR code. Wallet auth gate on all public URLs before provenance is revealed.',
    x: C3, y: 480,
  },

  // ─── PHASE 4: Aztec Integration & On-Chain Intelligence (Jul - Sep 2026) ─────────────
  {
    id: 'aztecmainnet',
    title: 'Aztec Mainnet Live',
    status: 'live',
    quarter: 'Completed',
    description: 'Connected to Aztec Labs public RPC for mainnet proof delegation and state reading. Full migration to Aztec Mainnet RPC. QD token transfers anchored to real Aztec blocks.',
    x: C4, y: 60,
  },
  {
    id: 'governance',
    title: 'On-Chain Governance',
    status: 'live',
    quarter: 'Completed',
    description: 'Protocol governance module live in the terminal. Members vote on proposals spending QDs as voting weight. One-vote-per-wallet nullifier, real-time vote tallying, and proposal lifecycle management (VOTING → APPROVED).',
    x: C4, y: 200,
  },
  {
    id: 'stealth-transfers',
    title: 'ZK Stealth Transfers',
    status: 'live',
    quarter: 'Completed',
    description: 'Private peer-to-peer capital routing leveraging Aztec\'s shielded state. Transfer significant capital between wallets with absolute cryptographic privacy, obscuring sender, receiver, and transaction size from public chain analysis.',
    x: C4, y: 340,
  },
  {
    id: 'alerts',
    title: 'Ledger Alert Engine',
    status: 'building',
    quarter: 'Sep 2026',
    description: 'Real-time on-chain ledger movement monitoring. Tracks wallets above $1M threshold, detects suspicious clustering and wash-trading patterns, and delivers push notifications through the in-terminal alert panel.',
    x: C4, y: 480,
  },

  // ─── PHASE 5: Protocol Expansion (Oct – Nov 2026) ────────────────────────
  {
    id: 'hyperliquid',
    title: 'Hyperliquid Execution',
    status: 'planned',
    quarter: 'Oct 2026',
    description: 'Direct perpetuals execution panel. Place, modify, and cancel orders on Hyperliquid L1 from within the Ledger terminal with institutional-grade slippage and position controls.',
    x: C5, y: 60,
  },
  {
    id: 'darkpool',
    title: 'Dark Pool Orderbook',
    status: 'planned',
    quarter: 'Oct 2026',
    description: 'Private institutional orderbook using the compiled ZK Order Matching circuit. Makers and takers cross price without revealing order size or price. Beta access for Ledger tier members only.',
    x: C5, y: 200,
  },
  {
    id: 'aml',
    title: 'AML Compliance Oracle',
    status: 'planned',
    quarter: 'Nov 2026',
    description: 'Automated AML screening for all wallet-to-wallet transfers above €1,000. Merkle-proof against OFAC sanction list. Travel Rule proof generated in <2s and stored on-chain for auditors.',
    x: C5, y: 340,
  },
  {
    id: 'mobileapp',
    title: 'Native Mobile App',
    status: 'planned',
    quarter: 'Nov 2026',
    description: 'Native iOS and Android app wrapping the Ledger terminal. Biometric wallet signing, push notifications for ledger alerts, LedgerChat, and Studio Provenance QR scanning from the camera.',
    x: C5, y: 480,
  },

  // ─── PHASE 6: Genesis — December 2026 ────────────────────────────────────
  {
    id: 'mainnet',
    title: 'Aztec Mainnet Alpha',
    status: 'planned',
    quarter: 'Dec 2026',
    description: 'Full production deployment on Aztec Mainnet. CoreLedger contract, private Token, and the first institutional Dark Pool liquidity pool live. Audited circuits only.',
    x: C6, y: 100,
  },
  {
    id: 'dao',
    title: 'Ledger DAO Governance',
    status: 'planned',
    quarter: 'Dec 2026',
    description: 'On-chain governance with ZK-private voting. Ledger Token holders vote on treasury, protocol upgrades, and fee structures without revealing wallet identity or token balance.',
    x: C6, y: 280,
  },
  {
    id: 'mica',
    title: 'MiCA / CNMV Filing',
    status: 'planned',
    quarter: 'Dec 2026',
    description: 'Full EU regulatory compliance package. MiCA white paper, CNMV sandbox notification for Humanity Ledger S.L., and automated Travel Rule proof submission pipeline for financial authorities.',
    x: C6, y: 460,
  },
];

const EDGES: RoadmapEdge[] = [
  // P1 → P2
  { from: 'frontend',    to: 'siwe' },
  { from: 'db',          to: 'vip' },
  { from: 'evm',         to: 'terminal' },
  { from: 'railway',     to: 'LedgerChat' },
  // P2 → P3
  { from: 'siwe',        to: 'zksandbox' },
  { from: 'vip',         to: 'enclave' },
  { from: 'terminal',    to: 'enclave' },
  { from: 'LedgerChat',   to: 'circuits' },
  { from: 'terminal',    to: 'passportqr' },
  // P3 → P4
  { from: 'zksandbox',   to: 'aztecmainnet' },
  { from: 'circuits',    to: 'aztecmainnet' },
  { from: 'enclave',     to: 'governance' },
  { from: 'passportqr',  to: 'stealth-transfers' },
  // P4 → P5
  { from: 'aztecmainnet',     to: 'hyperliquid' },
  { from: 'governance',       to: 'hyperliquid' },
  { from: 'stealth-transfers',to: 'darkpool' },
  { from: 'alerts',           to: 'aml' },
  // P5 → P6
  { from: 'hyperliquid', to: 'mainnet' },
  { from: 'darkpool',    to: 'mainnet' },
  { from: 'aml',         to: 'mainnet' },
  { from: 'hyperliquid', to: 'dao' },
  { from: 'mobileapp',   to: 'dao' },
  { from: 'aml',         to: 'mica' },
];

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; border: string }> = {
  live:     { label: 'Completed',  dot: 'bg-black',       text: 'text-black',       border: 'border-black' },
  building: { label: 'Building',   dot: 'bg-black/40',    text: 'text-black/60',    border: 'border-black/40' },
  planned:  { label: 'Planned',    dot: 'bg-black/15',    text: 'text-black/35',    border: 'border-black/15' },
};
const DEFAULT_STATUS_CFG = STATUS_CONFIG.planned;

const NODE_W = 200;
const NODE_H = 88;

// ─── Canvas Component ─────────────────────────────────────────────────────────

function RoadmapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 30, y: 60, scale: 0.78 });
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<RoadmapNode | null>(null);
  const dragStart = useRef<{ mx: number; my: number; tx: number; ty: number } | null>(null);

  const CANVAS_W = 1980;
  const CANVAS_H = 720;

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, tx: transform.x, ty: transform.y };
  }, [transform]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !dragStart.current) return;
    const { mx, my, tx, ty } = dragStart.current;
    setTransform(t => ({ ...t, x: tx + (e.clientX - mx), y: ty + (e.clientY - my) }));
  }, [dragging]);

  const onMouseUp = useCallback(() => { setDragging(false); dragStart.current = null; }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setTransform(t => ({ ...t, scale: Math.min(2, Math.max(0.3, t.scale + (-e.deltaY * 0.001))) }));
  }, []);

  const zoomIn  = () => setTransform(t => ({ ...t, scale: Math.min(2, t.scale + 0.15) }));
  const zoomOut = () => setTransform(t => ({ ...t, scale: Math.max(0.3, t.scale - 0.15) }));
  const reset   = () => setTransform({ x: 30, y: 60, scale: 0.78 });

  function edgePath(from: RoadmapNode, to: RoadmapNode) {
    const x1 = from.x + NODE_W;
    const y1 = from.y + NODE_H / 2;
    const x2 = to.x;
    const y2 = to.y + NODE_H / 2;
    const cx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
  }

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    setDragging(true);
    dragStart.current = { mx: e.touches[0].clientX, my: e.touches[0].clientY, tx: transform.x, ty: transform.y };
  }, [transform]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging || !dragStart.current) return;
    const { mx, my, tx, ty } = dragStart.current;
    setTransform(t => ({ ...t, x: tx + (e.touches[0].clientX - mx), y: ty + (e.touches[0].clientY - my) }));
  }, [dragging]);

  const onTouchEnd = useCallback(() => { setDragging(false); dragStart.current = null; }, []);

  const COLUMNS = [
    { label: 'Phase 1 — Core',         x: C1 },
    { label: 'Phase 2 — Auth & UX',    x: C2 },
    { label: 'Phase 3 — ZK & Studio',  x: C3 },
    { label: 'Phase 4 — Jul–Sep 26',   x: C4 },
    { label: 'Phase 5 — Oct–Nov 26',   x: C5 },
    { label: 'Phase 6 — Dec 26',       x: C6 },
  ];

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-white">
      {/* Legend + zoom controls */}
      <div className="absolute bottom-4 left-4 right-4 sm:bottom-8 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto z-20 flex items-center justify-between sm:justify-center px-4 py-3 border border-black/10 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg">
        <div className="flex items-center gap-4 sm:gap-5">
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5 sm:gap-2">
              <span className={`w-2 h-2 rounded-full ${v.dot}`} />
              <span className="text-[9px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-black/50">{v.label}</span>
            </div>
          ))}
        </div>
        <div className="w-[1px] h-4 bg-black/10 mx-2 sm:mx-4 hidden sm:block" />
        <div className="flex items-center gap-1 sm:gap-2">
          <button onClick={zoomOut} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors text-black/60 font-bold text-lg leading-none">−</button>
          <button onClick={zoomIn}  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors text-black/60 font-bold text-lg leading-none">+</button>
          <button onClick={reset}   className="px-2 sm:px-3 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors text-[9px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-black/50">Reset</button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative w-full flex-1 overflow-hidden bg-white"
        style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onWheel={onWheel}
      >
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.07) 1px, transparent 1px)',
            backgroundSize: `${32 * transform.scale}px ${32 * transform.scale}px`,
            backgroundPosition: `${transform.x}px ${transform.y}px`,
          }}
        />

        <div
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            width: CANVAS_W,
            height: CANVAS_H,
            position: 'absolute',
          }}
        >
          {/* Column labels */}
          {COLUMNS.map(q => (
            <div
              key={q.label}
              style={{ position: 'absolute', left: q.x, top: 0, width: NODE_W }}
              className="flex items-center justify-center"
            >
              <span className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-black/25 whitespace-nowrap">
                {q.label}
              </span>
            </div>
          ))}

          {/* SVG Edges */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: CANVAS_W, height: CANVAS_H, pointerEvents: 'none', overflow: 'visible' }}>
            {EDGES.map(e => {
              const fromNode = NODES.find(n => n.id === e.from);
              const toNode   = NODES.find(n => n.id === e.to);
              if (!fromNode || !toNode) return null;
              const opacity = toNode.status === 'planned' ? 0.08 : toNode.status === 'building' ? 0.2 : 0.14;
              return (
                <path
                  key={`${e.from}-${e.to}`}
                  d={edgePath(fromNode, toNode)}
                  stroke={`rgba(0,0,0,${opacity})`}
                  strokeWidth="1.5"
                  fill="none"
                  strokeDasharray={toNode.status === 'planned' ? '5 4' : undefined}
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {NODES.map(node => {
            const cfg = STATUS_CONFIG[node.status] ?? DEFAULT_STATUS_CFG;
            const isSelected = selected?.id === node.id;
            return (
              <div
                key={node.id}
                data-node="true"
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y + 24,
                  width: NODE_W,
                  minHeight: NODE_H,
                }}
                className={`bg-white border transition-all duration-150 cursor-pointer select-none ${
                  isSelected ? 'border-black shadow-md' : `${cfg.border} hover:border-black/40 hover:shadow-sm`
                }`}
                onClick={() => setSelected(isSelected ? null : node)}
              >
                <div className="p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                    <span className={`font-mono text-[9px] font-black uppercase tracking-wider ${cfg.text}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className={`text-[12px] font-bold tracking-tight leading-snug ${
                    node.status === 'live' ? 'text-black' :
                    node.status === 'building' ? 'text-black/55' :
                    'text-black/30'
                  }`}>
                    {node.title}
                  </p>
                  <p className={`text-[10px] font-mono ${
                    node.status === 'live' ? 'text-black/40' :
                    node.status === 'building' ? 'text-black/30' :
                    'text-black/20'
                  }`}>
                    {node.quarter}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          className="border-t border-black/8 bg-white px-6 py-5 flex items-start gap-6"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[selected.status].dot}`} />
              <span className="font-mono text-[10px] font-black uppercase tracking-wider text-black/40">
                {selected.quarter} · {STATUS_CONFIG[selected.status].label}
              </span>
            </div>
            <h3 className="text-[15px] font-black tracking-tight text-black mb-1.5">{selected.title}</h3>
            <p className="text-[13px] text-black/55 leading-relaxed max-w-[640px]">{selected.description}</p>
          </div>
          <button
            onClick={() => setSelected(null)}
            className="shrink-0 w-8 h-8 flex items-center justify-center border border-black/12 hover:bg-black/[0.03] transition-colors text-black/40 font-bold text-lg leading-none"
          >
            ×
          </button>
        </motion.div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HumanityLedger() {
  return (
    <div className="relative w-full h-full min-h-0 bg-white overflow-y-auto flex flex-col">
      <div className="absolute top-0 left-0 right-0 px-6 py-6 sm:py-8 z-10 pointer-events-none bg-gradient-to-b from-white via-white/90 to-transparent">
        <div className="max-w-[900px]">
          <h1 className="text-[22px] font-black tracking-tight text-black mb-2 pointer-events-auto">
            Protocol Roadmap
          </h1>
          <p className="text-[12px] sm:text-[13.5px] text-black/50 leading-relaxed pointer-events-auto max-w-xl">
            Humanity Ledger development timeline — from core infrastructure to Genesis in December 2026.
            Drag the canvas to explore, scroll to zoom, and click any node for details.
          </p>
        </div>
      </div>

      <div className="relative w-full flex-1">
        <RoadmapCanvas />
      </div>
    </div>
  );
}
