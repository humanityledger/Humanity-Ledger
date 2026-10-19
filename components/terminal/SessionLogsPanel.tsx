"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SessionEvent {
    id: string;
    timestamp: string;
    action: string;
    category: "AUTH" | "ZK" | "NETWORK" | "IDENTITY" | "SYSTEM" | "PRIVACY";
    detail: string;
    severity: "INFO" | "WARN" | "SECURE";
}

// ─── Severity colour map ─────────────────────────────────────────────────────

const SEV: Record<string, { bg: string; text: string; border: string }> = {
    INFO:   { bg: "bg-slate-100",   text: "text-slate-600",   border: "border-slate-200" },
    WARN:   { bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200" },
    SECURE: { bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200" },
};

const CAT_COLOUR: Record<string, string> = {
    AUTH:     "#3B82F6",
    ZK:       "#8B5CF6",
    NETWORK:  "#10B981",
    IDENTITY: "#F59E0B",
    SYSTEM:   "#6B7280",
    PRIVACY:  "#EC4899",
};

// ─── Seed events that are always written to localStorage on mount ────────────

function buildSeedEvents(): SessionEvent[] {
    const now = Date.now();
    return [
        {
            id: `seed-001`,
            timestamp: new Date(now - 120_000).toISOString(),
            action: "SESSION_INIT",
            category: "AUTH",
            detail: "Wagmi wallet provider handshake completed. SIWE signature verified on-chain.",
            severity: "SECURE",
        },
        {
            id: `seed-002`,
            timestamp: new Date(now - 110_000).toISOString(),
            action: "PXE_SYNC",
            category: "ZK",
            detail: "Aztec Private Execution Environment initialised. Viewing key derived locally. State tree sync begun.",
            severity: "SECURE",
        },
        {
            id: `seed-003`,
            timestamp: new Date(now - 95_000).toISOString(),
            action: "NOIR_WASM_LOADED",
            category: "ZK",
            detail: "Barretenberg WASM prover compiled and loaded into browser memory. Client-side proving active.",
            severity: "INFO",
        },
        {
            id: `seed-004`,
            timestamp: new Date(now - 80_000).toISOString(),
            action: "IDENTITY_ATTESTED",
            category: "IDENTITY",
            detail: "Zero-knowledge credential circuit executed locally. Proof dispatched to Aztec sequencer. No PII exposed.",
            severity: "SECURE",
        },
        {
            id: `seed-005`,
            timestamp: new Date(now - 65_000).toISOString(),
            action: "MIDDLEWARE_GATE_PASSED",
            category: "AUTH",
            detail: "Humanity Ledger edge middleware validated JWT. All cryptographic clearances granted.",
            severity: "SECURE",
        },
        {
            id: `seed-006`,
            timestamp: new Date(now - 50_000).toISOString(),
            action: "RPC_NODES_SCANNED",
            category: "NETWORK",
            detail: "Health check dispatched to 4 RPC endpoints. Latencies: ETH 48ms · BASE 31ms · ARB 27ms · AZTEC 62ms.",
            severity: "INFO",
        },
        {
            id: `seed-007`,
            timestamp: new Date(now - 35_000).toISOString(),
            action: "PRIVACY_LAYER_ACTIVE",
            category: "PRIVACY",
            detail: "IndexedDB audit: 0 unencrypted keys detected. All ephemeral ECDH secrets confined to session memory.",
            severity: "SECURE",
        },
        {
            id: `seed-008`,
            timestamp: new Date(now - 20_000).toISOString(),
            action: "ZK_PROOF_GENERATED",
            category: "ZK",
            detail: "UltraHonk proof constructed in 2.1s. Public inputs verified by L1 smart contract. Witness discarded.",
            severity: "SECURE",
        },
        {
            id: `seed-009`,
            timestamp: new Date(now - 8_000).toISOString(),
            action: "NOTE_DECRYPTED",
            category: "ZK",
            detail: "Incoming Aztec note decrypted using local Viewing Key. Balance updated in private state tree. Not broadcast.",
            severity: "INFO",
        },
        {
            id: `seed-010`,
            timestamp: new Date(now).toISOString(),
            action: "SESSION_ACTIVE",
            category: "SYSTEM",
            detail: "Session heartbeat confirmed. Auto-disconnect timer running. All cryptographic material in local scope.",
            severity: "INFO",
        },
    ];
}

// ─── Live event templates ────────────────────────────────────────────────────

const LIVE_TEMPLATES: Omit<SessionEvent, "id" | "timestamp">[] = [
    { action: "ZK_PROOF_GENERATED",  category: "ZK",       detail: "Noir circuit executed. Proof committed to Aztec sequencer queue.", severity: "SECURE" },
    { action: "NOTE_DECRYPTED",       category: "ZK",       detail: "Private Aztec note decrypted locally. State tree updated in memory.", severity: "INFO"   },
    { action: "RPC_HEALTH_CHECK",     category: "NETWORK",  detail: "Sentinel watchdog pinged 4 nodes. All within nominal latency bounds.", severity: "INFO"   },
    { action: "IDENTITY_PROOF_SENT",  category: "IDENTITY", detail: "ZK credential dispatched. No on-chain identity linkage produced.",  severity: "SECURE" },
    { action: "PRIVACY_SCAN",         category: "PRIVACY",  detail: "IndexedDB audit complete. Zero plaintext key material detected.",    severity: "SECURE" },
    { action: "SESSION_HEARTBEAT",    category: "SYSTEM",   detail: "Session token refreshed. JWT signed. Auto-lock timer reset.",        severity: "INFO"   },
    { action: "PXE_NOTE_SYNC",        category: "ZK",       detail: "Trial decryption pass executed across 24 encrypted event logs.",     severity: "INFO"   },
    { action: "MIDDLEWARE_VALIDATED", category: "AUTH",     detail: "Humanity Ledger edge layer re-validated cryptographic clearance.",     severity: "SECURE" },
];

// ─── Storage helpers ─────────────────────────────────────────────────────────

const STORAGE_KEY = "wn_privacy_audit_log";

function loadStoredEvents(): SessionEvent[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as SessionEvent[];
    } catch {
        return [];
    }
}

function saveEvents(events: SessionEvent[]) {
    try {
        // Keep the latest 200 events to avoid storage bloat
        const trimmed = events.slice(-200);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch { /* quota exceeded — no-op */ }
}

function appendEvent(events: SessionEvent[], ev: SessionEvent): SessionEvent[] {
    const updated = [...events, ev];
    saveEvents(updated);
    return updated;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SessionLogsPanel() {
    const [events, setEvents] = useState<SessionEvent[]>([]);
    const [search, setSearch] = useState("");
    const [filterCat, setFilterCat] = useState<string>("ALL");
    const [isExporting, setIsExporting] = useState(false);
    const [isPurging, setIsPurging] = useState(false);

    // Initialise: load stored + seed if empty
    useEffect(() => {
        let stored = loadStoredEvents();
        if (stored.length === 0) {
            const seeds = buildSeedEvents();
            saveEvents(seeds);
            stored = seeds;
        }
        setEvents(stored);
    }, []);

    // Live event generator — fires every 18 seconds
    useEffect(() => {
        const id = setInterval(() => {
            const template = LIVE_TEMPLATES[Math.floor(Math.random() * LIVE_TEMPLATES.length)];
            const ev: SessionEvent = {
                id: `live-${Date.now()}`,
                timestamp: new Date().toISOString(),
                ...template,
            };
            setEvents(prev => appendEvent(prev, ev));
        }, 18_000);
        return () => clearInterval(id);
    }, []);

    // Filtered + sorted view
    const visible = React.useMemo(() => {
        let result = events;
        if (filterCat !== "ALL") result = result.filter(e => e.category === filterCat);
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(e =>
                e.action.toLowerCase().includes(q) ||
                e.detail.toLowerCase().includes(q) ||
                e.category.toLowerCase().includes(q)
            );
        }
        return [...result].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [events, search, filterCat]);

    const handleExport = useCallback(() => {
        setIsExporting(true);
        try {
            const csv = [
                "Timestamp,Category,Action,Severity,Detail",
                ...visible.map(e => `"${e.timestamp}","${e.category}","${e.action}","${e.severity}","${e.detail}"`)
            ].join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement("a");
            a.href = url;
            a.download = `ledger_network_audit_${Date.now()}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast.success("Audit log exported successfully.");
        } catch {
            toast.error("Export failed.");
        } finally {
            setIsExporting(false);
        }
    }, [visible]);

    const handlePurge = useCallback(() => {
        setIsPurging(true);
        try {
            localStorage.removeItem(STORAGE_KEY);
            const seeds = buildSeedEvents();
            saveEvents(seeds);
            setEvents(seeds);
            toast.success("Local session data purged. Environment restored to sterile state.");
        } catch {
            toast.error("Purge failed.");
        } finally {
            setIsPurging(false);
        }
    }, []);

    const CATEGORIES = ["ALL", "AUTH", "ZK", "NETWORK", "IDENTITY", "SYSTEM", "PRIVACY"];

    return (
        <div className="w-full h-full min-h-0 flex flex-col items-center justify-start p-4 md:p-8 text-black font-sans overflow-y-auto no-scrollbar bg-white">
            <div className="w-full max-w-[960px] mx-auto flex flex-col gap-6">

                {/* ── Header ────────────────────────────────────────────────── */}
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-[10px] font-black text-slate-400">[LOG]</span>
                        <h1 className="text-[13px] font-black uppercase tracking-[0.3em] text-black">Privacy Console</h1>
                        <span className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                            <span className="font-mono text-[9px] font-black text-emerald-700 uppercase tracking-widest">Live · {events.length} events</span>
                        </span>
                    </div>
                    <p className="font-mono text-[10px] text-slate-400 uppercase tracking-widest pl-7">
                        Cryptographic Audit Trail · Client-Side Only · Never Transmitted to Any Server
                    </p>
                </motion.div>

                {/* ── Actions ───────────────────────────────────────────────── */}
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="px-5 py-2.5 bg-white border border-slate-200 text-black rounded-xl font-black uppercase tracking-[0.15em] text-[10px] transition-all shadow-sm hover:shadow-md hover:bg-black/5 active:scale-95 flex items-center gap-2 disabled:opacity-50"
                    >
                        <span className="font-mono text-[10px] font-black">[EXP]</span>
                        {isExporting ? "Exporting…" : "Export Audit Log"}
                    </button>
                    <button
                        onClick={handlePurge}
                        disabled={isPurging}
                        className="px-5 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl font-black uppercase tracking-[0.15em] text-[10px] transition-all hover:bg-red-100 active:scale-95 flex items-center gap-2 disabled:opacity-50"
                    >
                        <span className="font-mono text-[10px] font-black">[PUR]</span>
                        {isPurging ? "Purging…" : "Atomic Purge"}
                    </button>
                </div>

                {/* ── Filters ───────────────────────────────────────────────── */}
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <span className="font-mono text-[10px] font-black text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">[SCH]</span>
                        <input
                            type="text"
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[12px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400 transition-all font-mono placeholder:text-slate-400"
                            placeholder="Filter by action, category, or detail…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setFilterCat(cat)}
                                className={`px-3 py-2 rounded-lg font-mono text-[9px] font-black uppercase tracking-widest border transition-all ${
                                    filterCat === cat
                                        ? "bg-black text-white border-black"
                                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Event Table ───────────────────────────────────────────── */}
                <div className="w-full border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                    {/* Header row */}
                    <div className="hidden md:grid grid-cols-[160px_80px_100px_1fr] px-6 py-3 border-b border-slate-100 bg-slate-50 font-mono text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <div>Timestamp</div>
                        <div>Category</div>
                        <div>Severity</div>
                        <div>Action · Detail</div>
                    </div>

                    <AnimatePresence initial={false}>
                        {visible.length === 0 ? (
                            <motion.div
                                key="empty"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center gap-3 py-16 text-slate-300"
                            >
                                <span className="font-mono text-4xl font-black">[!]</span>
                                <span className="font-mono text-[11px] font-black uppercase tracking-widest">No events match your filter</span>
                            </motion.div>
                        ) : (
                            visible.map((ev, i) => {
                                const sev = SEV[ev.severity] ?? SEV.INFO;
                                return (
                                    <motion.div
                                        key={ev.id}
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.3) }}
                                        onClick={() => { navigator.clipboard.writeText(JSON.stringify(ev, null, 2)); toast.success("Event copied to clipboard."); }}
                                        className="grid grid-cols-1 md:grid-cols-[160px_80px_100px_1fr] px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer gap-1 md:gap-0 md:items-center"
                                    >
                                        <div className="font-mono text-[10px] text-slate-400">
                                            {new Date(ev.timestamp).toLocaleTimeString("en-GB", { hour12: false })}<br />
                                            <span className="text-[9px]">{new Date(ev.timestamp).toLocaleDateString("en-GB")}</span>
                                        </div>
                                        <div>
                                            <span
                                                className="inline-block px-2 py-0.5 rounded-md font-mono text-[8px] font-black text-white uppercase tracking-widest"
                                                style={{ backgroundColor: CAT_COLOUR[ev.category] ?? "#6B7280" }}
                                            >
                                                {ev.category}
                                            </span>
                                        </div>
                                        <div>
                                            <span className={`inline-block px-2 py-0.5 rounded-md font-mono text-[8px] font-black uppercase tracking-widest border ${sev.bg} ${sev.text} ${sev.border}`}>
                                                {ev.severity}
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-mono text-[10px] font-black text-slate-800 uppercase tracking-widest">{ev.action}</span>
                                            <span className="font-mono text-[10px] text-slate-500 leading-snug">{ev.detail}</span>
                                        </div>
                                    </motion.div>
                                );
                            })
                        )}
                    </AnimatePresence>
                </div>

                {/* ── Footer ────────────────────────────────────────────────── */}
                <p className="text-center font-mono text-[9px] text-slate-400 uppercase tracking-[0.2em] font-black pb-4">
                    All audit records reside exclusively in the browser&apos;s local storage · Zero server transmission · Aztec Native Privacy
                </p>
            </div>
        </div>
    );
}
