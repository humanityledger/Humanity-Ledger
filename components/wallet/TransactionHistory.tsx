"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Filter, Download, ExternalLink, CheckCircle2, Clock, XCircle, Globe, Zap } from 'lucide-react';
import { exportTransactionsToCSV, type TransactionType, type TransactionStatus } from '@/lib/wallet/transactions';
import { getChainName, getExplorerTxUrl } from '@/lib/wallet/chains';
import { StealthText } from '@/components/ui/stealth-text';

import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';
interface TransactionHistoryProps {
  authUserId: string;
  transactions?: any[];
  stats?: any;
  isLoading?: boolean;
}

export default function TransactionHistory({ authUserId, transactions: propTransactions, stats: propStats, isLoading: propLoading }: TransactionHistoryProps) {
  const [internalTransactions, setInternalTransactions] = useState<any[]>([]);
  const [internalStats, setInternalStats] = useState<any>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  
  const transactions = propTransactions || internalTransactions;
  const stats = propStats || internalStats;
  const loading = propLoading !== undefined ? propLoading : internalLoading;
  
  const [filterType, setFilterType] = useState<TransactionType | 'ALL'>('ALL');
  const [filterChain, setFilterChain] = useState<number | 'ALL'>('ALL');

  // Logic to filter transactions
  const filteredTransactions = useMemo(() => {
    let list = transactions;
    if (filterType !== 'ALL') {
      list = list.filter((t: any) => t.type === filterType);
    }
    if (filterChain !== 'ALL') {
      list = list.filter((t: any) => t.chainId === filterChain);
    }
    return list;
  }, [transactions, filterType, filterChain]);

  // Custom Virtualization State
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Constants
  const ITEM_HEIGHT = 100;
  const GAP = 12;
  const TOTAL_ITEM_HEIGHT = ITEM_HEIGHT + GAP;

  // Resize Observer for Container
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Initial size
    setContainerHeight(containerRef.current.clientHeight);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
         setContainerHeight(entry.contentRect.height);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [containerRef]);

  // Handle Scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
  };

  useEffect(() => {
    if (authUserId && !propTransactions) {
        loadTransactions();
    }
  }, [authUserId, propTransactions]);

  // Real-time updates every 30 seconds
  useEffect(() => {
    if (authUserId && !propTransactions) {
      const interval = setInterval(() => {
        loadTransactions();
      }, 30000); // 30s poll - Reduced from 5s to prevent 429 errors
      
      return () => clearInterval(interval);
    }
  }, [authUserId, propTransactions]);

  const loadTransactions = async () => {
    setInternalLoading(true);
    try {
        const response = await fetch(`/api/wallet/history/enriched?userAddress=${authUserId}`);
        if (!response.ok) throw new Error('Failed to fetch transactions');
        
        const data = await response.json();
        setInternalTransactions(data.activities || []);
        setInternalStats(data.stats || null);
    } catch (error) {
      console.error('Error loading transactions:', error);
      setInternalTransactions([]);
    } finally {
      setInternalLoading(false);
    }
  };

  const handleExport = () => {
    const csv = exportTransactionsToCSV(filteredTransactions);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Virtualization Math
  const totalContentHeight = filteredTransactions.length * TOTAL_ITEM_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / TOTAL_ITEM_HEIGHT) - 2); // Buffer top
  const endIndex = Math.min(
      filteredTransactions.length - 1,
      Math.floor((scrollTop + containerHeight) / TOTAL_ITEM_HEIGHT) + 2 // Buffer bottom
  );

  const visibleItems = [];
  for (let i = startIndex; i <= endIndex; i++) {
      visibleItems.push({
          index: i,
          item: filteredTransactions[i],
          offsetY: i * TOTAL_ITEM_HEIGHT
      });
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl md:text-2xl font-black text-[#1F1F1F] tracking-tighter">Activity Analytics</h2>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Active</span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={filteredTransactions.length === 0}
            className="px-4 py-2 bg-[#1F1F1F] text-[#EAEADF] rounded-xl font-bold hover:bg-[#1F1F1F]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-xs shadow-lg"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Bar - Senior Level Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
          <StatCard title="Total Swaps" value={stats?.swapCount || 0} icon={<ArrowLeftRight size={16}/>} color="blue" />
          <StatCard title="Sent" value={stats?.sentCount || 0} icon={<ArrowUpRight size={16}/>} color="red" />
          <StatCard title="Received" value={stats?.receivedCount || 0} icon={<ArrowDownLeft size={16}/>} color="green" />
          <StatCard title="Volume (tx)" value={transactions.length} icon={<Zap size={16}/>} color="orange" />
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 shrink-0 scrollbar-hide">
        <TypeFilterButton label="All Time" active={filterType === 'ALL'} onClick={() => setFilterType('ALL')} />
        <TypeFilterButton label="Sending" active={filterType === 'SEND'} onClick={() => setFilterType('SEND' as TransactionType)} />
        <TypeFilterButton label="Receiving" active={filterType === 'RECEIVE'} onClick={() => setFilterType('RECEIVE' as TransactionType)} />
        <TypeFilterButton label="Exchanges" active={filterType === 'SWAP'} onClick={() => setFilterType('SWAP' as TransactionType)} />
      </div>

      {/* Virtualized Transaction List */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-[400px] bg-[#1F1F1F]/5 rounded-[2.5rem] overflow-y-auto border border-[#1F1F1F]/5 relative scrollbar-hide px-2"
      >
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#1F1F1F] border-t-transparent" />
                <span className="text-xs font-bold text-[#1F1F1F]/50">Syncing with Nodes...</span>
             </div>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-[#1F1F1F]/50 font-medium">
            No activity records found
          </div>
        ) : (
            <div style={{ height: totalContentHeight, position: 'relative' }} className="py-4">
                {visibleItems.map(({ index, item, offsetY }) => (
                    <div
                        key={item.id || index}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: '1%',
                            width: '98%',
                            height: ITEM_HEIGHT,
                            transform: `translateY(${offsetY}px)`,
                            willChange: 'transform',
                            contain: 'strict'
                        }}
                    >
                        <MemoizedTransactionCard transaction={item} />
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string | number; icon: React.ReactNode; color: string }) {
    const colors: Record<string, string> = {
        blue: 'bg-[#25D366]/10 text-emerald-600',
        red: 'bg-red-500/10 text-red-600',
        green: 'bg-green-500/10 text-green-600',
        orange: 'bg-orange-500/10 text-orange-600',
    };

    return (
        <div className="p-4 bg-white border border-[#1F1F1F]/5 rounded-3xl shadow-sm group hover:scale-[1.02] transition-transform cursor-default">
            <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${colors[color]}`}>{icon}</div>
                <span className="text-[10px] font-black uppercase text-[#1F1F1F]/40 tracking-wider font-sans">{title}</span>
            </div>
            <div className="text-xl font-black text-[#1F1F1F] font-mono leading-none">
                {typeof value === 'number' ? safeToLocaleString(value) : value}
            </div>
        </div>
    );
}

// [RENDERIZADO INHUMANO 2D] Memorización O(1) de nodo para evitar basura en GC durante el virtual scroll.
const MemoizedTransactionCard = React.memo(
  function TransactionCard({ transaction }: { transaction: any }) {
  const getTypeIcon = () => {
    switch (transaction.type) {
      case 'SEND':
      case 'SELL':
        return <ArrowUpRight size={18} className="text-red-500" />;
      case 'RECEIVE':
      case 'DEPOSIT':
        return <ArrowDownLeft size={18} className="text-green-500" />;
      case 'SWAP':
        return <ArrowLeftRight size={18} className="text-[#25D366]" />;
      case 'BRIDGE':
        return <Globe size={18} className="text-purple-500" />;
      default:
        return <ArrowLeftRight size={18} className="text-[#1F1F1F]" />;
    }
  };

  const getStatusIcon = () => {
    switch (transaction.status) {
      case 'CONFIRMED':
      case 'COMPLETED':
        return <CheckCircle2 size={12} className="text-green-500" />;
      case 'PENDING':
        return <Clock size={12} className="text-yellow-500 animate-pulse" />;
      case 'FAILED':
        return <XCircle size={12} className="text-red-500" />;
    }
  };

  const formatValue = () => {
    const value = parseFloat(transaction.amount || transaction.value);
    const symbol = transaction.asset || 'ETH';
     
    if (isNaN(value)) return `0.00 ${symbol}`;

    const decimals = value < 1 ? 6 : 4;
    const formatted = value.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: decimals 
    });

    if (transaction.type === 'SEND' || transaction.type === 'SELL') {
      return `-${formatted} ${symbol}`;
    } else if (transaction.type === 'RECEIVE' || transaction.type === 'DEPOSIT') {
      return `+${formatted} ${symbol}`;
    }
    return `${formatted} ${symbol}`;
  };

  const formatDate = () => {
    if (!transaction.timestamp && !transaction.date) return 'Recently';
    const date = transaction.timestamp ? new Date(transaction.timestamp) : new Date(transaction.date);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const explorerUrl = getExplorerTxUrl(transaction.chainId, transaction.hash);

  return (
    <div className="h-full p-4 bg-white/60 backdrop-blur-md rounded-3xl border border-white hover:bg-white/90 transition-all shadow-sm flex flex-col justify-between group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-[#1F1F1F]/5 group-hover:bg-[#1F1F1F] group-hover:text-white transition-colors">
            {getTypeIcon()}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-[#1F1F1F] text-sm tracking-tight">{transaction.type}</span>
              <div className="flex items-center gap-1 px-2 py-0.5 bg-[#1F1F1F]/5 rounded-lg border border-[#1F1F1F]/5">
                  <Globe size={10} className="text-[#1F1F1F]/40" />
                  <span className="text-[10px] text-[#1F1F1F]/60 font-black uppercase tracking-widest">{getChainName(transaction.chainId)}</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  <span className="text-[10px] text-green-700 font-black uppercase tracking-widest">ZK PROVEN</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-[#1F1F1F]/40 font-bold font-mono">
                    {transaction.hash?.slice(0, 6)}...{transaction.hash?.slice(-4)}
                </span>
                {getStatusIcon()}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className={`text-lg font-black tracking-tighter ${
            (transaction.type === 'SEND' || transaction.type === 'SELL') ? 'text-red-500' : 
            (transaction.type === 'RECEIVE' || transaction.type === 'DEPOSIT') ? 'text-green-500' : 'text-[#1F1F1F]'
          }`}>
            <StealthText>{formatValue()}</StealthText>
          </div>
          <div className="text-[10px] text-[#1F1F1F]/40 font-black uppercase tracking-widest">{formatDate()}</div>
        </div>
      </div>
    </div>
  );
  },
  (prev, next) => (prev.transaction.id || prev.transaction.hash) === (next.transaction.id || next.transaction.hash)
);

function TypeFilterButton({ 
  label, 
  active, 
  onClick 
}: { 
  label: string; 
  active: boolean; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 rounded-2xl font-black whitespace-nowrap transition-all text-xs uppercase tracking-widest ${
        active
          ? 'bg-[#1F1F1F] text-[#EAEADF] shadow-[0_10px_20px_-5px_rgba(0,0,0,0.3)]'
          : 'bg-white/50 text-[#1F1F1F]/60 hover:bg-white border border-[#1F1F1F]/5'
      }`}
    >
      {label}
    </button>
  );
}


