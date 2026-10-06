"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Activity, DollarSign, Percent, Zap, Brain, AlertTriangle, BarChart3, ShieldCheck } from 'lucide-react';
import AttestingViewChart from './TradingViewChart';
import PremiumLocked from './PremiumLocked';
import { useAccount } from 'wagmi';
import { useAuth } from '@/hooks/useAuth';
import { useLedgerFeed } from '@/hooks/useLedgerFeed';

import { safeToFixed, safeToLocaleString } from '@/lib/utils/number-format';
interface AdvancedAnalyticsProps {
  walletAddress: string;
  isPremium: boolean;
  hasTrialed?: boolean;
}

interface PortfolioData {
  totalValue: number;
  pnl24h: number;
  change24h: number;
  activity24h: number;
  activityScore?: number;
  riskScore: number;
  rank: number;
  txCount: number;
  lastActive: string;
  loading: boolean;
  hasData: boolean;
  breakdown: Record<string, number>;
  networksActive?: string[];
}

export default function AdvancedAnalytics({ walletAddress, isPremium, hasTrialed }: AdvancedAnalyticsProps) {
  const { address: web3Address } = useAccount();
  const { isAuthenticated } = useAuth();
  const { unifiedLedgerFeed } = useLedgerFeed();
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d' | '90d' | '1y'>('7d');
  const [selectedMetric, setSelectedMetric] = useState<'value' | 'pnl' | 'activity' | 'risk'>('value');
  const [portfolioData, setPortfolioData] = useState<any>({
    totalValue: 0,
    pnl24h: 0,
    change24h: 0,
    activity24h: 0,
    riskScore: 0,
    rank: 0,
    txCount: 0,
    lastActive: '',
    loading: false,
    hasData: false,
    breakdown: {},
    strategicSummary: '',
    yieldPositions: [],
    networksActive: [],
    ledgerEvidence: [],
    influenceScore: 0,
    entityInfo: null,
    totalFlow30d: 0,
    identityTier: 'GHOST'
  });

  const fetchData = async (isManual = false) => {
    if (!walletAddress) {
      setPortfolioData((prev: any) => ({ ...prev, loading: false, hasData: false }));
      return;
    }

    setPortfolioData((prev: any) => ({ ...prev, loading: !prev.hasData, error: null }));
    
    try {
      const refreshQuery = isManual ? '?refresh=true' : '';
      const statsRes = await fetch(`/api/wallet/analytics/${walletAddress}${refreshQuery}`);
      
      if (!statsRes.ok) {
         throw new Error(`API Error: ${statsRes.status}`);
      }

      const statsData = await statsRes.json();
      
      if (statsData.error) {
         setPortfolioData((prev: any) => ({ 
           ...prev, 
           loading: false, 
           error: statsData.errorMessage || statsData.error,
           hasData: false 
         }));
         return;
      }

      const hasValue = (statsData.totalValue || 0) > 0 || (statsData.activity24h || 0) > 0;

      setPortfolioData({
        totalValue: statsData.totalValue || 0,
        pnl24h: statsData.pnl24h || 0, 
        change24h: statsData.change24h || 0,
        activity24h: statsData.activity24h || 0,
        riskScore: statsData.riskScore || 0,
        rank: statsData.rank || 0,
        txCount: statsData.txCount || 0,
        lastActive: statsData.lastActive || 'Never',
        loading: false,
        hasData: hasValue,
        breakdown: statsData.breakdown || {},
        strategicSummary: statsData.strategicSummary || '',
        yieldPositions: statsData.yieldPositions || [],
        networksActive: statsData.networksActive || [],
        ledgerEvidence: statsData.ledgerEvidence || [],
        influenceScore: statsData.influenceScore || 0
      });
    } catch (e: any) {
      console.error("Failed to fetch analytics data", e);
      setPortfolioData((prev: any) => ({ 
        ...prev, 
        loading: false, 
        error: "Connection timeout or invalid gateway. Ensure Alchemy key is active." 
      }));
    }
  };

  // Fetch real portfolio data
  useEffect(() => {
    if (!walletAddress) return;

    // [FAST-SYNC] Refresh basic stats every 5 seconds for "al segundo" feel
    const fastRefresh = async () => {
        try {
            const statsRes = await fetch(`/api/wallet/analytics/${walletAddress}`);
            const statsData = await statsRes.json();
            setPortfolioData((prev: any) => ({
                ...prev,
                totalValue: statsData.totalValue ?? prev.totalValue,
                pnl24h: statsData.pnl24h ?? prev.pnl24h,
                change24h: statsData.change24h ?? prev.change24h,
                txCount: statsData.txCount ?? prev.txCount,
                lastActive: statsData.lastActive ?? prev.lastActive,
                breakdown: statsData.breakdown ?? prev.breakdown,
                riskScore: statsData.riskScore ?? prev.riskScore,
                activity24h: statsData.activity24h ?? prev.activity24h,
                strategicSummary: statsData.strategicSummary ?? prev.strategicSummary,
                yieldPositions: statsData.yieldPositions ?? prev.yieldPositions,
                networksActive: statsData.networksActive ?? prev.networksActive,
                smartMoneyMetrics: statsData.smartMoneyMetrics ?? prev.smartMoneyMetrics,
                ledgerEvidence: statsData.ledgerEvidence ?? prev.ledgerEvidence,
                influenceScore: statsData.influenceScore ?? prev.influenceScore,
                entityInfo: statsData.entityInfo ?? prev.entityInfo,
                totalFlow30d: statsData.totalFlow30d ?? prev.totalFlow30d,
                identityTier: statsData.identityTier ?? prev.identityTier
            }));
        } catch (e) {
            console.warn("Fast refresh failed", e);
        }
    };

    fetchData(true); // Always force refresh on initial address change
    const interval = setInterval(() => fetchData(false), 60000);
    const fastInterval = setInterval(fastRefresh, 5000);
    return () => {
        clearInterval(interval);
        clearInterval(fastInterval);
    };
  }, [walletAddress]);


  // [MASTER-CHART] Fetch REAL historical trend from Alchemy Transfers
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!walletAddress) return;

    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const res = await fetch(`/api/premium/wallet-history?address=${walletAddress}&timeframe=${timeframe}`);
        const data = await res.json();
        if (data.history) {
          setHistoryData(data.history);
        }
      } catch (e) {
        console.error("Failed to fetch history", e);
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [walletAddress, timeframe]);

  // Use historyData instead of simulated portfolioHistory
  const portfolioHistory = historyData;

  const formatValue = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(Number(val))) return "$0.00";
    const n = Number(val);
    if (n === 0) return "$0.00";
    if (n >= 1e9) return `$${safeToFixed(n / 1e9, 2)}B`;
    if (n >= 1e6) return `$${safeToFixed(n / 1e6, 2)}M`;
    if (n >= 1e3) return `$${safeToFixed(n / 1e3, 2)}K`;
    return `$${safeToFixed(n, 2)}`;
  };

  if (!isPremium && !hasTrialed) {
    return (
      <PremiumLocked
        feature="Advanced Market Analytics"
        description="Get detailed information about portfolio performance, risk metrics, and history with our analytics engine."
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


      {/* 1. BTC PRICE CHART LIVE BINANCE (REQUIRED) */}
      <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
          <TrendingUp size={120} className="text-orange-500" />
        </div>
        <h3 className="text-sm font-black text-gray-400 mb-6 flex items-center gap-2 uppercase tracking-[0.2em]">
            <TrendingUp size={16} className="text-orange-500" />
            Binance Active Tracker: BTC / USDT
        </h3>
        <AttestingViewChart 
            symbol="BTCUSDT" 
            height={300} 
            transfers={unifiedLedgerFeed
                .filter(tx => tx.asset === 'BTC' || tx.asset === 'WBTC' || tx.asset === 'BTCB')
                .map(tx => ({
                    timestamp: tx.timestamp,
                    amount: tx.amount,
                    type: tx.type.includes('BUY') ? 'BUY' : (tx.type.includes('SELL') ? 'SELL' : 'TRANSFER'),
                    price: tx.usdValue / tx.amount
                }))
            }
        />
      </div>

      {/* 2. WALLET SELECTION & TIMEFRAME */}
      <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-5 border border-white/10 flex flex-col md:flex-row gap-6 items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#25D366]/10 rounded-2xl flex items-center justify-center text-blue-400 border border-[#25D366]/20">
                  <Activity size={24} />
              </div>
              <div>
                  <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Blockchain Monitor</div>
                  <div className="text-lg font-mono font-black text-white italic tracking-tighter flex items-center gap-2">
                      {portfolioData.entityInfo ? (
                        <span className="text-blue-400">{portfolioData.entityInfo.name}</span>
                      ) : (
                        walletAddress ? `${walletAddress.slice(0, 10)}...${walletAddress.slice(-8)}` : "SELECT A TARGET"
                      )}
                      {portfolioData.identityTier === 'PROTOCOL' && (
                        <span className="bg-[#25D366]/20 text-blue-400 text-[8px] px-2 py-0.5 rounded border border-[#25D366]/30 uppercase tracking-widest">System Entity</span>
                      )}
                  </div>
                  {portfolioData.entityInfo && (
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.1em]">
                      Protocolo: {portfolioData.entityInfo.protocol}  {portfolioData.entityInfo.type}
                    </div>
                  )}
                  {portfolioData.smartMoneyMetrics && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${
                        portfolioData.smartMoneyMetrics.score >= 80 ? 'bg-indigo-500 text-white' : 
                        portfolioData.smartMoneyMetrics.score >= 60 ? 'bg-[#25D366] text-white' : 
                        'bg-white/10 text-gray-400'
                      }`}>
                        Signal for {portfolioData.smartMoneyMetrics.category}
                      </div>
                      <div className="text-[9px] font-black text-blue-400 italic">
                        Score: {portfolioData.smartMoneyMetrics.score}/100
                      </div>
                    </div>
                  )}
              </div>
           </div>


           <div className="flex gap-4 items-center w-full md:w-auto">
            <div className="flex gap-1 bg-white/5 p-1.5 rounded-2xl flex-1 md:flex-initial border border-white/5">
              {(['24h', '7d', '30d', '90d', '1y'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`flex-1 py-1 px-3 rounded-xl text-[9px] font-black transition-all uppercase tracking-widest ${
                    timeframe === tf ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            <button
              onClick={() => fetchData(true)}
              disabled={portfolioData.loading}
              className={`p-3 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 text-white transition-all group ${portfolioData.loading ? 'opacity-50 cursor-wait' : ''}`}
              title="Full Sync"
            >
              <Zap size={18} className={`group-hover:text-blue-400 transition-colors ${portfolioData.loading ? 'animate-spin' : ''}`} />
            </button>

          </div>

      </div>

      {/* Quick Stats - REAL DATA */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard title="Total Value" value={formatValue(portfolioData.totalValue)} icon="wallet" />
        <StatCard 
            title="Total P&L" 
            value={`${(portfolioData.pnl24h || 0) >= 0 ? '+' : ''}${formatValue(portfolioData.pnl24h || 0)}`} 
            icon="pnl"
            trend={portfolioData.change24h || 0}
        />
        <StatCard title="Activity (24h)" value={(portfolioData.txCount || 0).toString()} icon="activity" />
        <StatCard title="Risk level" value={(portfolioData.riskScore || 50).toString()} icon="risk" />
        <StatCard title="Network Rank" value={`#${portfolioData.rank || '???'}`} icon="rank" />
        <StatCard title="Transactions" value={(portfolioData.txCount || 0).toString()} icon="tx" />
        {(portfolioData.totalFlow30d > 0 || portfolioData.identityTier === 'PROTOCOL') && (
            <StatCard 
                title="Throughput (30d)" 
                value={formatValue(portfolioData.totalFlow30d)} 
                icon="activity" 
                subtitle="Volume Processed"
            />
        )}
        {portfolioData.influenceScore > 0 && (
            <StatCard 
                title="Elite Influence" 
                value={`${portfolioData.influenceScore}/100`} 
                icon="rank"
                subtitle="Market Impact"
            />
        )}
        {portfolioData.smartMoneyMetrics && (
            <StatCard 
                title="Smart Conviction" 
                value={`${portfolioData.smartMoneyMetrics.metadata.profitableAttestationsPercent}%`} 
                icon="brain"
                subtitle="Est. Accuracy Rate"
            />
        )}

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-4 flex items-center justify-between backdrop-blur-md">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Active Signal:</span>
            </div>
            <span className="text-xs font-mono font-black text-emerald-400 italic truncate ml-2">{portfolioData.lastActive || 'Analyzing...'}</span>
        </div>
        
        {/* Elite Evidence Panel */}
        {portfolioData.ledgerEvidence && portfolioData.ledgerEvidence.length > 0 && (
          <div className="lg:col-span-2 bg-blue-600/5 border border-[#25D366]/20 rounded-3xl p-6 backdrop-blur-md">
            <h4 className="text-xs font-black text-blue-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <ShieldCheck size={16} />
              Elite Verification Evidence
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {portfolioData.ledgerEvidence.map((ev: string, i: number) => (
                <div key={i} className="flex items-center gap-3 text-sm text-gray-300 font-medium bg-white/5 p-3 rounded-2xl border border-white/5">
                  <div className="w-2 h-2 bg-[#25D366] rounded-full" />
                  {ev}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wealth Breakdown Preview */}
        <div className="bg-white/5 rounded-3xl p-5 border border-white/5 flex items-center gap-4 hover:border-white/20 transition-all">
            <div className="text-[10px] font-black text-gray-500 uppercase rotate-90 origin-left -translate-x-3 tracking-[0.3em]">ASSETS</div>
            <div className="flex gap-3 flex-1 overflow-x-auto no-scrollbar py-1">
                {Object.entries(portfolioData.breakdown || {})
                    .sort(([,a], [,b]) => (b as number) - (a as number))
                    .slice(0, 6)
                    .map(([sym, val]) => (
                    <div key={sym} className="flex-shrink-0 min-w-[70px] bg-white/5 rounded-2xl p-3 text-center border border-white/5 group hover:border-[#25D366]/30 transition-all">
                        <div className="text-[10px] font-black text-gray-500 group-hover:text-blue-400 transition-colors uppercase">{sym}</div>
                        <div className="text-lg font-black text-white italic tracking-tighter">
                            {((Number(val || 0) / (portfolioData.totalValue || 1)) * 100).toFixed(0)}%
                        </div>
                    </div>

                ))}
            </div>
        </div>
      </div>

      {/* 4. MAIN PERFORMANCE CHART */}
      <div className="bg-white/5 backdrop-blur-xl rounded-[2.5rem] p-4 border border-white/10 overflow-hidden relative">
        {historyLoading && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-20 flex items-center justify-center rounded-[2.5rem]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-[#25D366] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Scanning History...</span>
                </div>
            </div>
        )}
        {!walletAddress || portfolioHistory.length === 0 || portfolioData.error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className={`w-20 h-20 ${portfolioData.error ? 'bg-indigo-500/10' : 'bg-white/5'} rounded-full flex items-center justify-center mb-6 animate-pulse`}>
                {portfolioData.error ? <AlertTriangle size={40} className="text-indigo-500" /> : <Activity size={40} className="text-gray-600" />}
            </div>
            <h3 className="text-2xl font-black text-white italic mb-2 tracking-tighter">
                {portfolioData.error ? "DATA FLOW INTERRUPTED" : (!walletAddress ? "TARGET NOT SELECTED" : "GATHERING ON-CHAIN INTELLIGENCE")}
            </h3>
            <p className="text-gray-500 max-w-xs font-medium">
              {portfolioData.error 
                ? `${portfolioData.error}. Check the platform environment variables.`
                : (!walletAddress 
                    ? "Switch to the Tracker tab and select a target to start deep blockchain analysis."
                    : "Real-time history will populate as soon as the block explorer returns data.")}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
              <div className="bg-black/20 backdrop-blur-md rounded-3xl p-6 border border-white/5">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Inventory Breakdown</h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(portfolioData.breakdown || {})
                        .map(([name, value]) => ({ name, value: Number(value) }))
                        .filter(item => item.value >= 0.01)}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {Object.entries(portfolioData.breakdown || {})
                        .map(([name, value]) => ({ name, value: Number(value) }))
                        .filter(item => item.value >= 0.01)
                        .map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'][index % 4]} stroke="rgba(255,255,255,0.05)" />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#000', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', color: '#fff' }}
                      itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                      formatter={(value: any) => formatValue(Number(value) || 0) as any}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-black/20 backdrop-blur-md rounded-3xl p-6 border border-white/5">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">{selectedMetric === 'value' ? 'Value' : selectedMetric === 'pnl' ? 'P&L' : 'Activity'} Performance</h3>
                  <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                    {(['value', 'pnl', 'activity'] as const).map((metric) => (
                      <button
                        key={metric}
                        onClick={() => setSelectedMetric(metric)}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all uppercase tracking-widest ${
                          selectedMetric === metric
                            ? 'bg-white text-black'
                            : 'text-gray-500 hover:text-white'
                        }`}
                      >
                        {metric === 'value' ? 'VALOR' : metric === 'pnl' ? 'P&L' : 'ACTIVIDAD'}
                      </button>
                    ))}
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={portfolioHistory}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="10 10" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" hide />
                    <YAxis stroke="rgba(255,255,255,0.2)" hide />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(0,0,0,0.9)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '24px',
                        padding: '16px',
                        backdropFilter: 'blur(10px)'
                      }}
                      itemStyle={{ color: '#fff', fontWeight: 'black' }}
                      labelStyle={{ color: '#666', marginBottom: '8px' }}
                      formatter={(value: any) => [formatValue(value), selectedMetric.toUpperCase()]}
                    />
                    <Area
                      type="monotone"
                      dataKey={selectedMetric}
                      stroke="#3B82F6"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorValue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>


    </div>
  );
}

function StatCard({ title, value, icon, trend, subtitle }: { title: string; value: string; icon: string; trend?: number, subtitle?: string }) {
  const getIcon = () => {
    switch (icon) {
      case 'wallet': return <Activity className="text-blue-600" />;
      case 'pnl': return <TrendingUp className="text-green-600" />;
      case 'activity': return <Zap className="text-purple-600" />;
      case 'risk': return <BarChart3 className="text-orange-600" />;
      case 'rank': return <TrendingUp className="text-[#25D366]" />;
      case 'tx': return <Activity className="text-purple-500" />;
      case 'brain': return <Brain className="text-indigo-500" />;
      default: return <Activity className="text-blue-600" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:border-[#25D366]/50 transition-all group"
    >
      <div className="flex items-center gap-2 mb-3 text-gray-400 group-hover:text-white transition-colors">
        {getIcon()}
        <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
      </div>
      <div className="text-3xl font-black text-white tracking-tighter mb-1">{value}</div>
      {trend !== undefined && (
        <div className={`text-sm font-black flex items-center gap-1 ${
          (trend || 0) >= 0 ? 'text-green-400' : 'text-red-400'
        }`}>
          {(trend || 0) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {Math.abs(Number(trend || 0)).toFixed(1)}%
        </div>

      )}
      {trend === undefined && (
        <div className="text-[10px] font-bold text-[#25D366]/60 uppercase tracking-tighter">
          {subtitle || ' Real-Time Sync'}
        </div>
      )}
    </motion.div>
  );
}


