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
 * communityMls here: only the operator flips it. While it is false, posts stay readable by the
 * server. When it is true, a new channel is created as an XMTP group first (lib/communities/mls.ts)
 * and the server stores only its id. The first
 * screen shows no hash and no contract address.
 */

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { communityInviteUrl } from '@/lib/ui/format';
import { authorLabel, postText, MLS_VISIBILITY_SENTENCE, VISIBILITY_SENTENCE, type ReaderPost } from './CommunityReader';
import { createChannelGroup, isMlsCommunity, mlsGroupOf, readGroupPosts, postToGroup, syncGroupMembers } from '@/lib/communities/mls';
import {
  ENFORCEMENT_NOTE_MLS, MODERATION_SETTINGS, PERMISSION_SETTINGS, ROW_HELP, SLOW_MODE_HELP, SLOW_MODE_OPTIONS,
  effectivePermissions, encodeUnpin, isPrivileged, mayPinFor, pinnedIds, rankIn, type Rank, type SettingInfo,
} from '@/lib/communities/settings';
import { resolveInboxIdToAddress } from '@/lib/xmtp/client';
import { useT } from '@/lib/i18n/client';

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

/** Who can pin, from the community's answer: owner, admins, moderators, or members when allowed. */
export { mayPinFor };

export interface CommunityManageProps {
  communityId: string;
  myAddress: string;
  nameFor?: (address: string) => string | undefined;
  /** Back to the community's posts. */
  onBack: () => void;
  /** After leaving or deleting: back to the list of communities. */
  onGone: () => void;
  fetchImpl?: typeof fetch;
  /** The signed-in XMTP client: a channel of an MLS community is created as an XMTP group first. */
  xmtpClient?: any;
}

type Note = { kind: 'ok' | 'error'; text: string } | null;

