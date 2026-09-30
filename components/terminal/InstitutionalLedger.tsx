"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePublicClient, useBlockNumber } from 'wagmi';
import { formatEther } from 'viem';

import { AnimatedCounter } from "@/components/ui/animated-counter";


interface RealTransaction {
    id: string;
    hash: string;
    valueEth: number;
    gasPriceGwei: number;
    timestamp: number;
    from: string;
    to: string;
    time: string;
    nonce: number;
    gasLimit: number;
    type: string;
}

interface RealBlock {
    id: number;
    hash: string;
    status: 'MINED' | 'CONFIRMED';
    totalFee: number;
    gasUsedPct: number;
    miner: string;
    sizeKb: string;
    age: string;
    txCount: number;
}

export default function InstitutionalLedger() {
    const wagmiClient = usePublicClient();
    const { data: wagmiBlock } = useBlockNumber({ watch: true });

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

    // Data States
    const [transactions, setTransactions] = useState<RealTransaction[]>([]);
    const [blocks, setBlocks] = useState<RealBlock[]>([]);
    const [globalStats, setGlobalStats] = useState({
        tps: 0,
        avgGasPrice: 0,
        totalEthMoved: 0,
        blocksTracked: 0
    });

    // Search States
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[] | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);

    // Modal States
    const [selectedBlock, setSelectedBlock] = useState<RealBlock | null>(null);
    const [selectedTx, setSelectedTx] = useState<RealTransaction | null>(null);

    const handleSearch = useCallback(async () => {
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
                setSearchError(data.error || 'No results found.');
            }
        } catch {
            setSearchError('Network error — unable to reach the index.');
        } finally {
            setIsSearching(false);
        }
    }, [searchQuery]);

    // Main Polling Effect
    useEffect(() => {
        if (!publicClient || !blockNumber) return;

        const syncState = async () => {
            try {
                const block = await publicClient.getBlock({
                    blockNumber: blockNumber,
                    includeTransactions: true
                });

                const rawTxs = block.transactions as any[];
                
                const totalFeeEther = Number(formatEther(block.baseFeePerGas || 0n)) * rawTxs.length * 21000;
                const fillPercent = block.gasLimit > 0 ? (Number(block.gasUsed) / Number(block.gasLimit)) * 100 : 0;

                const newBlock: RealBlock = {
                    id: Number(block.number),
                    hash: block.hash,
                    status: 'CONFIRMED',
                    totalFee: totalFeeEther > 0 ? totalFeeEther : 0.054,
                    gasUsedPct: fillPercent,
                    miner: block.miner ? (block.miner.substring(0,6) + '...' + block.miner.substring(38)) : '0xUnknown',
                    sizeKb: (Number(block.size) / 1024).toFixed(2) + ' KB',
                    age: new Date(Number(block.timestamp) * 1000).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    txCount: rawTxs.length
                };

                setBlocks(prev => {
                    const exists = prev.find(p => p.id === newBlock.id);
                    if (exists) return prev;
                    return [newBlock, ...prev].slice(0, 10);
                });

                const highValueTxs = rawTxs
                    .filter((t: any) => t.value && t.value > 0n)
                    .sort((a,b) => (a.value < b.value ? 1 : -1))
                    .slice(0, 5); // top 5 transfers per block

                let ethSum = 0;

                if (highValueTxs.length > 0) {
                    const mappedTxs: RealTransaction[] = highValueTxs.map(t => {
                        const val = Number(formatEther(t.value));
                        ethSum += val;
                        return {
                            id: t.hash,
                            hash: t.hash,
                            valueEth: val,
                            gasPriceGwei: Number((t.gasPrice || t.maxFeePerGas || 0n)) / 1e9,
                            timestamp: Date.now(),
                            from: t.from,
                            to: t.to || 'Contract Creation',
                            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                            nonce: Number(t.nonce),
                            gasLimit: Number(t.gas),
                            type: 'TRANSFER'
                        };
                    });
                    
                    setTransactions(prev => {
                        const merged = [...mappedTxs, ...prev];
                        // Deduplicate
                        const unique = Array.from(new Map(merged.map(item => [item.hash, item])).values());
                        return unique.slice(0, 30); // keep last 30 ledger txs
                    });
                }

                setGlobalStats(prev => ({
                    tps: rawTxs.length / 12,
                    avgGasPrice: Number(block.baseFeePerGas || 0n) / 1e9,
                    totalEthMoved: prev.totalEthMoved + ethSum,
                    blocksTracked: prev.blocksTracked + 1
                }));

            } catch (error) {
                console.warn("L1 Sync Warning:", error);
            }
        };

        syncState();
    }, [blockNumber, publicClient]);

    return (
        <div className="w-full h-full min-h-0 flex flex-col p-4 md:p-8 bg-white  text-[#050505]  font-mono overflow-y-auto no-scrollbar transition-colors">
            
            {/* Primary Action Row */}
            <div className="w-full flex justify-end mb-4 flex-shrink-0 max-w-[1400px] mx-auto">
                <button 
                   onClick={() => window.location.reload()}
                   className="px-6 py-3 bg-white border border-slate-200 text-black rounded-xl font-black uppercase tracking-[0.15em] text-[10px] transition-all shadow-sm hover:shadow-md hover:bg-black/5 active:scale-95"
                >
                   REFRESH BLOCK EXPLORER
                </button>
            </div>

            {/* Header section */}
            <div className="max-w-[1400px] mx-auto w-full flex-shrink-0">
                <div className="w-full relative group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none">
                        {isSearching
                            ? <span className="font-mono text-[10px] font-black animate-spin inline-block text-[#050505]">[...]</span>
                            : <span className="font-mono text-[10px] font-black text-[#888888] group-focus-within:text-[#050505] transition-colors">[SCH]</span>}
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="w-full bg-[#F9F9F9]  border border-[#E5E5E5]  focus:border-[#050505]  text-[#050505]  p-5 pl-14 outline-none transition-all text-[11px] font-mono uppercase tracking-[0.1em] placeholder:text-[#A0A0A0]  rounded-xl shadow-sm"
                        placeholder="ADDRESS / TX HASH / ENS"
                    />
                    <button
                        onClick={handleSearch}
                        disabled={isSearching}
                        className="absolute inset-y-2 right-2 bg-white  hover:bg-[#FFFFFF]  text-white  px-8 font-bold text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                    >
                        {isSearching ? 'INDEXING...' : 'INITIATE'}
                    </button>
                </div>

                {/* Search Results / Errors */}
                {searchError && (
                    <div className="w-full mt-4 border border-[#050505]/20  bg-[#F9F9F9]  p-5 rounded-xl flex items-center gap-4 text-[#050505] ">
                        <span className="font-mono text-[10px] font-black shrink-0">[!]</span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em]">{searchError}</span>
                    </div>
                )}

                {searchResults !== null && (
                    <div className="w-full mt-4 border border-[#E5E5E5]  bg-[#F9F9F9]  rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="flex items-center justify-between p-5 bg-[#E5E5E5]/50  border-b border-[#E5E5E5] ">
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-[10px] font-black text-[#050505]">[ZAP]</span>
                                <h2 className="text-[10px] font-bold uppercase tracking-[0.1em]">QUERY RESULTS</h2>
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#A0A0A0]">
                                {searchResults.length} MATCHES
                            </span>
                        </div>
                        {searchResults.length === 0 ? (
                            <div className="p-10 text-center text-[10px] font-mono font-bold text-[#888888]  uppercase tracking-[0.2em]">
                                No results found for "{searchQuery}"
                            </div>
                        ) : (
                            <div className="flex flex-col divide-y divide-[#E5E5E5] ">
                                {searchResults.map((result: any, i: number) => {
                                    const entity = result.node || result.n || result;
                                    const label = result.label || entity._labels?.[0] || 'Entity';
                                    const name = entity.name || entity.address || entity.symbol || entity.id || 'Unknown';
                                    return (
                                        <div key={i} className="flex items-center justify-between p-5 hover:bg-white  transition-colors group cursor-pointer">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[13px] text-[#050505]  font-mono font-bold group-hover:text-[#888888]  transition-colors">{name}</span>
                                                {entity.description && (
                                                    <span className="text-[9px] text-[#888888]  font-bold uppercase tracking-widest">{entity.description}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="px-2.5 py-1 bg-[#E5E5E5]  text-[9px] font-black text-[#050505]  rounded-md uppercase tracking-widest">{label}</span>
                                                <span className="font-mono text-[10px] font-black text-[#888888] group-hover:translate-x-1 transition-all">{'[>]'}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Global Stats */}
            <div className="max-w-[1400px] mx-auto w-full flex items-center justify-between mt-8 border-y border-[#E5E5E5]  py-6 overflow-x-auto no-scrollbar">
                {[
                    { label: 'Network TPS', val: globalStats.tps, unit: 'tx/s', format: (v: number) => v.toFixed(2) },
                    { label: 'Avg Base Fee', val: globalStats.avgGasPrice, unit: 'GWEI', format: (v: number) => v.toFixed(2) },
                    { label: 'Blocks Indexed', val: globalStats.blocksTracked, unit: 'blk', format: (v: number) => Math.floor(v).toString() },
                    { label: 'Session Volume', val: globalStats.totalEthMoved, unit: 'ETH', format: (v: number) => `${v.toFixed(1)} ETH` },
                ].map((stat, i) => (
                    <div key={i} className="flex flex-col min-w-[140px]">
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#888888]  mb-1">{stat.label}</span>
                        <div className="flex items-end gap-1">
                            <AnimatedCounter 
                                value={stat.val}
                                format={stat.format}
                                className="text-xl md:text-2xl font-bold font-mono tracking-tighter text-[#050505]  leading-none"
                            />
                            <span className="text-[9px] text-[#A0A0A0]  font-bold uppercase mb-[2px]">{stat.unit}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Data Grids */}
            <div className="max-w-[1400px] mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8 pb-10">
                {/* BLOCKS PANEL */}
                <div className="border border-[#E5E5E5]  bg-[#F9F9F9]  rounded-2xl overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between p-6 bg-[#E5E5E5]/50  border-b border-[#E5E5E5] ">
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 overflow-hidden flex items-center justify-center "><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" /></div>
                            <h2 className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#050505] ">BLOCK TELEMETRY</h2>
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#A0A0A0]">LIVE STREAMING</span>
                    </div>
                    <div className="flex flex-col">
                        {blocks.length === 0 && (
                            <div className="p-12 text-center text-[10px] font-mono font-bold text-[#888888]  uppercase tracking-[0.2em] animate-pulse">Establishing Peer Link...</div>
                        )}
                        <AnimatePresence>
                            {blocks.map((block) => (
                                <motion.button 
                                    key={block.id} 
                                    layout
                                    initial={{ opacity: 0, y: -20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.8 }}
                                    onClick={() => setSelectedBlock(block)}
                                    className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 border-b border-[#E5E5E5]  hover:bg-white  transition-all gap-4 group"
                                >
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className="w-12 h-12 bg-white  rounded-xl flex items-center justify-center border border-[#E5E5E5]  group-hover:bg-white  group-hover:text-white  transition-all">
                                            <span className="font-mono text-[10px] font-black">[BLK]</span>
                                        </div>
                                        <div className="flex flex-col gap-1 text-left">
                                            <span className="text-lg font-mono font-black text-[#050505]  group-hover:text-[#888888]  transition-colors">{block.id}</span>
                                            <span className="text-[9px] font-mono text-[#888888]  uppercase tracking-widest flex items-center gap-2">
                                                <span className="font-mono text-[9px] font-black">[TIME]</span> {block.age}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5 sm:text-right relative z-10">
                                        <div className="text-[9px] font-mono text-[#888888]  uppercase tracking-widest flex items-center sm:justify-end gap-2">
                                            <span className="font-mono text-[9px] font-black text-[#050505]">[OK]</span> 
                                            VALIDATOR: <span className="text-[#050505]  font-bold">{block.miner}</span>
                                        </div>
                                        <div className="text-[9px] font-mono text-[#888888]  uppercase tracking-widest flex items-center sm:justify-end gap-3">
                                            <span>{block.txCount} TXS</span>
                                            <span className="h-2 w-[1px] bg-[#E5E5E5] " />
                                            <span>{block.sizeKb}</span>
                                        </div>
                                    </div>
                                </motion.button>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>

                {/* TRANSACTIONS PANEL */}
                <div className="border border-[#E5E5E5]  bg-[#F9F9F9]  rounded-2xl overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between p-6 bg-[#E5E5E5]/50  border-b border-[#E5E5E5] ">
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 overflow-hidden flex items-center justify-center "><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" /></div>
                            <h2 className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#050505] ">TRANSACTION FLOWS</h2>
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#A0A0A0]">MEMPOOL MONITOR</span>
                    </div>
                    <div className="flex flex-col">
                        {transactions.length === 0 && (
                            <div className="p-12 text-center text-[10px] font-mono font-bold text-[#888888]  uppercase tracking-[0.2em] animate-pulse">Syncing Mempool Hub...</div>
                        )}
                        {transactions.slice(0, 10).map((tx, i) => (
                            <button 
                                key={tx.id} 
                                onClick={() => setSelectedTx(tx)}
                                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 border-b border-[#E5E5E5]  hover:bg-white  transition-all gap-4 group text-left"
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-12 h-12 bg-white  rounded-xl flex items-center justify-center border border-[#E5E5E5]  group-hover:border-[#050505]  transition-all shrink-0">
                                        <span className="font-mono text-[10px] font-black text-[#888888] group-hover:text-[#050505]">[TX]</span>
                                    </div>
                                    <div className="flex flex-col gap-1 min-w-0">
                                        <span className="text-[11px] font-mono font-bold text-[#050505]  truncate group-hover:text-[#888888]  transition-colors">{tx.hash.substring(0,6) + '...' + tx.hash.substring(60)}</span>
                                        <span className="text-[9px] font-mono text-[#888888]  uppercase tracking-widest flex items-center gap-2">
                                            <span className="font-mono text-[9px] font-black">[TIME]</span> {tx.time}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 sm:text-right mt-2 sm:mt-0">
                                    <div className="flex items-center sm:justify-end gap-2 text-[9px] font-mono font-bold text-[#888888] uppercase tracking-widest">
                                        <span className="text-[#888888] ">{tx.from.substring(0,6) + '...'}</span>
                                        <span className="text-[#E5E5E5] "></span>
                                        <span className="text-[#050505] ">{tx.to.substring(0,6) + '...'}</span>
                                    </div>
                                    <div className="flex items-center sm:justify-end gap-3">
                                        <span className="px-2 py-0.5 bg-white  border border-[#E5E5E5]  text-[8px] font-black text-[#050505]  rounded-md uppercase tracking-widest">{tx.type}</span>
                                        <span className="text-sm font-mono font-black text-[#050505]  tracking-tighter">{tx.valueEth.toFixed(4)} ETH</span>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* INSPECTION MODALS */}
            <AnimatePresence>
                {(selectedBlock || selectedTx) && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-white/90  backdrop-blur-md"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="w-full max-w-2xl bg-[#F9F9F9]  border border-[#E5E5E5]  rounded-2xl shadow-xl overflow-hidden relative"
                        >
                            <button 
                                onClick={() => { setSelectedBlock(null); setSelectedTx(null); }}
                                className="absolute top-6 right-6 w-8 h-8 rounded-lg flex items-center justify-center text-[#888888]  hover:text-[#050505]  hover:bg-white  transition-all"
                            >
                                <span className="font-mono text-[12px] font-black">[X]</span>
                            </button>
                            <div className="p-8 md:p-10">
                                <div className="flex items-center gap-6 mb-10 pb-6 border-b border-[#E5E5E5] ">
                                    <div className="w-12 h-12 bg-white  border border-[#E5E5E5]  rounded-xl flex items-center justify-center shadow-sm">
                                        <div className="w-6 h-6 overflow-hidden flex items-center justify-center "><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" /></div>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <h3 className="text-xl font-bold uppercase tracking-[0.1em] text-[#050505] ">
                                            {selectedBlock ? 'BLOCK DETAILS' : 'TRANSACTION DETAILS'}
                                        </h3>
                                        <p className="text-[9px] text-[#A0A0A0] font-bold tracking-[0.2em] uppercase">Verified Execution Layer Data</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {selectedBlock ? (
                                        <>
                                            <DetailRow label="Block Height" value={selectedBlock.id} />
                                            <DetailRow label="Block Hash" value={selectedBlock.hash} />
                                            <DetailRow label="Miner / Validator" value={selectedBlock.miner} />
                                            <DetailRow label="Timestamp" value={selectedBlock.age} />
                                            <DetailRow label="Payload Size" value={selectedBlock.sizeKb} />
                                            <DetailRow label="Transactions" value={selectedBlock.txCount + ' Txs'} />
                                            <DetailRow label="Gas Used" value={selectedBlock.gasUsedPct.toFixed(2) + '%'} />
                                        </>
                                    ) : (
                                        <>
                                            <DetailRow label="Transaction Hash" value={selectedTx?.hash} />
                                            <DetailRow label="From" value={selectedTx?.from} />
                                            <DetailRow label="To" value={selectedTx?.to} />
                                            <DetailRow label="Value" value={(selectedTx?.valueEth || 0).toFixed(4) + ' ETH'} bold />
                                            <DetailRow label="Gas Limit" value={selectedTx?.gasLimit} />
                                            <DetailRow label="Gas Price" value={(selectedTx?.gasPriceGwei || 0).toFixed(2) + ' GWEI'} />
                                            <DetailRow label="Nonce" value={selectedTx?.nonce} />
                                        </>
                                    )}
                                </div>
                                <div className="mt-10 flex gap-4">
                                    <a
                                        href={selectedBlock ? `https://etherscan.io/block/${selectedBlock.id}` : `https://etherscan.io/tx/${selectedTx?.hash}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex-1 py-3 bg-white  text-white  rounded-lg font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-[#888888]  transition-colors text-center"
                                    >
                                        VERIFY EXTERNALLY
                                    </a>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

interface DetailRowProps {
    label: string;
    value: string | number | undefined | null;
    bold?: boolean;
}

function DetailRow({ label, value, bold }: DetailRowProps) {
    return (
        <div className="flex items-center justify-between py-4 border-b border-[#E5E5E5] ">
            <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#888888] ">{label}</span>
            <div className="flex items-center gap-3">
                <span className={`text-[12px] font-mono text-[#050505]  ${bold ? 'font-bold' : ''}`}>
                    {value ?? '—'}
                </span>
            </div>
        </div>
    );
}
