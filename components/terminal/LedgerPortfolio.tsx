"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, RefreshCw,
    Activity, DollarSign, Zap, Search, Clock, AlertCircle
} from 'lucide-react';
import { useSystemAccount as useAccount } from '@/hooks/useSystemAccount';
import useSWR from 'swr';
import { ScrollFloat } from '@/components/ui/ScrollFloat';
import { useSystemENS } from '@/hooks/useSystemENS';

interface LedgerEntity {
    rank: number;
    label: string;
    address: string;
    category: string;
    netWorthUSD: number;
    change24h: number;
    topHolding: string;
    topHoldingPct: number;
    winRate: number;
    pnl30d: number;
    txCount30d: number;
    chains: string[];
    alphaScore: number;
}

interface PortfolioToken {
    symbol: string;
    name: string;
    balance: number;
    priceUSD: number;
    valueUSD: number;
    change24h: number;
    allocation: number;
    chain: string;
}

const CHAIN_COLORS: Record<string, string> = {
    ethereum: '#627EEA', solana: '#9945FF', bsc: '#F0B90B',
    arbitrum: '#12AAFF', base: '#0052FF', polygon: '#8247E5',
};

const fmt = (n: number) => {
    if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
};
const pctColor = (v: number) => v >= 0 ? 'text-[#00C076]' : 'text-[#FF3B30]';
const pctFmt   = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function LedgerPortfolio() {
    const [view, setView] = React.useState<'leaderboard' | 'portfolio'>('leaderboard');
    const [search, setSearch] = React.useState('');
    const [lastUpdated, setLastUpdated] = React.useState(new Date());
    const [liveLedgerCount, setActiveLedgerCount] = React.useState(0);
    const [mounted, setMounted] = React.useState(false);

    const { address, isConnected } = useAccount();

    useEffect(() => { setMounted(true); }, []);

    const { data: ledgerData, isLoading: ledgerLoading, mutate: mutateLedgers } = useSWR(
        '/api/analytics/ledgers', fetcher,
        { refreshInterval: 12000, suspense: false }
    );

    const { data: portfolioData, isLoading: portfolioLoading, mutate: mutatePortfolio } = useSWR(
        isConnected && address ? `/api/user/portfolio?address=${address}` : null,
        fetcher,
        { refreshInterval: 30000, suspense: false }
    );

    const { data: priceData } = useSWR('/api/market/prices', fetcher, { refreshInterval: 60000 });
    const ep4Prices: Record<string, number> = priceData?.prices || {};
    const ledgers: LedgerEntity[] = ledgerData?.entities || [];

    const PORTFOLIO_TOKENS: PortfolioToken[] = (portfolioData?.tokens || []).map((t: any) => {
        const priceUSD = ep4Prices[t.symbol] || t.usdPrice || 0;
        return {
            symbol: t.symbol || '?',
            name: t.name || t.symbol,
            balance: parseFloat(t.balance || '0'),
            priceUSD,
            valueUSD: parseFloat(t.balance || '0') * priceUSD,
            change24h: t.change24h || 0,
            allocation: t.portfolioPct || 0,
            chain: (t.chain || 'ethereum').toLowerCase(),
        };
    });

    const totalValue = PORTFOLIO_TOKENS.reduce((s, t) => s + t.valueUSD, 0);

    useEffect(() => {
        let isMounted = true;
        const fetchLedgerTx = async () => {
            if (!isMounted) return;
            try {
                const res = await fetch('/api/ledgers/sse');
                if (res.ok) {
                    const parsed = await res.json();
                    if (parsed && parsed.type === 'LEDGER_TX') {
                        setActiveLedgerCount(c => c + 1);
                        setLastUpdated(new Date());
                    }
                }
            } catch {}
            finally { if (isMounted) setTimeout(fetchLedgerTx, 4000); }
        };
        fetchLedgerTx();
        return () => { isMounted = false; };
    }, []);

    const totalAUM    = ledgers.reduce((s, w) => s + (w.netWorthUSD || 0), 0);
    const avgAlpha    = ledgers.length > 0 ? ledgers.reduce((s, w) => s + (w.alphaScore || 0), 0) / ledgers.length : 0;
    const netFlowsUSD = ledgers.reduce((s, w) => s + (w.change24h >= 0 ? w.netWorthUSD * w.change24h / 100 : 0), 0);
    const totalTxns   = ledgers.reduce((s, w) => s + (w.txCount30d || 0), 0);

    const refresh = () => { mutateLedgers(); mutatePortfolio(); setLastUpdated(new Date()); };
    const filteredLedgers = ledgers.filter(w =>
        w.label.toLowerCase().includes(search.toLowerCase()) ||
        w.category.toLowerCase().includes(search.toLowerCase()) ||
        w.address.toLowerCase().includes(search.toLowerCase())
    );

    if (!mounted) return null;

    return (
        <div className="flex flex-col space-y-8">
            {/*  Legendary Title  */}
            <div className="px-2">
                <ScrollFloat 
                    textClassName="text-4xl md:text-6xl font-black tracking-tighter uppercase leading-none text-[#050505] "
                    animationDuration={1}
                    stagger={0.03}
                >
                    Capital Registry
                </ScrollFloat>
                <div className="flex items-center gap-2 mt-2 opacity-40">
                    <div className="w-1.5 h-1.5 rounded-full bg-white " />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] ">Sovereign Depth Tracking Active</span>
                </div>
            </div>

            {/*  Header Stats  */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Ledger AUM',   value: ledgerLoading ? '' : fmt(totalAUM), colorClass: 'text-[#050505] ', icon: <DollarSign size={16}/> },
                    { label: 'Ledger Txns 30d',    value: ledgerLoading ? '' : totalTxns.toLocaleString(), colorClass: 'text-[#050505] ', icon: <Activity size={16}/> },
                    { label: 'Smart Money Inflow', value: ledgerLoading ? '' : fmt(netFlowsUSD), colorClass: 'text-[#00C076]', icon: <TrendingUp size={16}/> },
                    { label: 'Avg Alpha Score',   value: ledgerLoading ? '' : avgAlpha.toFixed(1), colorClass: 'text-[#D4AF37]', icon: <Zap size={16}/> },
                ].map((s, i) => (
                    <div key={i} className="bg-white  border border-[#E5E5E5]  rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-3">
                            <span className={s.colorClass}>{s.icon}</span>
                            <span className="text-[9px] font-black text-[#888888]  uppercase tracking-widest">{s.label}</span>
                        </div>
                        <div className={`text-3xl font-black font-mono tracking-tighter ${s.colorClass}`}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/*  Card  */}
            <div className="bg-white  border border-[#E5E5E5]  rounded-3xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-[#E5E5E5]  bg-[#FFFFFF]  flex items-center gap-4 flex-wrap">
                    <div className="flex bg-[#F0F0F0]  p-1 rounded-2xl border border-[#E5E5E5] ">
                        {(['leaderboard', 'portfolio'] as const).map(v => (
                            <button key={v} onClick={() => setView(v)}
                                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === v ? 'bg-white  text-[#050505]  shadow-sm border border-[#E5E5E5] ' : 'text-[#888888]  hover:text-[#050505] '}`}>
                                {v === 'leaderboard' ? 'Leaderboard' : 'Portfolio'}
                            </button>
                        ))}
                    </div>
                    {liveLedgerCount > 0 && (
                        <span className="flex items-center gap-2 px-3 py-1.5 bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-full text-[9px] font-black text-[#D4AF37] uppercase tracking-widest">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]"/>
                            {liveLedgerCount} active signals
                        </span>
                    )}
                    <div className="relative flex-1 min-w-[200px] max-w-xs">
                        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#888888] "/>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entity grid"
                            className="w-full bg-white  border border-[#E5E5E5]  rounded-full pl-10 pr-4 py-2 text-[11px] font-mono text-[#050505]  outline-none focus:border-[#050505]  transition-all"
                        />
                    </div>
                    <button onClick={refresh} className="ml-auto p-2 bg-white  rounded-full border border-[#E5E5E5]  text-[#888888]  hover:text-[#050505]  transition-all">
                        <RefreshCw size={14} className={ledgerLoading ? 'animate-spin' : ''}/>
                    </button>
                </div>

                {view === 'leaderboard' ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-[9px] font-black text-[#888888]  uppercase tracking-[0.2em] bg-[#FFFFFF]  border-b border-[#E5E5E5] ">
                                    {['#', 'Entity Profile', 'Net Worth', '24h Change', 'Type', 'Top Alpha Holding', 'Win Rate', 'PnL (30d)'].map((h, i) => (
                                        <th key={h} className={`px-6 py-4 font-black ${i >= 2 ? 'text-right' : ''}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F0F0F0] ">
                                {filteredLedgers.map((w) => (
                                    <LedgerRow key={w.rank} w={w} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                         <div className="w-16 h-16 rounded-3xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-6">
                            <Wallet size={28} className="text-teal-500" />
                         </div>
                         <h3 className="text-lg font-black uppercase tracking-tighter mb-2 ">Portfolio Authentication Required</h3>
                         <p className="text-[11px] text-[#888888]  max-w-xs uppercase font-bold tracking-widest leading-loose">Establish a secure session connection to sync your on-chain assets into the terminal.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// -- Subcomponent to resolve ENS independently without breaking hook rules --
function LedgerRow({ w }: { w: LedgerEntity }) {
    const { ensName, ensAvatar } = useSystemENS(w.address as `0x${string}`);

    return (
        <tr className="hover:bg-[#FFFFFF]  transition-colors group">
            <td className="px-6 py-4 text-[10px] font-black text-[#888888] ">{w.rank}</td>
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    {ensAvatar ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={ensAvatar} alt={w.label} className="w-8 h-8 rounded-full border border-[#E5E5E5]  object-cover shadow-sm" />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-white  flex items-center justify-center text-[10px] font-black text-white  shadow-sm">
                            {w.label[0]}
                        </div>
                    )}
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="text-[12px] font-black text-[#050505]  uppercase tracking-tight">{w.label}</div>
                            {ensName && (
                                <span className="px-1.5 py-0.5 bg-[#0052FF]/10 text-[#0052FF] rounded-md text-[8px] font-black font-mono tracking-wider">
                                    {ensName}
                                </span>
                            )}
                        </div>
                        <div className="text-[9px] font-mono text-[#888888] ">{w.address.slice(0, 12)}...{w.address.slice(-6)}</div>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4 text-right text-[11px] font-black font-mono ">{fmt(w.netWorthUSD)}</td>
            <td className={`px-6 py-4 text-right text-[11px] font-black font-mono ${pctColor(w.change24h)}`}>{pctFmt(w.change24h)}</td>
            <td className="px-6 py-4 text-right">
                <span className="text-[8px] px-2 py-1 rounded-full bg-[#F0F0F0]  text-[#888888]  font-black uppercase tracking-wider">{w.category}</span>
            </td>
            <td className="px-6 py-4 text-right">
                <div className="text-[11px] font-black text-[#050505] ">{w.topHolding}</div>
                <div className="text-[8px] text-[#888888]  uppercase tracking-widest">{w.topHoldingPct}% DOMINANCE</div>
            </td>
            <td className="px-6 py-4 text-right text-[11px] font-black font-mono text-[#00C076]">{w.winRate}%</td>
            <td className={`px-6 py-4 text-right text-[11px] font-black font-mono ${pctColor(w.pnl30d)}`}>{fmt(w.pnl30d)}</td>
        </tr>
    );
}
