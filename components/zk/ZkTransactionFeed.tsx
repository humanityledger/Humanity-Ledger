'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpRight, ArrowDownLeft, Lock, ExternalLink, Filter,
  Search, Eye, EyeOff, Download, RefreshCw, CheckCircle, Clock,
  AlertCircle, Lock, Layers, Sparkles
} from 'lucide-react';
import {
  getZkTransactionHistory,
  clearZkTransactionHistory,
  formatZkTag,
  relativeTime,
  ZkTransactionRecord,
  SupportedToken,
  AZTEC_EXPLORER
} from '@/lib/zk/zkMoney';

interface ZkTransactionFeedProps {
  address: string;
  className?: string;
  onSelectTx?: (tx: ZkTransactionRecord) => void;
}

export function ZkTransactionFeed({
  address,
  className = '',
  onSelectTx
}: ZkTransactionFeedProps) {
  const [transactions, setTransactions] = useState<ZkTransactionRecord[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'sent' | 'received' | 'shield'>('all');
  const [filterToken, setFilterToken] = useState<'ALL' | SupportedToken>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [hideAmounts, setHideAmounts] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadTxs = () => {
    if (!address) return;
    const records = getZkTransactionHistory(address);
    setTransactions(records);
  };

  useEffect(() => {
    loadTxs();
    const handler = () => loadTxs();
    window.addEventListener('ledger_zk_payment_sent', handler);
    window.addEventListener('ledger_zk_balance_updated', handler);
    window.addEventListener('ledger_zk_history_cleared', handler);
    return () => {
      window.removeEventListener('ledger_zk_payment_sent', handler);
      window.removeEventListener('ledger_zk_balance_updated', handler);
      window.removeEventListener('ledger_zk_history_cleared', handler);
    };
  }, [address]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/zk/transfer?address=${encodeURIComponent(address)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.transactions && data.transactions.length > 0) {
          // Merge server transactions with local storage
          loadTxs();
        }
      }
    } catch {}
    setTimeout(() => {
      loadTxs();
      setIsRefreshing(false);
    }, 600);
  };

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      // Type filter
      if (filterType === 'sent' && tx.direction !== 'sent') return false;
      if (filterType === 'received' && tx.direction !== 'received') return false;

      // Token filter
      if (filterToken !== 'ALL' && tx.token !== filterToken) return false;

      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchHash = tx.txHash?.toLowerCase().includes(q);
        const matchRecip = tx.recipientTag?.toLowerCase().includes(q);
        const matchSender = tx.senderTag?.toLowerCase().includes(q);
        const matchMemo = tx.memo?.toLowerCase().includes(q);
        return matchHash || matchRecip || matchSender || matchMemo;
      }

      return true;
    });
  }, [transactions, filterType, filterToken, searchQuery]);

  const exportHistory = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(transactions, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `aztec_zk_history_${address.slice(0, 8)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div
      className={`bg-white rounded-3xl border border-black/[0.06] shadow-sm flex flex-col overflow-hidden text-[#111b21] ${className}`}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      {/* Feed Toolbar */}
      <div className="p-4 border-b border-black/[0.04] space-y-3 bg-gradient-to-b from-gray-50/50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#1C1C1E]/15 flex items-center justify-center">
              <Lock size={16} className="text-[#1C1C1E]" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-[15px] font-bold tracking-tight">Aztec Activity Stream</h3>
              <p className="text-[11px] text-gray-400 font-medium">UltraPlonk Sequencer Audit Trail</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setHideAmounts(!hideAmounts)}
              className="p-2 rounded-xl text-gray-500 hover:bg-black/5 hover:text-gray-800 transition-colors"
              title={hideAmounts ? 'Show Amounts' : 'Hide Amounts'}
            >
              {hideAmounts ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-xl text-gray-500 hover:bg-black/5 hover:text-gray-800 transition-colors disabled:opacity-50"
              title="Refresh Transactions"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-[#1C1C1E]' : ''} />
            </button>
            <button
              onClick={exportHistory}
              disabled={transactions.length === 0}
              className="p-2 rounded-xl text-gray-500 hover:bg-black/5 hover:text-gray-800 transition-colors disabled:opacity-30"
              title="Export JSON Audit Log"
            >
              <Download size={16} />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by handle, hash, or memo..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#f0f2f5] rounded-xl text-[12px] font-medium placeholder-gray-400 outline-none border-2 border-transparent focus:border-[#1C1C1E] transition-colors"
            />
          </div>

          <div className="flex bg-[#f0f2f5] p-1 rounded-xl">
            {(['all', 'sent', 'received'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilterType(tab)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg uppercase tracking-wider transition-all ${
                  filterType === tab
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="flex-1 overflow-y-auto divide-y divide-black/[0.04] min-h-[300px] max-h-[500px]">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[#f0f2f5] flex items-center justify-center text-gray-300 mb-3">
              <Shield size={24} />
            </div>
            <p className="text-[14px] font-bold text-gray-700">No shielded transactions detected</p>
            <p className="text-[12px] text-gray-400 max-w-xs mt-1">
              Your Aztec private transactions, notes, and transfers will appear here seamlessly with real-time status.
            </p>
          </div>
        ) : (
          filtered.map((tx, idx) => {
            const isSent = tx.direction === 'sent';
            return (
              <motion.div
                key={tx.txHash || idx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.03 }}
                onClick={() => onSelectTx?.(tx)}
                className="p-3.5 hover:bg-[#f0f2f5]/50 transition-colors cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 ${
                        isSent
                          ? 'bg-rose-50 text-rose-500'
                          : 'bg-[#1C1C1E]/15 text-[#1C1C1E]'
                      }`}
                    >
                      {isSent ? (
                        <ArrowUpRight size={18} strokeWidth={2.2} />
                      ) : (
                        <ArrowDownLeft size={18} strokeWidth={2.2} />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-bold text-gray-900">
                          {isSent ? `Sent to ${tx.recipientTag}` : `Received from ${tx.senderTag}`}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 uppercase">
                          zk{tx.token}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400 font-medium">
                        <span>{relativeTime(tx.timestamp)}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5 text-gray-500">
                          <CheckCircle size={10} className="text-[#1C1C1E]" /> Confirmed (Aztec)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-[14px] font-black ${
                        isSent ? 'text-gray-900' : 'text-[#1C1C1E]'
                      }`}
                    >
                      {hideAmounts ? '••••••' : `${isSent ? '-' : '+'}${tx.amount} ${tx.token}`}
                    </div>

                    <a
                      href={tx.aztecExplorerUrl || `${AZTEC_EXPLORER}/tx-effect/${tx.txHash?.replace('0x', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-[10px] text-gray-400 hover:text-[#1C1C1E] flex items-center justify-end gap-0.5 mt-0.5 font-medium transition-colors"
                    >
                      Explorer <ExternalLink size={9} />
                    </a>
                  </div>
                </div>

                {tx.memo && (
                  <div className="mt-2 ml-12 bg-[#f0f2f5] p-2 rounded-xl text-[11px] text-gray-600 flex items-center gap-1.5 border border-black/[0.02]">
                    <Lock size={10} className="text-gray-400 flex-shrink-0" />
                    <span className="truncate italic">"{tx.memo}"</span>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Footer Info Bar */}
      <div className="p-3 bg-gray-50 border-t border-black/[0.04] flex items-center justify-between text-[11px] text-gray-500 font-medium">
        <span className="flex items-center gap-1">
          <Layers size={12} className="text-[#1C1C1E]" />
          Sequencer Synced
        </span>
        <span className="font-mono text-[10px] text-gray-400">
          Showing {filtered.length} of {transactions.length} records
        </span>
      </div>
    </div>
  );
}
