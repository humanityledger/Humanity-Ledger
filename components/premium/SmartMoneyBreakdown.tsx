"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, TrendingUp, Activity, DollarSign, Clock, Award, Sparkles, RefreshCw } from 'lucide-react';

interface SmartMoneyMetrics {
  score: number;
  breakdown: {
    transactionFrequency: number;
    portfolioDiversification: number;
    averageAttestationsize: number;
    estimatedWinRate: number;
    walletAge: number;
  };
  insights: string[];
  confidence: 'high' | 'medium' | 'low';
  category: string;
  metadata: {
    totalTransactions: number;
    uniqueTokens: number;
    avgAttestUSD: number;
    walletAgeInDays: number;
    profitableAttestationsPercent: number;
  };
}

interface SmartMoneyBreakdownProps {
  address: string;
}

export default function SmartMoneyBreakdown({ address }: SmartMoneyBreakdownProps) {
  const [metrics, setMetrics] = useState<SmartMoneyMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalysis();
  }, [address]);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/ledger/smart-analysis?address=${address}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch analysis');
      }

      const data = await response.json();
      setMetrics(data);
    } catch (err: any) {
      console.error('Smart Money Analysis Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 bg-white/50 backdrop-blur-sm rounded-2xl border border-[#1F1F1F]/10">
        <div className="flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-600 border-t-transparent" />
          <span className="text-[#1F1F1F]/70 font-bold">Analyzing wallet behavior...</span>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-8 bg-red-50 rounded-2xl border border-red-200">
        <p className="text-red-600 font-bold"> Analysis Error: {error || 'Unknown error'}</p>
        <button
          onClick={fetchAnalysis}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700"
        >
          Retry Analysis
        </button>
      </div>
    );
  }

  const { score, breakdown, insights, confidence, category, metadata } = metrics;

  // Color based on score
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-600';
    if (s >= 60) return 'text-blue-600';
    if (s >= 40) return 'text-yellow-600';
    if (s >= 20) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreGradient = (s: number) => {
    if (s >= 80) return 'from-green-500 to-emerald-500';
    if (s >= 60) return 'from-[#25D366] to-cyan-500';
    if (s >= 40) return 'from-yellow-500 to-amber-500';
    if (s >= 20) return 'from-orange-500 to-indigo-500';
    return 'from-indigo-500 to-pink-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="text-purple-600" size={32} />
          <div>
            <h3 className="text-2xl font-black text-[#1F1F1F]">Smart Money Score</h3>
            <p className="text-sm text-[#1F1F1F]/70">Real on-chain behavior analysis</p>
          </div>
        </div>

        <button
          onClick={fetchAnalysis}
          className="p-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {/* Main Score Display */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative p-8 bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl border-2 border-purple-200"
      >
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Radial Score */}
          <div className="relative">
            <svg className="w-40 h-40 transform -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="#E5E7EB"
                strokeWidth="12"
                fill="none"
              />
              <motion.circle
                cx="80"
                cy="80"
                r="70"
                stroke="url(#scoreGradient)"
                strokeWidth="12"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 70}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 70 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 70 * (1 - score / 100) }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
              />
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" className={`${getScoreGradient(score).split(' ')[0].replace('from-', 'text-')}`} />
                  <stop offset="100%" className={`${getScoreGradient(score).split(' ')[1].replace('to-', 'text-')}`} />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-5xl font-black ${getScoreColor(score)}`}>{score}</span>
              <span className="text-sm font-bold text-[#1F1F1F]/70">/ 100</span>
            </div>
          </div>

          {/* Category & Confidence */}
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Award className="text-yellow-600" size={24} />
                <span className="text-sm font-bold text-[#1F1F1F]/70 uppercase">Category</span>
              </div>
              <div className={`text-3xl font-black bg-gradient-to-r ${getScoreGradient(score)} bg-clip-text text-transparent`}>
                {category}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Sparkles className="text-purple-600" size={20} />
              <span className="text-sm font-bold text-[#1F1F1F]/70">
                Confidence: <span className={`uppercase ${
                  confidence === 'high' ? 'text-green-600' :
                  confidence === 'medium' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>{confidence}</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4">
              <StatPill icon={<Activity size={16} />} label="Total TXs" value={metadata.totalTransactions.toString()} />
              <StatPill icon={<TrendingUp size={16} />} label="Tokens" value={metadata.uniqueTokens.toString()} />
              <StatPill icon={<DollarSign size={16} />} label="Avg Attest" value={`$${Math.round(metadata.avgAttestUSD / 1000)}K`} />
              <StatPill icon={<Clock size={16} />} label="Age" value={`${metadata.walletAgeInDays}d`} />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Score Breakdown */}
      <div className="p-6 bg-white/50 backdrop-blur-sm rounded-2xl border border-[#1F1F1F]/10 space-y-4">
        <h4 className="text-lg font-black text-[#1F1F1F]">Score Breakdown</h4>
        
        <MetricBar
          label="Transaction Frequency"
          value={breakdown.transactionFrequency}
          max={25}
          color="blue"
        />
        <MetricBar
          label="Portfolio Diversification"
          value={breakdown.portfolioDiversification}
          max={20}
          color="purple"
        />
        <MetricBar
          label="Average Attest Size"
          value={breakdown.averageAttestationsize}
          max={20}
          color="green"
        />
        <MetricBar
          label="Estimated Win Rate"
          value={breakdown.estimatedWinRate}
          max={20}
          color="yellow"
        />
        <MetricBar
          label="Wallet Age"
          value={breakdown.walletAge}
          max={15}
          color="pink"
        />
      </div>

      {/* Insights */}
      <div className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border border-blue-200 space-y-3">
        <h4 className="text-lg font-black text-[#1F1F1F] flex items-center gap-2">
          <Brain size={20} className="text-purple-600" />
          AI Insights
        </h4>
        {insights.map((insight, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-3 bg-white/70 rounded-xl text-sm font-bold text-[#1F1F1F]"
          >
            {insight}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function MetricBar({ label, value, max, color }: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const percentage = (value / max) * 100;
  
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-600',
    purple: 'bg-purple-600',
    green: 'bg-green-600',
    yellow: 'bg-yellow-600',
    pink: 'bg-pink-600',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-[#1F1F1F]">{label}</span>
        <span className="text-sm font-bold text-[#1F1F1F]/70">{value} / {max}</span>
      </div>
      <div className="h-2 bg-[#1F1F1F]/10 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${colorMap[color]}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function StatPill({ icon, label, value }: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 p-2 bg-white/70 rounded-lg">
      <div className="text-purple-600">{icon}</div>
      <div>
        <div className="text-xs text-[#1F1F1F]/70 font-bold">{label}</div>
        <div className="text-sm font-black text-[#1F1F1F]">{value}</div>
      </div>
    </div>
  );
}


