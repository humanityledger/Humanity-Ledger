'use client';

/**
 * Community analytics for owners and admins (Manage → Analytics).
 *
 * Two sources, always named on screen:
 * - Server: GET /api/chat/communities/[id]/analytics reads the database (members, roles, joins,
 *   proposals and, for a legacy community, its posts). A figure it could not read is "—", never 0.
 * - This device: in an encrypted (MLS) community the server holds no posts, so activity is computed
 *   here from the channels this admin's device can decrypt, in memory, and never uploaded.
 *
 * Charts are plain SVG (no chart library): one ink, the Ledger blue for the current or highlighted
 * value, greys for the rest. Every mark has a <title> for hover and screen readers, and every
 * chart has an empty state. Nothing comes from localStorage and nothing is estimated.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import {
  activeUniqueAddresses, activityByDay, formatCount, generateOperationalInsights, hourlyActivityMatrix, periodGrowthPct,
  toCsv, topContributors, type Contributor, type DayCount, type GrowthPoint,
} from '@/lib/communities/analytics';
import { isControlMessage } from '@/lib/communities/media-index';
import { readGroupPosts } from '@/lib/communities/mls';
import { resolveInboxIdToAddress } from '@/lib/xmtp/client';
import { ZkCommunityTreasury } from '@/components/zk/ZkCommunityTreasury';
import { useT } from '@/lib/i18n/client';

interface MemberItem { address: string; role: string; joinedAt: string; isZkVerified?: boolean }
interface ChannelItem { id: string; name: string; xmtpGroupId?: string | null }
interface AnalyticsResponse {
  community?: { id: string; name: string; createdAt?: string; ownerAddress?: string; communityMls?: boolean };
  stats?: { totalMembers?: number | null; adminCount?: number | null; totalChannels?: number | null; totalPosts?: number | null; totalChannelMessages?: number | null; channelMessages30d?: number | null };
  growthData?: GrowthPoint[];
  members?: MemberItem[];
  channels?: ChannelItem[];
  dailyActivity14d?: DayCount[] | null;
  roleBreakdown?: Record<'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER', number>;
  activeProposalsCount?: number | null;
  verifiedMembersCount?: number | null;
  channelPostCounts?: Record<string, number> | null;
}

/** What the admin's device read from the encrypted channels. */
interface LocalActivity {
  posts: Array<{ authorAddress: string; createdAt: number; channelId: string }>;
  channelCounts: Record<string, number>;
  failedChannels: number;
}

export interface CommunityAnalyticsProps {
  communityId?: string;
  community?: { id?: string; name?: string } | null;
  /** The signed-in XMTP client: with it, an encrypted community's activity is read on this device. */
  xmtpClient?: any;
  myAddress?: string;
  /** Hands a drafted treasury proposal to Governance. */
  onDraftProposal?: (p: { title: string; description: string }) => void;
}

type LoadState = 'loading' | 'ready' | 'forbidden' | 'error';
type Tab = 'overview' | 'members' | 'channels' | 'treasury';

const INK = '#15171c';
const INK_2 = '#475061';
const INK_3 = '#727a88';
const GRID = '#e4e7ec';
const ACCENT = '#2754d6';
const MUTED = '#d0d5dd';
const cardCls = 'rounded-2xl border border-[#e4e7ec] bg-white shadow-[var(--hl-shadow-xs)] p-6 min-h-[240px] flex flex-col gap-3';
const DRAW = `@keyframes hl-draw{from{stroke-dashoffset:1200}to{stroke-dashoffset:0}}@keyframes hl-rise{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion:reduce){.hl-anim{animation:none!important}}`;

function short(a: string): string { return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a; }

/** A smooth path through points (Catmull-Rom as cubic Bézier), clamped so it never overshoots the axis. */
function smoothPath(pts: Array<[number, number]>, floor: number): string {
  if (!pts.length) return '';
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1y = Math.min(floor, p1[1] + (p2[1] - p0[1]) / 6), c2y = Math.min(floor, p2[1] - (p3[1] - p1[1]) / 6);
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${c1y} ${p2[0] - (p3[0] - p1[0]) / 6},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / p) * p;
}

function Empty({ text }: { text: string }) {
  return <div className="flex-1 min-h-[150px] flex items-center justify-center rounded-xl border border-dashed border-[#d0d5dd] text-[14px]" style={{ color: INK_3 }}>{text}</div>;
}

