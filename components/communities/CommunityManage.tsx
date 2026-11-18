'use client';

/**
 * components/communities/CommunityManage.tsx
 *
 * Manage, for one community. It is the reading screen's sibling: the same type,
 * cards, borders, 18px text and 48px targets (components/communities/CommunityReader.tsx).
 * It replaces the old community surface (tabs Posts, Chat, Apps and More, the
 * "Chat & Channels" row, View Members, Search messages, Pinned Messages and the
 * extra "Write a post" buttons), which is deleted. The settings of a community
 * are this screen.
 *
 * One row, one job. Every row is an action the community already had, wired to
 * the API it already used. Nothing is added:
 *   Pinned posts        GET /api/chat/communities/:id/posts?pinned=1, PATCH PIN_MESSAGE / UNPIN_MESSAGE
 *   Members             GET, POST, PATCH, DELETE /api/chat/communities/:id/members
 *   Invite              the join link from GET /api/chat/communities/:id (members only)
 *   Name and description, Privacy and discovery   PATCH /api/chat/communities/:id
 *   Channels            PATCH /api/chat/communities CREATE_CHANNEL / DELETE_CHANNEL
 *   Permissions, Moderation and slow mode          PATCH /api/chat/communities UPDATE_PERMISSIONS
 *   Apps, Analytics, Governance                    the screens that already existed
 *   Leave               DELETE /api/chat/communities/:id/members (yourself)
 *   Delete              DELETE /api/chat/communities/:id (owner only)
 * Rows for admins are hidden from everyone else. There is no switch for
 * communityMls: it stays false and posts stay readable by the server. The first
 * screen shows no hash and no contract address.
 */

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { communityInviteUrl } from '@/lib/ui/format';
import { authorLabel, postText, VISIBILITY_SENTENCE, type ReaderPost } from './CommunityReader';

const CommunityApps = React.lazy(() => import('@/components/chat/community-apps/CommunityApps').then((m) => ({ default: m.CommunityApps })));
const CommunityAnalytics = React.lazy(() => import('@/components/chat/CommunityAnalytics'));
const CommunityGovernanceView = React.lazy(() => import('@/components/chat/CommunityGovernanceModal').then((m) => ({ default: m.CommunityGovernanceView })));

/** Text colours on white used here, with their contrast ratio. All are at least 7:1. */
const INK = '#15171c'; // 17.9:1
const INK_SOFT = '#3d424b'; // 10.4:1
const DANGER = '#9b1c16'; // 8.0:1

export type ManageView =
  | 'rows' | 'pinned' | 'members' | 'invite' | 'profile' | 'channels' | 'permissions'
  | 'moderation' | 'privacy' | 'apps' | 'analytics' | 'governance' | 'leave' | 'delete';

export interface ManageRow {
  view: Exclude<ManageView, 'rows'>;
  label: string;
  admin?: boolean;
  danger?: boolean;
}

/**
 * The rows of Manage, in order, for this person. Admin rows are hidden from everyone else.
 * Leave is for every member but the owner (the owner cannot leave; they delete). Delete is the owner's only.
 */
export function manageRows(role: { isOwner: boolean; isAdmin: boolean }): ManageRow[] {
  const all: ManageRow[] = [
    { view: 'pinned', label: 'Pinned posts' },
    { view: 'members', label: 'Members' },
    { view: 'invite', label: 'Invite' },
    { view: 'profile', label: 'Name and description', admin: true },
    { view: 'channels', label: 'Channels', admin: true },
    { view: 'permissions', label: 'Permissions', admin: true },
    { view: 'moderation', label: 'Moderation and slow mode', admin: true },
    { view: 'privacy', label: 'Privacy and discovery', admin: true },
    { view: 'apps', label: 'Apps' },
    { view: 'analytics', label: 'Analytics', admin: true },
    { view: 'governance', label: 'Governance' },
  ];
  const rows = all.filter((r) => !r.admin || role.isAdmin);
  if (!role.isOwner) rows.push({ view: 'leave', label: 'Leave this community', danger: true });
  if (role.isOwner) rows.push({ view: 'delete', label: 'Delete this community', danger: true });
  return rows;
}

/** Who can pin: the owner, an admin, or any member when the community lets members pin. Same rule as the server. */
export function canPin(role: { isOwner: boolean; isAdmin: boolean; isMember: boolean }, pinMessages: boolean | undefined): boolean {
  return role.isOwner || role.isAdmin || (role.isMember && pinMessages === true);
}

