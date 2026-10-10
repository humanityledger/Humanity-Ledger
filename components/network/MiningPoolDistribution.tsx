"use client";

import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Pickaxe, Server } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Refined color palette for dark mode pools
const POOL_COLORS = [
  '#0f172a', // slate-900
  '#4f46e5', // indigo-600
  '#0891b2', // cyan-600
  '#059669', // emerald-600
  '#ea580c', // orange-600
  '#9333ea', // purple-600
  '#e11d48', // rose-600
  '#2563eb', // emerald-600
  '#d97706', // amber-600
  '#7c3aed', // violet-600
  '#0d9488', // teal-600
  '#475569', // slate-600
  '#e2e8f0', // slate-200 for 'Others'
];

interface Pool {
  name: string;
  slug: string;
  blockCount: number;
  percentage: number;
  avgMatchRate: number | null;
}

interface MiningPoolsData {
  pools: Pool[];
  totalBlocks: number;
  lastHashrate: number;
  period: string;
}

const HISTORICAL_REFERENCE_DATA: Pool[] = [
  { name: 'Foundry USA', slug: 'foundry-usa', blockCount: 338, percentage: 35.08, avgMatchRate: null },
  { name: 'AntPool', slug: 'antpool', blockCount: 143, percentage: 15.29, avgMatchRate: null },
  { name: 'F2Pool', slug: 'f2pool', blockCount: 111, percentage: 11.87, avgMatchRate: null },
  { name: 'SpiderPool', slug: 'spiderpool', blockCount: 74, percentage: 7.91, avgMatchRate: null },
  { name: 'ViaBTC', slug: 'viabtc', blockCount: 63, percentage: 6.74, avgMatchRate: null },
  { name: 'MARA Pool', slug: 'mara-pool', blockCount: 55, percentage: 5.88, avgMatchRate: null },
  { name: 'SECPOOL', slug: 'secpool', blockCount: 40, percentage: 4.28, avgMatchRate: null },
  { name: 'Luxor', slug: 'luxor', blockCount: 32, percentage: 3.42, avgMatchRate: null },
  { name: 'SBI Crypto', slug: 'sbi-crypto', blockCount: 23, percentage: 2.46, avgMatchRate: null },
  { name: 'Binance Pool', slug: 'binance-pool', blockCount: 17, percentage: 1.82, avgMatchRate: null },
  { name: 'Braiins Pool', slug: 'braiins-pool', blockCount: 13, percentage: 1.39, avgMatchRate: null },
  { name: 'OCEAN', slug: 'ocean', blockCount: 13, percentage: 1.39, avgMatchRate: null },
  { name: 'Others', slug: 'others', blockCount: 23, percentage: 2.46, avgMatchRate: null },
];

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }: any) => {
  if (percentage < 5) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: '11px', fontWeight: 900, fontFamily: 'Inter' }}>
      {`${Math.round(percentage)}%`}
    </text>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data: Pool = payload[0].payload;
  return (
    <div className="bg-white/90 backdrop-blur-xl border border-slate-200 rounded-3xl p-6 shadow-2xl">
      <div className="text-slate-900 font-black text-sm mb-1">{data.name}</div>
      <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
        {data.blockCount.toLocaleString()} Verified Blocks (7d)
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-black tracking-tighter text-slate-900">{data.percentage}%</span>
        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Share</span>
      </div>
    </div>
  );
};

export function MiningPoolDistribution({ hideHeader = false, theme = 'default' }: { hideHeader?: boolean, theme?: 'default' | 'arctic' }) {
  const isArctic = theme === 'arctic';
  const { data, isLoading } = useQuery<MiningPoolsData>({
    queryKey: ['network', 'mining', 'pools'],
    queryFn: async () => {
      const res = await fetch('/api/network/v1/mining/pools');
      if (!res.ok) throw new Error('Failed to fetch pool data');
      return res.json();
    },
    refetchInterval: 600_000,
    staleTime: 300_000,
  });

  return (
    <div className={`${isArctic ? 'bg-white/40 backdrop-blur-xl border-slate-200' : 'bg-white border-slate-100 shadow-sm'} rounded-[3rem] border ${hideHeader ? 'p-0 border-none bg-transparent shadow-none' : 'p-10'}`}>
      {/* Header */}
      {!hideHeader && (
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-5">
              <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center shadow-sm ${isArctic ? 'bg-indigo-50 border-indigo-100' : 'bg-indigo-50 border-indigo-100'}`}>
                <Pickaxe className="text-indigo-600" size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Mining Resource Allocation</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-1">7-Day Performance Analysis</p>
              </div>
            </div>
            {data && (
              <div className={`flex items-center gap-3 border px-6 py-3 rounded-2xl ${isArctic ? 'bg-white/80 border-slate-200' : 'bg-black/5 border-slate-100'}`}>
                <Server size={14} className="text-slate-400" />
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                  {data.totalBlocks?.toLocaleString()} Blocks Audited
                </span>
              </div>
            )}
          </div>
      )}

      {isLoading ? (
        <div className="h-[420px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-indigo-600 animate-spin" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Querying Mining Nodes...</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-16 items-center">
          {/* Donut Chart */}
          <div className="w-full lg:w-[45%] h-[400px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.pools || HISTORICAL_REFERENCE_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius="65%"
                  outerRadius="92%"
                  dataKey="blockCount"
                  labelLine={false}
                  label={renderCustomLabel}
                  animationBegin={0}
                  animationDuration={1500}
                >
                  {(data?.pools || HISTORICAL_REFERENCE_DATA).map((_idx, idx) => (
                    <Cell
                      key={`cell-${idx}`}
                      fill={POOL_COLORS[idx % POOL_COLORS.length]}
                      stroke={isArctic ? "#ffffff" : "#ffffff"}
                      strokeWidth={6}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-[11px] font-black text-slate-300 uppercase tracking-[0.6em] mb-1">Hash Rate</div>
              <div className="text-[11px] font-black text-slate-300 uppercase tracking-[0.6em]">Share</div>
            </div>
          </div>

          {/* Legend Items */}
          <div className="w-full lg:w-[55%] flex flex-col gap-2">
            <AnimatePresence>
              {(data?.pools || HISTORICAL_REFERENCE_DATA).map((pool, idx) => (
                <motion.div
                  key={pool.slug}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className={`group flex items-center gap-4 p-3 pr-6 rounded-[1.25rem] border transition-all cursor-crosshair ${isArctic ? 'bg-white/60 border-slate-100 hover:bg-white hover:border-indigo-200 hover:shadow-lg' : 'bg-black/5 border-slate-100/50 hover:bg-white hover:border-slate-200 hover:shadow-xl'}`}
                >
                  {/* Number Badge */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black text-white shrink-0 shadow-sm"
                    style={{ backgroundColor: POOL_COLORS[idx % POOL_COLORS.length] }}
                  >
                    {idx + 1}
                  </div>

                  {/* Pool Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black text-slate-950 truncate tracking-tight">{pool.name}</div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{pool.blockCount.toLocaleString()} blocks</div>
                  </div>

                  {/* Stats & Bar Overlay */}
                  <div className="flex flex-col items-end gap-1 shrink-0 min-w-[80px]">
                    <div className="text-sm font-black font-mono text-slate-950 tracking-tighter">{pool.percentage}%</div>
                    {/* Simplified Precision Progress Bar */}
                    <div className="w-20 h-1 bg-slate-200/50 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pool.percentage}%` }}
                        transition={{ duration: 1, delay: 0.5 + idx * 0.05 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: POOL_COLORS[idx % POOL_COLORS.length] }}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
