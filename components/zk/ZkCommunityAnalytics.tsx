'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Lock, TrendingUp, TrendingDown, Activity, Users, Globe,
  Zap, Clock, ExternalLink, BarChart3, ArrowUpRight, Waves,
  FileText, CheckCircle, AlertTriangle, RefreshCw
} from 'lucide-react';
import { getShieldedBalances, getZkTransactionHistory, calculatePrivacyScore } from '@/lib/zk/zkMoney';
import { getCommunityTips, getOpenBounties, getCommunityStats } from '@/lib/zk/zkCommunityPayments';
import { getCommunityTreasury } from '@/lib/zk/zkMoney';

interface ZkCommunityAnalyticsProps {
  communityId: string;
  communityName?: string;
  className?: string;
}

export function ZkCommunityAnalytics({ communityId, communityName = 'Community', className = '' }: ZkCommunityAnalyticsProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  // Load data
  const tips = useMemo(() => getCommunityTips(communityId), [communityId, refreshKey]);
  const bounties = useMemo(() => getOpenBounties(communityId), [communityId, refreshKey]);
  const stats = useMemo(() => getCommunityStats(communityId), [communityId, refreshKey]);
  const treasury = useMemo(() => getCommunityTreasury(communityId), [communityId, refreshKey]);

  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1);
    window.addEventListener('ledger_zk_treasury_updated', handler);
    window.addEventListener('ledger_zk_payment_sent', handler);
    return () => {
      window.removeEventListener('ledger_zk_treasury_updated', handler);
      window.removeEventListener('ledger_zk_payment_sent', handler);
    };
  }, []);

  const totalTipVolume = tips.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
  const uniqueTippers = new Set(tips.map(t => t.senderTag)).size;

  // Chart data: last 7 days tip activity
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - i));
    const dayStr = day.toLocaleDateString('en', { weekday: 'short' });
    const dayTips = tips.filter(t => {
      const tipDate = new Date(t.timestamp);
      return tipDate.toDateString() === day.toDateString();
    });
    const vol = dayTips.reduce((s, t) => s + parseFloat(t.amount || '0'), 0);
    return { day: dayStr, volume: vol, count: dayTips.length };
  });
  const maxVol = Math.max(...last7Days.map(d => d.volume), 1);

  return (
    <div className={`space-y-5 ${className}`}>
      {/* Aztec shielded treasury banner */}
      <div className="bg-gradient-to-r from-[#1C1C1E] to-[#2C2C2E] rounded-3xl p-5 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#1C1C1E]/20 flex items-center justify-center">
              <Lock size={18} className="text-[#1C1C1E]" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[14px] font-black text-white">Aztec Shielded Treasury</div>
              <div className="text-[10px] text-white/50">{communityName} · Powered by zk.money</div>
            </div>
          </div>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition"
          >
            <RefreshCw size={12} className="text-white/60" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { token: 'zkDAI', amount: (treasury.balance as any).dai || (treasury.balance as any).DAI || '0', icon: '🟡' },
            { token: 'zkUSDC', amount: (treasury.balance as any).usdc || (treasury.balance as any).USDC || '0', icon: '🔵' },
            { token: 'zkETH', amount: (treasury.balance as any).eth || (treasury.balance as any).ETH || '0', icon: '💎' },
          ].map(({ token, amount, icon }) => (
            <div key={token} className="bg-white/[0.07] rounded-2xl p-3">
              <div className="text-[10px] text-white/50 font-semibold flex items-center gap-1">
                <Lock size={9} /> {token}
              </div>
              <div className="text-[16px] font-black font-mono text-white mt-1">
                {parseFloat(String(amount || '0')).toFixed(token === 'zkETH' ? 4 : 2)}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-white/[0.08] grid grid-cols-2 gap-3 text-[11px] font-mono">
          <div>
            <span className="text-white/40">Total Inflow:</span>
            <span className="text-[#1C1C1E] font-bold ml-1">{parseFloat(String(treasury.totalInflow || '0')).toFixed(2)} DAI</span>
          </div>
          <div>
            <span className="text-white/40">Total Outflow:</span>
            <span className="text-red-400 font-bold ml-1">{parseFloat(String(treasury.totalOutflow || '0')).toFixed(2)} DAI</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Private Tips', value: tips.length, sub: `${uniqueTippers} tippers`, color: '#1C1C1E', icon: <Activity size={14} /> },
          { label: 'Tip Volume', value: totalTipVolume.toFixed(0), sub: 'DAI equivalent', color: '#3A3A3C', icon: <TrendingUp size={14} /> },
          { label: 'Open Bounties', value: bounties.length, sub: 'Unclaimed', color: '#F59E0B', icon: <Zap size={14} /> },
          { label: 'Contributors', value: stats.topContributors.length, sub: 'Active members', color: '#8B5CF6', icon: <Users size={14} /> },
        ].map(({ label, value, sub, color, icon }) => (
          <div key={label} className="bg-white border border-black/[0.06] rounded-2xl p-4 shadow-xs">
            <div className="flex items-center gap-1.5 mb-2" style={{ color }}>
              {icon}
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `${color}` }}>{label}</span>
            </div>
            <div className="text-[22px] font-black text-gray-900">{value}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* 7-Day Tip Volume Bar Chart */}
      <div className="bg-white border border-black/[0.06] rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={15} className="text-[#1C1C1E]" />
          <h3 className="text-[13px] font-bold text-gray-900">7-Day Private Tip Volume</h3>
          <span className="ml-auto text-[10px] text-gray-400 font-semibold bg-[#1C1C1E]/10 text-[#1C1C1E] px-2 py-0.5 rounded-full">zk.money Protected</span>
        </div>

        <div className="flex items-end gap-2 h-[80px]">
          {last7Days.map(({ day, volume, count }) => (
            <div key={day} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-lg bg-[#1C1C1E] min-h-[4px] transition-all duration-700 relative group"
                style={{ height: `${Math.max(8, (volume / maxVol) * 72)}px` }}
                title={`${volume.toFixed(2)} DAI · ${count} tips`}
              />
              <span className="text-[9px] text-gray-400 font-semibold">{day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Contributors */}
      {stats.topContributors.length > 0 && (
        <div className="bg-white border border-black/[0.06] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Lock size={14} className="text-[#1C1C1E]" />
            <h3 className="text-[13px] font-bold text-gray-900">Anonymous Top Contributors</h3>
            <span className="ml-auto text-[10px] text-gray-400">Amounts hidden on-chain</span>
          </div>
          <div className="space-y-2">
            {stats.topContributors.slice(0, 5).map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[#f0f2f5] flex items-center justify-center text-[11px] font-black text-gray-500">
                  {i + 1}
                </div>
                <div className="flex-1 text-[12px] font-mono text-gray-700">
                  {c.zkHandle ? `${c.zkHandle.slice(0, 8)}...${c.zkHandle.slice(-4)}` : 'zk:anon'}
                </div>
                <div className="text-[12px] font-bold text-[#1C1C1E] font-mono">{parseFloat(c.amount || '0').toFixed(2)} DAI</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open Bounties */}
      {bounties.length > 0 && (
        <div className="bg-white border border-black/[0.06] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-amber-500" />
            <h3 className="text-[13px] font-bold text-gray-900">Open Community Bounties</h3>
          </div>
          <div className="space-y-2">
            {bounties.map(b => {
              const daysLeft = Math.max(0, Math.floor((b.expiresAt - Date.now()) / 86_400_000));
              return (
                <div key={b.id} className="flex items-center justify-between bg-[#FAFAFA] border border-black/[0.05] rounded-xl px-3 py-2">
                  <div>
                    <div className="text-[12px] font-bold text-gray-900">{b.title}</div>
                    <div className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Clock size={9} /> {daysLeft}d remaining
                    </div>
                  </div>
                  <div className="text-[13px] font-black text-[#1C1C1E] font-mono">{b.reward} {b.token}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Privacy badge */}
      <div className="flex items-center justify-center gap-2 py-2">
        <Lock size={12} className="text-[#1C1C1E]" />
        <span className="text-[11px] text-gray-400 font-semibold">All community payments are end-to-end private via Aztec Network zk.money</span>
        <a href="https://aztec.network" target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#1C1C1E] hover:underline flex items-center gap-0.5">
          Aztec Docs <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}
