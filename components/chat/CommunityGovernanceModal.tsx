'use client';

/**
 * Community governance (Manage → Governance): proposals and one-member-one-vote decisions.
 *
 * V2 (27 Nov 2026): vote labels are plain JSX (no text with an open bracket), the header says
 * "Community governance", and there is no on-chain claim
 * (votes are rows on Ledger Chat's server, one per member). Every proposal shows who wrote it and
 * their role now, For / Against / Abstain with percentages, and its quorum. Owners, admins and
 * moderators can export a proposal as a Markdown draft for a forum; nothing is posted for them.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Copy, FileText, Plus, Search, Vote, X } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale, useT } from '@/lib/i18n/client';
import { RoleBadge } from '@/components/communities/MemberSheet';
import { forumDraft, isPrivilegedRole, percentages, quorumFor, PROPOSAL_DURATIONS, type CreatorRole, type EffectiveStatus, type Tally, type VoteChoice } from '@/lib/communities/governance';
import type { Rank } from '@/lib/communities/settings';

export interface CommunityGovernanceProps {
  communityId: string;
  communityName: string;
  myAddress: string;
  /** The viewer's role, when Manage already knows it; the API's callerRole is used otherwise. */
  myRank?: Rank | null;
  /** A proposal drafted elsewhere (the treasury), opened in the creation form. */
  prefillProposal?: { title: string; description: string } | null;
  onPrefillUsed?: () => void;
  onOpenAnalytics?: () => void;
}

interface Proposal {
  id: string;
  question: string;
  description: string;
  creatorAddress: string;
  creatorName?: string | null;
  creatorRole?: CreatorRole;
  createdAt: string;
  votingEndsAt: string;
  votingThreshold: number;
  votesFor: number;
  votesAgainst: number;
  votesAbstain?: number;
  totalVotes?: number;
  eligibleMembers?: number;
  myVote?: VoteChoice | null;
  effectiveStatus?: EffectiveStatus;
}

type Tab = 'all' | 'active' | 'moderators' | 'closed';
type Sort = 'newest' | 'votes' | 'ending';

const INK = '#15171c';
const INK_SOFT = '#3d424b';
const DANGER = '#c0362c';
const card = 'rounded-2xl border border-[#d4d8de] bg-white';
const btn = 'inline-flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-2xl text-[16px] font-semibold transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-[#15171c]/25 disabled:opacity-50';
const primary = `${btn} bg-[#15171c] text-white hover:bg-[#2a2d34]`;
const secondary = `${btn} border-2 border-[#15171c] bg-white text-[#15171c] hover:bg-[#f2f4f7]`;
const quiet = `${btn} text-[#15171c] hover:bg-[#f2f4f7]`;
const short = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

const TEMPLATES: Array<{ id: string; label: string; title: string; description: string }> = [
  { id: 'rule', label: 'Community rule', title: 'New rule: ', description: 'What the rule says:\n\nWhy we need it:\n\nWhen it starts:' },
  { id: 'channel', label: 'New encrypted channel', title: 'Open a channel for ', description: 'Channel name:\n\nWhat it is for:\n\nWho should be in it: every member (each channel is its own end-to-end encrypted group).' },
  { id: 'treasury', label: 'Treasury allocation', title: 'Allocate funds to ', description: 'Amount and asset:\n\nRecipient:\n\nPurpose:\n\nHow it will be reported back:' },
  { id: 'question', label: 'Open question', title: 'Should we ', description: 'The question:\n\nOptions we considered:\n\nWhat happens if it passes:' },
];

function tallyOf(p: Proposal): Tally {
  const a = p.votesAbstain ?? 0;
  return { for: p.votesFor || 0, against: p.votesAgainst || 0, abstain: a, total: p.totalVotes ?? (p.votesFor || 0) + (p.votesAgainst || 0) + a };
}

function statusOf(p: Proposal): EffectiveStatus {
  if (p.effectiveStatus) return p.effectiveStatus;
  return new Date(p.votingEndsAt).getTime() > Date.now() ? 'ACTIVE' : 'REJECTED';
}

/** "in 3 days", "2 days ago": the browser's own words for the language. */
function relative(date: string | number | Date, lang: string): string {
  const diff = new Date(date).getTime() - Date.now();
  const abs = Math.abs(diff);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [['day', 86_400_000], ['hour', 3_600_000], ['minute', 60_000]];
  try {
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
    for (const [u, ms] of units) if (abs >= ms || u === 'minute') return rtf.format(Math.round(diff / ms), u);
  } catch { /* old browser */ }
  return new Date(date).toLocaleDateString();
}