function Legend({ items }: { items: Array<{ color: string; label: string }> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]" style={{ color: INK_2 }}>
      {items.map((i) => <span key={i.label} className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: i.color }} aria-hidden="true" />{i.label}</span>)}
    </div>
  );
}

/** Cumulative members per day for the last 30 days, as a smooth area. */
function GrowthAreaSvg({ series, title, empty, legend }: { series: Array<{ label: string; total: number }>; title: string; empty: string; legend: string }) {
  if (!series.length || series.every((s) => s.total === 0)) return <Empty text={empty} />;
  const W = 400, H = 200, L = 34, R = 8, T = 10, B = 24;
  const max = niceMax(Math.max(...series.map((s) => s.total)));
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, series.length - 1);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const pts = series.map((s, i) => [x(i), y(s.total)] as [number, number]);
  const line = smoothPath(pts, H - B);
  const area = `${line} L${x(series.length - 1)},${H - B} L${x(0)},${H - B} Z`;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={title}>
        <title>{title}</title>
        <style>{DRAW}</style>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke={GRID} strokeWidth={1} />
            <text x={L - 6} y={y(max * f) + 4} textAnchor="end" fontSize={11} fontFamily="sans-serif" fill={INK_3}>{Math.round(max * f)}</text>
          </g>
        ))}
        <path d={area} fill="rgba(39,84,214,0.08)" className="hl-anim" style={{ animation: 'hl-rise .6s ease both' }} />
        <path d={line} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" className="hl-anim" style={{ strokeDasharray: 1200, animation: 'hl-draw .6s ease both' }} />
        {series.map((s, i) => (i % 7 === 0 || i === series.length - 1) && (
          <text key={s.label} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle'} fontSize={11} fontFamily="sans-serif" fill={INK_3}>{s.label}</text>
        ))}
        {series.map((s, i) => (
          <rect key={`h${s.label}`} x={x(i) - (W - L - R) / series.length / 2} y={T} width={(W - L - R) / series.length} height={H - T - B} fill="transparent">
            <title>{`${s.label}: ${s.total}`}</title>
          </rect>
        ))}
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={4} fill={ACCENT} stroke="#fff" strokeWidth={2} />
      </svg>
      <Legend items={[{ color: ACCENT, label: legend }]} />
    </>
  );
}

/** Messages per day, today in the accent colour. */
function DailyBarsSvg({ days, title, empty, legend, todayLabel }: { days: DayCount[]; title: string; empty: string; legend: string; todayLabel: string }) {
  if (!days.length || days.every((d) => d.count === 0)) return <Empty text={empty} />;
  const W = 400, H = 200, L = 30, R = 4, T = 10, B = 24;
  const max = niceMax(Math.max(...days.map((d) => d.count)));
  const slot = (W - L - R) / days.length, bw = Math.max(4, slot - 4);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={title}>
        <title>{title}</title>
        <style>{DRAW}</style>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke={GRID} strokeWidth={1} />
            <text x={L - 6} y={y(max * f) + 4} textAnchor="end" fontSize={11} fontFamily="sans-serif" fill={INK_3}>{Math.round(max * f)}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const h = (H - T - B) * (d.count / max);
          const today = i === days.length - 1;
          return (
            <g key={d.key} className="hl-anim" style={{ animation: 'hl-rise .6s ease both' }}>
              <rect x={L + i * slot + (slot - bw) / 2} y={H - B - h} width={bw} height={Math.max(h, d.count ? 2 : 0)} rx={Math.min(4, bw / 2)} fill={today ? ACCENT : INK}>
                <title>{`${d.label}: ${d.count}`}</title>
              </rect>
              {(i % 3 === 0 || today) && <text x={L + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize={11} fontFamily="sans-serif" fill={INK_3}>{today ? todayLabel : d.label}</text>}
            </g>
          );
        })}
      </svg>
      <Legend items={[{ color: INK, label: legend }, { color: ACCENT, label: todayLabel }]} />
    </>
  );
}

