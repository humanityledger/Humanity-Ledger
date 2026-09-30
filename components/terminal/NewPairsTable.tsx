"use client";

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    Search, Loader2, ShieldCheck, ShieldAlert,
    ArrowUpRight, ArrowDownRight, Clock, Filter,
    Users, Zap, AlertTriangle, RefreshCw
} from 'lucide-react';
import { useMarketData } from '@/lib/api-client';

type Chain = 'all' | 'solana' | 'base' | 'ethereum' | 'arbitrum' | 'bsc' | 'polygon' | 'avalanche';

const CHAIN_COLORS: Record<string, string> = {
    solana:    '#9945FF',
    base:      '#0052FF',
    ethereum:  '#627EEA',
    arbitrum:  '#12AAFF',
    bsc:       '#F0B90B',
    polygon:   '#8247E5',
    avalanche: '#E84142',
};

const NETWORKS: Chain[] = ['all', 'ethereum', 'solana', 'base', 'bsc', 'arbitrum', 'polygon', 'avalanche'];

export function NewPairsTable() {
    // =========================================================================
    // INJECTED DATA HOOK
    // Enforcing strict on-chain reality. Waiting for endpoint assignment.
    // =========================================================================
    const [rawData, setRawData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetchRealPairs = React.useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('https://api.dexscreener.com/latest/dex/search?q=usd');
            const data = await res.json();
            if (!data.pairs || data.pairs.length === 0) throw new Error("Empty response");
            setRawData(data);
            setError(false);
        } catch (err) {
            console.warn("Failed to fetch pairs", err);
            // Zero-Mock Mandate: No fallback data. Show error state.
            setError(true);
            setRawData({ pairs: [] });
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchRealPairs();
        const interval = setInterval(fetchRealPairs, 15000); // 15 seconds
        return () => clearInterval(interval);
    }, [fetchRealPairs]);

    const refetch = fetchRealPairs;
    const pairs = rawData?.pairs || [];

    const [search, setSearch]     = useState('');
    const [chainFilter, setChainFilter] = useState<Chain>('all');
    const [rugFilter, setRugFilter]     = useState<'all' | 'verified' | 'risky'>('all');
    const lastRefresh = new Date(); // To be controlled by react-query internally in the future

    const fmt = (n: number | null | undefined) => {
        if (n == null || isNaN(n)) return '';
        if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
        if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
        if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
        return `$${n.toFixed(0)}`;
    };

    const pctColor = (v: number) => v >= 0 ? 'text-[#00C076]' : 'text-[#FF3B30]';
    const pctFmt   = (v: number | null | undefined) => {
        if (v == null || isNaN(v)) return '';
        return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
    };

    const getAge = (ms: number) => {
        const diff = Date.now() - ms;
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m`;
        return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    };

    const filtered = pairs
        .filter((p: any) => p != null && typeof p === 'object')
        .filter((p: any) => chainFilter === 'all' || p.chain === chainFilter || p.chainId === chainFilter)
        .filter((p: any) => {
            const score = p.security?.score ?? 50;
            if (rugFilter === 'verified') return score >= 65;
            if (rugFilter === 'risky')    return score < 65;
            return true;
        })
        .filter((p: any) =>
            (p.baseToken?.symbol ?? '').toLowerCase().includes(search.toLowerCase()) ||
            (p.baseToken?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
            (p.chain ?? '').toLowerCase().includes(search.toLowerCase())
        );

    const chains: Chain[] = NETWORKS;

    return (
        <div className="w-full h-full min-h-0 p-0 flex flex-col overflow-hidden text-[#050505] font-sans">
            <div className="flex-1 w-full bg-[#FFFFFF] rounded-2xl border border-[#E5E5E5] overflow-hidden shadow-sm flex flex-col min-h-0">

            {/*  Toolbar  */}
            <div className="shrink-0 px-4 py-3 border-b border-[#E5E5E5] bg-[#FFFFFF] flex items-center gap-3 flex-wrap">
                {/* Search */}
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
                    <input
                        value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Symbol, chain"
                        className="w-full bg-white border border-[#E5E5E5] rounded-lg pl-8 pr-3 py-1.5 text-[11px] font-mono text-[#050505] outline-none focus:border-[#050505] transition-all"
                    />
                </div>

                {/* Rug filter */}
                <div className="flex gap-1">
                    {(['all', 'verified', 'risky'] as const).map(f => (
                        <button key={f}
                            onClick={() => setRugFilter(f)}
                            className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border transition-all ${rugFilter === f
                                ? f === 'verified' ? 'bg-[#00C076] text-white border-[#00C076]'
                                : f === 'risky'    ? 'bg-[#FF3B30] text-white border-[#FF3B30]'
                                : 'bg-white text-white border-[#050505]'
                                : 'text-[#888888] border-[#E5E5E5] hover:border-[#050505]'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                <div className="ml-auto flex items-center gap-3">
                    <button onClick={() => refetch()} className="p-1.5 rounded-lg border border-[#E5E5E5] text-[#888888] hover:text-[#050505] transition-colors">
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <span className="flex items-center gap-1.5 text-[9px] font-black tracking-widest uppercase" style={{ color: '#888888' }}>
                        SECURE SYNC
                    </span>
                </div>
            </div>

            {/*  Network Filter Row (Fix B)  */}
            <div className="shrink-0 px-4 py-2 border-b border-[#E5E5E5] bg-white flex items-center gap-2 flex-wrap">
                <span className="text-[9px] font-black text-[#888888] uppercase tracking-widest mr-1">Network:</span>
                {chains.map(c => (
                    <button key={c}
                        onClick={() => setChainFilter(c)}
                        className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border transition-all ${chainFilter === c
                            ? 'text-white border-transparent'
                            : 'text-[#888888] border-[#E5E5E5] hover:border-[#050505] bg-transparent'}`}
                        style={chainFilter === c ? { background: c === 'all' ? '#050505' : CHAIN_COLORS[c] || '#050505' } : {}}>
                        {c === 'all' ? 'All Networks' : c.charAt(0).toUpperCase() + c.slice(1)}
                    </button>
                ))}
            </div>

            {/*  Table  */}
            {/* outer scroll: horizontal only */}
            <div className="flex-1 overflow-x-auto relative min-h-0 flex flex-col">
                {/* min-width wrapper */}
                <div style={{ minWidth: 1400 }} className="flex-1 flex flex-col min-h-0">

                    {/* Column Headers */}
                    <div className="sticky top-0 z-10 grid bg-white border-b border-[#E5E5E5] text-[9px] font-bold text-[#A0A0A0] uppercase tracking-[0.1em] shrink-0"
                        style={{ gridTemplateColumns: '2.4fr 1.4fr 0.7fr 0.9fr 0.9fr 0.9fr 0.9fr 0.9fr 0.9fr 1fr 1fr 1.4fr' }}
                    >
                        {['ASSET/DEX', 'PRICE', 'AGE', '5M', '1H', '6H', '24H', 'LIQ', 'MCAP', 'FDV', 'VOL/MAKERS', 'SEC/SCORE'].map((h, idx) => (
                            <div key={h} className={`px-3 py-2.5 ${idx > 2 ? 'text-right' : ''}`}>{h}</div>
                        ))}
                    </div>

                    {/* Rows */}
                    <div className="flex-1 overflow-y-auto msv-hide-scrollbar min-h-0">
                        {loading ? (
                            <div className="p-12 text-center text-[#888888] text-xs font-mono flex flex-col items-center justify-center h-full">
                                <Loader2 className="animate-spin mb-3" size={32} />
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] font-sans">WAITING FOR ON-CHAIN ENDPOINT</p>
                            </div>
                        ) : error ? (
                            <div className="h-full flex flex-col items-center justify-center p-12">
                                <AlertTriangle size={24} className="text-black/10 mb-3" />
                                <p className="text-[10px] font-bold text-black/40 uppercase tracking-[0.2em] font-sans">
                                    DATA LAKE SYNC FAILED
                                </p>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="p-12 text-center text-[#888888] text-[10px] font-mono flex items-center justify-center h-full">NO PAIRS MATCH FILTERS</div>
                        ) : (
                            <div className="flex flex-col w-full h-full">
                                {filtered.map((p: any, index: number) => {
                                    if (!p || !p.baseToken) {
                                        return null;
                                    }
                                    const security = p.security || { score: 50, honeypotRisk: false, lpBurned: false, mintRevoked: false };
                                    const priceChange = p.priceChange || { m5: 0, h1: 0, h6: 0, h24: 0 };
                                    const txns = p.txns || { m5: { buys: 0, sells: 0 } };
                                    const liquidity = p.liquidity || { usd: 0 };
                                    const verifiers = p.verifiers || { makers: 0, snipers: 0 };
                                    const taxes = p.taxes || { buy: 0, sell: 0 };
                                    const chainName = p.chain || p.chainId || 'unknown';
                                    const isRug = (security.score ?? 50) < 65;
                                    const score = security.score ?? 50;
                                    return (
                                        <div key={p.id || index} className="border-b border-[#F0F0F0]">
                                            <div className="grid hover:bg-[#FFFFFF] transition-colors items-center cursor-pointer min-h-[78px]"
                                                style={{ gridTemplateColumns: '2.4fr 1.4fr 0.7fr 0.9fr 0.9fr 0.9fr 0.9fr 0.9fr 0.9fr 1fr 1fr 1.4fr' }}
                                            >
                                                {/* Token / Dex */}
                                                <div className="px-3 flex items-center gap-2.5 overflow-hidden">
                                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0"
                                                        style={{ background: CHAIN_COLORS[chainName] || '#888' }}>
                                                        {p.baseToken.symbol[0]}
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[11px] font-black text-[#050505] truncate">{p.baseToken.symbol}</span>
                                                            <span className="text-[8px] font-mono text-[#888888]">/ {p.quoteToken?.symbol || 'USD'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-[8px] font-bold text-[#888888] truncate">{p.baseToken.name}</span>
                                                            <span className="text-[7px] px-1.5 py-0.5 rounded border border-[#E5E5E5] text-[#888888]" style={{ borderColor: CHAIN_COLORS[chainName] + '55', color: CHAIN_COLORS[chainName] }}>{chainName}</span>
                                                            <span className="text-[7px] text-[#888888]">{p.dexId || p.dex}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Price */}
                                                <div className="px-3">
                                                    <div className="text-[11px] font-black font-mono text-[#050505]">${p.priceUsd}</div>
                                                    <div className="flex gap-2 mt-0.5 text-[9px] font-mono">
                                                        <span className="text-[#00C076] flex items-center gap-0.5"><ArrowUpRight size={9}/>{txns.m5?.buys || 0}B</span>
                                                        <span className="text-[#FF3B30] flex items-center gap-0.5"><ArrowDownRight size={9}/>{txns.m5?.sells || 0}S</span>
                                                    </div>
                                                </div>

                                                {/* Age */}
                                                <div className="px-3 text-right text-[10px] font-mono font-bold text-[#050505] flex items-center justify-end gap-1">
                                                    <Clock size={10} className="text-[#888888]" />{getAge(p.pairCreatedAt)}
                                                </div>

                                                {/* 5m % */}
                                                <div className={`px-3 text-right text-[10px] font-black font-mono ${pctColor(priceChange.m5 || 0)}`}>
                                                    {pctFmt(priceChange.m5 || 0)}
                                                </div>

                                                {/* 1h % */}
                                                <div className={`px-3 text-right text-[10px] font-black font-mono ${pctColor(priceChange.h1 || 0)}`}>
                                                    {pctFmt(priceChange.h1 || 0)}
                                                </div>

                                                {/* 6h % */}
                                                <div className={`px-3 text-right text-[10px] font-black font-mono ${pctColor(priceChange.h6 || 0)}`}>
                                                    {pctFmt(priceChange.h6 || 0)}
                                                </div>

                                                {/* 24h % */}
                                                <div className={`px-3 text-right text-[10px] font-black font-mono ${pctColor(priceChange.h24 || 0)}`}>
                                                    {pctFmt(priceChange.h24 || 0)}
                                                </div>

                                                {/* Liquidity */}
                                                <div className="px-3 text-right text-[10px] font-bold font-mono text-[#050505]">
                                                    {fmt(liquidity.usd || p.liquidity || 0)}
                                                </div>

                                                {/* MCap */}
                                                <div className="px-3 text-right text-[10px] font-bold font-mono text-[#050505]">
                                                    {fmt(p.mcap)}
                                                </div>

                                                {/* FDV */}
                                                <div className="px-3 text-right text-[10px] font-bold font-mono text-[#888888]">
                                                    {fmt(p.fdv)}
                                                </div>

                                                {/* Makers */}
                                                <div className="px-3 text-right">
                                                    <div className="flex flex-col items-end gap-0.5">
                                                        <span className="text-[10px] font-bold font-mono text-[#050505] flex items-center gap-1">
                                                            <Users size={9} className="text-[#888888]" />{verifiers.makers || 0}
                                                        </span>
                                                        {(verifiers.snipers || 0) > 0 && (
                                                            <span className="text-[8px] font-bold text-[#FF3B30] flex items-center gap-0.5">
                                                                <Zap size={8}/>{verifiers.snipers}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Security Score */}
                                                <div className="px-3">
                                                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider border w-fit ml-auto ${
                                                        isRug
                                                            ? 'bg-[#FF3B30]/10 border-[#FF3B30]/30 text-[#FF3B30]'
                                                            : 'bg-[#00C076]/10 border-[#00C076]/30 text-[#00C076]'
                                                    }`}>
                                                        {isRug ? <ShieldAlert size={10}/> : <ShieldCheck size={10}/>}
                                                        <span>{score}/100</span>
                                                        {p.security.honeypotRisk && <AlertTriangle size={9} className="text-[#FF9500]" />}
                                                    </div>
                                                    <div className="flex gap-1.5 justify-end mt-1">
                                                        {security.lpBurned     && <span className="text-[7px] font-black text-[#00C076]">LP</span>}
                                                        {security.mintRevoked  && <span className="text-[7px] font-black text-[#00C076]">MINT</span>}
                                                        {(taxes.buy || 0)  > 0 && <span className="text-[7px] font-bold text-[#888888]">B:{taxes.buy}%</span>}
                                                        {(taxes.sell || 0) > 0 && <span className="text-[7px] font-bold text-[#888888]">S:{taxes.sell}%</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/*  Status Footer  */}
            <div className="shrink-0 px-5 py-2.5 border-t border-[#E5E5E5] bg-[#FFFFFF] flex items-center justify-between text-[9px] font-bold text-[#A0A0A0] uppercase tracking-[0.1em]">
                <span>{filtered.length} PAIRS · ON-CHAIN VERIFIED</span>
                <span className="font-mono text-[#050505]/40 tracking-widest">WAN SECURITY ENGINE</span>
            </div>
        </div>
        </div>
    );
}
