'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Lock, TrendingUp, Activity, Users, Globe,
  Zap, Clock, ExternalLink, BarChart3, ArrowUpRight,
  RefreshCw, CheckCircle, Shield
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
      {/* ── Aztec Shielded Banner ── */}
      <div className="bg-[#15171c] rounded-3xl p-6 text-white border border-black/10 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
              <Lock size={18} className="text-white" strokeWidth={2} />
            </div>
            <div>
              <div className="text-[15px] font-bold text-white leading-tight">Aztec Shielded Vault Analytics</div>
              <div className="text-[11px] text-white/50">{communityName} · Powered by zk.money</div>
            </div>
          </div>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-white/70 hover:text-white"
            title="Refresh Vault Metrics"
          >
            <RefreshCw size={13} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { token: 'zkDAI', amount: (treasury.balance as any).dai || (treasury.balance as any).DAI || '0' },
            { token: 'zkUSDC', amount: (treasury.balance as any).usdc || (treasury.balance as any).USDC || '0' },
            { token: 'zkETH', amount: (treasury.balance as any).eth || (treasury.balance as any).ETH || '0' },
          ].map(({ token, amount }) => (
            <div key={token} className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="text-[10px] text-white/50 font-semibold uppercase tracking-wider flex items-center gap-1">
                <Lock size={9} /> {token}
              </div>
              <div className="text-[20px] font-bold font-mono text-white mt-1">
                {parseFloat(String(amount || '0')).toFixed(token === 'zkETH' ? 4 : 2)}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <span className="text-white/40">Total Inflow:</span>
            <span className="text-white font-bold ml-1.5">{parseFloat(String(treasury.totalInflow || '0')).toFixed(2)} DAI</span>
          </div>
          <div>
            <span className="text-white/40">Total Outflow:</span>
            <span className="text-white/90 font-bold ml-1.5">{parseFloat(String(treasury.totalOutflow || '0')).toFixed(2)} DAI</span>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Private Tips', value: tips.length, sub: `${uniqueTippers} tippers`, icon: <Activity size={14} /> },
          { label: 'Tip Volume', value: `$${totalTipVolume.toFixed(0)}`, sub: 'DAI equivalent', icon: <TrendingUp size={14} /> },
          { label: 'Open Bounties', value: bounties.length, sub: 'Unclaimed', icon: <Zap size={14} /> },
          { label: 'Contributors', value: stats.topContributors.length, sub: 'Active members', icon: <Users size={14} /> },
        ].map(({ label, value, sub, icon }) => (
          <div key={label} className="bg-white border border-black/[0.06] rounded-2xl p-4 shadow-sm space-y-1">
            <div className="flex items-center gap-1.5 text-[#15171c]">
              {icon}
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#727a88]">{label}</span>
            </div>
            <div className="text-[22px] font-bold font-mono text-[#15171c]">{value}</div>
            <div className="text-[11px] text-[#727a88]">{sub}</div>
          </div>
        ))}
      </div>

      {/* ── 7-Day Tip Volume Bar Chart ── */}
      <div className="bg-white border border-black/[0.06] rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-[#15171c]" />
            <h3 className="text-[14px] font-bold text-[#15171c]">7-Day Private Tip Volume</h3>
          </div>
          <span className="text-[11px] text-[#15171c] font-semibold bg-[#f2f4f7] px-2.5 py-0.5 rounded-full border border-black/[0.04]">
            zk.money Protected
          </span>
        </div>

        <div className="flex items-end gap-2.5 h-[90px] pt-2 border-b border-black/[0.04] pb-2">
          {last7Days.map(({ day, volume, count }) => (
            <div key={day} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
              <div
                className="w-full rounded-t-lg bg-[#15171c] min-h-[4px] transition-all duration-500 hover:bg-black"
                style={{ height: `${Math.max(8, (volume / maxVol) * 76)}px` }}
                title={`${volume.toFixed(2)} DAI · ${count} tips`}
              />
              <span className="text-[10px] text-[#727a88] font-mono font-semibold">{day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Top Contributors ── */}
      {stats.topContributors.length > 0 && (
        <div className="bg-white border border-black/[0.06] rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Lock size={15} className="text-[#15171c]" />
              <h3 className="text-[14px] font-bold text-[#15171c]">Anonymous Top Contributors</h3>
            </div>
            <span className="text-[11px] text-[#727a88]">Shielded on Aztec</span>
          </div>
          <div className="space-y-2">
            {stats.topContributors.slice(0, 5).map((c, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[#f2f4f7] border border-black/[0.03]">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-[11px] font-mono font-bold text-[#15171c] border border-black/[0.04]">
                    {i + 1}
                  </div>
                  <span className="text-[12px] font-mono font-semibold text-[#15171c]">
                    {c.zkHandle ? `${c.zkHandle.slice(0, 8)}...${c.zkHandle.slice(-4)}` : 'zk:anon'}
                  </span>
                </div>
                <div className="text-[12px] font-bold font-mono text-[#15171c]">{parseFloat(c.amount || '0').toFixed(2)} DAI</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Open Bounties ── */}
      {bounties.length > 0 && (
        <div className="bg-white border border-black/[0.06] rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={15} className="text-[#15171c]" />
            <h3 className="text-[14px] font-bold text-[#15171c]">Open Community Bounties</h3>
          </div>
          <div className="space-y-2.5">
            {bounties.map(b => {
              const daysLeft = Math.max(0, Math.floor((b.expiresAt - Date.now()) / 86_400_000));
              return (
                <div key={b.id} className="flex items-center justify-between bg-[#f2f4f7] border border-black/[0.03] rounded-2xl px-4 py-3">
                  <div>
                    <div className="text-[13px] font-bold text-[#15171c]">{b.title}</div>
                    <div className="text-[11px] text-[#727a88] flex items-center gap-1 mt-0.5 font-medium">
                      <Clock size={11} /> {daysLeft}d remaining
                    </div>
                  </div>
                  <div className="text-[13px] font-bold text-[#15171c] font-mono bg-white px-3 py-1.5 rounded-xl border border-black/[0.04]">
                    {b.reward} {b.token}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Privacy badge ── */}
      <div className="flex items-center justify-center gap-2 py-2 text-[12px] text-[#727a88]">
        <Shield size={13} className="text-[#15171c]" />
        <span>End-to-end privacy via Aztec Network zk.money</span>
      </div>
    </div>
  );
}
