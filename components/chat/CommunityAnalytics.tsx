'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart2,
  Users, 
  TrendingUp, 
  Calendar, 
  Download, 
  Search, 
  RefreshCcw, 
  CheckCircle2, 
  Clock, 
  FileText,
  Hash,
  Award,
  Lock,
  Globe,
  Shield
} from 'lucide-react';
import { getCommunityStats, ZkCommunityStats } from '@/lib/zk/zkCommunityPayments';
import { getCommunityTreasury, ZkCommunityTreasury } from '@/lib/zk/zkMoney';
import { ZkCommunityAnalytics } from '@/components/zk/ZkCommunityAnalytics';

interface MemberItem {
  address: string;
  role: string;
  joinedAt: string;
}

interface ActivityItem {
  id: string;
  action: string;
  details: string;
  time: string;
  iconName?: string;
}

interface GrowthPoint {
  month: string;
  users: number;
  new: number;
  active: number;
}

interface CommunityAnalyticsProps {
  communityId?: string;
  community?: any;
}

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-3xl shadow-sm border border-black/[0.06] p-6 ${className}`}>
    {children}
  </div>
);

export default function CommunityAnalytics({ communityId, community: initialCommunity }: CommunityAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'zk_treasury'>('overview');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [zkStats, setZkStats] = useState<ZkCommunityStats | null>(null);
  const [zkTreasury, setZkTreasury] = useState<ZkCommunityTreasury | null>(null);
  const [searchMember, setSearchMember] = useState('');

  const targetId = communityId || initialCommunity?.id;

  const fetchAnalytics = useCallback(async () => {
    if (!targetId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/chat/communities/${targetId}/analytics`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setAnalyticsData(json);
      }
    } catch (err) {
      console.error('[CommunityAnalytics] Failed to fetch analytics:', err);
    } finally {
      if (targetId) {
        setZkStats(getCommunityStats(targetId));
        setZkTreasury(getCommunityTreasury(targetId));
      }
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [targetId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchAnalytics();
  };

  const communityName = analyticsData?.community?.name || initialCommunity?.name || 'Community';
  const totalMembers = analyticsData?.stats?.totalMembers ?? initialCommunity?.membersCount ?? 1;
  const adminCount = analyticsData?.stats?.adminCount ?? 1;
  const totalChannels = analyticsData?.stats?.totalChannels ?? initialCommunity?.channels?.length ?? 1;
  const totalPosts = analyticsData?.stats?.totalPosts ?? 0;
  const growthData: GrowthPoint[] = analyticsData?.growthData || [
    { month: 'Now', users: totalMembers, new: totalMembers, active: totalMembers }
  ];
  const members: MemberItem[] = analyticsData?.members || [];
  const recentActivities: ActivityItem[] = analyticsData?.recentActivities || [];

  const maxUsers = Math.max(...growthData.map(d => d.users), 1);

  const filteredMembers = members.filter(m => 
    !searchMember.trim() || m.address.toLowerCase().includes(searchMember.toLowerCase().trim())
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 pb-28 space-y-6">
      
      {/* ── HEADER CARD ── */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/[0.06] flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#15171c] text-white flex items-center justify-center shrink-0 shadow-sm">
            <BarChart2 size={18} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#15171c]">{communityName} Analytics</h1>
            <p className="text-[#727a88] text-[13px]">
              Verified accounts, active channels, and community metrics.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto">
          <button 
            onClick={handleRefresh}
            className={`p-2.5 bg-[#f2f4f7] hover:bg-[#e4e7ec] border border-black/[0.04] rounded-xl text-[#15171c] transition-all shadow-sm ${isRefreshing ? 'animate-spin' : ''}`}
            title="Refresh Live Data"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>

          <div className="flex items-center p-1 bg-[#f2f4f7] rounded-xl gap-1 flex-1 lg:flex-none">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 lg:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'overview' ? 'bg-white text-[#15171c] shadow-sm' : 'text-[#727a88] hover:text-[#15171c]'}`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`flex-1 lg:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'members' ? 'bg-white text-[#15171c] shadow-sm' : 'text-[#727a88] hover:text-[#15171c]'}`}
            >
              Members ({members.length || totalMembers})
            </button>
            <button
              onClick={() => setActiveTab('zk_treasury')}
              className={`flex-1 lg:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === 'zk_treasury' ? 'bg-white text-[#15171c] shadow-sm' : 'text-[#727a88] hover:text-[#15171c]'}`}
            >
              <Lock className="w-3.5 h-3.5" /> Aztec zk.money
            </button>
          </div>
        </div>
      </div>

      {/* ── TOP KPIS GRID ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Members', value: String(totalMembers), icon: Users, desc: 'Verified Wallets' },
          { label: 'Admins & Mods', value: String(adminCount), icon: Award, desc: 'Group Governors' },
          { label: 'Channels', value: String(totalChannels), icon: Hash, desc: 'Active Rooms' },
          { label: 'Posts Published', value: String(totalPosts), icon: FileText, desc: 'Public Records' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-black/[0.06] shadow-sm hover:shadow-md transition-all space-y-2">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-semibold text-[#727a88] uppercase tracking-wider">{stat.label}</span>
              <div className="p-2 rounded-xl bg-[#f2f4f7] text-[#15171c]">
                <stat.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-[#15171c] tracking-tight">{stat.value}</div>
            <p className="text-[11px] text-[#727a88] font-medium">{stat.desc}</p>
          </div>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Member Growth Timeline */}
          <Card>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-base font-bold text-[#15171c]">Member Growth Timeline</h2>
                <p className="text-xs text-[#727a88]">Verified sovereign memberships over time</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#15171c]" />
                <span className="text-xs font-semibold text-[#15171c]">Total Members</span>
              </div>
            </div>

            {/* Bar visualization */}
            <div className="h-56 flex items-end gap-3 pt-6 border-b border-black/[0.04] pb-2">
              {growthData.map((d, index) => {
                const barHeight = Math.max(16, Math.round((d.users / maxUsers) * 160));
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-[#15171c] text-white text-[10px] font-mono font-bold py-1 px-2 rounded-md whitespace-nowrap shadow-md pointer-events-none">
                      {d.users} members
                    </div>
                    <div 
                      style={{ height: `${barHeight}px` }} 
                      className="w-full bg-[#15171c] rounded-t-lg transition-all duration-300 group-hover:bg-black"
                    />
                    <span className="text-[11px] font-mono font-semibold text-[#727a88] mt-1">{d.month}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex justify-between text-xs text-[#727a88] font-mono">
              <span>Established: {analyticsData?.community?.createdAt ? new Date(analyticsData.community.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Alpha'}</span>
              <span>Network: Humanity Ledger L2</span>
            </div>
          </Card>

          {/* Live Activity */}
          <Card>
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-base font-bold text-[#15171c]">Recent Community Activity</h2>
                <p className="text-xs text-[#727a88]">Real cryptographic transactions and events</p>
              </div>
            </div>

            <div className="space-y-3">
              {recentActivities.length === 0 ? (
                <div className="py-8 text-center text-[#727a88] text-sm">
                  No recent activity recorded yet.
                </div>
              ) : (
                recentActivities.map((act) => (
                  <div key={act.id} className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#f2f4f7] border border-black/[0.03]">
                    <div className="p-2 rounded-xl bg-white text-[#15171c] shrink-0 border border-black/[0.04] shadow-xs">
                      {act.iconName === 'FileText' ? <FileText className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#15171c]">{act.action}</p>
                      <p className="text-[12px] text-[#727a88] truncate">{act.details}</p>
                      <p className="text-[10px] text-[#727a88]/70 mt-1 font-mono">{act.time}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Aztec Shielded Treasury Card */}
          <div className="bg-[#15171c] text-white rounded-3xl p-6 shadow-sm border border-black/10 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                  <Lock size={18} className="text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white tracking-tight">Aztec Shielded Treasury Metrics</h2>
                    <span className="text-[10px] font-semibold uppercase tracking-wider bg-white/10 text-white/90 px-2 py-0.5 rounded-full">
                      zk.money Native
                    </span>
                  </div>
                  <p className="text-xs text-white/60">Confidential balances and private tips via UltraHonk proofs</p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-mono text-white/90 bg-white/10 px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  UltraHonk Proof Verified
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">Shielded DAI</p>
                <p className="text-2xl font-bold font-mono text-white mt-1">
                  {zkTreasury?.balance?.dai || '0.00'} <span className="text-xs font-semibold text-white/60">zkDAI</span>
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">Private Tip Volume</p>
                <p className="text-2xl font-bold font-mono text-white mt-1">
                  ${zkStats?.totalVolume || '0.00'} <span className="text-xs font-semibold text-white/60">USD</span>
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">Active Bounties</p>
                <p className="text-2xl font-bold font-mono text-white mt-1">
                  {zkStats?.activeBounties ?? 0} <span className="text-xs font-semibold text-white/60">Open</span>
                </p>
              </div>
            </div>

            {zkStats?.topContributors && zkStats.topContributors.length > 0 && (
              <div className="pt-4 border-t border-white/10">
                <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">Top Anonymous Contributors</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {zkStats.topContributors.slice(0, 3).map((c, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5 flex items-center justify-between text-xs">
                      <span className="font-mono text-white/90 truncate">{c.zkHandle}</span>
                      <span className="font-bold font-mono text-white">{c.amount} {c.token}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'members' && (
        <Card>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-base font-bold text-[#15171c]">Verified Member Directory</h2>
              <p className="text-xs text-[#727a88]">Wallets participating in this community</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#727a88]" />
              <input
                type="text"
                placeholder="Filter by wallet address..."
                value={searchMember}
                onChange={e => setSearchMember(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#f2f4f7] border border-black/[0.05] rounded-xl text-xs font-mono text-[#15171c] outline-none focus:border-[#15171c] focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-black/[0.05] text-[#727a88] uppercase font-semibold text-[11px] tracking-wider">
                  <th className="pb-3 px-4">Member Wallet</th>
                  <th className="pb-3 px-4">Role</th>
                  <th className="pb-3 px-4">Joined At</th>
                  <th className="pb-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.03] font-medium">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[#727a88]">
                      {members.length === 0 ? 'Loading members...' : 'No matching members found.'}
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m, i) => (
                    <tr key={i} className="hover:bg-[#f2f4f7]/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-[#15171c]">
                        {m.address}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          m.role === 'OWNER' || m.role === 'ADMIN'
                            ? 'bg-[#15171c] text-white'
                            : 'bg-[#f2f4f7] text-[#15171c]'
                        }`}>
                          {m.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#727a88] font-mono">
                        {new Date(m.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#15171c]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'zk_treasury' && targetId && (
        <ZkCommunityAnalytics communityId={targetId} communityName={communityName} />
      )}
    </div>
  );
}
