"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Database, Loader2, AlertTriangle } from 'lucide-react';
import { useSystemIntel } from '@/lib/api-client';
import { useSystemENS } from '@/hooks/useSystemENS';

interface Transaction {
    id: string;
    hash: string;
    from: string;
    to: string;
    value: string;
    asset: string;
    chain: string;
    type: string;
    timestamp: string;
}

export default function ActiveTransactions() {
    // =========================================================================
    // INJECTED DATA HOOK  Zero-Mock Mandate
    // MOCK STREAM ERADICATED: No more Math.random() / setInterval fake data.
    // Mempool endpoint injected via REGISTRY.Private_INTEL.massTransfers
    // =========================================================================
    const { data: rawData, isLoading, error } = useSystemIntel('massTransfers');
    const txs: Transaction[] = (rawData?.transfers || []).slice(0, 20).map((t: any, i: number) => ({
        id:        t.id || String(i),
        hash:      t.hash || t.txHash || '0x',
        from:      t.from || t.sender || '',
        to:        t.to   || t.receiver || '',
        value:     t.value || t.amount || '0',
        asset:     t.asset || t.token || 'ETH',
        chain:     (t.chain || t.network || 'ETHEREUM').toUpperCase(),
        type:      t.type || 'TRANSFER',
        timestamp: t.timestamp
            ? new Date(t.timestamp).toLocaleTimeString()
            : new Date().toLocaleTimeString(),
    }));

    return (
        <div className="p-8 h-full w-full min-h-0 flex flex-col bg-transparent font-sans">
            <header className="mb-10 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-black uppercase tracking-tighter">Mempool Stream</h2>
                    <p className="text-[10px] text-black/30 font-bold uppercase tracking-[0.3em] mt-1">Cross-chain transaction propagation</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="px-4 py-2 bg-black text-white text-[9px] font-black uppercase tracking-widest rounded-xl">
                        {isLoading ? ' Events / Min' : `${txs.length} Events / Minute`}
                    </div>
                </div>
            </header>

            <div className="flex-1 space-y-2 overflow-y-auto pr-4 scrollbar-hide">
                {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 text-black/30">
                        <Loader2 size={36} className="animate-spin" />
                        <p className="text-[10px] font-black uppercase tracking-[0.25em]">Waiting for on-chain mempool endpoint</p>
                        <p className="text-[9px] font-mono opacity-60">Zero-Mock Mandate Active</p>
                    </div>
                ) : error ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 text-black/20">
                        <AlertTriangle size={36} />
                        <p className="text-[10px] font-black uppercase tracking-[0.25em]">Mempool stream unavailable</p>
                    </div>
                ) : txs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 text-black/20">
                        <Database size={36} />
                        <p className="text-[10px] font-black uppercase tracking-[0.25em]">No transactions in stream</p>
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {txs.map((tx) => (
                            <TransactionRow key={tx.id} tx={tx} />
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}

function TransactionRow({ tx }: { tx: Transaction }) {
    const { ensName: fromName, ensAvatar: fromAvatar, displayName: fromDisplay } = useSystemENS(tx.from as `0x${string}`);
    const { ensName: toName, ensAvatar: toAvatar, displayName: toDisplay } = useSystemENS(tx.to as `0x${string}`);

    return (
        <motion.div
            initial={{ opacity: 0, x: -20, height: 0 }}
            animate={{ opacity: 1, x: 0, height: 'auto' }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white border border-black/[0.04] p-4 rounded-2xl flex items-center justify-between group hover:border-black/10 transition-all cursor-crosshair shadow-sm hover:shadow-md"
        >
            <div className="flex items-center gap-6">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    tx.chain === 'ETHEREUM' ? 'bg-blue-50 text-[#25D366]' :
                    tx.chain === 'SOLANA' ? 'bg-purple-50 text-purple-500' :
                    'bg-black/5 text-black/40'
                }`}>
                    <Database size={16} />
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-black uppercase tracking-widest">{tx.chain}</span>
                        <div className="w-1 h-1 rounded-full bg-black/10" />
                        <span className="text-[10px] font-bold text-black/30 uppercase">{tx.type}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 overflow-hidden">
                        {/* FROM */}
                        <div className="flex items-center gap-1.5 min-w-0">
                            {fromAvatar && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={fromAvatar} alt="from" className="w-4 h-4 rounded-full border border-black/5" />
                            )}
                            <span className="text-[11px] font-bold text-black/60 font-mono truncate max-w-[120px]">
                                {fromDisplay}
                            </span>
                        </div>
                        <ArrowRight size={10} className="text-black/20 shrink-0" />
                        {/* TO */}
                        <div className="flex items-center gap-1.5 min-w-0">
                            {toAvatar && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={toAvatar} alt="to" className="w-4 h-4 rounded-full border border-black/5" />
                            )}
                            <span className="text-[11px] font-bold text-black/60 font-mono truncate max-w-[120px]">
                                {toDisplay}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="text-right shrink-0">
                <div className="flex items-center gap-1.5 justify-end">
                    <span className="text-sm font-black text-black font-mono">{tx.value}</span>
                    <span className="text-[9px] font-black text-black/30 uppercase tracking-widest">{tx.asset}</span>
                </div>
                <span className="text-[9px] font-bold text-black/20 uppercase tracking-widest mt-1 block">{tx.timestamp}</span>
            </div>
        </motion.div>
    );
}