/** Active (posted in 7 days) against dormant members, as a two-segment ring. */
function EngagementDonutSvg({ active, total, title, activeLabel, dormantLabel, empty }: { active: number; total: number; title: string; activeLabel: string; dormantLabel: string; empty: string }) {
  if (!total) return <Empty text={empty} />;
  const a = Math.min(active, total), r = 64, c = 2 * Math.PI * r, frac = a / total;
  return (
    <>
      <svg viewBox="0 0 400 200" className="w-full h-auto" role="img" aria-label={title}>
        <title>{title}</title>
        <style>{DRAW}</style>
        <circle cx={200} cy={100} r={r} fill="none" stroke={MUTED} strokeWidth={18}><title>{`${dormantLabel}: ${total - a}`}</title></circle>
        {a > 0 && (
          <circle cx={200} cy={100} r={r} fill="none" stroke={ACCENT} strokeWidth={18} strokeLinecap="butt" transform="rotate(-90 200 100)"
            strokeDasharray={`${c * frac} ${c}`} className="hl-anim" style={{ animation: 'hl-rise .6s ease both' }}>
            <title>{`${activeLabel}: ${a}`}</title>
          </circle>
        )}
        <text x={200} y={100} textAnchor="middle" fontSize={28} fontWeight={600} fontFamily="sans-serif" fill={INK}>{Math.round(frac * 100)}%</text>
        <text x={200} y={122} textAnchor="middle" fontSize={11} fontFamily="sans-serif" fill={INK_3}>{`${a} / ${total}`}</text>
      </svg>
      <Legend items={[{ color: ACCENT, label: `${activeLabel} · ${a}` }, { color: MUTED, label: `${dormantLabel} · ${total - a}` }]} />
    </>
  );
}

/** 7 × 24 grid of activity, darker = more. */
function ActivityHeatmapSvg({ matrix, days, title, empty, note }: { matrix: number[][]; days: string[]; title: string; empty: string; note: string }) {
  const max = Math.max(0, ...matrix.flat());
  if (!max) return <Empty text={empty} />;
  const W = 400, H = 200, L = 34, T = 6, B = 20, cw = (W - L - 4) / 24, ch = (H - T - B) / 7;
  const shade = (v: number) => (v === 0 ? '#f2f4f7' : `rgba(21,23,28,${0.15 + 0.85 * (v / max)})`);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={title}>
        <title>{title}</title>
        {matrix.map((row, d) => (
          <g key={d}>
            <text x={L - 6} y={T + d * ch + ch / 2 + 4} textAnchor="end" fontSize={11} fontFamily="sans-serif" fill={INK_3}>{days[d]}</text>
            {row.map((v, h) => (
              <rect key={h} x={L + h * cw + 1} y={T + d * ch + 1} width={cw - 2} height={ch - 2} rx={2} fill={shade(v)}>
                <title>{`${days[d]} ${String(h).padStart(2, '0')}:00 UTC: ${v}`}</title>
              </rect>
            ))}
          </g>
        ))}
        {[0, 6, 12, 18, 23].map((h) => <text key={h} x={L + h * cw + cw / 2} y={H - 5} textAnchor="middle" fontSize={11} fontFamily="sans-serif" fill={INK_3}>{String(h).padStart(2, '0')}</text>)}
      </svg>
      <p className="text-[12.5px]" style={{ color: INK_3 }}>{note}</p>
    </>
  );
}

function TopContributorsList({ list, empty, nameFor }: { list: Contributor[]; empty: string; nameFor?: (a: string) => string | undefined }) {
  if (!list.length) return <Empty text={empty} />;
  const max = list[0].count || 1;
  return (
    <ol className="flex flex-col gap-3">
      {list.map((c, i) => (
        <li key={c.address} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className="truncate" style={{ color: INK }}><span className="tabular-nums mr-2" style={{ color: INK_3 }}>{i + 1}</span>{nameFor?.(c.address) || c.label}</span>
            <span className="tabular-nums font-semibold" style={{ color: INK }}>{c.count}</span>
          </div>
          <div className="h-1.5 rounded-full lg-recessed overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(c.count / max) * 100}%`, background: i === 0 ? ACCENT : INK }} /></div>
        </li>
      ))}
    </ol>
  );
}

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'members', label: 'Members' },
  { id: 'channels', label: 'Channels' },
  { id: 'treasury', label: 'Treasury' },
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Members at the end of each of the last 30 days (UTC), from their join dates. */
function cumulativeMembers(members: ReadonlyArray<MemberItem>, now = Date.now()): Array<{ label: string; total: number }> {
  const joins = members.map((m) => new Date(m.joinedAt).getTime()).filter(Number.isFinite).sort((a, b) => a - b);
  const days = activityByDay([], 30, now);
  let i = 0;
  return days.map((d) => {
    const end = Date.parse(`${d.key}T23:59:59.999Z`);
    while (i < joins.length && joins[i] <= end) i++;
    return { label: d.label, total: i };
  });
}

