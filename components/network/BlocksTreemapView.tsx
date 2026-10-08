"use client";

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader, Zap, Cpu, Boxes, Activity, Hash, Lock, Box, Info } from 'lucide-react';
import { NetworkTabs } from '@/components/network/NetworkTabs';
import { NetworkSearch } from '@/components/network/NetworkSearch';
import { BlockTreemap } from '@/components/network/BlockTreemap';
import { TransactionDetailPanel } from '@/components/network/TransactionDetailPanel';
import { processBlock, filterBlocksByType, getBlockColor, type ProcessedBlock, type ProcessedTransaction, type BlockType } from '@/lib/network/blockProcessor';

import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';
type TabType = 'all' | 'consolidation' | 'coinjoin' | 'data';

export function BlocksTreemapView() {
    const [selectedTab, setSelectedTab] = useState<TabType>('all');
    const [selectedTransaction, setSelectedTransaction] = useState<ProcessedTransaction | null>(null);
    const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

    // Fetch blocks and mempool data
    const { data: rawData, isLoading } = useQuery({
        queryKey: ['network', 'blocks', 'treemap', 'high-density'],
        queryFn: async () => {
            // Fetch multiple data sources for a richer visualization
            const [recentTxsRes, mempoolBlocksRes] = await Promise.all([
                fetch('/api/network/mempool/recent'),
                fetch('/api/network/v1/fees/mempool-blocks')
            ]);
            
            const recentTxs = recentTxsRes.ok ? await recentTxsRes.json() : [];
            const mempoolBlocks = mempoolBlocksRes.ok ? await mempoolBlocksRes.json() : [];
            
            return { recentTxs, mempoolBlocks };
        },
        refetchInterval: 10000, // Refresh every 10 seconds for real-time feel
    });

    // BTC to USD rate - Should ideally come from priceService or context
    const btcToUsd = 97000; 

    // Process and enrich data
    const processedBlocks = useMemo(() => {
        if (!rawData) return [];
        
        // 1. Only use real transactions (Filter out any payloads missing a true on-chain hash)
        const realTxs: ProcessedTransaction[] = (rawData.recentTxs || []).filter((tx: any) => tx.txid || tx.hash).map((tx: any) => ({
            hash: tx.txid || tx.hash,
            type: tx.inputs?.length > 10 ? 'consolidation' as const : (tx.vout?.length > 5 ? 'coinjoin' as const : 'normal' as const),
            amount: (tx.value || 0) / 100000000,
            feeRate: tx.fee / tx.vsize || 0,
            virtualSize: tx.vsize || 100,
            inputs: tx.inputs?.length || 1,
            outputs: tx.vout?.length || 1,
            timestamp: Date.now() / 1000,
            rbfEnabled: true,
            version: 1,
        }));

        // 2. Filter transactions based on selected tab if not 'all'
        const filteredTxs = selectedTab === 'all' 
            ? realTxs 
            : realTxs.filter(tx => tx.type === selectedTab);

        // Combined data wrapped in a mock "Block" structure for the treemap component
        const mainBlock: ProcessedBlock = {
            id: 'mempool',
            height: 0,
            timestamp: Date.now() / 1000,
            size: 1000000,
            txCount: filteredTxs.length,
            transactions: filteredTxs,
            type: selectedTab === 'all' ? 'normal' : selectedTab,
            color: getBlockColor(selectedTab === 'all' ? 'normal' : selectedTab),
        };

        return [mainBlock];
    }, [rawData, selectedTab]);

    // Simple mapping: we only have one main block (the building one)
    const filteredBlocks = processedBlocks;

    // Update dimensions on resize
    useEffect(() => {
        const updateDimensions = () => {
            const container = document.getElementById('treemap-container');
            if (container) {
                const rect = container.getBoundingClientRect();
                setDimensions({
                    width: rect.width,
                    height: Math.max(600, window.innerHeight - 400),
                });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0D0D12] pt-24 pb-12 px-6 flex justify-center items-center">
                <Loader className="animate-spin text-[#25D366]" size={40} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0D0D12] pt-24 pb-12 px-6">
            <div className="max-w-[1800px] mx-auto space-y-6">
                {/* Navigation Tabs */}
                <NetworkTabs />

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2">
                            Visualización de Bloques
                        </h1>
                        <p className="text-gray-400 text-lg">
                            Bloques minados en tiempo real con clasificación inteligente
                        </p>
                    </motion.div>

                    <div className="w-full max-w-md">
                        <NetworkSearch />
                    </div>
                </div>

                {/* Mining Status - Real-Time Feed Placeholder */}
                <div className="bg-[#0B0E11] border border-white/5 rounded-2xl p-8 flex items-center justify-center mb-8">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="w-12 h-12 rounded-full border-2 border-white/5 border-t-[#25D366] animate-spin" />
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-300">Synchronizing Global Mining Feed</p>
                            <p className="text-[8px] font-mono text-white/50 uppercase tracking-[0.2em]">Hashrate Telemetry: AWAITING_HANDSHAKE</p>
                        </div>
                    </div>
                </div>

                {/* Filter Tabs - Mempool style */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-0 overflow-x-auto bg-[#1A1F26] rounded-md p-0.5 w-fit border border-gray-800"
                >
                    {[
                        { id: 'all', label: 'Todos' },
                        { id: 'consolidation', label: 'Consolidación' },
                        { id: 'coinjoin', label: 'Coinjoin' },
                        { id: 'data', label: 'Datos' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setSelectedTab(tab.id as TabType)}
                            className={`px-5 py-2 font-bold text-[10px] uppercase transition-all whitespace-nowrap ${
                                selectedTab === tab.id
                                    ? 'bg-[#1D74F1] text-white shadow-inner'
                                    : 'text-gray-200 hover:text-white'
                            } ${tab.id === 'all' ? 'rounded-l-sm' : ''} ${tab.id === 'data' ? 'rounded-r-sm' : ''}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </motion.div>

                {/* Stats */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4"
                >
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Total Bloques</p>
                        <p className="text-2xl font-bold text-white">{processedBlocks.length}</p>
                    </div>
                    <div className="bg-emerald-600/10 border border-emerald-500/30 rounded-xl p-4">
                        <p className="text-xs uppercase tracking-wider text-emerald-400 mb-1">Consolidación</p>
                        <p className="text-2xl font-bold text-white">
                            {processedBlocks[0]?.transactions.filter((t: any) => t.type === 'consolidation').length || 0}
                        </p>
                    </div>
                    <div className="bg-cyan-600/10 border border-cyan-500/30 rounded-xl p-4">
                        <p className="text-xs uppercase tracking-wider text-cyan-400 mb-1">Coinjoin</p>
                        <p className="text-2xl font-bold text-white">
                            {processedBlocks[0]?.transactions.filter((t: any) => t.type === 'coinjoin').length || 0}
                        </p>
                    </div>
                    <div className="bg-yellow-600/10 border border-yellow-500/30 rounded-xl p-4">
                        <p className="text-xs uppercase tracking-wider text-yellow-400 mb-1">Datos</p>
                        <p className="text-2xl font-bold text-white">
                            {processedBlocks[0]?.transactions.filter((t: any) => t.type === 'data').length || 0}
                        </p>
                    </div>
                </motion.div>

                {/* Treemap with Pending Block Sidebar */}
                <div className="flex flex-col lg:flex-row gap-4 h-full min-h-[500px]">
                    {/*  [LEGENDARY] Pending Block Representation - Mempool.space Style */}
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="w-full lg:w-48 bg-[#0B0E11] border border-white/5 rounded-2xl flex flex-col items-center justify-end p-4 relative overflow-hidden shrink-0 aspect-square lg:aspect-auto"
                    >
                        {/* The Fill Animation */}
                        <motion.div 
                            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-emerald-600 to-emerald-400/50"
                            animate={{ height: ['62%', '65%', '62%'] }}
                            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                        />
                        
                        {/* Transaction "Flow" Particles */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            {[1, 2, 3, 4, 5].map(i => (
                                <motion.div
                                    key={i}
                                    initial={{ y: -20, opacity: 0, x: 40 + ((i * 37) % 100) }}
                                    animate={{ y: 200, opacity: [0, 1, 0] }}
                                    transition={{ repeat: Infinity, duration: 2, delay: i * 0.4 }}
                                    className="absolute w-1 h-1 bg-emerald-400 rounded-full"
                                />
                            ))}
                        </div>

                        <div className="z-10 text-center pb-8">
                            <div className="bg-emerald-600/20 p-3 rounded-xl mb-4 mx-auto w-fit border border-[#25D366]/20">
                                <Box className="text-[#25D366] animate-pulse" size={28} />
                            </div>
                            <p className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.2em] mb-1">Building Block</p>
                            <p className="text-2xl font-black text-white font-mono tracking-tighter">1.82 MB</p>
                            <div className="mt-4 flex items-center justify-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#25D366] animate-ping" />
                                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Active Flow</span>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        id="treemap-container"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="flex-1 bg-[#0B0E11] border border-white/5 rounded-2xl p-4 overflow-hidden relative"
                    >
                        {filteredBlocks.length > 0 ? (
                            <BlockTreemap
                                blocks={filteredBlocks}
                                onBlockClick={setSelectedTransaction}
                                width={dimensions.width - (dimensions.width > 1024 ? 240 : 48)} 
                                height={dimensions.height}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-96 text-gray-500">
                                <Loader className="animate-spin mr-2" />
                                Loading real-time mempool...
                            </div>
                        )}
                    </motion.div>
                </div>

                {/* Legend */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-wrap gap-4 items-center justify-center text-sm"
                >
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gradient-to-br from-green-900 to-green-600 rounded"></div>
                        <span className="text-gray-200">Normal</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gradient-to-br from-emerald-900 to-emerald-600 rounded"></div>
                        <span className="text-gray-200">Consolidación (Inputs {' > '} 5)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gradient-to-br from-cyan-900 to-cyan-500 rounded"></div>
                        <span className="text-gray-200">Coinjoin (Privacidad)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gradient-to-br from-yellow-900 to-yellow-600 rounded"></div>
                        <span className="text-gray-200">Datos (OP_RETURN)</span>
                    </div>
                </motion.div>
            </div>

            {/* Transaction Detail Panel */}
            {selectedTransaction && (
                <TransactionDetailPanel
                    transaction={selectedTransaction}
                    onClose={() => setSelectedTransaction(null)}
                    btcToUsd={btcToUsd}
                />
            )}
        </div>
    );
}




