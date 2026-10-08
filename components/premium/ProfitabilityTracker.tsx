"use client";

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight, Coins } from 'lucide-react';
import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';

interface PnLData {
  total_realized_profit_usd: string;
  total_unrealized_profit_usd: string;
  total_profit_usd: string;
  total_tokens_sold: number;
  total_tokens_bought: number;
  result?: Array<{
    token_symbol: string;
    realized_profit_usd: string;
    unrealized_profit_usd: string;
    total_profit_usd: string;
    avg_buy_price_usd: string;
    avg_sell_price_usd: string;
  }>;
}

interface ProfitabilityTrackerProps {
  pnlData: PnLData | null;
  isLoading?: boolean;
}

export default function ProfitabilityTracker({ pnlData, isLoading }: ProfitabilityTrackerProps) {
  if (isLoading) {
    return (
      <div className="p-16 text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-[#25D366]/30 border-t-[#25D366] rounded-full mx-auto"
        />
        <p className="text-gray-500 mt-4">Calculating P&L...</p>
      </div>
    );
  }

  if (!pnlData) {
    return (
      <div className="p-16 text-center border border-dashed border-white/10 rounded-3xl bg-white/5">
        <DollarSign size={56} className="mx-auto mb-5 opacity-20 text-green-400" />
        <h3 className="text-2xl font-black text-white mb-2">P&L Data Not Available</h3>
        <p className="text-gray-500 text-sm max-w-md mx-auto">
          Profitability analysis requires complete transaction history.
        </p>
      </div>
    );
  }

  const realizedProfit = parseFloat(pnlData.total_realized_profit_usd || '0');
  const unrealizedProfit = parseFloat(pnlData.total_unrealized_profit_usd || '0');
  const totalProfit = parseFloat(pnlData.total_profit_usd || '0');

  const isPositive = totalProfit >= 0;
  const profitPercentage = ((totalProfit / (realizedProfit + unrealizedProfit || 1)) * 100);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total P&L */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`p-8 rounded-3xl relative overflow-hidden border-2 ${
            isPositive 
              ? 'bg-gradient-to-br from-green-600/20 to-emerald-600/20 border-green-500/40'
              : 'bg-gradient-to-br from-indigo-600/20 to-violet-600/20 border-indigo-500/40'
          }`}
        >
          <div className={`absolute top-0 right-0 w-40 h-40 blur-3xl ${isPositive ? 'bg-green-500/30' : 'bg-indigo-500/30'}`} />
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              {isPositive ? (
                <TrendingUp size={24} className="text-green-400" />
              ) : (
                <TrendingDown size={24} className="text-indigo-400" />
              )}
              <p className="text-xs uppercase tracking-widest font-bold text-gray-400">P&L Total</p>
            </div>
            
            <p className={`text-5xl font-black mb-2 ${isPositive ? 'text-green-400' : 'text-indigo-400'}`}>
              {isPositive ? '+' : '-'}${safeToLocaleString(Math.abs(totalProfit))}
            </p>
            
            <p className="text-sm text-gray-400">
              Profit {isPositive ? 'accumulated' : 'loss accumulated'}
            </p>
          </div>
        </motion.div>

        {/* Realized */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="p-8 bg-white/5 border border-white/10 rounded-3xl"
        >
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpRight size={20} className="text-emerald-400" />
            <p className="text-xs uppercase tracking-widest font-bold text-gray-400">Realizado</p>
          </div>
          <p className={`text-4xl font-black mb-2 ${realizedProfit >= 0 ? 'text-green-400' : 'text-indigo-400'}`}>
            {realizedProfit >= 0 ? '+' : '-'}${safeToLocaleString(Math.abs(realizedProfit))}
          </p>
          <p className="text-sm text-gray-500">{pnlData.total_tokens_sold || 0} tokens sold</p>
        </motion.div>

        {/* Unrealized */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="p-8 bg-white/5 border border-white/10 rounded-3xl"
        >
          <div className="flex items-center gap-2 mb-2">
            <Coins size={20} className="text-purple-400" />
            <p className="text-xs uppercase tracking-widest font-bold text-gray-400">Unrealized</p>
          </div>
          <p className={`text-4xl font-black mb-2 ${unrealizedProfit >= 0 ? 'text-green-400' : 'text-indigo-400'}`}>
            {unrealizedProfit >= 0 ? '+' : '-'}${safeToLocaleString(Math.abs(unrealizedProfit))}
          </p>
          <p className="text-sm text-gray-500">Current holdings</p>
        </motion.div>
      </div>

      {/* Token Breakdown */}
      {pnlData.result && pnlData.result.length > 0 && (
        <div className="bg-black/40 border border-white/10 rounded-3xl p-6">
          <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3">
            <Coins size={24} className="text-emerald-400" />
            P&L by Token
          </h3>

          <div className="space-y-3">
            {pnlData.result
              .sort((a, b) => parseFloat(b.total_profit_usd) - parseFloat(a.total_profit_usd))
              .slice(0, 10)
              .map((token, idx) => {
                const tokenProfit = parseFloat(token.total_profit_usd || '0');
                const tokenRealized = parseFloat(token.realized_profit_usd || '0');
                const tokenUnrealized = parseFloat(token.unrealized_profit_usd || '0');
                const isTokenPositive = tokenProfit >= 0;

                return (
                  <motion.div
                    key={token.token_symbol}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`p-5 rounded-2xl border ${
                      isTokenPositive
                        ? 'bg-green-500/5 border-green-500/20'
                        : 'bg-indigo-500/5 border-indigo-500/20'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          isTokenPositive ? 'bg-green-500/20' : 'bg-indigo-500/20'
                        }`}>
                          {isTokenPositive ? (
                            <TrendingUp size={20} className="text-green-400" />
                          ) : (
                            <TrendingDown size={20} className="text-indigo-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-black text-xl text-white">{token.token_symbol}</p>
                          <p className="text-xs text-gray-500">
                            Buy: ${safeToFixed(parseFloat(token.avg_buy_price_usd || '0'), 4)} · 
                            Sell: ${safeToFixed(parseFloat(token.avg_sell_price_usd || '0'), 4)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className={`text-2xl font-black ${isTokenPositive ? 'text-green-400' : 'text-indigo-400'}`}>
                          {isTokenPositive ? '+' : '-'}${safeToLocaleString(Math.abs(tokenProfit))}
                        </p>
                        <div className="flex gap-3 text-xs mt-1">
                          <span className="text-gray-500">R: ${safeToLocaleString(Math.abs(tokenRealized))}</span>
                          <span className="text-gray-600">|</span>
                          <span className="text-gray-500">U: ${safeToLocaleString(Math.abs(tokenUnrealized))}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}


