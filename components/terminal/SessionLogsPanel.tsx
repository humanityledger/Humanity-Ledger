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
        const trimmed = events.slice(-200);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch { /* quota exceeded — no-op */ }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SessionLogsPanel() {
    const [events, setEvents] = useState<SessionEvent[]>([]);
    const [search, setSearch] = useState("");
    const [filterCat, setFilterCat] = useState<string>("ALL");
    const [isExporting, setIsExporting] = useState(false);
    const [isPurging, setIsPurging] = useState(false);

    // Initialise: load stored local events
    useEffect(() => {
        const stored = loadStoredEvents();
        setEvents(stored);
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
        return [...result].reverse();
    }, [events, filterCat, search]);

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
            setEvents([]);
            toast.success("Local session audit data cleared.");
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
                        <span className="font-mono text-xs font-black bg-black text-white px-2 py-0.5 rounded tracking-widest uppercase">AUDIT</span>
                        <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 uppercase">Cryptographic Session Audit Log</h1>
                    </div>
                    <p className="text-xs text-slate-500 font-mono">
                        Real-time verification log of on-device zero-knowledge proofs, wallet handshakes, and cryptographic sessions.
                    </p>
                </motion.div>

                {/* ── Controls ──────────────────────────────────────────────── */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExport}
                            disabled={isExporting || visible.length === 0}
                            className="px-4 py-2 bg-black hover:bg-slate-800 disabled:opacity-40 text-white font-mono text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                        >
                            Export CSV
                        </button>
                        <button
                            onClick={handlePurge}
                            disabled={isPurging || events.length === 0}
                            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 disabled:opacity-40 font-mono text-[10px] font-black uppercase tracking-widest rounded-xl border border-rose-200 transition-all"
                        >
                            Purge Records
                        </button>
                    </div>

                    <div className="flex-1 max-w-xs">
                        <input
                            type="text"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-black placeholder:text-slate-400"
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
                                className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400 text-center px-4"
                            >
                                <span className="font-mono text-4xl font-black text-slate-300">[AUDIT]</span>
                                <span className="font-mono text-[11px] font-black uppercase tracking-widest text-slate-600">No session audit records found</span>
                                <p className="text-xs text-slate-400 max-w-sm">
                                    Real cryptographic operations (SIWE handshakes, Aztec ZK circuits, and XMTP message dispatches) are logged here on-device.
                                </p>
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
                    All audit records reside exclusively in browser local storage · Zero server transmission · Aztec Native Privacy
                </p>
            </div>
        </div>
    );
}
