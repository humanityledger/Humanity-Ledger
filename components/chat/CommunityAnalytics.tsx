'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
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
  Globe
} from 'lucide-react';

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
  <div className={`bg-white rounded-2xl shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] border border-gray-100 p-6 ${className}`}>
    {children}
  </div>
);

export default function CommunityAnalytics({ communityId, community: initialCommunity }: CommunityAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'members'>('overview');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
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
    <div className="min-h-screen bg-[#FAFAFA] p-4 sm:p-8 font-sans text-gray-900">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">{communityName} Pulse</h1>
              <span className="px-2.5 py-1 rounded-full bg-[#25D366]/10 text-[#25D366] text-xs font-semibold tracking-wide uppercase">Native Live</span>
            </div>
            <p className="text-gray-500 mt-2 text-sm max-w-xl">
              Live cryptographic metrics for verified members, channels, and community activity.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <button 
              onClick={handleRefresh}
              className={`p-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all shadow-sm ${isRefreshing ? 'animate-spin' : ''}`}
              title="Refresh Native Data"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
            <div className="flex items-center p-1 bg-[#F2F2F7] rounded-xl">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'overview' ? 'bg-white text-black shadow-sm' : 'text-black/50'}`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('members')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'members' ? 'bg-white text-black shadow-sm' : 'text-black/50'}`}
              >
                Members ({members.length || totalMembers})
              </button>
            </div>
          </div>
        </div>

        {/* Top KPIs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Total Members', value: String(totalMembers), icon: Users, desc: 'Verified Sovereign Accounts' },
            { label: 'Admins and Mods', value: String(adminCount), icon: Award, desc: 'Group Governors' },
            { label: 'Channels', value: String(totalChannels), icon: Hash, desc: 'Active Rooms' },
            { label: 'Posts Published', value: String(totalPosts), icon: FileText, desc: 'Sovereign Records' },
          ].map((stat, i) => (
            <Card key={i} className="hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 group relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{stat.label}</span>
                  <h3 className="text-3xl font-extrabold text-gray-900 tracking-tight">{stat.value}</h3>
                  <p className="text-xs text-gray-500 font-medium">{stat.desc}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#25D366]/10 text-[#25D366]">
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Growth Chart */}
            <Card className="lg:col-span-2">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Member Growth Timeline</h2>
                  <p className="text-xs text-gray-500">Real chronological count from sovereign memberships</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#25D366]"></span>
                  <span className="text-xs font-semibold text-gray-600">Total Members</span>
                </div>
              </div>

              {/* Bar visualization */}
              <div className="h-64 flex items-end gap-3 pt-6 border-b border-gray-100 pb-2">
                {growthData.map((d, index) => {
                  const barHeight = Math.max(12, Math.round((d.users / maxUsers) * 200));
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] font-bold py-1 px-2 rounded-md whitespace-nowrap shadow-md pointer-events-none">
                        {d.users} members
                      </div>
                      <div 
                        style={{ height: `${barHeight}px` }} 
                        className="w-full bg-[#25D366] rounded-t-lg transition-all duration-300 group-hover:bg-[#20b858]"
                      />
                      <span className="text-[11px] font-semibold text-gray-500 mt-1">{d.month}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-between text-xs text-gray-400">
                <span>Origin: {analyticsData?.community?.createdAt ? new Date(analyticsData.community.createdAt).toLocaleDateString('en-US') : 'Established'}</span>
                <span>Active Network: Polygon and Ethereum</span>
              </div>
            </Card>

            {/* Recent Activities */}
            <Card>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Live Activity</h2>
                  <p className="text-xs text-gray-500">Real community actions</p>
                </div>
              </div>

              <div className="space-y-4">
                {recentActivities.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-sm">
                    No recent activity recorded yet.
                  </div>
                ) : (
                  recentActivities.map((act) => (
                    <div key={act.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="p-2 rounded-lg bg-[#25D366]/10 text-[#25D366] shrink-0">
                        {act.iconName === 'FileText' ? <FileText className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-gray-900">{act.action}</p>
                        <p className="text-[11px] text-gray-600 truncate">{act.details}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{act.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'members' && (
          <Card>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Verified Member Directory</h2>
                <p className="text-xs text-gray-500">Native database list of wallets participating in this community</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter by wallet address..."
                  value={searchMember}
                  onChange={e => setSearchMember(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-[#25D366]/20"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 uppercase font-bold tracking-wider">
                    <th className="pb-3 px-4">Member Wallet</th>
                    <th className="pb-3 px-4">Role</th>
                    <th className="pb-3 px-4">Joined At</th>
                    <th className="pb-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-medium">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-400">
                        {members.length === 0 ? 'Loading members...' : 'No matching members found.'}
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((m, i) => (
                      <tr key={i} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-gray-900">
                          {m.address}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            m.role === 'OWNER' || m.role === 'ADMIN'
                              ? 'bg-[#25D366]/15 text-[#25D366]'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {m.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-500 font-mono">
                          {new Date(m.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#25D366]">
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

      </div>
    </div>
  );
}
