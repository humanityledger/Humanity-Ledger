"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, RefreshCw, AlertTriangle, ExternalLink, ShieldCheck, Zap, Loader2 } from 'lucide-react';
import { useSystemAccount as useAccount } from '@/hooks/useSystemAccount';
import { useTransactionHandler } from '@/hooks/useTransactionHandler';
import { toast } from 'sonner';

interface DeFiPool {
    pool: string; chain: string; chainFull?: string; project: string;
    symbol: string; apy: number; apyBase: number; apyReward: number;
    tvlUsd: number; ilRisk: string; stablecoin: boolean;
    url: string; riskScore: number; tier: string;
}

const fmtUsd = (n: number) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
};
const fmtApy  = (n: number) => `${n.toFixed(2)}%`;

const RISK: Record<number, { label: string; color: string }> = {
    1: { label: 'SAFE',        color: 'var(--az-emerald)' },
    2: { label: 'LOW',         color: 'var(--az-emerald)' },
    3: { label: 'MODERATE',    color: 'var(--az-amber)' },
    4: { label: 'HIGH',        color: '#ff7a3c' },
    5: { label: 'AGGRESSIVE',  color: 'var(--az-rose)' },
};

const CHAIN_CLS: Record<string, string> = {
    Ethereum: 'az-chain-pill az-chain-eth', Arbitrum: 'az-chain-pill az-chain-arb',
    Base: 'az-chain-pill az-chain-base', Optimism: 'az-chain-pill az-chain-op',
    BSC: 'az-chain-pill az-chain-bnb', Solana: 'az-chain-pill az-chain-sol',
};
const chainCls = (c: string) => CHAIN_CLS[c] || 'az-chain-pill az-badge-ghost';

function SkeletonRows({ n = 8 }: { n?: number }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {Array.from({ length: n }).map((_idx, i) => (
                <div key={i} style={{ padding: '12px 16px', display: 'flex', gap: 12 }}>
                    <div className="az-skeleton" style={{ flex: 1, height: 10, borderRadius: 0 }} />
                    <div className="az-skeleton" style={{ width: 60, height: 10 }} />
                    <div className="az-skeleton" style={{ width: 70, height: 10 }} />
                    <div className="az-skeleton" style={{ width: 50, height: 10 }} />
                </div>
            ))}
        </div>
    );
}

