"use client";
import React, { useMemo } from 'react';
import { LayoutDashboard, TrendingUp, Wallet, Shield, Loader2 } from 'lucide-react';
import { useAppKit } from '@reown/appkit/react';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import useSWR from 'swr';

import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';
const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function SimpleDashboard() {
    const { address, isConnected } = useSystemAccount();

    const { data: stats, error, isLoading } = useSWR(
        isConnected && address ? `/api/ledger/stats?address=${address}` : null,
        fetcher,
        { refreshInterval: 15000 }
    );

    const displayStats = useMemo(() => {
        if (!stats) return [
            { label: 'Total Balance', value: '$0.00', icon: Wallet, color: 'text-emerald-500' },
            { label: 'Today Gain', value: '0.0%', icon: TrendingUp, color: 'text-[#25D366]' },
            { label: 'Active Positions', value: '0', icon: LayoutDashboard, color: 'text-purple-500' },
            { label: 'Security Score', value: '0/100', icon: Shield, color: 'text-amber-500' }
        ];

        return [
            { 
                label: 'Total Balance', 
                value: `$${safeToLocaleString(stats.totalValue || 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
                icon: Wallet, 
                color: 'text-emerald-500' 
            },
            { 
                label: 'Today Gain', 
                value: `${stats.change24h >= 0 ? '+' : ''}${safeToFixed(stats.change24h, 1)}%`, 
                icon: TrendingUp, 
                color: stats.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500' 
            },
            { 
                label: 'Asset Count', 
                value: stats.tokenCount?.toString() || '0', 
                icon: LayoutDashboard, 
                color: 'text-purple-500' 
            },
            { 
                label: 'Security Score', 
                value: `${stats.riskScore || 0}/100`, 
                icon: Shield, 
                color: 'text-amber-500' 
            }
        ];
    }, [stats]);

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center h-[400px]">
                <Loader2 className="animate-spin text-[var(--aztec-ink)]/20" size={48} />
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {displayStats.map((stat, i) => (
                    <div key={i} className="bg-[var(--aztec-parchment)]/20 backdrop-blur-xl p-6 rounded-[2.5rem] border border-[var(--aztec-ink)]/5 shadow-sm group hover:border-[var(--aztec-chartreuse)]/30 transition-all hover:scale-[1.02] glitch-hover">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-2xl bg-[var(--aztec-parchment)]/30 shadow-sm ${stat.color} transition-colors group-hover:bg-[var(--aztec-ink)] group-hover:text-[var(--aztec-chartreuse)]`}>
                                <stat.icon size={20} />
                            </div>
                        </div>
                        <h3 className="text-[var(--aztec-ink)]/50 font-aztec-mono text-[10px] font-black uppercase tracking-widest mb-2">{stat.label}</h3>
                        <p className="text-3xl font-black text-[var(--aztec-ink)] font-aztec-h1 tracking-tighter">{stat.value}</p>
                    </div>
                ))}
            </div>
            
            <div className="bg-[var(--aztec-parchment)]/20 backdrop-blur-xl p-12 rounded-[3.5rem] border border-[var(--aztec-ink)]/5 flex flex-col items-center justify-center text-center glitch-hover">
                <div className="w-20 h-20 bg-[var(--aztec-ink)] text-[var(--aztec-parchment)] rounded-[2rem] flex items-center justify-center mb-8 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)]">
                    <LayoutDashboard size={32} />
                </div>
                <h2 className="font-aztec-h1 text-4xl lg:text-5xl font-black text-[var(--aztec-ink)] mb-4 uppercase tracking-tighter italic">Main Dashboard</h2>
                <p className="font-aztec-body text-[var(--aztec-ink)]/60 font-medium max-w-lg leading-relaxed text-lg">
                    {isConnected 
                        ? `Analyzing wallet ${address?.slice(0, 6)}...${address?.slice(-4)} in real time.`
                        : 'Connect your wallet to see Elite analytics.'}
                </p>
                {stats?.fromCache && (
                    <span className="mt-8 text-[10px] font-aztec-mono text-[var(--aztec-chartreuse)] uppercase tracking-[0.4em] font-black mix-blend-difference">Data Cached // Elite Sentinel Active</span>
                )}
            </div>
        </div>
    );
}