/** Reads every encrypted channel on this device and keeps only who wrote, when, and where. */
async function readLocalActivity(client: any, channels: ChannelItem[]): Promise<LocalActivity> {
  const senders = new Map<string, string>();
  const posts: LocalActivity['posts'] = [];
  const channelCounts: Record<string, number> = {};
  let failedChannels = 0;
  for (const ch of channels) {
    if (!ch.xmtpGroupId) continue;
    try {
      const list = await readGroupPosts(client, ch.xmtpGroupId);
      let n = 0;
      for (const m of list) {
        if (isControlMessage(m.content)) continue;
        let a = senders.get(m.senderInboxId);
        if (a === undefined) {
          a = String((await resolveInboxIdToAddress(m.senderInboxId, client).catch(() => null)) ?? '').toLowerCase();
          senders.set(m.senderInboxId, a);
        }
        if (!a) continue;
        posts.push({ authorAddress: a, createdAt: m.createdAt, channelId: ch.id });
        n++;
      }
      channelCounts[ch.id] = n;
    } catch {
      failedChannels++;
    }
  }
  return { posts, channelCounts, failedChannels };
}

function downloadCsv(name: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export default function CommunityAnalytics({ communityId, community: initialCommunity, xmtpClient, onDraftProposal }: CommunityAnalyticsProps) {
  const t = useT();
  const targetId = communityId || initialCommunity?.id || '';
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [tab, setTab] = useState<Tab>('overview');
  const [query, setQuery] = useState('');
  const [local, setLocal] = useState<LocalActivity | null>(null);
  const [localState, setLocalState] = useState<'idle' | 'reading' | 'done' | 'unavailable'>('idle');

  const load = useCallback(async () => {
    if (!targetId) return;
    setState((s) => (s === 'ready' ? 'ready' : 'loading'));
    try {
      const res = await fetch(`/api/chat/communities/${encodeURIComponent(targetId)}/analytics`, { credentials: 'include', cache: 'no-store' });
      if (res.status === 403) { setState('forbidden'); return; }
      if (!res.ok) { setState('error'); return; }
      setData(await res.json());
      setState('ready');
    } catch {
      setState('error');
    }
  }, [targetId]);
  useEffect(() => { void load(); }, [load]);

  const isMls = data?.community?.communityMls === true;
  const channels = useMemo(() => (data?.channels ?? []).map((c) => ({ id: c.id, name: c.name, xmtpGroupId: c.xmtpGroupId ?? null })), [data]);
  const channelKey = channels.map((c) => `${c.id}:${c.xmtpGroupId ?? ''}`).join('|');

  // Encrypted community: read the channels here, in memory, never uploaded.
  useEffect(() => {
    if (!isMls) return;
    if (!xmtpClient) { setLocalState('unavailable'); return; }
    let live = true;
    setLocalState('reading');
    readLocalActivity(xmtpClient, channels)
      .then((r) => { if (live) { setLocal(r); setLocalState('done'); } })
      .catch(() => { if (live) setLocalState('unavailable'); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMls, xmtpClient, channelKey]);

  const members = useMemo(() => data?.members ?? [], [data]);
  const totalMembers = data?.stats?.totalMembers ?? null;
  const posts = local?.posts ?? null;
  const daily: DayCount[] | null = posts ? activityByDay(posts.map((p) => p.createdAt), 14) : data?.dailyActivity14d ?? null;
  const postsWeek = daily ? daily.slice(-7).reduce((n, d) => n + d.count, 0) : null;
  const active7d = posts ? activeUniqueAddresses(posts, 7) : null;
  const activeToday = posts ? activeUniqueAddresses(posts, 1) : null;
  const growthPct = periodGrowthPct(data?.growthData ?? []);
  const growthSeries = useMemo(() => cumulativeMembers(members), [members]);
  const contributors = useMemo(() => (posts ? topContributors(posts, 5) : []), [posts]);
  const heat = useMemo(() => (posts ? hourlyActivityMatrix(posts.map((p) => p.createdAt)) : null), [posts]);
  const channelCounts: Record<string, number> | null = local?.channelCounts ?? data?.channelPostCounts ?? null;
  const lastByChannel = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of posts ?? []) m[p.channelId] = Math.max(m[p.channelId] ?? 0, p.createdAt);
    return m;
  }, [posts]);
  const insights = useMemo(() => generateOperationalInsights({
    totalMembers, active7d, growthPct, daily,
    channels: channels.map((c) => ({ name: c.name, count: channelCounts ? channelCounts[c.id] ?? 0 : null })),
    activeProposals: data?.activeProposalsCount ?? null,
  }), [totalMembers, active7d, growthPct, daily, channels, channelCounts, data]);

  const shownMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => !q || m.address.toLowerCase().includes(q) || m.role.toLowerCase().includes(q));
  }, [members, query]);

  const source = isMls
    ? localState === 'done' ? t('Computed on this device from the encrypted channels. Nothing was sent to the server.')
      : localState === 'reading' ? t('Reading the encrypted channels on this device…')
      : t('Activity in an encrypted community is only readable on a member’s device. Open this page where your encrypted messaging is connected.')
    : t('Read from the server database.');

  if (!targetId) return null;
  if (state === 'loading' && !data) return <p className="text-[16px] py-10 text-center" style={{ color: INK_3 }} role="status">{t('Loading…')}</p>;
  if (state === 'forbidden') return <p className="text-[16px] py-10 text-center" style={{ color: INK }} role="alert">{t('Only the owner and admins see analytics.')}</p>;
  if (state === 'error' && !data) {
    return (
      <div className="py-10 text-center" role="alert">
        <p className="text-[16px]" style={{ color: INK }}>{t('Analytics could not load. Check your connection and try again.')}</p>
        <button type="button" onClick={load} className="mt-4 min-h-[48px] px-5 rounded-2xl bg-[#15171c] lg-ink text-white text-[16px] font-semibold">{t('Try again')}</button>
      </div>
    );
  }

  const summary: Array<{ value: string; label: string }> = [
    { value: formatCount(totalMembers), label: t('members') },
    { value: formatCount(postsWeek), label: t('messages this week') },
    { value: growthPct === null ? '—' : `${growthPct > 0 ? '+' : ''}${growthPct}%`, label: t('growth this month') },
    { value: formatCount(activeToday), label: t('active today') },
  ];
  const toneCls = { positive: 'border-l-[#157347]', attention: 'border-l-[#8f5b00]', neutral: 'border-l-[#d0d5dd]' } as const;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[22px] font-semibold" style={{ color: INK }}>{t('Analytics')}</h2>
          <p className="text-[14px] mt-0.5" style={{ color: INK_3 }}>{data?.community?.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 lg-recessed border border-[#e4e7ec] rounded-xl" role="tablist" aria-label={t('Analytics sections')}>
            {TABS.map((x) => (
              <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)}
                className={`min-h-[40px] px-3.5 rounded-lg text-[14px] font-medium transition-colors ${tab === x.id ? 'bg-white text-[#15171c] shadow-[var(--hl-shadow-xs)]' : 'text-[#475061] hover:text-[#15171c]'}`}>
                {t(x.label)}
              </button>
            ))}
          </div>
          <button type="button" onClick={load} aria-label={t('Refresh')} title={t('Refresh')} className="min-h-[44px] min-w-[44px] grid place-items-center rounded-xl border border-[#e4e7ec] hover:bg-[#f2f4f7]" style={{ color: INK }}>
            <RefreshCw size={17} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summary.map((s) => (
          <div key={s.label} className="rounded-2xl lg-card px-5 py-4">
            <div className="text-[28px] font-bold tabular-nums tracking-tight leading-none" style={{ color: INK }}>{s.value}</div>
            <div className="text-[14px] mt-1.5" style={{ color: INK_2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <p className={`rounded-xl border px-4 py-2.5 text-[13.5px] ${isMls && localState !== 'done' ? 'border-[#e4e7ec] lg-recessed' : 'border-[#e4e7ec] bg-white'}`} style={{ color: INK_2 }} role="note">
        {source}{local?.failedChannels ? ` ${t('{count} channels could not be read on this device.', { count: local.failedChannels })}` : ''}
      </p>

      {tab === 'overview' && (
        <>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
            <section className={cardCls}>
              <h3 className="text-[16px] font-semibold" style={{ color: INK }}>{t('Members over the last 30 days')}</h3>
              <GrowthAreaSvg series={growthSeries} title={t('Members over the last 30 days')} empty={t('No data yet')} legend={t('Members (cumulative)')} />
            </section>
            <section className={cardCls}>
              <h3 className="text-[16px] font-semibold" style={{ color: INK }}>{t('Messages per day · 14 days')}</h3>
              {daily ? <DailyBarsSvg days={daily} title={t('Messages per day · 14 days')} empty={t('No data yet')} legend={t('Messages')} todayLabel={t('Today')} /> : <Empty text={t('Not available from this source')} />}
            </section>
            <section className={cardCls}>
              <h3 className="text-[16px] font-semibold" style={{ color: INK }}>{t('Active members · 7 days')}</h3>
              {active7d !== null && typeof totalMembers === 'number'
                ? <EngagementDonutSvg active={active7d} total={totalMembers} title={t('Active members · 7 days')} activeLabel={t('Active')} dormantLabel={t('Not active')} empty={t('No data yet')} />
                : <Empty text={t('Not available from this source')} />}
            </section>
            <section className={cardCls}>
              <h3 className="text-[16px] font-semibold" style={{ color: INK }}>{t('Top contributors')}</h3>
              {posts ? <TopContributorsList list={contributors} empty={t('No data yet')} /> : <Empty text={t('Not available from this source')} />}
            </section>
            <section className={cardCls}>
              <h3 className="text-[16px] font-semibold" style={{ color: INK }}>{t('When people write')}</h3>
              {heat ? <ActivityHeatmapSvg matrix={heat} days={WEEKDAYS.map((d) => t(d))} title={t('When people write')} empty={t('No data yet')} note={t('Hours in UTC. Darker means more messages.')} /> : <Empty text={t('Not available from this source')} />}
            </section>
            <section className={cardCls}>
              <h3 className="text-[16px] font-semibold" style={{ color: INK }}>{t('Messages by channel')}</h3>
              {channelCounts && Object.values(channelCounts).some((n) => n > 0) ? (
                <ul className="flex flex-col gap-3">
                  {channels.map((c) => {
                    const n = channelCounts[c.id] ?? 0, all = Object.values(channelCounts).reduce((a, b) => a + b, 0) || 1;
                    return (
                      <li key={c.id} className="flex flex-col gap-1">
                        <div className="flex justify-between text-[14px]"><span style={{ color: INK }}>#{c.name}</span><span className="tabular-nums" style={{ color: INK_2 }}>{n} · {Math.round((n / all) * 100)}%</span></div>
                        <div className="h-1.5 rounded-full lg-recessed overflow-hidden"><div className="h-full rounded-full bg-[#15171c]" style={{ width: `${(n / all) * 100}%` }} /></div>
                      </li>
                    );
                  })}
                </ul>
              ) : <Empty text={channelCounts ? t('No data yet') : t('Not available from this source')} />}
            </section>
          </div>
          {insights.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-[16px] font-semibold" style={{ color: INK }}>{t('What stands out')}</h3>
              <ul className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
                {insights.map((i) => (
                  <li key={i.id} className={`rounded-xl border border-[#e4e7ec] border-l-4 ${toneCls[i.tone]} bg-white px-4 py-3`}>
                    <p className="text-[15px] font-semibold" style={{ color: INK }}>{t(i.title, i.vars)}</p>
                    <p className="text-[13.5px] mt-0.5" style={{ color: INK_2 }}>{i.detail === '{names}' ? String(i.vars.names) : t(i.detail, i.vars)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {tab === 'members' && (
        <section className="rounded-2xl lg-card p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex-1 min-w-[220px]">
              <span className="sr-only">{t('Search members')}</span>
              <Search size={17} aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#727a88]" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Search by wallet or role')}
                className="w-full min-h-[44px] rounded-xl border border-[#d0d5dd] pl-10 pr-3 text-[15px] outline-none focus:border-[#15171c]" style={{ color: INK }} />
            </label>
            <button type="button" className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-[#d0d5dd] text-[14px] font-medium hover:bg-[#f2f4f7]" style={{ color: INK }}
              onClick={() => downloadCsv(`members-${targetId.slice(0, 8)}.csv`, toCsv([['wallet', 'role', 'joined', 'verified'], ...members.map((m) => [m.address, m.role, m.joinedAt, m.isZkVerified ? 'yes' : 'no'])]))}>
              <Download size={16} aria-hidden="true" />{t('Export CSV')}
            </button>
          </div>
          {data?.roleBreakdown && (
            <p className="text-[14px] tabular-nums" style={{ color: INK_2 }}>
              {t('{owner} owner · {admins} admins · {mods} moderators · {members} members · {verified} verified', { owner: data.roleBreakdown.OWNER, admins: data.roleBreakdown.ADMIN, mods: data.roleBreakdown.MODERATOR, members: data.roleBreakdown.MEMBER, verified: formatCount(data.verifiedMembersCount) })}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead><tr className="border-b border-[#e4e7ec]" style={{ color: INK_3 }}>
                <th className="py-2 pr-3 font-medium">{t('Wallet')}</th><th className="py-2 pr-3 font-medium">{t('Role')}</th><th className="py-2 pr-3 font-medium">{t('Verified')}</th><th className="py-2 text-right font-medium">{t('Joined')}</th>
              </tr></thead>
              <tbody>
                {shownMembers.map((m) => (
                  <tr key={m.address} className="border-b border-[#f2f4f7]">
                    <td className="py-2.5 pr-3 font-mono text-[13px]" style={{ color: INK }}>{short(m.address)}</td>
                    <td className="py-2.5 pr-3" style={{ color: INK_2 }}>{t(m.role === 'ADMIN' ? 'Admin' : m.role === 'MODERATOR' ? 'Moderator' : m.role === 'OWNER' ? 'Owner' : 'Member')}</td>
                    <td className="py-2.5 pr-3">{m.isZkVerified ? <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[#157347]"><ShieldCheck size={14} aria-hidden="true" />{t('ZK verified')}</span> : <span style={{ color: INK_3 }}>—</span>}</td>
                    <td className="py-2.5 text-right tabular-nums" style={{ color: INK_3 }}>{new Date(m.joinedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shownMembers.length === 0 && <p className="py-6 text-center text-[14px]" style={{ color: INK_3 }}>{t('No members match.')}</p>}
          </div>
        </section>
      )}

      {tab === 'channels' && (
        <section className="rounded-2xl lg-card p-5 overflow-x-auto">
          <table className="w-full text-left text-[14px]">
            <thead><tr className="border-b border-[#e4e7ec]" style={{ color: INK_3 }}>
              <th className="py-2 pr-3 font-medium">{t('Channel')}</th><th className="py-2 pr-3 font-medium text-right">{t('Messages')}</th><th className="py-2 pr-3 font-medium">{t('Health')}</th><th className="py-2 font-medium">{t('Encryption')}</th>
            </tr></thead>
            <tbody>
              {channels.map((c) => {
                const n = channelCounts ? channelCounts[c.id] ?? 0 : null;
                const last = lastByChannel[c.id];
                const health = n === null ? '—' : n === 0 ? t('Dormant') : posts ? (last && Date.now() - last < 7 * 86_400_000 ? t('Active') : t('Quiet')) : t('Has messages');
                return (
                  <tr key={c.id} className="border-b border-[#f2f4f7]">
                    <td className="py-2.5 pr-3 font-medium" style={{ color: INK }}>#{c.name}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums" style={{ color: INK }}>{formatCount(n)}</td>
                    <td className="py-2.5 pr-3" style={{ color: INK_2 }}>{health}</td>
                    <td className="py-2.5" style={{ color: INK_2 }}>{c.xmtpGroupId ? t('End-to-end encrypted') : t('Server')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-[13px]" style={{ color: INK_3 }}>{t('Active: messages in the last 7 days. Quiet: older messages only. Dormant: no messages.')}</p>
        </section>
      )}

      {tab === 'treasury' && (
        <ZkCommunityTreasury communityId={targetId} communityName={data?.community?.name || initialCommunity?.name || ''} isAdmin onDraftProposal={onDraftProposal} />
      )}
    </div>
  );
}