const PERMISSIONS: Array<[key: string, label: string]> = [
  ['sendMessages', 'Members can write posts'],
  ['sendMedia', 'Members can share photos and audio'],
  ['sendPolls', 'Members can start polls'],
  ['embedLinks', 'Members can share links'],
  ['pinMessages', 'Members can pin posts'],
  ['changeInfo', 'Members can change the name and description'],
];
const MODERATION: Array<[key: string, label: string]> = [
  ['antiSpam', 'Filter spam'],
  ['requireApproval', 'Approve new members before they join'],
];
const SLOW: Array<[seconds: number, label: string]> = [[0, 'Off'], [10, '10 seconds'], [30, '30 seconds'], [60, '1 minute'], [300, '5 minutes'], [3600, '1 hour']];

export interface CommunityManageProps {
  communityId: string;
  myAddress: string;
  nameFor?: (address: string) => string | undefined;
  /** Back to the community's posts. */
  onBack: () => void;
  /** After leaving or deleting: back to the list of communities. */
  onGone: () => void;
  fetchImpl?: typeof fetch;
}

type Note = { kind: 'ok' | 'error'; text: string } | null;

const btn = 'min-h-[48px] min-w-[48px] px-4 rounded-2xl text-[18px] font-semibold flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#15171c]/25';
const primary = `${btn} px-5 bg-[#15171c] text-white hover:bg-[#2a2d34] disabled:bg-[#e4e7ec] disabled:text-[#3d424b]`;
const secondary = `${btn} border-2 border-[#15171c] bg-white hover:bg-[#f2f4f7]`;
const dangerBtn = `${btn} px-5 bg-[#9b1c16] text-white hover:bg-[#7f1612] disabled:bg-[#e4e7ec] disabled:text-[#3d424b]`;
const card = 'rounded-2xl border border-[#d4d8de] bg-white';
const input = 'w-full min-h-[52px] rounded-2xl border-2 border-[#9aa1ac] focus:border-[#15171c] outline-none px-4 py-3 text-[18px] bg-white placeholder:text-[#4a505c]';
const short = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export function CommunityManage({ communityId, myAddress, nameFor, onBack, onGone, fetchImpl }: CommunityManageProps) {
  const f = useMemo<typeof fetch>(() => fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a)), [fetchImpl]);
  const me = myAddress.toLowerCase();
  const headers = useMemo(() => ({ 'Content-Type': 'application/json', 'x-web3-address': me, 'x-verified-session-address': me }), [me]);
  const base = `/api/chat/communities/${encodeURIComponent(communityId)}`;

  const [community, setCommunity] = useState<any>(null);
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading');
  const [view, setView] = useState<ManageView>('rows');
  const [note, setNote] = useState<Note>(null);

  const fetchCommunity = useCallback(async () => {
    try {
      const res = await f(base, { headers, credentials: 'include', cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        const text = res.status === 401
          ? 'You are signed out. Sign in again, then open this community.'
          : res.status === 404
            ? 'This community is not available on this account.'
            : (typeof d?.error === 'string' && d.error.length < 160 ? d.error : 'This community could not be loaded. Check your connection and try again.');
        setNote({ kind: 'error', text });
        setLoad('error');
        return;
      }
      setCommunity(d.community ?? d);
      setLoad('ready');
    } catch {
      setNote({ kind: 'error', text: 'This community could not be loaded. Check your connection and try again.' });
      setLoad((s) => (s === 'ready' ? 'ready' : 'error'));
    }
  }, [base, f, headers]);

  useEffect(() => { setView('rows'); setLoad('loading'); setCommunity(null); fetchCommunity(); }, [fetchCommunity]);
  useEffect(() => { setNote(null); }, [view]);

  const myMember = (community?.members || []).find((m: any) => String(m.walletAddress || '').toLowerCase() === me);
  const isOwner = !!community?.ownerAddress && String(community.ownerAddress).toLowerCase() === me;
  const isAdmin = isOwner || myMember?.role === 'ADMIN';
  const role = { isOwner, isAdmin, isMember: isOwner || !!myMember };
  const rows = manageRows(role);
  const name = community?.name || 'Community';

  const patch = async (url: string, body: unknown, method = 'PATCH'): Promise<{ ok: boolean; data: any }> => {
    try {
      const res = await f(url, { method, headers, credentials: 'include', body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, data };
    } catch {
      return { ok: false, data: { error: 'This device could not reach the server. Check your connection and try again.' } };
    }
  };
  const fail = (d: any, fallback: string) => setNote({ kind: 'error', text: typeof d?.error === 'string' && d.error.length < 160 ? d.error : fallback });

  const title = view === 'rows' ? 'Manage' : rows.find((r) => r.view === view)?.label ?? 'Manage';

  return (
    <section className="flex-1 flex flex-col w-full h-full min-w-0 min-h-0 bg-white" aria-label={`Manage ${name}`}>
      <header className="shrink-0 flex items-center gap-2 px-3 sm:px-5 py-3 border-b border-[#d4d8de] bg-white">
        <button
          type="button"
          onClick={() => (view === 'rows' ? onBack() : setView('rows'))}
          className={`${btn} px-3 hover:bg-[#eff1f4]`}
          style={{ color: INK }}
          aria-label={view === 'rows' ? `Back to ${name}` : 'Back to Manage'}
        >
          <span aria-hidden="true" className="text-[22px] leading-none">‹</span>
          <span className="hidden sm:inline">Back</span>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[21px] sm:text-[22px] font-semibold leading-tight truncate" style={{ color: INK }}>{title}</h1>
          <p className="text-[16px] leading-snug truncate" style={{ color: INK_SOFT }}>{name}</p>
        </div>
      </header>

      <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-[720px] mx-auto flex flex-col gap-4 min-w-0">
          {note && (
            <p
              role={note.kind === 'error' ? 'alert' : 'status'}
              className={`rounded-2xl border px-4 py-3 text-[18px] leading-snug ${note.kind === 'error' ? 'border-[#9b1c16] bg-[#fdf3f2]' : 'border-[#d4d8de] bg-[#f2f4f7]'}`}
              style={{ color: note.kind === 'error' ? DANGER : INK }}
            >
              {note.text}
            </p>
          )}

          {load === 'loading' && !community && <p className="text-[18px] py-10 text-center" style={{ color: INK_SOFT }} role="status">Loading…</p>}
          {load === 'error' && !community && (
            <div className="py-10 text-center" role={note ? undefined : 'alert'}>
              {!note && <p className="text-[18px] leading-snug" style={{ color: INK }}>This community could not be loaded. Check your connection and try again.</p>}
              <button type="button" onClick={() => { setNote(null); setLoad('loading'); fetchCommunity(); }} className={`${primary} mx-auto mt-4`}>Try again</button>
            </div>
          )}

          {community && view === 'rows' && (
            <>
              <ul className={`${card} divide-y divide-[#d4d8de] overflow-hidden`} aria-label="Manage this community">
                {rows.map((r) => (
                  <li key={r.view}>
                    <button
                      type="button"
                      onClick={() => setView(r.view)}
                      className="w-full min-h-[56px] px-4 py-3 flex items-center gap-3 text-left text-[18px] font-semibold hover:bg-[#f2f4f7] focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#15171c]/25"
                      style={{ color: r.danger ? DANGER : INK }}
                    >
                      <span className="flex-1 min-w-0">{r.label}</span>
                      <RowValue view={r.view} community={community} />
                      <span aria-hidden="true" className="text-[22px] leading-none" style={{ color: INK_SOFT }}>›</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-[16px] leading-snug" style={{ color: INK_SOFT }}>{VISIBILITY_SENTENCE}</p>
            </>
          )}

          {community && view === 'pinned' && (
            <PinnedPosts communityId={communityId} base={base} f={f} headers={headers} me={me} nameFor={nameFor} allowed={canPin(role, community?.permissions?.pinMessages)} />
          )}

          {community && view === 'members' && (
            <Members base={base} f={f} headers={headers} me={me} nameFor={nameFor} isAdmin={isAdmin} owner={String(community.ownerAddress || '').toLowerCase()} />
          )}

          {community && view === 'invite' && (
            <Invite
              joinCode={community.joinCode}
              canReset={isAdmin}
              onReset={async () => {
                const r = await patch('/api/chat/communities', { action: 'REVOKE_LINK', communityId });
                if (!r.ok) return fail(r.data, 'The link was not reset. Try again.');
                setCommunity((c: any) => ({ ...c, joinCode: r.data?.joinCode ?? c?.joinCode }));
                setNote({ kind: 'ok', text: 'New link ready. The old link no longer works.' });
              }}
            />
          )}

          {community && view === 'profile' && isAdmin && (
            <Profile
              community={community}
              onSave={async (n, d) => {
                const r = await patch(base, { name: n, description: d });
                if (!r.ok) return fail(r.data, 'The name was not saved. Try again.');
                setNote({ kind: 'ok', text: 'Saved.' });
                fetchCommunity();
              }}
            />
          )}

          {community && view === 'channels' && isAdmin && (
            <Channels
              channels={community.channels || []}
              onAdd={async (n) => {
                const r = await patch('/api/chat/communities', { action: 'CREATE_CHANNEL', communityId, name: n });
                if (!r.ok) { fail(r.data, 'The channel was not added. Try again.'); return false; }
                setNote({ kind: 'ok', text: `Channel ${n} added.` });
                await fetchCommunity();
                return true;
              }}
              onDelete={async (id, n) => {
                const r = await patch('/api/chat/communities', { action: 'DELETE_CHANNEL', communityId, channelId: id });
                if (!r.ok) return fail(r.data, 'The channel was not deleted. Try again.');
                setNote({ kind: 'ok', text: `Channel ${n} deleted.` });
                fetchCommunity();
              }}
            />
          )}

          {community && (view === 'permissions' || view === 'moderation') && isAdmin && (
            <Switches
              items={view === 'permissions' ? PERMISSIONS : MODERATION}
              values={community.permissions || {}}
              slow={view === 'moderation'}
              onChange={async (changes) => {
                const r = await patch('/api/chat/communities', { action: 'UPDATE_PERMISSIONS', communityId, permissions: changes });
                if (!r.ok) return fail(r.data, 'Not saved. Try again.');
                setNote({ kind: 'ok', text: 'Saved.' });
                setCommunity((c: any) => ({ ...c, permissions: { ...(c?.permissions || {}), ...(r.data?.permissions || changes) } }));
              }}
            />
          )}

          {community && view === 'privacy' && isAdmin && (
            <Privacy
              isPrivate={!!community.isPrivate}
              onChange={async (priv) => {
                const r = await patch(base, { isPrivate: priv });
                if (!r.ok) return fail(r.data, 'Not saved. Try again.');
                setNote({ kind: 'ok', text: priv ? 'Saved. It is private now.' : 'Saved. It is public now.' });
                setCommunity((c: any) => ({ ...c, isPrivate: priv }));
              }}
            />
          )}

          {community && (view === 'apps' || view === 'governance' || (view === 'analytics' && isAdmin)) && (
            <Suspense fallback={<p className="text-[18px] py-10 text-center" style={{ color: INK_SOFT }} role="status">Loading…</p>}>
              <div className={`${card} overflow-hidden`}>
                {view === 'apps' && <CommunityApps communityId={communityId} communityName={name} />}
                {view === 'analytics' && <CommunityAnalytics communityId={communityId} community={community} />}
                {view === 'governance' && <CommunityGovernanceView communityId={communityId} communityName={name} myAddress={myAddress} />}
              </div>
            </Suspense>
          )}

          {community && view === 'leave' && !isOwner && (
            <Confirm
              text={`You will stop seeing the posts of ${name}. To come back you need a new invite if it is private.`}
              action="Leave"
              onConfirm={async () => {
                const r = await patch(`${base}/members`, {}, 'DELETE');
                if (!r.ok) return fail(r.data, 'You did not leave. Try again.');
                onGone();
              }}
              onCancel={() => setView('rows')}
            />
          )}

          {community && view === 'delete' && isOwner && (
            <Confirm
              text={`This deletes ${name} for everyone: its posts, channels and members. It cannot be undone.`}
              action="Delete for everyone"
              typeToConfirm={name}
              onConfirm={async () => {
                const r = await patch(base, {}, 'DELETE');
                if (!r.ok) return fail(r.data, 'The community was not deleted. Try again.');
                onGone();
              }}
              onCancel={() => setView('rows')}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function RowValue({ view, community }: { view: ManageView; community: any }) {
  let v = '';
  if (view === 'members' && typeof community?.membersCount === 'number') v = String(community.membersCount);
  if (view === 'privacy') v = community?.isPrivate ? 'Private' : 'Public';
  if (view === 'channels' && Array.isArray(community?.channels)) v = String(community.channels.length);
  if (!v) return null;
  return <span className="text-[16px] font-normal shrink-0" style={{ color: INK_SOFT }}>{v}</span>;
}

// ─── Pinned posts ────────────────────────────────────────────────────────────

function PinnedPosts({ communityId, base, f, headers, me, nameFor, allowed }: {
  communityId: string; base: string; f: typeof fetch; headers: Record<string, string>; me: string; nameFor?: (a: string) => string | undefined; allowed: boolean;
}) {
  const [pinned, setPinned] = useState<ReaderPost[] | null>(null);
  const [recent, setRecent] = useState<ReaderPost[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        f(`${base}/posts?pinned=1`, { headers, credentials: 'include', cache: 'no-store' }),
        f(`${base}/posts`, { headers, credentials: 'include', cache: 'no-store' }),
      ]);
      if (!a.ok || !b.ok) throw new Error('load');
      const pa = await a.json();
      const pb = await b.json();
      // Each answer replaces the list. An empty answer is an empty list, never the previous one.
      const pins: ReaderPost[] = (Array.isArray(pa.posts) ? pa.posts : []).filter((p: any) => p && p.id && p.pinnedAt);
      const ids = new Set(pins.map((p) => p.id));
      setPinned(pins);
      setRecent((Array.isArray(pb.posts) ? pb.posts : []).filter((p: any) => p && p.id && !p.pinnedAt && !ids.has(p.id)).slice(0, 20));
      setError('');
    } catch {
      setError('The posts could not be loaded. Check your connection and try again.');
    }
  }, [base, f, headers]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = async (id: string, pin: boolean) => {
    setBusy(id);
    try {
      const res = await f('/api/chat/communities', {
        method: 'PATCH', headers, credentials: 'include',
        body: JSON.stringify({ action: pin ? 'PIN_MESSAGE' : 'UNPIN_MESSAGE', communityId, messageId: id }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d?.ok) setError(typeof d?.error === 'string' ? d.error : pin ? 'The post was not pinned. Try again.' : 'The post was not unpinned. Try again.');
    } catch {
      setError('This device could not reach the server. Check your connection and try again.');
    }
    await refresh();
    setBusy(null);
  };

  const who = (p: ReaderPost) => {
    const l = authorLabel(p, me, nameFor);
    return l.wallet ? `${l.name} · ${l.wallet}` : l.name;
  };

  return (
    <>
      {error && <p role="alert" className="rounded-2xl border border-[#9b1c16] bg-[#fdf3f2] px-4 py-3 text-[18px]" style={{ color: DANGER }}>{error}</p>}
      <h2 className="text-[19px] font-semibold" style={{ color: INK }}>Pinned</h2>
      {pinned === null ? (
        <p className="text-[18px]" style={{ color: INK_SOFT }} role="status">Loading…</p>
      ) : pinned.length === 0 ? (
        <p className={`${card} px-4 py-3 text-[18px]`} style={{ color: INK }} data-testid="pinned-empty">No pinned posts.</p>
      ) : (
        <ol className="flex flex-col gap-3" data-testid="pinned-list">
          {pinned.map((p) => (
            <PostCard key={p.id} p={p} who={who(p)}>
              {allowed && (
                <button type="button" disabled={busy === p.id} onClick={() => toggle(p.id, false)} className={secondary} style={{ color: INK }}>
                  Unpin
                </button>
              )}
            </PostCard>
          ))}
        </ol>
      )}

      {allowed ? (
        <>
          <h2 className="text-[19px] font-semibold mt-2" style={{ color: INK }}>Choose a post to pin</h2>
          {recent === null ? null : recent.length === 0 ? (
            <p className="text-[18px]" style={{ color: INK_SOFT }}>There are no other posts to pin.</p>
          ) : (
            <ol className="flex flex-col gap-3" data-testid="pin-candidates">
              {recent.map((p) => (
                <PostCard key={p.id} p={p} who={who(p)}>
                  <button type="button" disabled={busy === p.id} onClick={() => toggle(p.id, true)} className={secondary} style={{ color: INK }}>
                    Pin
                  </button>
                </PostCard>
              ))}
            </ol>
          )}
        </>
      ) : (
        <p className="text-[18px] leading-snug" style={{ color: INK_SOFT }}>Admins choose which posts are pinned.</p>
      )}
    </>
  );
}

function PostCard({ p, who, children }: { p: ReaderPost; who: string; children?: React.ReactNode }) {
  return (
    <li className={`${card} px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3`}>
      <div className="flex-1 min-w-0">
        <p className="text-[16px] font-semibold" style={{ color: INK_SOFT }}>{who}</p>
        <p className="text-[18px] leading-relaxed mt-1 whitespace-pre-wrap break-words" style={{ color: INK }}>{postText(p)}</p>
      </div>
      {children ? <div className="shrink-0 flex gap-2">{children}</div> : null}
    </li>
  );
}

// ─── Members ─────────────────────────────────────────────────────────────────

function Members({ base, f, headers, me, nameFor, isAdmin, owner }: {
  base: string; f: typeof fetch; headers: Record<string, string>; me: string; nameFor?: (a: string) => string | undefined; isAdmin: boolean; owner: string;
}) {
  const [members, setMembers] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [add, setAdd] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await f(`${base}/members`, { headers, credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const d = await res.json();
      setMembers(Array.isArray(d.members) ? d.members : []);
    } catch {
      setError('The members could not be loaded. Check your connection and try again.');
    }
  }, [base, f, headers]);
  useEffect(() => { refresh(); }, [refresh]);

  const call = async (method: string, body: unknown, key: string, failText: string) => {
    setBusy(key);
    setError('');
    try {
      const res = await f(`${base}/members`, { method, headers, credentials: 'include', body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(typeof d?.error === 'string' ? d.error : failText);
    } catch {
      setError('This device could not reach the server. Check your connection and try again.');
    }
    await refresh();
    setBusy(null);
  };

  const validAdd = /^0x[0-9a-fA-F]{40}$/.test(add.trim());

  return (
    <>
      {error && <p role="alert" className="rounded-2xl border border-[#9b1c16] bg-[#fdf3f2] px-4 py-3 text-[18px]" style={{ color: DANGER }}>{error}</p>}
      {members === null && !error && <p className="text-[18px]" style={{ color: INK_SOFT }} role="status">Loading…</p>}
      {members && (
        <ul className={`${card} divide-y divide-[#d4d8de]`}>
          {members.map((m) => {
            const a = String(m.walletAddress || '').toLowerCase();
            const isMe = a === me;
            const isTheOwner = a === owner;
            const label = isMe ? 'You' : nameFor?.(a) || (typeof m.name === 'string' && m.name) || short(a);
            const roleText = isTheOwner ? 'Owner' : m.role === 'ADMIN' ? 'Admin' : m.role === 'MODERATOR' ? 'Moderator' : 'Member';
            return (
              <li key={a} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[18px] font-semibold truncate" style={{ color: INK }}>{label}</p>
                  <p className="text-[16px]" style={{ color: INK_SOFT }}>{roleText}{label !== short(a) ? <span className="tabular-nums"> · {short(a)}</span> : null}</p>
                </div>
                {isAdmin && !isTheOwner && !isMe && (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy === a} className={secondary} style={{ color: INK }}
                      onClick={() => call('PATCH', { walletAddress: a, role: m.role === 'ADMIN' ? 'MEMBER' : 'ADMIN' }, a, 'The role was not changed. Try again.')}>
                      {m.role === 'ADMIN' ? 'Make member' : 'Make admin'}
                    </button>
                    <button type="button" disabled={busy === a} className={secondary} style={{ color: DANGER, borderColor: DANGER }}
                      onClick={() => call('DELETE', { walletAddress: a }, a, 'The member was not removed. Try again.')}>
                      Remove
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {isAdmin && (
        <form className={`${card} px-4 py-4 flex flex-col gap-3`} onSubmit={(e) => { e.preventDefault(); if (validAdd) call('POST', { walletAddress: add.trim() }, 'add', 'The member was not added. Try again.').then(() => setAdd('')); }}>
          <label htmlFor="manage-add-member" className="text-[18px] font-semibold" style={{ color: INK }}>Add a member by wallet address</label>
          <input id="manage-add-member" value={add} onChange={(e) => setAdd(e.target.value)} placeholder="0x…" className={input} style={{ color: INK }} autoComplete="off" spellCheck={false} />
          <div className="flex justify-end">
            <button type="submit" disabled={!validAdd || busy === 'add'} className={primary}>Add</button>
          </div>
        </form>
      )}
    </>
  );
}

// ─── Invite ──────────────────────────────────────────────────────────────────

function Invite({ joinCode, canReset, onReset }: { joinCode?: string | null; canReset?: boolean; onReset?: () => Promise<void> }) {
  const link = communityInviteUrl(joinCode);
  const [copied, setCopied] = useState<'' | 'yes' | 'no'>('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setCopied(''); }, [link]);
  if (!link) return <p className={`${card} px-4 py-3 text-[18px]`} style={{ color: INK }}>This community has no invite link yet.</p>;
  return (
    <div className={`${card} px-4 py-4 flex flex-col gap-3`}>
      <p className="text-[18px] leading-snug" style={{ color: INK }}>Send this link to someone you want in this community.</p>
      <p className="rounded-2xl border-2 border-[#9aa1ac] px-4 py-3 text-[18px] break-all" style={{ color: INK }} data-testid="invite-link">{link}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={primary}
          onClick={() => navigator.clipboard?.writeText(link).then(() => setCopied('yes'), () => setCopied('no'))}
        >
          Copy the link
        </button>
        {copied === 'yes' && <span role="status" className="text-[18px]" style={{ color: INK }}>Copied.</span>}
        {copied === 'no' && <span role="alert" className="text-[18px]" style={{ color: DANGER }}>Not copied. Select the link and copy it.</span>}
      </div>
      {canReset && onReset && (
        <div className="border-t border-[#d4d8de] pt-3 flex flex-col gap-2">
          {!confirmReset ? (
            <button type="button" className={`${btn} px-4 self-start hover:bg-[#eff1f4]`} style={{ color: DANGER }} onClick={() => setConfirmReset(true)} data-testid="invite-reset">
              Reset the link
            </button>
          ) : (
            <>
              <p className="text-[16px] leading-snug" style={{ color: INK }}>Anyone with the old link will not be able to join with it. People already in stay.</p>
              <div className="flex flex-wrap gap-3">
                <button type="button" disabled={busy} className={primary} onClick={async () => { setBusy(true); try { await onReset(); } finally { setBusy(false); setConfirmReset(false); } }}>
                  {busy ? 'Resetting…' : 'Reset now'}
                </button>
                <button type="button" className={`${btn} px-4 hover:bg-[#eff1f4]`} style={{ color: INK }} onClick={() => setConfirmReset(false)}>Cancel</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Name and description ────────────────────────────────────────────────────

function Profile({ community, onSave }: { community: any; onSave: (name: string, description: string) => Promise<void> }) {
  const [n, setN] = useState(community?.name || '');
  const [d, setD] = useState(community?.description || '');
  const [busy, setBusy] = useState(false);
  return (
    <form className={`${card} px-4 py-4 flex flex-col gap-3`} onSubmit={async (e) => { e.preventDefault(); if (!n.trim()) return; setBusy(true); await onSave(n.trim(), d.trim()); setBusy(false); }}>
      <label htmlFor="manage-name" className="text-[18px] font-semibold" style={{ color: INK }}>Name</label>
      <input id="manage-name" value={n} onChange={(e) => setN(e.target.value)} maxLength={60} className={input} style={{ color: INK }} />
      <label htmlFor="manage-description" className="text-[18px] font-semibold" style={{ color: INK }}>Description</label>
      <textarea id="manage-description" value={d} onChange={(e) => setD(e.target.value)} maxLength={280} rows={3} className={`${input} resize-none`} style={{ color: INK }} />
      <div className="flex justify-end">
        <button type="submit" disabled={!n.trim() || busy} className={primary}>Save</button>
      </div>
    </form>
  );
}

// ─── Channels ────────────────────────────────────────────────────────────────

function Channels({ channels, onAdd, onDelete }: { channels: any[]; onAdd: (name: string) => Promise<boolean>; onDelete: (id: string, name: string) => Promise<void> }) {
  const [n, setN] = useState('');
  const [busy, setBusy] = useState(false);
  const clean = n.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 40);
  return (
    <>
      <ul className={`${card} divide-y divide-[#d4d8de]`}>
        {channels.map((c) => (
          <li key={c.id} className="px-4 py-3 flex items-center gap-3 min-h-[56px]">
            <span className="flex-1 min-w-0 text-[18px] font-semibold truncate" style={{ color: INK }}>{c.name}</span>
            {c.name !== 'general' && (
              <button type="button" className={secondary} style={{ color: DANGER, borderColor: DANGER }} onClick={() => onDelete(c.id, c.name)}>
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
      <form className={`${card} px-4 py-4 flex flex-col gap-3`} onSubmit={async (e) => { e.preventDefault(); if (!clean) return; setBusy(true); if (await onAdd(clean)) setN(''); setBusy(false); }}>
        <label htmlFor="manage-channel" className="text-[18px] font-semibold" style={{ color: INK }}>Add a channel</label>
        <input id="manage-channel" value={n} onChange={(e) => setN(e.target.value)} placeholder="announcements" maxLength={40} className={input} style={{ color: INK }} />
        <div className="flex justify-end">
          <button type="submit" disabled={!clean || busy} className={primary}>Add</button>
        </div>
      </form>
    </>
  );
}

// ─── Permissions, moderation and slow mode ───────────────────────────────────

function Switches({ items, values, slow, onChange }: {
  items: Array<[string, string]>; values: Record<string, any>; slow: boolean; onChange: (changes: Record<string, boolean | number>) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, changes: Record<string, boolean | number>) => { setBusy(key); await onChange(changes); setBusy(null); };
  return (
    <>
      <ul className={`${card} divide-y divide-[#d4d8de]`}>
        {items.map(([key, label]) => {
          const on = values[key] === true;
          return (
            <li key={key}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                disabled={busy === key}
                onClick={() => run(key, { [key]: !on })}
                className="w-full min-h-[56px] px-4 py-3 flex items-center gap-3 text-left text-[18px] hover:bg-[#f2f4f7] focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#15171c]/25"
                style={{ color: INK }}
              >
                <span className="flex-1 min-w-0 font-semibold">{label}</span>
                <span className={`min-w-[64px] text-center rounded-xl px-3 py-1 text-[16px] font-semibold border-2 ${on ? 'bg-[#15171c] border-[#15171c] text-white' : 'bg-white border-[#9aa1ac] text-[#15171c]'}`}>{on ? 'On' : 'Off'}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {slow && (
        <fieldset className={`${card} px-4 py-4`}>
          <legend className="px-1 text-[18px] font-semibold" style={{ color: INK }}>Slow mode</legend>
          <p className="text-[16px] mb-3" style={{ color: INK_SOFT }}>How long each member waits between two posts.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SLOW.map(([v, l]) => {
              const on = (values.slowModeSeconds ?? 0) === v;
              return (
                <button key={v} type="button" role="radio" aria-checked={on} disabled={busy === 'slow'} onClick={() => run('slow', { slowModeSeconds: v })}
                  className={`${btn} ${on ? 'bg-[#15171c] text-white' : 'border-2 border-[#9aa1ac] bg-white text-[#15171c] hover:bg-[#f2f4f7]'}`}>
                  {l}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
    </>
  );
}

// ─── Privacy and discovery ───────────────────────────────────────────────────

function Privacy({ isPrivate, onChange }: { isPrivate: boolean; onChange: (priv: boolean) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">Who can join</legend>
      {([
        [true, 'Private', 'Only people with an invite can join. It is not listed in Find one.'],
        [false, 'Public', 'Anyone can find it in Find one and join.'],
      ] as const).map(([priv, label, text]) => (
        <button key={label} type="button" role="radio" aria-checked={isPrivate === priv} disabled={busy}
          onClick={async () => { if (isPrivate === priv) return; setBusy(true); await onChange(priv); setBusy(false); }}
          className={`${card} min-h-[56px] px-4 py-3 flex items-center gap-3 text-left border-2 ${isPrivate === priv ? 'border-[#15171c]' : 'border-[#d4d8de] hover:bg-[#f2f4f7]'}`}>
          <span className="flex-1 min-w-0">
            <span className="block text-[18px] font-semibold" style={{ color: INK }}>{label}</span>
            <span className="block text-[16px]" style={{ color: INK_SOFT }}>{text}</span>
          </span>
          <span className="text-[16px] font-semibold" style={{ color: INK }}>{isPrivate === priv ? 'Selected' : 'Choose'}</span>
        </button>
      ))}
      <p className="text-[16px] leading-snug" style={{ color: INK_SOFT }}>Either way, posts are stored on our server and people in the community can read them.</p>
    </fieldset>
  );
}

// ─── Leave and Delete ────────────────────────────────────────────────────────

function Confirm({ text, action, typeToConfirm, onConfirm, onCancel }: {
  text: string; action: string; typeToConfirm?: string; onConfirm: () => Promise<void>; onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = !typeToConfirm || typed.trim() === typeToConfirm.trim();
  return (
    <div className={`${card} px-4 py-4 flex flex-col gap-3`}>
      <p className="text-[18px] leading-snug" style={{ color: INK }}>{text}</p>
      {typeToConfirm && (
        <>
          <label htmlFor="manage-confirm" className="text-[18px] font-semibold" style={{ color: INK }}>Type the name to confirm: {typeToConfirm}</label>
          <input id="manage-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} className={input} style={{ color: INK }} autoComplete="off" />
        </>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className={secondary} style={{ color: INK }}>Cancel</button>
        <button type="button" disabled={!ready || busy} onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }} className={dangerBtn}>{action}</button>
      </div>
    </div>
  );
}
