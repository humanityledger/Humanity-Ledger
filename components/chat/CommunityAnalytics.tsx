'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { formatCount, type GrowthPoint } from '@/lib/communities/analytics';
import { ZkCommunityTreasury } from '@/components/zk/ZkCommunityTreasury';

/**
 * Community analytics for owners and admins. Every figure comes from
 * GET /api/chat/communities/[id]/analytics, which reads the database. A figure the server could
 * not read is shown as "—", never as 0. Nothing here comes from localStorage and nothing is
 * estimated: there is no community treasury contract, so the treasury is shown as not deployed.
 */

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
}

interface AnalyticsResponse {
  community?: { id: string; name: string; createdAt?: string };
  stats?: {
    totalMembers?: number | null;
    adminCount?: number | null;
    totalChannels?: number | null;
    totalPosts?: number | null;
    totalChannelMessages?: number | null;
    channelMessages30d?: number | null;
  };
  growthData?: GrowthPoint[];
  recentActivities?: ActivityItem[];
  members?: MemberItem[];
}

interface CommunityAnalyticsProps {
  communityId?: string;
  community?: { id?: string; name?: string } | null;
}

type LoadState = 'loading' | 'ready' | 'forbidden' | 'error';
type Tab = 'overview' | 'members' | 'treasury';

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'members', label: 'Members' },
  { id: 'treasury', label: 'Treasury' },
];

function shortAddress(a: string): string {
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-[#E4E7EC]">
      <header className="px-5 py-4 border-b border-[#E4E7EC]">
        <h2 className="text-[14px] font-semibold text-[#15171C]">{title}</h2>
        {note ? <p className="text-[13px] text-[#727A88] mt-0.5">{note}</p> : null}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E4E7EC] px-4 py-4">
      <div className="text-[12px] font-medium text-[#727A88]">{label}</div>
      <div className="mt-1 text-[22px] font-semibold text-[#15171C] tabular-nums tracking-tight">{value}</div>
      <div className="mt-1 text-[12px] text-[#727A88] leading-snug">{note}</div>
    </div>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`bg-[#EFF1F4] rounded-xl ${className}`} aria-hidden />;
}

