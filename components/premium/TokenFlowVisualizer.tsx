"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { GitBranch, ArrowRight, TrendingUp, Copy, CheckCircle2, Star } from 'lucide-react';
import PremiumLocked from './PremiumLocked';

import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';
interface TokenFlow {
  from: string;
  to: string;
  token: string;
  amount: number;
  usdValue: number;
  timestamp: Date;
  type: 'IN' | 'OUT' | 'SWAP';
}

interface CopyAttestingSignal {
  id: string;
  walletLabel: string;
  walletAddress: string;
  action: 'BUY' | 'SELL';
  token: string;
  amount: number;
  usdValue: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercentage: number;
  winRate: number;
  followersCount: number;
  timestamp: Date;
  confidence: number;
}

export default function TokenFlowVisualizer({ isPremium }: { isPremium: boolean }) {
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('7d');
  const [selectedToken, setSelectedToken] = useState('all');

  const tokenFlows: TokenFlow[] = [
    {
      from: 'Binance',
      to: 'DeFi Wallet #1',
      token: 'ETH',
      amount: 500,
      usdValue: 1250000,
      timestamp: new Date(),
      type: 'OUT',
    },
    {
      from: 'DeFi Wallet #1',
      to: 'Uniswap',
      token: 'ETH',
      amount: 250,
      usdValue: 625000,
      timestamp: new Date(),
      type: 'SWAP',
    },
    {
      from: 'Uniswap',
      to: 'DeFi Wallet #1',
      token: 'AAVE',
      amount: 75000,
      usdValue: 625000,
      timestamp: new Date(),
      type: 'SWAP',
    },
    {
      from: 'DeFi Wallet #1',
      to: 'Aave Protocol',
      token: 'AAVE',
      amount: 75000,
      usdValue: 625000,
      timestamp: new Date(),
      type: 'OUT',
    },
  ];

  const copySignals: CopyAttestingSignal[] = [
    {
      id: '1',
      walletLabel: 'Smart Verifier #1',
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      action: 'BUY',
      token: 'AAVE',
      amount: 5000,
      usdValue: 425000,
      entryPrice: 85,
      currentPrice: 106,
      pnl: 105000,
      pnlPercentage: 24.7,
      winRate: 87,
      followersCount: 1234,
      timestamp: new Date(Date.now() - 3600000),
      confidence: 92,
    },
    {
      id: '2',
      walletLabel: 'Ledger Tracker Pro',
      walletAddress: '0x28C6c06298d514Db089934071355E5743bf21d60',
      action: 'BUY',
      token: 'LDO',
      amount: 10000,
      usdValue: 22500,
      entryPrice: 2.25,
      currentPrice: 2.18,
      pnl: -700,
      pnlPercentage: -3.1,
      winRate: 78,
      followersCount: 892,
      timestamp: new Date(Date.now() - 7200000),
      confidence: 75,
    },
    {
      id: '3',
      walletLabel: 'DeFi Alpha',
      walletAddress: '0xab5801a7d398351b8be11c439e05c5b3259aec9b',
      action: 'BUY',
      token: 'UNI',
      amount: 8000,
      usdValue: 68000,
      entryPrice: 8.5,
      currentPrice: 11.2,
      pnl: 21600,
      pnlPercentage: 31.8,
      winRate: 92,
      followersCount: 2156,
      timestamp: new Date(Date.now() - 10800000),
      confidence: 95,
    },
  ];

  if (!isPremium) {
    return (
      <PremiumLocked
        feature="Token Flow & Copy Attesting"
        description="Visualize money flow between wallets and copy successful verifiers automatically. Track ledger movements in real-time."
        icon="trending"
        onUpgrade={() => {
          const upgradeBtn = document.querySelector('[data-upgrade-trigger="true"]') as HTMLButtonElement;
          upgradeBtn?.click();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Token Flow Diagram */}
      <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 border border-[#1F1F1F]/10">
        <h3 className="text-lg font-black text-[#1F1F1F] mb-4 flex items-center gap-2">
          <GitBranch className="text-emerald-600" />
          Token Flow Analysis
        </h3>

        <div className="space-y-4">
          {tokenFlows.map((flow, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              <div className="flex items-center gap-4">
                {/* From */}
                <div className="flex-1 p-3 bg-gradient-to-r from-purple-100 to-purple-50 rounded-lg">
                  <div className="text-xs text-[#1F1F1F]/60 mb-1">FROM</div>
                  <div className="font-bold text-[#1F1F1F]">{flow.from}</div>
                </div>

                {/* Flow Arrow */}
                <div className="flex flex-col items-center">
                  <ArrowRight className="text-purple-600" size={24} />
                  <div className="mt-1 px-2 py-0.5 bg-purple-600 text-white text-xs font-bold rounded-full">
                    {flow.type}
                  </div>
                </div>

                {/* To */}
                <div className="flex-1 p-3 bg-gradient-to-r from-pink-50 to-pink-100 rounded-lg">
                  <div className="text-xs text-[#1F1F1F]/60 mb-1">TO</div>
                  <div className="font-bold text-[#1F1F1F]">{flow.to}</div>
                </div>

                {/* Amount */}
                <div className="p-3 bg-white/50 rounded-lg min-w-[140px]">
                  <div className="font-black text-[#1F1F1F]">
                    {safeToLocaleString(flow.amount)} {flow.token}
                  </div>
                  <div className="text-sm text-[#1F1F1F]/70">
                    ${safeToLocaleString(flow.usdValue)}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Copy Attesting Signals */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-[#1F1F1F] flex items-center gap-2">
            <Copy className="text-green-600" />
            Copy Attesting Signals
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
              LIVE
            </span>
          </h3>
          <button className="px-4 py-2 bg-[#1F1F1F] text-white rounded-xl text-sm font-bold hover:bg-[#1F1F1F]/90 transition-all">
            Auto-Copy: OFF
          </button>
        </div>

        <div className="grid gap-4">
          {copySignals.map((signal, index) => (
            <CopySignalCard key={signal.id} signal={signal} index={index} />
          ))}
        </div>
      </div>

      {/* Performance Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
          <div className="text-sm text-green-700 font-bold mb-1">Total P&L</div>
          <div className="text-2xl font-black text-green-600">+$125,900</div>
          <div className="text-sm text-green-700 mt-1">From copy attesting</div>
        </div>

        <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200">
          <div className="text-sm text-emerald-700 font-bold mb-1">Win Rate</div>
          <div className="text-2xl font-black text-emerald-600">85.7%</div>
          <div className="text-sm text-emerald-700 mt-1">24 wins / 4 losses</div>
        </div>

        <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
          <div className="text-sm text-purple-700 font-bold mb-1">Following</div>
          <div className="text-2xl font-black text-purple-600">12 Verifiers</div>
          <div className="text-sm text-purple-700 mt-1">Auto-copy enabled</div>
        </div>
      </div>
    </div>
  );
}

function CopySignalCard({ signal, index }: { signal: CopyAttestingSignal; index: number }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    alert(`Copied ${signal.action} ${safeToLocaleString(signal.amount)} ${signal.token}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="p-4 bg-white/50 backdrop-blur-sm rounded-xl border border-[#1F1F1F]/10 hover:shadow-lg transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <Star className="text-yellow-500 fill-current" size={16} />
            <span className="font-black text-[#1F1F1F]">{signal.walletLabel}</span>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
              {signal.winRate}% Win Rate
            </span>
            <span className="text-xs text-[#1F1F1F]/60">
              {safeToLocaleString(signal.followersCount)} followers
            </span>
          </div>

          {/* Attest Details */}
          <div className="flex items-center gap-3 mb-3">
            <div className={`px-3 py-1 rounded-lg font-bold ${
              signal.action === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {signal.action}
            </div>
            <div className="font-bold text-[#1F1F1F]">
              {safeToLocaleString(signal.amount)} {signal.token}
            </div>
            <div className="text-sm text-[#1F1F1F]/70">
              @ ${safeToFixed(signal.entryPrice, 2)}
            </div>
            <div className="text-sm text-[#1F1F1F]/70">
              ${safeToLocaleString(signal.usdValue)}
            </div>
          </div>

          {/* Performance */}
          <div className="flex items-center gap-4">
            <div>
              <div className="text-xs text-[#1F1F1F]/60">Current P&L</div>
              <div className={`font-bold ${signal.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {signal.pnl >= 0 ? '+' : ''}{signal.pnl >= 0 ? '$' : '-$'}{Math.abs(signal.pnl).toLocaleString()}
                <span className="text-sm ml-1">
                  ({signal.pnlPercentage >= 0 ? '+' : ''}{safeToFixed(signal.pnlPercentage, 1)}%)
                </span>
              </div>
            </div>
            
            <div>
              <div className="text-xs text-[#1F1F1F]/60">Confidence</div>
              <div className="flex items-center gap-2">
                <div className="w-20 h-2 bg-[#1F1F1F]/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 to-pink-600"
                    style={{ width: `${signal.confidence}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-[#1F1F1F]">{signal.confidence}%</span>
              </div>
            </div>

            <div className="text-xs text-[#1F1F1F]/60 ml-auto">
              {new Date(signal.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          disabled={copied}
          className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${
            copied
              ? 'bg-green-600 text-white'
              : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg hover:scale-105'
          }`}
        >
          {copied ? (
            <>
              <CheckCircle2 size={20} />
              Copied!
            </>
          ) : (
            <>
              <Copy size={20} />
              Copy Attest
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}