export function CommunityGovernanceView({ communityId, communityName, myAddress, myRank, prefillProposal, onPrefillUsed, onOpenAnalytics }: CommunityGovernanceProps) {
  const t = useT();
  const locale = useLocale();
  const base = `/api/chat/communities/${encodeURIComponent(communityId)}/proposals`;
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [callerRole, setCallerRole] = useState<CreatorRole | null>(null);
  const [membersCount, setMembersCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [votingId, setVotingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftFor, setDraftFor] = useState<Proposal | null>(null);

  const role: CreatorRole | null = (myRank as CreatorRole | null | undefined) ?? callerRole;
  const privileged = isPrivilegedRole(role);

  const fetchProposals = useCallback(async () => {
    try {
      const res = await fetch(base, { credentials: 'include', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setLoadError(t(typeof data?.error === 'string' && data.error.length < 160 ? data.error : 'The proposals could not be loaded. Try again.')); return; }
      setProposals(Array.isArray(data.proposals) ? data.proposals : []);
      if (data.callerRole) setCallerRole(data.callerRole);
      if (typeof data.membersCount === 'number') setMembersCount(data.membersCount);
      setLoadError('');
    } catch {
      setLoadError(t('This device could not reach the server. Check your connection and try again.'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  useEffect(() => { void fetchProposals(); }, [fetchProposals]);
  useEffect(() => { if (prefillProposal) setCreating(true); }, [prefillProposal]);

  const counts = useMemo(() => ({
    all: proposals.length,
    active: proposals.filter((p) => statusOf(p) === 'ACTIVE').length,
    moderators: proposals.filter((p) => isPrivilegedRole(p.creatorRole)).length,
    closed: proposals.filter((p) => statusOf(p) !== 'ACTIVE').length,
  }), [proposals]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return proposals
      .filter((p) => tab === 'all' || (tab === 'active' ? statusOf(p) === 'ACTIVE' : tab === 'closed' ? statusOf(p) !== 'ACTIVE' : isPrivilegedRole(p.creatorRole)))
      .filter((p) => !q || `${p.question} ${p.description} ${p.creatorName ?? ''} ${p.creatorAddress}`.toLowerCase().includes(q))
      .sort((a, b) => sort === 'votes' ? tallyOf(b).total - tallyOf(a).total
        : sort === 'ending' ? new Date(a.votingEndsAt).getTime() - new Date(b.votingEndsAt).getTime()
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [proposals, tab, query, sort]);

  const vote = async (p: Proposal, choice: VoteChoice) => {
    if (votingId) return;
    setVotingId(p.id);
    // Optimistic: the bar moves at once; the list is read again either way.
    setProposals((list) => list.map((x) => x.id !== p.id ? x : {
      ...x,
      myVote: choice,
      votesFor: x.votesFor + (choice === 'FOR' ? 1 : 0),
      votesAgainst: x.votesAgainst + (choice === 'AGAINST' ? 1 : 0),
      votesAbstain: (x.votesAbstain ?? 0) + (choice === 'ABSTAIN' ? 1 : 0),
      totalVotes: tallyOf(x).total + 1,
    }));
    try {
      const res = await fetch(base, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'VOTE', proposalId: p.id, vote: choice }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok) toast.success(t(choice === 'FOR' ? 'You voted: For' : choice === 'AGAINST' ? 'You voted: Against' : 'You voted: Abstain'));
      else toast.error(t(typeof d?.error === 'string' && d.error.length < 160 ? d.error : 'Your vote was not recorded. Try again.'));
    } catch {
      toast.error(t('This device could not reach the server. Check your connection and try again.'));
    } finally {
      setVotingId(null);
      void fetchProposals();
    }
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'all', label: t('All') }, { id: 'active', label: t('Active') }, { id: 'moderators', label: t('Moderators') }, { id: 'closed', label: t('Closed') },
  ];

  return (
    <div className="flex flex-col gap-5 pb-10">
      <header className={`${card} p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-[#15171c] lg-ink text-white flex items-center justify-center shrink-0" aria-hidden="true"><Vote size={20} strokeWidth={2} /></div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em]" style={{ color: INK_SOFT }}>{t('Community governance')}</p>
            <h2 className="text-[22px] sm:text-[24px] font-semibold tracking-tight truncate" style={{ color: INK }}>{communityName}</h2>
            <p className="text-[15px] leading-snug mt-0.5" style={{ color: INK_SOFT }}>
              {t('One member, one vote. Proposals and votes are kept by this community on Ledger Chat’s server.')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {role && <span className="text-[14px]" style={{ color: INK_SOFT }}>{t('Your role')}: <RoleBadge role={role} /></span>}
          {onOpenAnalytics && <button type="button" className={quiet} onClick={onOpenAnalytics}>{t('Analytics')}</button>}
          <button type="button" className={primary} onClick={() => setCreating(true)}><Plus size={18} aria-hidden="true" />{t('New proposal')}</button>
        </div>
      </header>

      {creating && (
        <CreateProposal
          base={base}
          role={role}
          membersCount={membersCount}
          prefill={prefillProposal ?? null}
          onClose={() => { setCreating(false); onPrefillUsed?.(); }}
          onCreated={async () => { setCreating(false); onPrefillUsed?.(); setTab('all'); await fetchProposals(); }}
        />
      )}

      <div className="flex flex-col gap-3">
        <div role="tablist" aria-label={t('Filter proposals')} className="flex flex-wrap gap-2">
          {tabs.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)}
              className={`min-h-[44px] px-4 rounded-full text-[15px] font-semibold border-2 transition-colors ${tab === x.id ? 'bg-[#15171c] lg-ink border-[#15171c] text-white' : 'bg-white border-[#d4d8de] text-[#15171c] hover:bg-[#f2f4f7]'}`}>
              {x.label} <span className="tabular-nums opacity-70">{counts[x.id]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex-1 min-w-[220px]">
            <span className="sr-only">{t('Search proposals')}</span>
            <Search size={18} aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#3d424b]" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Search proposals')}
              className="w-full min-h-[48px] rounded-2xl border-2 border-[#d4d8de] focus:border-[#15171c] outline-none pl-11 pr-4 text-[16px] bg-white" style={{ color: INK }} />
          </label>
          <label className="flex items-center gap-2 text-[15px]" style={{ color: INK_SOFT }}>
            {t('Sort')}
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="min-h-[48px] rounded-2xl border-2 border-[#d4d8de] bg-white px-3 text-[16px]" style={{ color: INK }}>
              <option value="newest">{t('Newest')}</option>
              <option value="votes">{t('Most voted')}</option>
              <option value="ending">{t('Ending soon')}</option>
            </select>
          </label>
        </div>
      </div>

      {loading && <p className="text-[17px] py-10 text-center" style={{ color: INK_SOFT }} role="status">{t('Loading…')}</p>}
      {!loading && loadError && (
        <div className={`${card} p-6 text-center`} role="alert">
          <p className="text-[17px]" style={{ color: INK }}>{loadError}</p>
          <button type="button" className={`${primary} mt-4`} onClick={() => { setLoading(true); void fetchProposals(); }}>{t('Try again')}</button>
        </div>
      )}
      {!loading && !loadError && proposals.length === 0 && (
        <div className={`${card} p-8 text-center`}>
          <p className="text-[18px] font-semibold" style={{ color: INK }}>{t('No proposals yet')}</p>
          <p className="text-[16px] mt-1" style={{ color: INK_SOFT }}>{t('Start the first decision of this community.')}</p>
        </div>
      )}
      {!loading && !loadError && proposals.length > 0 && shown.length === 0 && (
        <p className="text-[16px]" style={{ color: INK_SOFT }} role="status">{t('No proposals match this filter.')}</p>
      )}

      <ul className="flex flex-col gap-4">
        {shown.map((p) => (
          <li key={p.id}>
            <ProposalCard
              p={p}
              locale={locale}
              me={myAddress.toLowerCase()}
              expanded={!!expanded[p.id]}
              onToggle={() => setExpanded((e) => ({ ...e, [p.id]: !e[p.id] }))}
              voting={votingId === p.id}
              onVote={(c) => vote(p, c)}
              canExport={privileged}
              onExport={() => setDraftFor(p)}
            />
          </li>
        ))}
      </ul>

      {draftFor && <ForumDraft p={draftFor} communityName={communityName} onClose={() => setDraftFor(null)} />}
    </div>
  );
}

function ProposalCard({ p, locale, me, expanded, onToggle, voting, onVote, canExport, onExport }: {
  p: Proposal; locale: string; me: string; expanded: boolean; onToggle: () => void; voting: boolean;
  onVote: (c: VoteChoice) => void; canExport: boolean; onExport: () => void;
}) {
  const t = useT();
  const tl = tallyOf(p);
  const pc = percentages(tl);
  const status = statusOf(p);
  const active = status === 'ACTIVE';
  const quorum = Math.max(1, p.votingThreshold || 1);
  const reached = tl.total >= quorum;
  const long = p.description.length > 240 || p.description.split('\n').length > 3;
  const author = String(p.creatorAddress || '').toLowerCase();
  const statusText = status === 'ACTIVE' ? t('Active') : status === 'PASSED' ? t('Passed') : status === 'REJECTED' ? t('Rejected') : t('Closed without quorum');
  const statusTone = status === 'ACTIVE' ? 'bg-[#ebf7f0] text-[#157347]' : status === 'PASSED' ? 'bg-[#15171c] text-white' : 'bg-[#eff1f4] text-[#3d424b]';
  const choices: Array<{ c: VoteChoice; label: string }> = [{ c: 'FOR', label: t('For') }, { c: 'AGAINST', label: t('Against') }, { c: 'ABSTAIN', label: t('Abstain') }];

  return (
    <article className={`${card} p-5 sm:p-6 flex flex-col gap-4 ${active ? 'border-l-4 border-l-[#15171c]' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[20px] font-semibold leading-snug break-words" style={{ color: INK }}>{p.question}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[14px]" style={{ color: INK_SOFT }}>
            <span className="font-medium" style={{ color: INK }}>{author === me ? t('You') : p.creatorName || short(author)}</span>
            {p.creatorName && <span className="font-mono tabular-nums">{short(author)}</span>}
            {p.creatorRole && p.creatorRole !== 'MEMBER' && <RoleBadge role={p.creatorRole} />}
            <span>· {relative(p.createdAt, locale)}</span>
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold ${statusTone}`}>{statusText}</span>
      </div>

      <div>
        <p className={`text-[16px] leading-relaxed whitespace-pre-wrap break-words ${expanded ? '' : 'line-clamp-3'}`} style={{ color: INK }}>{p.description}</p>
        {long && (
          <button type="button" onClick={onToggle} aria-expanded={expanded} className="mt-1 min-h-[44px] text-[15px] font-semibold underline underline-offset-4" style={{ color: INK }}>
            {expanded ? t('Show less') : t('Read more')}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex h-3 w-full overflow-hidden rounded-full lg-recessed" role="img" aria-label={t('For {for}%, against {against}%, abstain {abstain}%', { for: pc.for, against: pc.against, abstain: pc.abstain })}>
          <div className="h-full bg-[#15171c] transition-[width] duration-300" style={{ width: `${pc.for}%` }} />
          <div className="h-full bg-[#c0362c] transition-[width] duration-300" style={{ width: `${pc.against}%` }} />
          <div className="h-full bg-[#d0d5dd] transition-[width] duration-300" style={{ width: `${pc.abstain}%` }} />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[15px]" style={{ color: INK }}>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#15171c]" aria-hidden="true" />{t('For')} <strong className="tabular-nums">{tl.for}</strong> <span className="tabular-nums" style={{ color: INK_SOFT }}>({pc.for}%)</span></span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#c0362c]" aria-hidden="true" />{t('Against')} <strong className="tabular-nums">{tl.against}</strong> <span className="tabular-nums" style={{ color: INK_SOFT }}>({pc.against}%)</span></span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#d0d5dd]" aria-hidden="true" />{t('Abstain')} <strong className="tabular-nums">{tl.abstain}</strong> <span className="tabular-nums" style={{ color: INK_SOFT }}>({pc.abstain}%)</span></span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[14px]" style={{ color: INK_SOFT }}>
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            {reached && <CheckCircle2 size={15} className="text-[#157347]" aria-hidden="true" />}
            {t('Quorum: {votes} / {quorum} votes', { votes: tl.total, quorum })}
          </span>
          {typeof p.eligibleMembers === 'number' && <span className="tabular-nums">· {t('{count} members can vote', { count: p.eligibleMembers })}</span>}
          <span className="inline-flex items-center gap-1"><Clock size={14} aria-hidden="true" />{active ? t('Ends {when}', { when: relative(p.votingEndsAt, locale) }) : t('Ended {when}', { when: relative(p.votingEndsAt, locale) })}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {p.myVote ? (
          <span className="inline-flex items-center gap-2 rounded-full lg-recessed px-4 min-h-[44px] text-[15px] font-semibold" style={{ color: INK }}>
            <CheckCircle2 size={16} aria-hidden="true" />{t(p.myVote === 'FOR' ? 'You voted: For' : p.myVote === 'AGAINST' ? 'You voted: Against' : 'You voted: Abstain')}
          </span>
        ) : active ? (
          choices.map(({ c, label }) => (
            <button key={c} type="button" disabled={voting} onClick={() => onVote(c)}
              className={c === 'FOR' ? primary : c === 'AGAINST' ? `${btn} border-2 border-[#c0362c] bg-white text-[#c0362c] hover:bg-[#fdeeec]` : secondary}>
              {label}
            </button>
          ))
        ) : null}
        {canExport && (
          <button type="button" className={`${quiet} ml-auto`} onClick={onExport}><FileText size={17} aria-hidden="true" />{t('Forum draft')}</button>
        )}
      </div>
    </article>
  );
}

function CreateProposal({ base, role, membersCount, prefill, onClose, onCreated }: {
  base: string; role: CreatorRole | null; membersCount: number | null; prefill: { title: string; description: string } | null;
  onClose: () => void; onCreated: () => Promise<void>;
}) {
  const t = useT();
  const [title, setTitle] = useState(prefill?.title ?? '');
  const [description, setDescription] = useState(prefill?.description ?? '');
  const [days, setDays] = useState<number>(7);
  const suggested = quorumFor(membersCount ?? 1);
  const [quorum, setQuorum] = useState<number>(suggested);
  const [official, setOfficial] = useState(false);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setQuorum(quorumFor(membersCount ?? 1)); }, [membersCount]);
  const privileged = isPrivilegedRole(role);
  const okTitle = title.trim().length >= 5 && title.trim().length <= 200;
  const okDesc = description.trim().length >= 10 && description.trim().length <= 5000;
  const roleText = role === 'OWNER' ? t('Owner') : role === 'ADMIN' ? t('Admin') : role === 'MODERATOR' ? t('Moderator') : t('Member');

  const submit = async () => {
    if (!okTitle || !okDesc || busy) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(base, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), durationDays: days, quorumCount: quorum, official: privileged && official }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(t(typeof d?.error === 'string' && d.error.length < 200 ? d.error : 'The proposal was not created. Try again.')); return; }
      toast.success(t('Proposal created. Members can vote now.'));
      await onCreated();
    } catch {
      setError(t('This device could not reach the server. Check your connection and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full rounded-2xl border-2 border-[#9aa1ac] focus:border-[#15171c] outline-none px-4 py-3 text-[17px] bg-white';
  const pill = (on: boolean) => `min-h-[44px] px-4 rounded-full text-[15px] font-semibold border-2 ${on ? 'bg-[#15171c] border-[#15171c] text-white' : 'bg-white border-[#d4d8de] text-[#15171c] hover:bg-[#f2f4f7]'}`;
  return (
    <section className={`${card} p-5 sm:p-6 flex flex-col gap-4`} aria-label={t('New proposal')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[20px] font-semibold" style={{ color: INK }}>{t('New proposal')}</h3>
          <p className="text-[15px] mt-0.5" style={{ color: INK_SOFT }}>
            {t('You propose as {role}.', { role: roleText })} {privileged ? t('Your proposal is marked with your role.') : t('Any member can propose; owners, admins and moderators are marked.')}
          </p>
        </div>
        <button type="button" className={`${quiet} px-3`} onClick={onClose} aria-label={t('Close')}><X size={18} aria-hidden="true" /></button>
      </div>

      <div className="flex flex-wrap gap-2" aria-label={t('Start from')}>
        {TEMPLATES.map((x) => (
          <button key={x.id} type="button" className={pill(false)} onClick={() => { setTitle(t(x.title)); setDescription(t(x.description)); }}>{t(x.label)}</button>
        ))}
      </div>

      <div className="flex gap-2" role="tablist">
        <button type="button" role="tab" aria-selected={!preview} className={pill(!preview)} onClick={() => setPreview(false)}>{t('Write')}</button>
        <button type="button" role="tab" aria-selected={preview} className={pill(preview)} onClick={() => setPreview(true)}>{t('Preview')}</button>
      </div>

      {preview ? (
        <div className="rounded-2xl border border-dashed border-[#9aa1ac] p-4">
          <p className="text-[19px] font-semibold break-words" style={{ color: INK }}>{title.trim() || t('Title')}</p>
          <p className="mt-2 text-[16px] whitespace-pre-wrap break-words" style={{ color: INK }}>{description.trim() || t('Description')}</p>
        </div>
      ) : (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-[16px] font-semibold" style={{ color: INK }}>{t('Title')}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={field} style={{ color: INK }} />
            <span className="text-[13px] tabular-nums" style={{ color: okTitle || !title ? INK_SOFT : DANGER }}>{t('{count} / 200 · at least 5', { count: title.trim().length })}</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[16px] font-semibold" style={{ color: INK }}>{t('Description')}</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} rows={6} className={`${field} resize-y`} style={{ color: INK }} />
            <span className="text-[13px] tabular-nums" style={{ color: okDesc || !description ? INK_SOFT : DANGER }}>{t('{count} / 5000 · at least 10', { count: description.trim().length })}</span>
          </label>
        </>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[16px] font-semibold" style={{ color: INK }}>{t('Voting time')}</span>
        <div className="flex flex-wrap gap-2">
          {PROPOSAL_DURATIONS.map((d) => (
            <button key={d} type="button" aria-pressed={days === d} className={pill(days === d)} onClick={() => setDays(d)}>{t('{days} days', { days: d })}</button>
          ))}
        </div>
      </div>
      <label className="flex flex-wrap items-center gap-3">
        <span className="text-[16px] font-semibold" style={{ color: INK }}>{t('Quorum (votes needed)')}</span>
        <input type="number" min={1} max={500} value={quorum} onChange={(e) => setQuorum(Math.min(500, Math.max(1, Math.floor(Number(e.target.value) || 1))))}
          className="w-28 min-h-[48px] rounded-2xl border-2 border-[#9aa1ac] px-3 text-[17px] tabular-nums bg-white" style={{ color: INK }} />
        {membersCount !== null && <span className="text-[14px]" style={{ color: INK_SOFT }}>{t('Suggested: {count} (a quarter of {members} members)', { count: suggested, members: membersCount })}</span>}
      </label>
      {privileged && (
        <label className="flex items-center gap-3 min-h-[44px] text-[16px]" style={{ color: INK }}>
          <input type="checkbox" checked={official} onChange={(e) => setOfficial(e.target.checked)} className="w-5 h-5 accent-[#15171c]" />
          {t('Publish as a moderators’ proposal')}
        </label>
      )}
      {error && <p role="alert" className="text-[16px]" style={{ color: DANGER }}>{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={quiet} onClick={onClose}>{t('Cancel')}</button>
        <button type="button" className={primary} disabled={!okTitle || !okDesc || busy} onClick={submit}>{busy ? t('Publishing…') : t('Publish proposal')}</button>
      </div>
    </section>
  );
}

function ForumDraft({ p, communityName, onClose }: { p: Proposal; communityName: string; onClose: () => void }) {
  const t = useT();
  const md = useMemo(() => forumDraft({ title: p.question, description: p.description, createdAt: p.createdAt, votingEndsAt: p.votingEndsAt }, tallyOf(p), communityName, statusOf(p)), [p, communityName]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="lg-scrim fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t('Forum draft')} onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[88dvh] flex flex-col lg-sheet rounded-t-3xl sm:rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#d4d8de]">
          <div className="min-w-0">
            <p className="text-[18px] font-semibold" style={{ color: INK }}>{t('Forum draft')}</p>
            <p className="text-[14px]" style={{ color: INK_SOFT }}>{t('Markdown for forum.aztec.network or any forum. Nothing is posted for you.')}</p>
          </div>
          <button type="button" className={`${quiet} px-3`} onClick={onClose} aria-label={t('Close')}><X size={18} aria-hidden="true" /></button>
        </div>
        <pre className="flex-1 overflow-auto px-5 py-4 font-mono text-[13px] leading-[1.6] whitespace-pre-wrap break-words lg-canvas" style={{ color: INK }}>{md}</pre>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#d4d8de]">
          <button type="button" className={primary} onClick={() => navigator.clipboard?.writeText(md).then(() => toast.success(t('Copied.')), () => toast.error(t('Not copied. Select the text and copy it.')))}>
            <Copy size={17} aria-hidden="true" />{t('Copy Markdown')}
          </button>
        </div>
      </div>
    </div>
  );
}
