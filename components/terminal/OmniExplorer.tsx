"use client";

import React, { useState, useEffect } from "react";
import { 
    Search, Activity, Box, ArrowRight, Clock, ShieldCheck, 
    AlignLeft, Loader2, AlertCircle, X, ChevronRight, Zap
} from "lucide-react";
import { usePublicClient, useBlockNumber } from 'wagmi';
import { useSystemAccount as useAccount } from '@/hooks/useSystemAccount';
import { formatEther } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';

export function OmniExplorer() {
    const { address } = useAccount();
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[] | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [selectedBlock, setSelectedBlock] = useState<any | null>(null);
    const [selectedTx, setSelectedTx] = useState<any | null>(null);

    const wagmiClient = usePublicClient();
    const { data: wagmiBlock } = useBlockNumber({ watch: true });
    
    // [SOVEREIGN FALLBACK] Maintain data stream even if Wagmi is disconnected
    const [fallbackClient, setFallbackClient] = useState<any>(null);
    const [fallbackBlock, setFallbackBlock] = useState<bigint | null>(null);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (!wagmiClient) {
            import('viem').then(({ createPublicClient, http }) => {
                const client = createPublicClient({
                    chain: { id: 1, name: 'Ethereum', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://eth.llamarpc.com'] }, public: { http: ['https://eth.llamarpc.com'] } } } as any,
                    transport: http()
                });
                setFallbackClient(client);
                client.getBlockNumber().then(setFallbackBlock);
                interval = setInterval(() => {
                    client.getBlockNumber().then(setFallbackBlock).catch(() => {});
                }, 12000);
            });
        }
        return () => clearInterval(interval);
    }, [wagmiClient]);

    const publicClient = wagmiClient || fallbackClient;
    const blockNumber = wagmiBlock || fallbackBlock;
    
    const [blocks, setBlocks] = useState<any[]>([]);
    const [massiveTxs, setMassiveTxs] = useState<any[]>([]);

    //  On-chain block feed 
    useEffect(() => {
        // [MOLECULAR PRECISION] Early exit if RPC bridge is not yet established.
        // This prevents the 'Critical Node Failure' crash during early mobile hydration.
        if (!publicClient || !blockNumber) return;

        const fetchBlock = async () => {
            if (!publicClient) return;
            try {
                const block = await publicClient.getBlock({
                    blockNumber: blockNumber,
                    includeTransactions: true
                });

                const targetBlock = {
                    height: Number(block.number),
                    age: '0 secs ago',
                    txs: block.transactions.length,
                    size: (Number(block.size) / 1000000).toFixed(2) + ' MB',
                    validator: block.miner ? (block.miner.substring(0,6) + '...' + block.miner.substring(38)) : '0xSync...'
                };

                setBlocks(prev => {
                    const exists = prev.find(p => p.height === targetBlock.height);
                    if (exists) return prev;
                    return [targetBlock, ...prev].slice(0, 5);
                });

                const txs = block.transactions as any[];
                const valTxs = txs
                    .filter((t: any) => t.value && t.value > 0n)
                    .sort((a,b) => (a.value < b.value ? 1 : -1))
                    .slice(0, 5);
                
                if (valTxs.length > 0) {
                    const newMassive = valTxs.map(t => ({
                        hash: t.hash.substring(0,6) + '...' + t.hash.substring(60),
                        age: 'New Block',
                        from: t.from.substring(0,6) + '...' + t.from.substring(38),
                        to: t.to ? (t.to.substring(0,6) + '...' + t.to.substring(38)) : 'Contract',
                        value: Number(formatEther(t.value)).toFixed(4) + ' ETH',
                        type: 'TRANSFER'
                    }));
                    setMassiveTxs(prev => [...newMassive, ...prev].slice(0, 5));
                }
            } catch (e) {
                // [SILENT RECOVERY] Log failure but do not bubble up to the ErrorBoundary.
                // Mobile network conditions can cause intermittent RPC timeouts.
                console.warn('[OmniExplorer] RPC Synchronization Lag:', e);
            }
        };

        fetchBlock();
    }, [blockNumber, publicClient]);

    //  Search handler 
    const handleSearch = async () => {
        const q = searchQuery.trim();
        if (!q || q.length < 2) return;
        setIsSearching(true);
        setSearchResults(null);
        setSearchError(null);
        try {
            const res = await fetch(`/api/graph?q=${encodeURIComponent(q)}`);
            const data = await res.json();
            if (data.ok) {
                setSearchResults(data.data ?? []);
            } else {
                setSearchError(data.error || 'No results found');
            }
        } catch {
            setSearchError('Network error  could not reach the graph index.');
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="relative h-full w-full min-h-0 font-sans p-0 flex flex-col selection:bg-white/20  selection:text-[#050505]  overflow-hidden bg-[#FFFFFF] ">
            
            <div className="relative z-10 w-full h-full overflow-y-auto msv-hide-scrollbar flex flex-col gap-12">
                {/* Header / Search Area */}
                <div className="flex flex-col items-start w-full max-w-[2560px] mx-auto pt-16 pb-12 gap-8 text-left">
                    <div className="text-center space-y-4 border-b border-[#E5E5E5]  pb-8 w-full">
                        <div className="flex items-center justify-center gap-3 mb-2">
                             <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#888888] ">TRANSACTION & ADDRESS SEARCH</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-[0.05em] text-[#050505]  leading-none">
                            GLOBAL SEARCH
                        </h1>
                    </div>

                    <div className="w-full relative group mt-4">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none">
                            {isSearching
                                ? <Loader2 size={18} className="text-[#050505]  animate-spin" />
                                : <Search size={18} className="text-[#888888]  group-focus-within:text-[#050505]  transition-colors" />}
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="w-full bg-white  border border-[#E5E5E5]  focus:border-[#050505]  text-[#050505]  p-5 pl-14 outline-none transition-all text-[11px] font-mono uppercase tracking-[0.1em] placeholder:text-[#A0A0A0]  rounded shadow-sm"
                            placeholder="INPUT ADDRESS / TX HASH / ENS"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={isSearching}
                            className="absolute inset-y-2 right-2 bg-white  hover:bg-[#FFFFFF]  hover:text-[#050505]  hover:border-[#050505]  border border-transparent text-white  px-8 font-semibold text-[13px] transition-all disabled:opacity-50 disabled:cursor-not-allowed rounded"
                        >
                            {isSearching ? 'Searching...' : 'Search'}
                        </button>
                    </div>

                    {/* Search Results / Errors */}
                    {searchError && (
                        <div className="w-full border border-[#FF3B30]/30 bg-white  p-5 rounded flex items-center gap-4 text-[#FF3B30]">
                            <AlertCircle size={16} className="shrink-0" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.1em]">{searchError}</span>
                        </div>
                    )}

                    {searchResults !== null && (
                        <div className="w-full border border-[#E5E5E5]  bg-white  rounded overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center justify-between p-5 bg-[#FFFFFF]  border-b border-[#E5E5E5] ">
                                <div className="flex items-center gap-3">
                                    <Zap size={14} className="text-[#050505] " />
                                    <h2 className="text-[13px] font-semibold">Search Results</h2>
                                </div>
                                <span className="text-[12px] text-[#A0A0A0]">
                                    {searchResults.length} results found
                                </span>
                            </div>
                            {searchResults.length === 0 ? (
                                <div className="p-10 text-center text-[10px] font-mono font-bold text-[#888888]  uppercase tracking-[0.2em]">
                                    Graph index return null for &quot;{searchQuery}&quot;
                                </div>
                            ) : (
                                <div className="flex flex-col divide-y divide-[#E5E5E5] ">
                                    {searchResults.map((result: any, i: number) => {
                                        const entity = result.node || result.n || result;
                                        const label = result.label || entity._labels?.[0] || 'Entity';
                                        const name = entity.name || entity.address || entity.symbol || entity.id || 'Unknown';
                                        return (
                                            <div key={i} className="flex items-center justify-between p-5 hover:bg-[#FFFFFF]  transition-colors group cursor-pointer">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[13px] text-[#050505]  font-mono font-bold group-hover:text-[#888888]  transition-colors">{name}</span>
                                                    {entity.description && (
                                                        <span className="text-[9px] text-[#888888]  font-bold uppercase tracking-widest">{entity.description}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="px-2.5 py-1 bg-[#FFFFFF]  border border-[#E5E5E5]  text-[9px] font-black text-[#888888]  rounded-md uppercase tracking-widest">{label}</span>
                                                    <ChevronRight size={14} className="text-[#888888] group-hover:translate-x-1 transition-all" />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Data Grids */}
                <div className="w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 pb-20">
                    
                    {/* BLOCKS PANEL */}
                    <div className="border border-[#E5E5E5]  bg-white  rounded overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between p-6 bg-[#FFFFFF]  border-b border-[#E5E5E5] ">
                            <div className="flex items-center gap-3">
                                <Box size={14} className="text-[#050505] " />
                                <h2 className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#050505] ">BLOCK TELEMETRY</h2>
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#A0A0A0]">LIVE STREAMING</span>
                        </div>

                        <div className="flex flex-col">
                            {blocks.length === 0 && (
                                <div className="p-12 text-center text-[13px] text-[#888888]  animate-pulse">Loading blocks</div>
                            )}
                            <AnimatePresence>
                                {blocks.map((block, i) => (
                                    <motion.button 
                                        key={block.height} 
                                        layout
                                        initial={{ opacity: 0, y: -20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.8 }}
                                        onClick={() => setSelectedBlock(block)}
                                        className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 border-b border-[#E5E5E5]  hover:bg-[#FFFFFF]  transition-all gap-4 group relative overflow-hidden"
                                    >
                                        {/* Animation: Mined pulse effect on mount */}
                                        <motion.div
                                            initial={{ opacity: 0.8, scale: 0.9 }}
                                            animate={{ opacity: [0.8, 0, 0], scale: [0.9, 1.05, 1] }}
                                            transition={{ duration: 1.5, ease: "easeOut" }}
                                            className="absolute inset-0 bg-[#E8F5E9]  z-0 pointer-events-none"
                                        />

                                        <div className="flex items-center gap-4 relative z-10">
                                            <div className="w-12 h-12 bg-[#FFFFFF]  rounded-xl flex items-center justify-center border border-[#E5E5E5]  group-hover:bg-white  group-hover:text-white  transition-all">
                                                <Box size={16} />
                                            </div>
                                            <div className="flex flex-col gap-1 text-left">
                                                <span className="text-lg font-mono font-black text-[#050505]  group-hover:text-[#888888]  transition-colors">{block.height}</span>
                                                <span className="text-[9px] font-mono text-[#888888]  uppercase tracking-widest flex items-center gap-2">
                                                    <Clock size={10} /> {block.age}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1.5 sm:text-right relative z-10">
                                            <div className="text-[11px] font-mono text-[#888888]  uppercase tracking-widest flex items-center sm:justify-end gap-2">
                                                <ShieldCheck size={10} className="text-[#050505] " /> 
                                                Validator: <span className="text-[#050505]  font-bold">{block.validator}</span>
                                            </div>
                                            <div className="text-[9px] font-mono text-[#888888]  uppercase tracking-widest flex items-center sm:justify-end gap-3">
                                                <span>{block.txs} TXS</span>
                                                <span className="h-2 w-[1px] bg-[#E5E5E5] " />
                                                <span>{block.size}</span>
                                            </div>
                                        </div>
                                    </motion.button>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* TRANSACTIONS PANEL */}
                    <div className="border border-[#E5E5E5]  bg-white  rounded overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between p-6 bg-[#FFFFFF]  border-b border-[#E5E5E5] ">
                            <div className="flex items-center gap-3">
                                <Activity size={14} className="text-[#050505] " />
                                <h2 className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#050505] ">TRANSACTION FLOWS</h2>
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#A0A0A0]">MEMPOOL MONITOR</span>
                        </div>

                        <div className="flex flex-col">
                            {massiveTxs.length === 0 && (
                                <div className="p-12 text-center text-[13px] text-[#888888]  animate-pulse">Loading transactions</div>
                            )}
                            {massiveTxs.map((tx, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => setSelectedTx(tx)}
                                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 border-b border-[#E5E5E5]  hover:bg-[#FFFFFF]  transition-all gap-4 group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-[#FFFFFF]  rounded-xl flex items-center justify-center border border-[#E5E5E5]  group-hover:border-[#050505]  transition-all">
                                            <AlignLeft size={16} className="text-[#888888]  group-hover:text-[#050505] " />
                                        </div>
                                        <div className="flex flex-col gap-1 text-left min-w-0">
                                            <span className="text-[11px] font-mono font-bold text-[#050505]  truncate group-hover:text-[#888888]  transition-colors">{tx.hash}</span>
                                            <span className="text-[9px] font-mono text-[#888888]  uppercase tracking-widest flex items-center gap-2">
                                                <Clock size={10} /> {tx.age}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 sm:text-right mt-2 sm:mt-0">
                                        <div className="flex items-center sm:justify-end gap-2 text-[9px] font-mono font-bold text-[#888888] uppercase tracking-widest">
                                            <span className="text-[#888888] ">{tx.from}</span>
                                            <ArrowRight size={10} className="text-[#E5E5E5] " />
                                            <span className="text-[#050505] ">{tx.to}</span>
                                        </div>
                                        <div className="flex items-center sm:justify-end gap-3">
                                            <span className="px-2 py-0.5 bg-[#FFFFFF]  border border-[#E5E5E5]  text-[8px] font-black text-[#888888]  rounded-md uppercase tracking-widest">{tx.type}</span>
                                            <span className="text-sm font-mono font-black text-[#050505]  tracking-tighter">{tx.value}</span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                 {/* INSPECTION MODALS */}
                 {(selectedBlock || selectedTx) && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-white/90  backdrop-blur-md">
                        <div className="w-full max-w-2xl bg-white  border border-[#E5E5E5]  rounded shadow-xl overflow-hidden relative">
                            <button 
                                onClick={() => { setSelectedBlock(null); setSelectedTx(null); }}
                                className="absolute top-6 right-6 w-8 h-8 rounded flex items-center justify-center text-[#888888]  hover:text-[#050505]  hover:bg-[#FFFFFF]  transition-all"
                            >
                                <X size={18} />
                            </button>

                            <div className="p-8 md:p-10">
                                <div className="flex items-center gap-6 mb-10 pb-6 border-b border-[#E5E5E5] ">
                                    <div className="w-12 h-12 bg-[#FFFFFF]  border border-[#E5E5E5]  rounded flex items-center justify-center">
                                        {selectedBlock ? <Box size={20} className="text-[#050505] " /> : <Activity size={20} className="text-[#050505] " />}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <h3 className="text-[18px] font-bold uppercase tracking-[0.05em] text-[#050505] ">
                                            {selectedBlock ? 'Block Details' : 'Transaction Details'}
                                        </h3>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {selectedBlock ? (
                                        <>
                                            <DetailRow label="Block Number" value={selectedBlock.height} />
                                            <DetailRow label="Validator" value={selectedBlock.validator} copy />
                                            <DetailRow label="Timestamp" value={selectedBlock.age} />
                                            <DetailRow label="Block Size" value={selectedBlock.size} />
                                            <DetailRow label="Transactions" value={selectedBlock.txs + ' Transactions'} />
                                        </>
                                    ) : (
                                        <>
                                            <DetailRow label="Transaction Hash" value={selectedTx.hash} copy />
                                            <DetailRow label="From" value={selectedTx.from} copy />
                                            <DetailRow label="To" value={selectedTx.to} copy />
                                            <DetailRow label="Amount" value={selectedTx.value} highlight />
                                            <DetailRow label="Type" value={selectedTx.type} />
                                        </>
                                    )}
                                </div>

                                <button
                                    onClick={() => { setSelectedBlock(null); setSelectedTx(null); }}
                                    className="w-full mt-10 py-3 bg-white  text-white  rounded font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-[#A0A0A0]  transition-colors"
                                >
                                    CLOSE
                                </button>
                            </div>
                        </div>
                    </div>
                 )}

                 {/* Sovereign Footer */}
                 <div className="text-center pt-8 pb-4">
                     <span className="text-[11px] text-[#A0A0A0]">Real-time on-chain data</span>
                 </div>
            </div>
        </div>
    );
}

function DetailRow({ label, value, copy, highlight, green }: any) {
    return (
        <div className="flex items-center justify-between py-4 border-b border-[#E5E5E5] ">
            <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#888888] ">{label}</span>
            <div className="flex items-center gap-3">
                <span className={`text-[12px] font-mono ${highlight ? 'text-[#050505]  font-bold' : green ? 'text-[#00C076]' : 'text-[#050505] '}`}>
                    {value}
                </span>
                {copy && (
                    <button className="p-2 hover:bg-black/5  rounded-xl transition-all text-black/10  hover:text-black ">
                        <ShieldCheck size={14} />
                    </button>
                )}
            </div>
        </div>
    );
}