export default function DeFiYieldPanel() {
    const [pools, setPools] = useState<DeFiPool[]>([]);
    const [stats, setStats] = useState({ avgApy: 0, maxApy: 0, stablePools: 0, totalTvl: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [stableOnly, setStableOnly] = useState(false);
    const [minApy, setMinApy] = useState(3);
    const [chain, setChain] = useState('all');
    const [riskMax, setRiskMax] = useState(5);
    const [selected, setSelected] = useState<DeFiPool | null>(null);
    const [ts, setTs] = useState('');

    const { isConnected } = useAccount();
    const { handleExternalTransaction } = useTransactionHandler();
    const [isDepositing, setIsDepositing] = useState(false);
    const [depositAmount, setDepositAmount] = useState('1000');

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const r = await fetch(`/api/defi/yields?limit=100&minApy=${minApy}&chain=${chain}`);
            const d = await r.json();
            if (d.error) throw new Error(d.error);
            setStats(d.stats || {});
            if (d?.timestamp) {
                setTs(new Date(d.timestamp).toISOString().slice(11, 19));
            }
            let p: DeFiPool[] = d.pools || [];
            if (stableOnly) p = p.filter(x => x.stablecoin);
            if (riskMax < 5) p = p.filter(x => x.riskScore <= riskMax);
            setPools(p);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    }, [minApy, chain, stableOnly, riskMax]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { const i = setInterval(load, 60000); return () => clearInterval(i); }, [load]);

    const CHAINS = ['all', 'Ethereum', 'Arbitrum', 'Base', 'Optimism', 'Polygon', 'BSC', 'Solana'];

    const handleOneClickDeposit = async () => {
        if (!isConnected) {
            toast.error("Wallet Not Connected", { description: "Connect a wallet to execute on-chain deposits." });
            return;
        }
        if (!selected) return;
        
        setIsDepositing(true);
        try {
            toast.loading("Generating optimal calldata...", { id: `dep-${selected.pool}` });
            
            // Send routing intent to Execution Engine (Enso API via Backend)
            const response = await fetch('/api/defi/deposit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chain: selected.chainFull || selected.chain,
                    poolAddress: selected.pool, // The DeFiLlama pool representing the receipt token
                    amount: depositAmount,
                    userAddress: isConnected ? window.ethereum?.selectedAddress || '0xUserContextPending' : null
                })
            });

            if (!response.ok) {
                const j = await response.json();
                throw new Error(j.error || "Execution Engine routing failed.");
            }

            const { tx } = await response.json();
            
            toast.loading("Awaiting signature from web3 provider...", { id: `dep-${selected.pool}` });

            // Ejecutar transacción real On-Chain via wagmi router handler
            await handleExternalTransaction({
                to: tx.to as `0x${string}`,
                data: tx.data as `0x${string}`,
                value: tx.value || "0",
                chainId: tx.chainId
            });
            
            toast.success("Deposit Confirmed On-Chain", { 
                id: `dep-${selected.pool}`,
                description: `Successfully deposited into ${selected.project} on ${selected.chainFull || selected.chain} network.` 
            });
        } catch (e: any) {
            toast.error("Deposit Failed", { 
                id: `dep-${selected.pool}`,
                description: e.message || "User rejected the transaction or gas estimation failed."
            });
        } finally {
            setIsDepositing(false);
        }
    };

    return (
        <div className="h-full min-h-0 flex flex-col bg-white rounded border border-[#E5E5E5] shadow-sm overflow-hidden">
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid rgba(5,5,5,0.06)', flexShrink: 0, backgroundColor: '#FFFFFF' }}>
                {[
                    { label: 'MAX APY',       value: fmtApy(stats.maxApy),   color: '#16a34a' },
                    { label: 'AVG APY',       value: fmtApy(stats.avgApy),   color: '#050505' },
                    { label: 'STABLE POOLS',  value: stats.stablePools,      color: '#0ea5e9' },
                    { label: 'TOTAL TVL',     value: fmtUsd(stats.totalTvl), color: '#050505' },
                ].map(s => (
                    <div key={s.label} style={{ padding: '16px 20px', borderRight: '1px solid rgba(5,5,5,0.06)' }} className="last:border-0 hover:bg-black/[0.015] transition-colors">
                        <div className="text-[9px] font-bold uppercase tracking-widest text-[#050505]/40 mb-1">{s.label}</div>
                        <div className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid rgba(5,5,5,0.06)', flexShrink: 0, flexWrap: 'wrap', backgroundColor: '#FFFFFF' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={stableOnly} onChange={e => setStableOnly(e.target.checked)} style={{ accentColor: '#050505' }} />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#050505]/60">STABLE ONLY</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Filter size={10} color="rgba(5,5,5,0.4)" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#050505]/50">APY MIN:</span>
                    <select value={minApy} onChange={e => setMinApy(+e.target.value)} className="bg-white border border-[#E5E5E5] rounded px-2 py-1 text-xs text-[#050505] font-mono outline-none">
                        {[3,5,8,10,15,20,30].map(v => <option key={v} value={v}>{v}%</option>)}
                    </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#050505]/50">CHAIN:</span>
                    <select value={chain} onChange={e => setChain(e.target.value)} className="bg-white border border-[#E5E5E5] rounded px-2 py-1 text-xs text-[#050505] font-mono outline-none">
                        {CHAINS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#050505]/50">MAX RISK:</span>
                    <select value={riskMax} onChange={e => setRiskMax(+e.target.value)} className="bg-white border border-[#E5E5E5] rounded px-2 py-1 text-xs text-[#050505] font-mono outline-none">
                        {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}  {RISK[v]?.label}</option>)}
                    </select>
                </div>
                <button onClick={load} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-widest text-[#050505]/50 hover:text-[#050505] hover:bg-black/5 transition-all">
                    <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> REFRESH
                </button>
            </div>

            {/* Table */}
            <div className="flex flex-1 min-h-0 relative overflow-hidden">
                <div className="custom-scrollbar flex-1 w-full overflow-y-auto">
                    {error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', color: '#ff3b30', fontSize: 11 }}>
                            <AlertTriangle size={12} /> <span>{error}</span>
                        </div>
                    )}
                    {!loading && pools.length > 0 && (
                        <div className="grid grid-cols-6 gap-8 p-4 border-b border-[#E5E5E5] sticky top-0 bg-[#FFFFFF]/95 backdrop-blur z-10 text-[10px] font-mono tracking-widest text-[#050505]/40 uppercase">
                            <span className="col-span-2">Pool</span>
                            <span style={{ textAlign: 'right' }}>Chain</span>
                            <span style={{ textAlign: 'right' }}>APY</span>
                            <span style={{ textAlign: 'right' }}>TVL</span>
                            <span style={{ textAlign: 'right' }}>Risk</span>
                        </div>
                    )}
                    {loading && <SkeletonRows />}
                    <AnimatePresence initial={false}>
                        {pools.map((p, i) => {
                            const risk = RISK[p.riskScore] || RISK[5];
                            const isActive = selected?.pool === p.pool;
                            return (
                                <motion.div
                                    key={p.pool}
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15, delay: i * 0.008 }}
                                    className={`grid grid-cols-6 gap-8 p-4 border-b border-[#E5E5E5] cursor-pointer transition-colors ${isActive ? 'bg-white/[0.02]' : 'hover:bg-[#FFFFFF]'}`}
                                    onClick={() => setSelected(isActive ? null : p)}
                                >
                                    <div className="col-span-2 overflow-hidden flex flex-col gap-1">
                                        <span className="text-sm font-bold text-[#050505] tracking-tight truncate">{p.symbol}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] uppercase text-[#050505]/40 tracking-wider truncate">{p.project}</span>
                                            {p.stablecoin && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#FFFFFF] border border-[#E5E5E5] text-[#050505]">STABLE</span>}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-white border border-[#E5E5E5] text-[#A0A0A0]">{p.chain}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                        <span className="text-sm font-mono font-bold" style={{ color: p.apy >= 20 ? '#16a34a' : p.apy >= 10 ? '#0ea5e9' : '#050505' }}>
                                            {fmtApy(p.apy)}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                        <span className="text-sm font-mono font-bold text-[#050505]/70">{fmtUsd(p.tvlUsd)}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                        <span className="text-[10px] font-bold tracking-widest px-2 py-1 rounded border border-[#E5E5E5] bg-white text-[#050505]">{risk.label}</span>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>

                {/* Detail panel with 1-Click Execution */}
                <AnimatePresence>
                    {selected && (
                        <motion.div
                            initial={{ x: 400, opacity: 0 }} 
                            animate={{ x: 0, opacity: 1 }} 
                            exit={{ x: 400, opacity: 0 }}
                            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                            className="w-[340px] flex-shrink-0 border-l border-[#E5E5E5] bg-[#FFFFFF] flex flex-col overflow-hidden shadow-xl z-20"
                        >
                            <div className="p-6 border-b border-[#E5E5E5] bg-[#FFFFFF]">
                                <div className="text-[10px] font-mono tracking-widest text-[#050505]/50 mb-2 uppercase flex items-center gap-2">
                                    <ShieldCheck size={12} /> ON-CHAIN SYNC
                                </div>
                                <div className="text-xl font-bold font-mono tracking-tight text-[#050505] mb-1">{selected.symbol}</div>
                                <div className="text-xs text-[#050505]/40 uppercase font-mono">{selected.project} · {selected.chainFull || selected.chain}</div>
                            </div>
                            
                            <div className="flex-1 p-6 space-y-5 overflow-y-auto custom-scrollbar">
                                {/* APY Hero */}
                                <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded p-6 text-center">
                                    <div className="text-[10px] uppercase font-mono tracking-[0.1em] text-[#050505]/40 mb-2">TOTAL NET YIELD</div>
                                    <div className="text-4xl font-bold font-mono text-[#00C076]">{fmtApy(selected.apy)}</div>
                                    <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-[#E5E5E5]">
                                        <div className="flex flex-col"><span className="text-[9px] text-[#050505]/40 uppercase">Base</span> <span className="text-xs font-mono font-bold text-[#050505]">{fmtApy(selected.apyBase)}</span></div>
                                        <div className="flex flex-col"><span className="text-[9px] text-[#050505]/40 uppercase">Reward</span> <span className="text-xs font-mono font-bold text-[#050505]">{fmtApy(selected.apyReward)}</span></div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    {[
                                        { l: 'TVL',        v: fmtUsd(selected.tvlUsd) },
                                        { l: 'IL RISK',    v: selected.ilRisk === 'no' ? 'NONE' : selected.ilRisk.toUpperCase() },
                                        { l: 'RISK',       v: `${selected.riskScore}/5  ${RISK[selected.riskScore]?.label}` },
                                        { l: 'ASSET TYPE', v: selected.stablecoin ? 'STABLECOIN' : 'VOLATILE' },
                                    ].map(row => (
                                        <div key={row.l} className="flex justify-between items-center py-2.5 border-b border-[#E5E5E5]">
                                            <span className="text-[10px] font-mono text-[#050505]/40 uppercase tracking-widest">{row.l}</span>
                                            <span className="text-sm font-mono font-bold text-[#050505]">{row.v}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="bg-white rounded p-4 border border-[#E5E5E5]">
                                    <div className="text-[10px] font-mono tracking-widest text-[#050505]/50 mb-2">DEPOSIT AMOUNT (USDC)</div>
                                    <input 
                                        type="number" 
                                        value={depositAmount} 
                                        onChange={e => setDepositAmount(e.target.value)} 
                                        className="w-full bg-[#FFFFFF] border border-[#E5E5E5] rounded py-3 px-4 text-[#050505] font-mono text-xl outline-none focus:border-[#050505] transition-colors"
                                        placeholder="0.00"
                                    />
                                    <div className="mt-2 text-[10px] font-mono text-[#050505]/40">
                                        ESTIMATE: <span className="text-[#00C076] font-bold">+{fmtUsd((Number(depositAmount || 0) * selected.apy) / 100 / 365)} / DAY</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="p-5 border-t border-[#E5E5E5] bg-[#FFFFFF] space-y-3">
                                <button 
                                    onClick={handleOneClickDeposit}
                                    disabled={isDepositing || !depositAmount}
                                    className="w-full py-4 rounded bg-white text-white font-bold uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-2 hover:bg-[#888888] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isDepositing ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <>
                                            <Zap size={14} /> DEPOSIT
                                        </>
                                    )}
                                </button>
                                <p className="text-[9px] font-mono text-[#050505]/30 text-center uppercase tracking-widest">
                                    {isConnected ? 'SMART CONTRACT ROUTING' : 'CONNECT WALLET TO DEPOSIT'}
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {ts && <div className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-[#050505]/30" style={{ padding: '6px 16px', borderTop: '1px solid rgba(5,5,5,0.06)', flexShrink: 0 }}>DATA: DEFILLAMA API · SYNC: {ts} UTC</div>}
        </div>
    );
}
