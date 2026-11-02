"use client";

import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, XCircle, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAztecNative } from '@/context/AztecNativeContext';

export function AztecAirdropCalendar() {
    const { aztecAddress, refresh } = useAztecNative();
    const [claimedMonths, setClaimedMonths] = useState<Set<string>>(new Set<string>());
    const [isLoading, setIsLoading] = useState(false);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getUTCFullYear());

    // Generate years from current up to 2100
    const currentYear = new Date().getUTCFullYear();
    const years = Array.from({ length: 2100 - currentYear + 1 }, (_idx, i) => currentYear + i);

    useEffect(() => {
        if (!aztecAddress) return;
        fetch(`/api/aztec/airdrop/calendar?aztecAddress=${aztecAddress}`)
            .then(res => res.json())
            .then(data => {
                if (data.claims) {
                    const claimed = new Set<string>(data.claims.map((c: any) => `${c.year}-${c.month}`));
                    setClaimedMonths(claimed);
                }
            })
            .catch(console.error);
    }, [aztecAddress]);

    const handleClaim = async () => {
        if (!aztecAddress) return;
        setIsLoading(true);

        try {
            const res = await fetch('/api/aztec/airdrop/calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // debugOverride: true allows claiming on non-1st days for testnet debug purposes
                body: JSON.stringify({ aztecAddress, debugOverride: true }) 
            });
            const data = await res.json();
            
            if (res.ok) {
                toast.success(`1000 QDs Airdrop Claimed! Tx: ${data.txHash || 'Simulated'}`);
                
                const now = new Date();
                const m = now.getUTCMonth() + 1;
                const y = now.getUTCFullYear();
                setClaimedMonths(prev => new Set(prev).add(`${y}-${m}`));
                
                // Refresh balance on the parent components
                if (refresh) {
                    await refresh();
                }
            } else {
                toast.error(data.error || 'Failed to claim Airdrop');
            }
        } catch (e) {
            toast.error("Network error during claim.");
        } finally {
            setIsLoading(false);
        }
    };

    const renderMonth = (monthIndex: number) => {
        const monthNum = monthIndex + 1;
        const monthName = new Date(selectedYear, monthIndex, 1).toLocaleString('default', { month: 'short' }).toUpperCase();
        
        const now = new Date();
        const currentM = now.getUTCMonth() + 1;
        const currentY = now.getUTCFullYear();
        
        const isPast = selectedYear < currentY || (selectedYear === currentY && monthNum < currentM);
        const isCurrent = selectedYear === currentY && monthNum === currentM;
        const isFuture = selectedYear > currentY || (selectedYear === currentY && monthNum > currentM);
        
        const isClaimed = claimedMonths.has(`${selectedYear}-${monthNum}`);
        
        let statusColor = "border-zinc-900/10 bg-zinc-50";
        let statusIcon = null;
        let canClaim = false;

        if (isClaimed) {
            statusColor = "border-emerald-200 bg-emerald-50 text-emerald-700";
            statusIcon = <CheckCircle2 size={16} className="text-emerald-500" />;
        } else if (isPast) {
            statusColor = "border-red-200 bg-red-50 text-red-700 opacity-50";
            statusIcon = <XCircle size={16} className="text-red-500" />;
        } else if (isCurrent) {
            statusColor = "border-amber-400 bg-amber-50 shadow-sm";
            canClaim = true;
        } else {
            statusColor = "border-zinc-900/10 bg-white opacity-40";
        }

        return (
            <div key={monthNum} className={`flex flex-col items-center justify-center p-3 border ${statusColor} transition-all`}>
                <div className="text-[10px] font-black tracking-widest mb-1">{monthName}</div>
                {statusIcon ? (
                    <div className="mt-1">{statusIcon}</div>
                ) : canClaim ? (
                    <button 
                        onClick={handleClaim}
                        disabled={isLoading}
                        className="mt-1 px-3 py-1 bg-black text-white text-[8px] font-black uppercase tracking-widest hover:bg-zinc-800 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 size={10} className="animate-spin" /> : 'CLAIM'}
                    </button>
                ) : (
                    <div className="mt-1 text-[8px] font-mono opacity-50">LOCKED</div>
                )}
            </div>
        );
    };

    return (
        <div className="w-full mt-6 border border-zinc-900/10 bg-white relative overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-zinc-900/10 bg-zinc-900/[0.02]">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[12px] font-black uppercase tracking-[0.2em] text-zinc-900 flex items-center gap-2">
                        <Calendar size={16} /> Global Airdrop Calendar
                    </h3>
                    <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="bg-transparent border border-zinc-900/20 text-[10px] font-black px-2 py-1 uppercase"
                    >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 border border-zinc-900/10 bg-white">
                        <div className="text-[9px] font-black uppercase tracking-widest text-zinc-900/40 mb-1">Airdrop Rule</div>
                        <div className="text-[10px] font-mono text-zinc-800">1000 QDs drop on the 1st of every month. Claim window is strictly 24 hours.</div>
                    </div>
                    
                    {/* Anti-Hoarding Directive */}
                    <div className="p-3 border border-amber-500/30 bg-amber-500/5">
                        <div className="text-[9px] font-black uppercase tracking-widest text-amber-700 flex items-center gap-1 mb-1">
                            <AlertTriangle size={10} /> Ecosystem Directive
                        </div>
                        <div className="text-[9px] font-mono text-amber-900/80">
                            <strong>Spend to Earn:</strong> You must spend QDs from one wallet to access network rewards. Rotate wallets to avoid hoarding and simulate real Aztec Network volume.
                        </div>
                    </div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="p-6">
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {Array.from({ length: 12 }, (_idx, i) => renderMonth(i))}
                </div>
            </div>
            
            {/* Status Footer */}
            <div className="px-6 py-4 border-t border-zinc-900/10 bg-zinc-900 text-[9px] font-mono text-zinc-400 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Airdrop Oracle Live
                </div>
                <div>Year: {selectedYear} / 2100</div>
            </div>
        </div>
    );
}