export default function CommunityAnalytics({ communityId, community: initialCommunity }: CommunityAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [state, setState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [searchMember, setSearchMember] = useState('');

  const targetId = communityId || initialCommunity?.id;

  const fetchAnalytics = useCallback(async () => {
    if (!targetId) {
      setState('error');
      return;
    }
    try {
      const res = await fetch(`/api/chat/communities/${encodeURIComponent(targetId)}/analytics`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.status === 401 || res.status === 403) {
        setState('forbidden');
        return;
      }
      if (!res.ok) {
        setState('error');
        return;
      }
      const json = (await res.json()) as AnalyticsResponse;
      setData(json);
      setState('ready');
    } catch (err) {
      console.error('[CommunityAnalytics] Failed to fetch analytics:', err);
      setState('error');
    } finally {
      setRefreshing(false);
    }
  }, [targetId]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    void fetchAnalytics();
  };

  const communityName = data?.community?.name || initialCommunity?.name || 'Community';
  const stats = data?.stats ?? {};
  const growth: GrowthPoint[] = useMemo(() => (data?.growthData ?? []).slice(-12), [data]);
  const members: MemberItem[] = useMemo(() => data?.members ?? [], [data]);
  const activities: ActivityItem[] = data?.recentActivities ?? [];
  const maxTotal = growth.reduce((m, p) => Math.max(m, p.total), 0);

  const filteredMembers = useMemo(() => {
    const q = searchMember.trim().toLowerCase();
    return q ? members.filter((m) => m.address.toLowerCase().includes(q)) : members;
  }, [members, searchMember]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 pb-28 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[18px] font-semibold tracking-tight text-[#15171C] truncate">{communityName}</h1>
          <p className="text-[13px] text-[#727A88]">
            Analytics · from the server database · established {formatDate(data?.community?.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center p-0.5 bg-[#F2F4F7] border border-[#E4E7EC] rounded-xl" role="tablist">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => setActiveTab(id)}
                className={`px-3 py-1.5 text-[13px] font-medium rounded-[10px] transition-colors duration-150 ease-out ${
                  activeTab === id ? 'bg-white text-[#15171C] border border-[#E4E7EC]' : 'text-[#727A88] hover:text-[#15171C] border border-transparent'
                }`}
              >
                {label}
                {id === 'members' && state === 'ready' ? (
                  <span className="ml-1 tabular-nums text-[#727A88]">{formatCount(members.length)}</span>
                ) : null}
              </button>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-9 px-3 inline-flex items-center gap-1.5 bg-white border border-[#E4E7EC] rounded-xl text-[13px] font-medium text-[#15171C] hover:bg-[#F2F4F7] disabled:text-[#A3A9B4] transition-colors duration-150 ease-out"
            title="Read the figures again"
          >
            <RefreshCw size={14} strokeWidth={1.5} />
            {refreshing ? 'Reading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {state === 'loading' ? (
        <div className="space-y-4" aria-busy="true">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonBlock key={i} className="h-[104px]" />
            ))}
          </div>
          <SkeletonBlock className="h-56" />
        </div>
      ) : state === 'forbidden' ? (
        <Panel title="Analytics are for owners and admins">
          <p className="text-[13px] text-[#475061]">Your account is not an owner or admin of this community.</p>
        </Panel>
      ) : state === 'error' ? (
        <Panel title="Analytics could not be read">
          <p className="text-[13px] text-[#475061]">
            The server did not answer. No figures are shown rather than figures that may be wrong.
          </p>
        </Panel>
      ) : (
        <>
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Metric label="Members" value={formatCount(stats.totalMembers)} note="Wallets signed in with Ethereum" />
                <Metric label="Owners and admins" value={formatCount(stats.adminCount)} note="Can moderate and configure" />
                <Metric label="Channels" value={formatCount(stats.totalChannels)} note="Rooms in this community" />
                <Metric label="Posts" value={formatCount(stats.totalPosts)} note="Published with a title" />
                <Metric label="Channel messages" value={formatCount(stats.totalChannelMessages)} note="All time" />
                <Metric label="Messages, 30 days" value={formatCount(stats.channelMessages30d)} note="Channel messages" />
              </div>

              <p className="text-[12px] leading-relaxed text-[#727A88] px-1">
                Channel messages and posts are stored on the Ledger Chat server and are readable by it: they are
                not end-to-end encrypted. Direct messages use XMTP and are not counted here.
              </p>

              <Panel title="Member growth" note="Members at the end of each month, UTC. Last 12 months.">
                {growth.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-[#727A88]">No members recorded.</p>
                ) : (
                  <>
                    <div className="h-44 flex items-end gap-2 border-b border-[#E4E7EC]">
                      {growth.map((p) => {
                        const h = maxTotal > 0 ? Math.max(2, Math.round((p.total / maxTotal) * 160)) : 2;
                        return (
                          <div key={p.key} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
                            <span className="text-[11px] tabular-nums text-[#475061] mb-1">{p.total}</span>
                            <div
                              style={{ height: `${h}px` }}
                              className="w-full max-w-[36px] bg-[#15171C] rounded-t-[4px]"
                              title={`${p.label}: ${p.total} members, ${p.joined} joined`}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 mt-2">
                      {growth.map((p) => (
                        <span key={p.key} className="flex-1 min-w-0 text-center text-[11px] text-[#727A88] tabular-nums truncate">
                          {p.label}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </Panel>

              <Panel title="Recent activity" note="Community creation and the latest posts and messages.">
                {activities.length === 0 ? (
                  <p className="py-6 text-center text-[13px] text-[#727A88]">No activity recorded.</p>
                ) : (
                  <ul className="divide-y divide-[#E4E7EC]">
                    {activities.map((a) => (
                      <li key={a.id} className="flex items-baseline justify-between gap-4 py-2.5">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-[#15171C]">{a.action}</p>
                          <p className="text-[13px] text-[#727A88] truncate">{a.details}</p>
                        </div>
                        <span className="shrink-0 text-[12px] tabular-nums text-[#727A88]">{a.time}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          )}

          {activeTab === 'members' && (
            <Panel title="Members" note="Wallets in this community, oldest first.">
              <div className="relative mb-3">
                <Search size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#727A88]" />
                <input
                  type="text"
                  placeholder="Filter by address"
                  value={searchMember}
                  onChange={(e) => setSearchMember(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 bg-white border border-[#E4E7EC] rounded-xl text-[13px] font-mono text-[#15171C] outline-none focus:border-[#2754D6] transition-colors duration-150 ease-out"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-[#E4E7EC] text-[12px] text-[#727A88]">
                      <th className="py-2 pr-4 font-medium">Wallet</th>
                      <th className="py-2 pr-4 font-medium">Role</th>
                      <th className="py-2 font-medium text-right">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E7EC]">
                    {filteredMembers.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-[#727A88]">
                          {members.length === 0 ? 'No members recorded.' : 'No member matches this address.'}
                        </td>
                      </tr>
                    ) : (
                      filteredMembers.map((m) => (
                        <tr key={`${m.address}-${m.joinedAt}`}>
                          <td className="py-2.5 pr-4 font-mono text-[12px] text-[#15171C]" title={m.address}>
                            {shortAddress(m.address)}
                          </td>
                          <td className="py-2.5 pr-4 text-[#475061]">
                            {m.role === 'OWNER' ? 'Owner' : m.role === 'ADMIN' ? 'Admin' : 'Member'}
                          </td>
                          <td className="py-2.5 text-right tabular-nums text-[#727A88]">{formatDate(m.joinedAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {activeTab === 'treasury' && targetId && (
            <ZkCommunityTreasury communityId={targetId} communityName={communityName} />
          )}
        </>
      )}
    </div>
  );
}
