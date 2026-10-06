"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Percent, ArrowUpDown, Eye, Crown } from 'lucide-react';
import type { WatchedWallet } from './LedgerTracker';

import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';
interface WalletComparisonProps {
  wallets: WatchedWallet[];
  isPremium: boolean;
  selectedWallets: string[];
  onToggleWallet: (id: string) => void;
  selectedWalletAddress?: string;
}

export default function WalletComparison({ 
  wallets, 
  isPremium, 
  selectedWallets, 
  onToggleWallet,
  selectedWalletAddress 
}: WalletComparisonProps) {
  const [metric, setMetric] = useState<'value' | 'change' | 'pnl' | 'risk' | 'rank' | 'activity'>('value');

  const toggleWallet = (id: string) => {
    // [TIERED ACCESS] Limit Free users to comparison of 3 wallets
    if (!isPremium && !selectedWallets.includes(id) && selectedWallets.length >= 3) {
        // ideally trigger a modal or upgrade prompt
        // For now, let's keep it simple but maybe log it or impactful UI
        // We will just return to prevent selection.
        return;
    }
    onToggleWallet(id);
  };

  const compareData = selectedWallets.map(id => {
    const wallet = wallets.find(w => w.id === id);
    return wallet;
  }).filter(Boolean) as WatchedWallet[];

  const formatValue = (val: number) => {
    if (val >= 1e9) return `$${safeToFixed(val / 1e9, 2)}B`;
    if (val >= 1e6) return `$${safeToFixed(val / 1e6, 2)}M`;
    if (val >= 1e3) return `$${safeToFixed(val / 1e3, 2)}K`;
    return `$${safeToFixed(val, 2)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-white flex items-center gap-2">
          <BarChart3 className="text-[#25D366]" />
          Wallet Comparison
        </h2>
        {!isPremium && <span className="text-xs font-bold text-blue-400 uppercase border border-[#25D366]/30 px-2 py-1 rounded-full">Limit: 3 Wallets (Free)</span>}
      </div>

      {/* Wallet Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {wallets.map(wallet => {
            const isSelected = selectedWallets.includes(wallet.id);
            const isCurrentlyWatched = selectedWalletAddress?.toLowerCase() === wallet.address.toLowerCase();
            const isDisabled = !isPremium && !isSelected && selectedWallets.length >= 3;
            
            return (
              <button
                key={wallet.id}
                onClick={() => toggleWallet(wallet.id)}
                disabled={isDisabled}
                className={`p-4 rounded-xl border-2 transition-all text-left group relative overflow-hidden ${
                  isSelected
                    ? 'border-[#25D366] bg-[#25D366]/10'
                    : isCurrentlyWatched
                      ? 'border-emerald-500/50 bg-emerald-500/5 hover:border-emerald-500'
                      : isDisabled 
                        ? 'border-white/5 bg-white/5 opacity-50 cursor-not-allowed'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                {isCurrentlyWatched && !isSelected && (
                  <div className="absolute top-0 right-0 px-2 py-0.5 bg-emerald-500 text-[10px] font-black uppercase text-black rounded-bl-lg">
                    Watching
                  </div>
                )}
                {isDisabled && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10 backdrop-blur-[1px]">
                        <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1">
                            <Crown size={12} className="text-yellow-500" /> Upgrade
                        </span>
                    </div>
                )}
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white truncate group-hover:text-blue-200 transition-colors">{wallet.label}</span>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-5 h-5 bg-[#25D366] rounded-full flex items-center justify-center"
                    >
                      <span className="text-white text-xs"></span>
                    </motion.div>
                  )}
                </div>
                <div className="text-sm text-gray-400 font-mono truncate">
                  {wallet.address?.slice(0, 12) ?? '0x...'}...
                </div>
              </button>
            );
        })}
      </div>

      {/* Comparison Results */}
      {compareData.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Metric Selector */}
          <div className="flex flex-wrap gap-2 bg-white/5 p-2 rounded-xl backdrop-blur-sm border border-white/10">
            {[
              { id: 'value', label: 'Value' },
              { id: 'pnl', label: 'P&L' },
              { id: 'change', label: '24h %' },
              { id: 'activity', label: 'TXs' },
              { id: 'risk', label: 'Risk' },
              { id: 'rank', label: 'Rank' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMetric(m.id as any)}
                className={`flex-1 min-w-[80px] py-2 px-3 rounded-lg font-bold text-xs transition-all ${
                  metric === m.id ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Comparison Chart */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <div className="space-y-4">
              {compareData.map((wallet, index) => {
                const maxValue = Math.max(...compareData.map(w => w.totalValue || 0), 0.01);
                const percentage = metric === 'value' 
                  ? ((wallet.totalValue || 0) / maxValue) * 100
                  : metric === 'change'
                  ? Math.min(Math.abs(wallet.change24h || 0) * 10, 100)
                  : ((wallet.totalValue || 0) > 0 ? Math.min(((wallet.totalValue || 0) / 1e6) * 10, 100) : 0); 

                return (
                  <div key={wallet.id}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-white">{wallet.label}</span>
                      <span className="text-sm font-bold text-white">
                        {metric === 'value' && formatValue(wallet.totalValue)}
                        {metric === 'change' && (
                          <span className={wallet.change24h >= 0 ? 'text-green-400' : 'text-red-400'}>
                             {wallet.change24h >= 0 ? '+' : ''}{safeToFixed(wallet.change24h, 2)}%
                          </span>
                        )}
                        {metric === 'pnl' && (
                          <span className={wallet.pnl24h && wallet.pnl24h >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {wallet.pnl24h && wallet.pnl24h >= 0 ? '+' : ''}{formatValue(wallet.pnl24h || 0)}
                          </span>
                        )}
                        {metric === 'risk' && `Score: ${wallet.riskScore || 0}`}
                        {metric === 'rank' && `Rank: #${wallet.rank || '???'}`}
                        {metric === 'activity' && `${wallet.txCount || 0} txs`}
                      </span>
                    </div>
                    <div className="relative h-8 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.8, delay: index * 0.1 }}
                        className={`h-full rounded-full ${
                          index === 0 ? 'bg-gradient-to-r from-purple-500 to-pink-500' :
                          index === 1 ? 'bg-gradient-to-r from-[#25D366] to-cyan-500' :
                          'bg-gradient-to-r from-green-500 to-emerald-500'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Comparison Table */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl overflow-hidden border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Wallet</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase">Value</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase">24h P&L</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase">TXs</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Intell.</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {compareData.map((wallet, index) => (
                    <tr key={wallet.id} className={index % 2 === 0 ? 'bg-white/5' : ''}>
                      <td className="px-4 py-3 font-bold text-white">{wallet.label}</td>
                      <td className="px-4 py-3 text-right font-bold text-white">{formatValue(wallet.totalValue)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold flex items-center gap-1 justify-end ${wallet.pnl24h && wallet.pnl24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {wallet.pnl24h && wallet.pnl24h >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          {formatValue(Math.abs(wallet.pnl24h || 0))}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-white font-mono text-xs">{wallet.txCount || 0}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 bg-[#25D366]/10 text-blue-400 rounded-full text-[10px] font-black uppercase">
                          Rank #{wallet.rank || '???'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-black ${wallet.riskScore && wallet.riskScore > 60 ? 'text-red-400' : 'text-green-400'}`}>
                          {wallet.riskScore || 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {compareData.length < 2 && (
        <div className="text-center py-12 text-gray-500">
          <BarChart3 size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-bold mb-2 text-gray-400">Select at least 2 wallets to compare</p>
          <p className="text-sm">Click on the wallets above to add them to the comparison</p>
        </div>
      )}
    </div>
  );
}


