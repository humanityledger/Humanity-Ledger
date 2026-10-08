"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Clock, TrendingUp, HardDrive, Shield } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import type { ProcessedTransaction } from '@/lib/network/blockProcessor';

import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';
interface TransactionDetailPanelProps {
    transaction: ProcessedTransaction | null;
    onClose: () => void;
    btcToUsd: number; // BTC to USD exchange rate
}

export function TransactionDetailPanel({ transaction, onClose, btcToUsd }: TransactionDetailPanelProps) {
    if (!transaction) return null;

    const usdAmount = transaction.amount * btcToUsd;
    const usdFeeRate = (transaction.feeRate / 100000000) * btcToUsd; // sats/vB to USD

    return (
        <AnimatePresence>
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 h-full w-full md:w-[500px] bg-[#0D0D12] border-l border-white/10 shadow-2xl z-50 overflow-y-auto"
            >
                {/* Header */}
                <div className="sticky top-0 bg-[#0D0D12]/95 backdrop-blur-xl border-b border-white/10 p-6 flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-white">Transaction</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Transaction Hash */}
                    <div>
                        <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Transaction</p>
                        <Link 
                            href={`/network/transactions/${transaction.hash}`}
                            className="font-mono text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-2 break-all transition-colors"
                        >
                            {transaction.hash}
                            <ExternalLink size={14} className="flex-shrink-0" />
                        </Link>
                    </div>

                    {/* Time */}
                    <div>
                        <p className="text-xs uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1">
                            <Clock size={12} />
                            First Seen
                        </p>
                        <p className="text-white text-lg">
                            {formatDistanceToNow(new Date(transaction.timestamp * 1000), { addSuffix: true })}
                        </p>
                    </div>

                    {/* Amount */}
                    <div>
                        <p className="text-xs uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1">
                            <TrendingUp size={12} />
                            Amount
                        </p>
                        <p className="text-white text-2xl font-bold font-mono">
                            {safeToFixed(transaction.amount, 8)} <span className="text-orange-400">BTC</span>
                        </p>
                        <p className="text-gray-400 text-sm mt-1">
                             ${safeToLocaleString(usdAmount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                        </p>
                    </div>

                    {/* Fee Rate */}
                    <div>
                        <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Fee Rate</p>
                        <p className="text-white text-xl font-mono">
                            {safeToFixed(transaction.feeRate, 3)} <span className="text-gray-400">sats</span>
                        </p>
                        <p className="text-green-400 font-bold text-lg">
                            {safeToFixed(usdFeeRate, 2)} USD
                        </p>
                    </div>

                    {/* Exchange Rate */}
                    <div>
                        <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Exchange Rate</p>
                        <p className="text-white font-mono">
                            {safeToFixed(transaction.feeRate / transaction.virtualSize, 2)} <span className="text-gray-400">sat/vB</span>
                        </p>
                    </div>

                    {/* Virtual Size */}
                    <div>
                        <p className="text-xs uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1">
                            <HardDrive size={12} />
                            Virtual Size
                        </p>
                        <p className="text-white text-xl font-mono">
                            {safeToLocaleString(transaction.virtualSize)} <span className="text-gray-400">kvB</span>
                        </p>
                    </div>

                    {/* Status Badges */}
                    <div className="space-y-3 pt-4 border-t border-white/10">
                        <div className="flex gap-2 flex-wrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                transaction.rbfEnabled 
                                    ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-500/30'
                                    : 'bg-gray-600/20 text-gray-400 border border-gray-500/30'
                            }`}>
                                {transaction.rbfEnabled ? 'RBF enabled' : 'RBF disabled'}
                            </span>

                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-600/20 text-emerald-400 border border-[#25D366]/30">
                                Version {transaction.version}
                            </span>

                            {transaction.type === 'consolidation' && (
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
                                    Consolidation
                                </span>
                            )}

                            {transaction.type === 'coinjoin' && (
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[var(--aave-teal)]/20 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                                    <Shield size={12} />
                                    Coinjoin
                                </span>
                            )}

                            {transaction.type === 'data' && (
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-600/20 text-yellow-400 border border-yellow-500/30">
                                    Data
                                </span>
                            )}
                        </div>

                        {/* Input/Output Info */}
                        <div className="flex gap-4 text-sm">
                            <div className="bg-white/5 px-4 py-2 rounded-lg flex-1">
                                <p className="text-gray-500 text-xs mb-1">Inputs</p>
                                <p className="text-white font-mono font-bold">{transaction.inputs}</p>
                            </div>
                            <div className="bg-white/5 px-4 py-2 rounded-lg flex-1">
                                <p className="text-gray-500 text-xs mb-1">Outputs</p>
                                <p className="text-white font-mono font-bold">{transaction.outputs}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}