const btn = 'min-h-[48px] min-w-[48px] px-4 rounded-2xl text-[18px] font-semibold flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#15171c]/25';
const primary = `${btn} px-5 bg-[#15171c] text-white hover:bg-[#2a2d34] disabled:bg-[#e4e7ec] disabled:text-[#3d424b]`;
const secondary = `${btn} border-2 border-[#15171c] bg-white hover:bg-[#f2f4f7]`;
const dangerBtn = `${btn} px-5 bg-[#9b1c16] text-white hover:bg-[#7f1612] disabled:bg-[#e4e7ec] disabled:text-[#3d424b]`;
const card = 'rounded-2xl border border-[#d4d8de] bg-white';
const input = 'w-full min-h-[52px] rounded-2xl border-2 border-[#9aa1ac] focus:border-[#15171c] outline-none px-4 py-3 text-[18px] bg-white placeholder:text-[#4a505c]';
const short = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export function CommunityManage({ communityId, myAddress, nameFor, onBack, onGone, fetchImpl, xmtpClient }: CommunityManageProps) {
  const t = useT();
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
          ? t('You are signed out. Sign in again, then open this community.')
          : res.status === 404
            ? t('This community is not available on this account.')
            : t(typeof d?.error === 'string' && d.error.length < 160 ? d.error : 'This community could not be loaded. Check your connection and try again.');
        setNote({ kind: 'error', text });
        setLoad('error');
        return;
      }
      setCommunity(d.community ?? d);
      setLoad('ready');
    } catch {
      setNote({ kind: 'error', text: t("This community could not be loaded. Check your connection and try again.") });
      setLoad((s) => (s === 'ready' ? 'ready' : 'error'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, f, headers]);

  useEffect(() => { setView('rows'); setLoad('loading'); setCommunity(null); fetchCommunity(); }, [fetchCommunity]);
  useEffect(() => { setNote(null); }, [view]);

  const rank: Rank | null = rankIn(community, me);
  const isOwner = rank === 'OWNER';
  const isAdmin = rank === 'OWNER' || rank === 'ADMIN';
  const role = { isOwner, isAdmin, isMember: !!rank };
  const rows = manageRows(role);
  const name = community?.name || t('Community');
  const mls = isMlsCommunity(community);
  const perms = effectivePermissions(community?.permissions);
  // Members may edit name and description when the community allows it (changeInfo).
  const canEditInfo = isAdmin || (!!rank && perms.changeInfo);
  const visibleRows = canEditInfo && !isAdmin
    ? [...rows.slice(0, 3), { view: 'profile' as const, label: 'Name and description' }, ...rows.slice(3)]
    : rows;

  /** After a membership change: an admin's app makes each encrypted channel match the server's list now. */
  const syncEncrypted = useCallback(async () => {
    if (!mls || !xmtpClient || !isAdmin) return;
    try {
      const res = await f(base, { headers, credentials: 'include', cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      const c = d.community ?? d;
      for (const ch of (c?.channels || []) as { xmtpGroupId?: string | null }[]) {
        if (ch.xmtpGroupId) await syncGroupMembers(xmtpClient, ch.xmtpGroupId, c, me).catch(() => { /* retried when the community opens */ });
      }
    } catch { /* retried when the community opens */ }
  }, [mls, xmtpClient, isAdmin, f, base, headers, me]);

  const patch = async (url: string, body: unknown, method = 'PATCH'): Promise<{ ok: boolean; data: any }> => {
    try {
      const res = await f(url, { method, headers, credentials: 'include', body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, data };
    } catch {
      return { ok: false, data: { error: 'This device could not reach the server. Check your connection and try again.' } };
    }
  };
  const fail = (d: any, fallback: string) => setNote({ kind: 'error', text: t(typeof d?.error === 'string' && d.error.length < 160 ? d.error : fallback) });

  const title = t(view === 'rows' ? 'Manage' : visibleRows.find((r) => r.view === view)?.label ?? 'Manage');

  return (
    <section className="flex-1 flex flex-col w-full h-full min-w-0 min-h-0 bg-white" aria-label={t("Manage {name}", { name })}>
      <header className="shrink-0 flex items-center gap-2 px-3 sm:px-5 py-3 border-b border-[#d4d8de] bg-white">
        <button
          type="button"
          onClick={() => (view === 'rows' ? onBack() : setView('rows'))}
          className={`${btn} px-3 hover:bg-[#eff1f4]`}
          style={{ color: INK }}
          aria-label={view === 'rows' ? t("Back to {name}", { name }) : t("Back to Manage")}
        >
          <span aria-hidden="true" className="text-[22px] leading-none">‹</span>
          <span className="hidden sm:inline">{t("Back")}</span>
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

          {load === 'loading' && !community && <p className="text-[18px] py-10 text-center" style={{ color: INK_SOFT }} role="status">{t("Loading…")}</p>}
          {load === 'error' && !community && (
            <div className="py-10 text-center" role={note ? undefined : 'alert'}>
              {!note && <p className="text-[18px] leading-snug" style={{ color: INK }}>{t("This community could not be loaded. Check your connection and try again.")}</p>}
              <button type="button" onClick={() => { setNote(null); setLoad('loading'); fetchCommunity(); }} className={`${primary} mx-auto mt-4`}>{t("Try again")}</button>
            </div>
          )}

          {community && view === 'rows' && (
            <>
              <ul className={`${card} divide-y divide-[#d4d8de] overflow-hidden`} aria-label={t("Manage this community")}>
                {visibleRows.map((r) => (
                  <li key={r.view}>
                    <button
                      type="button"
                      onClick={() => setView(r.view)}
                      className="w-full min-h-[56px] px-4 py-3 flex items-center gap-3 text-left text-[18px] font-semibold hover:bg-[#f2f4f7] focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#15171c]/25"
                      style={{ color: r.danger ? DANGER : INK }}
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block">{t(r.label)}</span>
                        {ROW_HELP[r.view] && <span className="block text-[15px] font-normal leading-snug mt-0.5" style={{ color: r.danger ? DANGER : INK_SOFT }}>{t(ROW_HELP[r.view])}</span>}
                      </span>
                      <RowValue view={r.view} community={community} />
                      <span aria-hidden="true" className="text-[22px] leading-none" style={{ color: INK_SOFT }}>›</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-[16px] leading-snug" style={{ color: INK_SOFT }}>{t(mls ? MLS_VISIBILITY_SENTENCE : VISIBILITY_SENTENCE)}</p>
            </>
          )}

          {community && view === 'pinned' && (
            mls
              ? <MlsPinnedPosts community={community} xmtpClient={xmtpClient} me={me} nameFor={nameFor} allowed={mayPinFor(perms, rank)} />
              : <PinnedPosts communityId={communityId} base={base} f={f} headers={headers} me={me} nameFor={nameFor} allowed={mayPinFor(perms, rank)} />
          )}

          {community && view === 'members' && (
            <Members base={base} f={f} headers={headers} me={me} nameFor={nameFor} rank={rank} owner={String(community.ownerAddress || '').toLowerCase()} mls={mls} onChanged={async () => { await fetchCommunity(); await syncEncrypted(); }} />
          )}

          {community && view === 'invite' && (
            <Invite
              joinCode={community.joinCode}
              canReset={isAdmin}
              onReset={async () => {
                const r = await patch('/api/chat/communities', { action: 'REVOKE_LINK', communityId });
                if (!r.ok) return fail(r.data, 'The link was not reset. Try again.');
                setCommunity((c: any) => ({ ...c, joinCode: r.data?.joinCode ?? c?.joinCode }));
                setNote({ kind: 'ok', text: t("New link ready. The old link no longer works.") });
              }}
            />
          )}

          {community && view === 'profile' && canEditInfo && (
            <Profile
              community={community}
              onSave={async (n, d) => {
                const r = await patch(base, { name: n, description: d });
                if (!r.ok) return fail(r.data, 'The name was not saved. Try again.');
                setNote({ kind: 'ok', text: t("Saved.") });
                fetchCommunity();
              }}
            />
          )}

          {community && view === 'channels' && isAdmin && (
            <Channels
              channels={community.channels || []}
              mls={mls}
              onAdd={async (n) => {
                // An MLS community: the channel is an XMTP group, created here; the server stores only its id.
                let xmtpGroupId: string | undefined;
                if (isMlsCommunity(community)) {
                  if (!xmtpClient) { setNote({ kind: 'error', text: t("Encrypted messaging is not connected on this device yet. Try again in a moment.") }); return false; }
                  try { xmtpGroupId = await createChannelGroup(xmtpClient, community, n, me); }
                  catch (e) { setNote({ kind: 'error', text: t(e instanceof Error && !e.message.startsWith('[') ? e.message : 'The encrypted channel could not be created. Try again.') }); return false; }
                }
                const r = await patch('/api/chat/communities', { action: 'CREATE_CHANNEL', communityId, name: n, ...(xmtpGroupId ? { xmtpGroupId } : {}) });
                if (!r.ok) { fail(r.data, 'The channel was not added. Try again.'); return false; }
                setNote({ kind: 'ok', text: t('Channel {name} added.', { name: n }) });
                await fetchCommunity();
                return true;
              }}
              onDelete={async (id, n) => {
                const r = await patch('/api/chat/communities', { action: 'DELETE_CHANNEL', communityId, channelId: id });
                if (!r.ok) return fail(r.data, 'The channel was not deleted. Try again.');
                setNote({ kind: 'ok', text: t('Channel {name} deleted.', { name: n }) });
                fetchCommunity();
              }}
            />
          )}

          {community && (view === 'permissions' || view === 'moderation') && isAdmin && (
            <Switches
              items={view === 'permissions' ? PERMISSION_SETTINGS : MODERATION_SETTINGS}
              values={perms}
              slow={view === 'moderation'}
              mls={mls}
              onChange={async (changes) => {
                const r = await patch('/api/chat/communities', { action: 'UPDATE_PERMISSIONS', communityId, permissions: changes });
                if (!r.ok) return fail(r.data, 'Not saved. Try again.');
                setNote({ kind: 'ok', text: t("Saved.") });
                setCommunity((c: any) => ({ ...c, permissions: { ...(c?.permissions || {}), ...(r.data?.permissions || changes) } }));
                // Turning approval off does not admit anyone: pending requests stay until answered in Members.
              }}
            />
          )}

          {community && view === 'privacy' && isAdmin && (
            <Privacy
              isPrivate={!!community.isPrivate}
              mls={mls}
              onChange={async (priv) => {
                const r = await patch(base, { isPrivate: priv });
                if (!r.ok) return fail(r.data, 'Not saved. Try again.');
                setNote({ kind: 'ok', text: t(priv ? 'Saved. It is private now.' : 'Saved. It is public now.') });
                setCommunity((c: any) => ({ ...c, isPrivate: priv }));
              }}
            />
          )}

          {community && (view === 'apps' || view === 'governance' || (view === 'analytics' && isAdmin)) && (
            <Suspense fallback={<p className="text-[18px] py-10 text-center" style={{ color: INK_SOFT }} role="status">{t("Loading…")}</p>}>
              <div className={`${card} overflow-hidden`}>
                {view === 'apps' && <CommunityApps communityId={communityId} communityName={name} />}
                {view === 'analytics' && <CommunityAnalytics communityId={communityId} community={community} />}
                {view === 'governance' && <CommunityGovernanceView communityId={communityId} communityName={name} myAddress={myAddress} />}
              </div>
            </Suspense>
          )}

          {community && view === 'leave' && !isOwner && (
            <Confirm
              text={t(mls
                ? 'You stop being a member of {name}. An admin’s app removes you from the encrypted channel the next time it opens; from then on you cannot read new posts. To come back you need a new invite if it is private.'
                : 'You will stop seeing the posts of {name}. To come back you need a new invite if it is private.', { name })}
              action={t('Leave')}
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
              text={t(mls
                ? 'This deletes {name} for everyone: its name, channels, members and invite links on our server. Posts are end-to-end encrypted and stay on the devices that already received them. It cannot be undone.'
                : 'This deletes {name} for everyone: its posts, channels and members. It cannot be undone.', { name })}
              action={t('Delete for everyone')}
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
  const t = useT();
  let v = '';
  if (view === 'members' && typeof community?.membersCount === 'number') v = String(community.membersCount);
  if (view === 'privacy') v = community?.isPrivate ? t('Private') : t('Public');
  if (view === 'channels' && Array.isArray(community?.channels)) v = String(community.channels.length);
  if (!v) return null;
  return <span className="text-[16px] font-normal shrink-0" style={{ color: INK_SOFT }}>{v}</span>;
}

// ─── Pinned posts ────────────────────────────────────────────────────────────

function PinnedPosts({ communityId, base, f, headers, me, nameFor, allowed }: {
  communityId: string; base: string; f: typeof fetch; headers: Record<string, string>; me: string; nameFor?: (a: string) => string | undefined; allowed: boolean;
}) {
  const t = useT();
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
      setError(t("The posts could not be loaded. Check your connection and try again."));
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
      if (!res.ok || !d?.ok) setError(typeof d?.error === 'string' ? d.error : pin ? t("The post was not pinned. Try again.") : t("The post was not unpinned. Try again."));
    } catch {
      setError(t("This device could not reach the server. Check your connection and try again."));
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
      <h2 className="text-[19px] font-semibold" style={{ color: INK }}>{t("Pinned")}</h2>
      {pinned === null ? (
        <p className="text-[18px]" style={{ color: INK_SOFT }} role="status">{t("Loading…")}</p>
      ) : pinned.length === 0 ? (
        <p className={`${card} px-4 py-3 text-[18px]`} style={{ color: INK }} data-testid="pinned-empty">{t("No pinned posts.")}</p>
      ) : (
        <ol className="flex flex-col gap-3" data-testid="pinned-list">
          {pinned.map((p) => (
            <PostCard key={p.id} p={p} who={who(p)}>
              {allowed && (
                <button type="button" disabled={busy === p.id} onClick={() => toggle(p.id, false)} className={secondary} style={{ color: INK }}>
                  {t("Unpin")}
                </button>
              )}
            </PostCard>
          ))}
        </ol>
      )}

      {allowed ? (
        <>
          <h2 className="text-[19px] font-semibold mt-2" style={{ color: INK }}>{t("Choose a post to pin")}</h2>
          {recent === null ? null : recent.length === 0 ? (
            <p className="text-[18px]" style={{ color: INK_SOFT }}>{t("There are no other posts to pin.")}</p>
          ) : (
            <ol className="flex flex-col gap-3" data-testid="pin-candidates">
              {recent.map((p) => (
                <PostCard key={p.id} p={p} who={who(p)}>
                  <button type="button" disabled={busy === p.id} onClick={() => toggle(p.id, true)} className={secondary} style={{ color: INK }}>
                    {t("Pin")}
                  </button>
                </PostCard>
              ))}
            </ol>
          )}
        </>
      ) : (
        <p className="text-[18px] leading-snug" style={{ color: INK_SOFT }}>{t("Admins choose which posts are pinned.")}</p>
      )}
    </>
  );
}

/**
 * Pins of an encrypted community are group messages (__PIN__ / __UNPIN__), read on this device;
 * our server never sees which post is pinned. Pins from people who may not pin are ignored by
 * every app (lib/communities/settings.ts pinnedIds).
 */
function MlsPinnedPosts({ community, xmtpClient, me, nameFor, allowed }: {
  community: any; xmtpClient?: any; me: string; nameFor?: (a: string) => string | undefined; allowed: boolean;
}) {
  const t = useT();
  const group = mlsGroupOf(community);
  const [list, setList] = useState<ReaderPost[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!group || !xmtpClient) { setError(t('Encrypted messaging is not connected on this device yet. Try again in a moment.')); return; }
    try {
      const msgs = await readGroupPosts(xmtpClient, group);
      const addr = new Map<string, string>();
      const withAuthors = [] as { id: string; content: string; authorAddress?: string; createdAt: number }[];
      for (const m of msgs) {
        if (!addr.has(m.senderInboxId)) addr.set(m.senderInboxId, (await resolveInboxIdToAddress(m.senderInboxId, xmtpClient).catch(() => null)) ?? '');
        withAuthors.push({ id: m.id, content: m.content, authorAddress: addr.get(m.senderInboxId) || undefined, createdAt: m.createdAt });
      }
      const p = effectivePermissions(community?.permissions);
      const ids = pinnedIds(withAuthors, (a) => mayPinFor(p, rankIn(community, a)));
      const byId = new Map(withAuthors.map((x) => [x.id, x]));
      setList(ids.map((id) => byId.get(id)).filter(Boolean) as ReaderPost[]);
      setError('');
    } catch {
      setError(t('The posts could not be loaded. Check your connection and try again.'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, xmtpClient, community]);
  useEffect(() => { refresh(); }, [refresh]);
  const unpin = async (id: string) => {
    if (!group || !xmtpClient) return;
    setBusy(id);
    try { await postToGroup(xmtpClient, group, encodeUnpin(id)); } catch { setError(t('The post was not unpinned. Try again.')); }
    await refresh();
    setBusy(null);
  };
  const who = (p: ReaderPost) => { const l = authorLabel(p, me, nameFor); return l.wallet ? `${l.name} · ${l.wallet}` : l.name; };
  return (
    <>
      {error && <p role="alert" className="rounded-2xl border border-[#9b1c16] bg-[#fdf3f2] px-4 py-3 text-[18px]" style={{ color: DANGER }}>{error}</p>}
      <h2 className="text-[19px] font-semibold" style={{ color: INK }}>{t("Pinned")}</h2>
      {list === null && !error ? (
        <p className="text-[18px]" style={{ color: INK_SOFT }} role="status">{t("Loading…")}</p>
      ) : list && list.length === 0 ? (
        <p className={`${card} px-4 py-3 text-[18px]`} style={{ color: INK }}>{t("No pinned posts.")}</p>
      ) : list ? (
        <ol className="flex flex-col gap-3">
          {list.map((p) => (
            <PostCard key={p.id} p={p} who={who(p)}>
              {allowed && <button type="button" disabled={busy === p.id} onClick={() => unpin(p.id)} className={secondary} style={{ color: INK }}>{t("Unpin")}</button>}
            </PostCard>
          ))}
        </ol>
      ) : null}
      <p className="text-[16px] leading-snug" style={{ color: INK_SOFT }}>
        {t(allowed ? 'To pin a post, open its menu in the community and choose Pin. Pins are encrypted group messages: our server does not know which posts are pinned.' : 'The owner, admins and moderators choose which posts are pinned.')}
      </p>
    </>
  );
}

function PostCard({ p, who, children }: { p: ReaderPost; who: string; children?: React.ReactNode }) {
  const t = useT();
  return (
    <li className={`${card} px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3`}>
      <div className="flex-1 min-w-0">
        <p className="text-[16px] font-semibold" style={{ color: INK_SOFT }}>{who}</p>
        <p className="text-[18px] leading-relaxed mt-1 whitespace-pre-wrap break-words" style={{ color: INK }}>{t(postText(p))}</p>
      </div>
      {children ? <div className="shrink-0 flex gap-2">{children}</div> : null}
    </li>
  );
}

// ─── Members ─────────────────────────────────────────────────────────────────

const RANKS: Record<Rank, number> = { OWNER: 3, ADMIN: 2, MODERATOR: 1, MEMBER: 0 };
const ROLE_HELP: Record<string, string> = {
  ADMIN: 'Admins change settings, channels and roles, add and remove people, and answer join requests.',
  MODERATOR: 'Moderators pin posts and remove members. They do not change settings.',
  MEMBER: 'Members read, post and vote, within the community’s permissions.',
};

function Members({ base, f, headers, me, nameFor, rank, owner, mls, onChanged }: {
  base: string; f: typeof fetch; headers: Record<string, string>; me: string; nameFor?: (a: string) => string | undefined;
  rank: Rank | null; owner: string; mls: boolean; onChanged: () => Promise<void>;
}) {
  const t = useT();
  const [members, setMembers] = useState<any[] | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [add, setAdd] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const isAdmin = rank === 'OWNER' || rank === 'ADMIN';

  const refresh = useCallback(async () => {
    try {
      const res = await f(`${base}/members`, { headers, credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const d = await res.json();
      setMembers(Array.isArray(d.members) ? d.members : []);
      setRequests(Array.isArray(d.requests) ? d.requests : []);
    } catch {
      setError(t("The members could not be loaded. Check your connection and try again."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, f, headers]);
  useEffect(() => { refresh(); }, [refresh]);

  const call = async (method: string, body: unknown, key: string, failText: string, doneText: string) => {
    setBusy(key);
    setError(''); setOk('');
    let changed = false;
    try {
      const res = await f(`${base}/members`, { method, headers, credentials: 'include', body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(t(typeof d?.error === 'string' && d.error.length < 160 ? d.error : failText));
      else { changed = true; setOk(t(doneText)); }
    } catch {
      setError(t("This device could not reach the server. Check your connection and try again."));
    }
    await refresh();
    if (changed) await onChanged();
    setBusy(null);
  };

  const validAdd = /^0x[0-9a-fA-F]{40}$/.test(add.trim());
  const rankOfRow = (m: any): Rank => (String(m.walletAddress || '').toLowerCase() === owner ? 'OWNER' : m.role === 'ADMIN' || m.role === 'MODERATOR' ? m.role : 'MEMBER');
  const nameOf = (a: string, m?: any) => nameFor?.(a) || (typeof m?.name === 'string' && m.name) || short(a);
  // Roles you can give: strictly below your own (lib/communities/roles.ts, enforced by the server).
  const givable = (['ADMIN', 'MODERATOR', 'MEMBER'] as Rank[]).filter((r) => isAdmin && rank && RANKS[r] < RANKS[rank]);

  return (
    <>
      {error && <p role="alert" className="rounded-2xl border border-[#9b1c16] bg-[#fdf3f2] px-4 py-3 text-[18px]" style={{ color: DANGER }}>{error}</p>}
      {ok && <p role="status" className="rounded-2xl border border-[#d4d8de] bg-[#f2f4f7] px-4 py-3 text-[18px]" style={{ color: INK }}>{ok}</p>}

      {isAdmin && requests.length > 0 && (
        <section className={`${card} px-4 py-4 flex flex-col gap-3`} aria-label={t('Requests to join')}>
          <h2 className="text-[19px] font-semibold" style={{ color: INK }}>{t('Requests to join')} · {requests.length}</h2>
          <p className="text-[16px] leading-snug" style={{ color: INK_SOFT }}>{t('These people opened your invite link. They see nothing until you approve them.')}</p>
          <ul className="divide-y divide-[#d4d8de]">
            {requests.map((r) => {
              const a = String(r.walletAddress || '').toLowerCase();
              return (
                <li key={a} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[18px] font-semibold truncate" style={{ color: INK }}>{nameOf(a, r)}</p>
                    <p className="text-[16px] tabular-nums" style={{ color: INK_SOFT }}>{short(a)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy === a} className={primary} onClick={() => call('POST', { walletAddress: a }, a, 'The request was not approved. Try again.', 'Approved. They are a member now.')}>{t('Approve')}</button>
                    <button type="button" disabled={busy === a} className={secondary} style={{ color: DANGER, borderColor: DANGER }} onClick={() => call('DELETE', { walletAddress: a, request: true }, a, 'The request was not declined. Try again.', 'Request declined.')}>{t('Decline')}</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {members === null && !error && <p className="text-[18px]" style={{ color: INK_SOFT }} role="status">{t("Loading…")}</p>}
      {members && (
        <ul className={`${card} divide-y divide-[#d4d8de]`}>
          {members.map((m) => {
            const a = String(m.walletAddress || '').toLowerCase();
            const isMe = a === me;
            const r = rankOfRow(m);
            const label = isMe ? t('You') : nameOf(a, m);
            const roleText = t(r === 'OWNER' ? 'Owner' : r === 'ADMIN' ? 'Admin' : r === 'MODERATOR' ? 'Moderator' : 'Member');
            // Act only on someone below you; moderators may remove members but not change roles.
            const canRemove = !isMe && !!rank && isPrivileged(rank) && RANKS[r] < RANKS[rank];
            const roleChoices = !isMe && rank && RANKS[r] < RANKS[rank] ? givable.filter((x) => x !== r) : [];
            return (
              <li key={a} className="px-4 py-3 flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[18px] font-semibold truncate" style={{ color: INK }}>{label}</p>
                    <p className="text-[16px]" style={{ color: INK_SOFT }}>{roleText}{label !== short(a) ? <span className="tabular-nums"> · {short(a)}</span> : null}</p>
                  </div>
                  {(roleChoices.length > 0 || canRemove) && (
                    <div className="flex flex-wrap gap-2">
                      {roleChoices.map((x) => (
                        <button key={x} type="button" disabled={busy === a} className={secondary} style={{ color: INK }}
                          onClick={() => call('PATCH', { walletAddress: a, role: x }, a, 'The role was not changed. Try again.', 'Role changed.')}>
                          {t(x === 'ADMIN' ? 'Make admin' : x === 'MODERATOR' ? 'Make moderator' : 'Make member')}
                        </button>
                      ))}
                      {canRemove && (
                        <button type="button" disabled={busy === a} className={secondary} style={{ color: DANGER, borderColor: DANGER }}
                          onClick={() => call('DELETE', { walletAddress: a }, a, 'The member was not removed. Try again.', mls ? 'Removed. They can no longer read new posts once the encrypted channel is updated.' : 'Removed.')}>
                          {t("Remove")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <details className={`${card} px-4 py-3`}>
        <summary className="text-[18px] font-semibold cursor-pointer" style={{ color: INK }}>{t('What each role can do')}</summary>
        <ul className="mt-2 flex flex-col gap-1.5 text-[16px] leading-snug" style={{ color: INK_SOFT }}>
          <li><b style={{ color: INK }}>{t('Owner')}</b> — {t('Everything, including deleting the community. There is one owner.')}</li>
          <li><b style={{ color: INK }}>{t('Admin')}</b> — {t(ROLE_HELP.ADMIN)}</li>
          <li><b style={{ color: INK }}>{t('Moderator')}</b> — {t(ROLE_HELP.MODERATOR)}</li>
          <li><b style={{ color: INK }}>{t('Member')}</b> — {t(ROLE_HELP.MEMBER)}</li>
        </ul>
      </details>
      {isAdmin && (
        <form className={`${card} px-4 py-4 flex flex-col gap-3`} onSubmit={(e) => { e.preventDefault(); if (validAdd) call('POST', { walletAddress: add.trim() }, 'add', 'The member was not added. Try again.', 'Added.').then(() => setAdd('')); }}>
          <label htmlFor="manage-add-member" className="text-[18px] font-semibold" style={{ color: INK }}>{t("Add a member by wallet address")}</label>
          <p className="text-[16px] leading-snug -mt-1" style={{ color: INK_SOFT }}>{t(mls ? 'They join as a member and can read new posts as soon as the encrypted channel adds them (your app does it now).' : 'They join as a member.')}</p>
          <input id="manage-add-member" value={add} onChange={(e) => setAdd(e.target.value)} placeholder="0x…" className={input} style={{ color: INK }} autoComplete="off" spellCheck={false} />
          <div className="flex justify-end">
            <button type="submit" disabled={!validAdd || busy === 'add'} className={primary}>{t("Add")}</button>
          </div>
        </form>
      )}
    </>
  );
}

// ─── Invite ──────────────────────────────────────────────────────────────────

function Invite({ joinCode, canReset, onReset }: { joinCode?: string | null; canReset?: boolean; onReset?: () => Promise<void> }) {
  const t = useT();
  const link = communityInviteUrl(joinCode);
  const [copied, setCopied] = useState<'' | 'yes' | 'no'>('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setCopied(''); }, [link]);
  if (!link) return <p className={`${card} px-4 py-3 text-[18px]`} style={{ color: INK }}>{t("This community has no invite link yet.")}</p>;
  return (
    <div className={`${card} px-4 py-4 flex flex-col gap-3`}>
      <p className="text-[18px] leading-snug" style={{ color: INK }}>{t("Send this link to someone you want in this community.")}</p>
      <p className="rounded-2xl border-2 border-[#9aa1ac] px-4 py-3 text-[18px] break-all" style={{ color: INK }} data-testid="invite-link">{link}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={primary}
          onClick={() => navigator.clipboard?.writeText(link).then(() => setCopied('yes'), () => setCopied('no'))}
        >
          {t("Copy the link")}
        </button>
        {copied === 'yes' && <span role="status" className="text-[18px]" style={{ color: INK }}>{t("Copied.")}</span>}
        {copied === 'no' && <span role="alert" className="text-[18px]" style={{ color: DANGER }}>{t("Not copied. Select the link and copy it.")}</span>}
      </div>
      {canReset && onReset && (
        <div className="border-t border-[#d4d8de] pt-3 flex flex-col gap-2">
          {!confirmReset ? (
            <button type="button" className={`${btn} px-4 self-start hover:bg-[#eff1f4]`} style={{ color: DANGER }} onClick={() => setConfirmReset(true)} data-testid="invite-reset">
              {t("Reset the link")}
            </button>
          ) : (
            <>
              <p className="text-[16px] leading-snug" style={{ color: INK }}>{t("Anyone with the old link will not be able to join with it. People already in stay.")}</p>
              <div className="flex flex-wrap gap-3">
                <button type="button" disabled={busy} className={primary} onClick={async () => { setBusy(true); try { await onReset(); } finally { setBusy(false); setConfirmReset(false); } }}>
                  {busy ? t("Resetting…") : t("Reset now")}
                </button>
                <button type="button" className={`${btn} px-4 hover:bg-[#eff1f4]`} style={{ color: INK }} onClick={() => setConfirmReset(false)}>{t("Cancel")}</button>
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
  const t = useT();
  const [n, setN] = useState(community?.name || '');
  const [d, setD] = useState(community?.description || '');
  const [busy, setBusy] = useState(false);
  return (
    <form className={`${card} px-4 py-4 flex flex-col gap-3`} onSubmit={async (e) => { e.preventDefault(); if (!n.trim()) return; setBusy(true); await onSave(n.trim(), d.trim()); setBusy(false); }}>
      <label htmlFor="manage-name" className="text-[18px] font-semibold" style={{ color: INK }}>{t("Name")}</label>
      <input id="manage-name" value={n} onChange={(e) => setN(e.target.value)} maxLength={60} className={input} style={{ color: INK }} />
      <label htmlFor="manage-description" className="text-[18px] font-semibold" style={{ color: INK }}>{t("Description")}</label>
      <textarea id="manage-description" value={d} onChange={(e) => setD(e.target.value)} maxLength={280} rows={3} className={`${input} resize-none`} style={{ color: INK }} />
      <div className="flex justify-end">
        <button type="submit" disabled={!n.trim() || busy} className={primary}>{t("Save")}</button>
      </div>
    </form>
  );
}

// ─── Channels ────────────────────────────────────────────────────────────────

function Channels({ channels, mls, onAdd, onDelete }: { channels: any[]; mls: boolean; onAdd: (name: string) => Promise<boolean>; onDelete: (id: string, name: string) => Promise<void> }) {
  const t = useT();
  const [n, setN] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const clean = n.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 40);
  const taken = channels.some((c) => String(c.name).toLowerCase() === clean);
  return (
    <>
      <p className="text-[16px] leading-snug" style={{ color: INK_SOFT }}>
        {t(mls ? 'Each channel is its own end-to-end encrypted group with every member. The first channel carries the community’s main posts and cannot be deleted.' : 'The first channel carries the community’s main posts and cannot be deleted.')}
      </p>
      <ul className={`${card} divide-y divide-[#d4d8de]`}>
        {channels.map((c, i) => (
          <li key={c.id} className="px-4 py-3 flex flex-col gap-2 min-h-[56px]">
            <div className="flex items-center gap-3">
              <span className="flex-1 min-w-0 text-[18px] font-semibold truncate" style={{ color: INK }}>
                {c.name}{i === 0 && <span className="ml-2 text-[15px] font-normal" style={{ color: INK_SOFT }}>{t('Main')}</span>}
              </span>
              {i > 0 && confirm !== c.id && (
                <button type="button" className={secondary} style={{ color: DANGER, borderColor: DANGER }} onClick={() => setConfirm(c.id)}>{t("Delete")}</button>
              )}
            </div>
            {confirm === c.id && (
              <div className="flex flex-col gap-2">
                <p className="text-[16px] leading-snug" style={{ color: INK }}>{t(mls ? 'Delete {name}? It disappears from the community for everyone. Posts already sent stay on the devices that received them.' : 'Delete {name}? Its posts are deleted for everyone.', { name: c.name })}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy} className={dangerBtn} onClick={async () => { setBusy(true); await onDelete(c.id, c.name); setBusy(false); setConfirm(null); }}>{t('Delete for everyone')}</button>
                  <button type="button" className={secondary} style={{ color: INK }} onClick={() => setConfirm(null)}>{t('Cancel')}</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <form className={`${card} px-4 py-4 flex flex-col gap-3`} onSubmit={async (e) => { e.preventDefault(); if (!clean || taken) return; setBusy(true); if (await onAdd(clean)) setN(''); setBusy(false); }}>
        <label htmlFor="manage-channel" className="text-[18px] font-semibold" style={{ color: INK }}>{t("Add a channel")}</label>
        <input id="manage-channel" value={n} onChange={(e) => setN(e.target.value)} placeholder={t("announcements")} maxLength={40} className={input} style={{ color: INK }} />
        {taken && <p role="alert" className="text-[16px]" style={{ color: DANGER }}>{t('A channel with this name already exists.')}</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={!clean || taken || busy} className={primary}>{busy ? t('Creating…') : t("Add")}</button>
        </div>
      </form>
    </>
  );
}

// ─── Permissions, moderation and slow mode ───────────────────────────────────

function Switches({ items, values, slow, mls, onChange }: {
  items: SettingInfo[]; values: Record<string, any>; slow: boolean; mls: boolean; onChange: (changes: Record<string, boolean | number>) => Promise<void>;
}) {
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, changes: Record<string, boolean | number>) => { setBusy(key); await onChange(changes); setBusy(null); };
  return (
    <>
      <ul className={`${card} divide-y divide-[#d4d8de]`}>
        {items.map(({ key, label, help }) => {
          const on = values[key] === true;
          return (
            <li key={key}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-describedby={`help-${key}`}
                disabled={busy === key}
                onClick={() => run(key, { [key]: !on })}
                className="w-full min-h-[56px] px-4 py-3 flex items-center gap-3 text-left text-[18px] hover:bg-[#f2f4f7] focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#15171c]/25"
                style={{ color: INK }}
              >
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold">{t(label)}</span>
                  <span id={`help-${key}`} className="block text-[15px] leading-snug mt-0.5" style={{ color: INK_SOFT }}>{t(help)}</span>
                </span>
                <span className={`min-w-[64px] text-center rounded-xl px-3 py-1 text-[16px] font-semibold border-2 shrink-0 ${on ? 'bg-[#15171c] border-[#15171c] text-white' : 'bg-white border-[#9aa1ac] text-[#15171c]'}`}>{busy === key ? '…' : on ? t("On") : t("Off")}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {slow && (
        <fieldset className={`${card} px-4 py-4`}>
          <legend className="px-1 text-[18px] font-semibold" style={{ color: INK }}>{t("Slow mode")}</legend>
          <p className="text-[16px] mb-3" style={{ color: INK_SOFT }}>{t(SLOW_MODE_HELP)}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="radiogroup" aria-label={t("Slow mode")}>
            {SLOW_MODE_OPTIONS.map(([v, l]) => {
              const on = (values.slowModeSeconds ?? 0) === v;
              return (
                <button key={v} type="button" role="radio" aria-checked={on} disabled={busy === 'slow'} onClick={() => run('slow', { slowModeSeconds: v })}
                  className={`${btn} ${on ? 'bg-[#15171c] text-white' : 'border-2 border-[#9aa1ac] bg-white text-[#15171c] hover:bg-[#f2f4f7]'}`}>
                  {t(l)}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      <p className="text-[16px] leading-snug" style={{ color: INK_SOFT }}>
        {t(mls ? ENFORCEMENT_NOTE_MLS : 'These rules apply to new posts in this community.')}
      </p>
    </>
  );
}

// ─── Privacy and discovery ───────────────────────────────────────────────────

function Privacy({ isPrivate, mls, onChange }: { isPrivate: boolean; mls: boolean; onChange: (priv: boolean) => Promise<void> }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">{t("Who can join")}</legend>
      {([
        [true, 'Private', 'Not listed in Discover. Only people with your invite link or a personal invite can join.'],
        [false, 'Public', 'Listed in Discover with its name and description. Anyone can join and read new posts.'],
      ] as const).map(([priv, label, text]) => (
        <button key={label} type="button" role="radio" aria-checked={isPrivate === priv} disabled={busy}
          onClick={async () => { if (isPrivate === priv) return; setBusy(true); await onChange(priv); setBusy(false); }}
          className={`${card} min-h-[56px] px-4 py-3 flex items-center gap-3 text-left border-2 ${isPrivate === priv ? 'border-[#15171c]' : 'border-[#d4d8de] hover:bg-[#f2f4f7]'}`}>
          <span className="flex-1 min-w-0">
            <span className="block text-[18px] font-semibold" style={{ color: INK }}>{t(label)}</span>
            <span className="block text-[16px]" style={{ color: INK_SOFT }}>{t(text)}</span>
          </span>
          <span className="text-[16px] font-semibold shrink-0" style={{ color: INK }}>{isPrivate === priv ? t("Selected") : t("Choose")}</span>
        </button>
      ))}
      <p className="text-[16px] leading-snug" style={{ color: INK_SOFT }}>
        {t(mls
          ? 'Either way, posts are end-to-end encrypted: only members can read them and our server never stores them. Our server knows the name, the description and who is a member.'
          : 'Either way, posts are stored on our server and people in the community can read them.')}
      </p>
      <p className="text-[16px] leading-snug" style={{ color: INK_SOFT }}>{t('To control who gets in one by one, turn on “Approve new members before they join” in Moderation.')}</p>
    </fieldset>
  );
}

// ─── Leave and Delete ────────────────────────────────────────────────────────

function Confirm({ text, action, typeToConfirm, onConfirm, onCancel }: {
  text: string; action: string; typeToConfirm?: string; onConfirm: () => Promise<void>; onCancel: () => void;
}) {
  const t = useT();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = !typeToConfirm || typed.trim() === typeToConfirm.trim();
  return (
    <div className={`${card} px-4 py-4 flex flex-col gap-3`}>
      <p className="text-[18px] leading-snug" style={{ color: INK }}>{text}</p>
      {typeToConfirm && (
        <>
          <label htmlFor="manage-confirm" className="text-[18px] font-semibold" style={{ color: INK }}>{t("Type the name to confirm: {typeToConfirm}", { typeToConfirm })}</label>
          <input id="manage-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} className={input} style={{ color: INK }} autoComplete="off" />
        </>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className={secondary} style={{ color: INK }}>{t("Cancel")}</button>
        <button type="button" disabled={!ready || busy} onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }} className={dangerBtn}>{action}</button>
      </div>
    </div>
  );
}
