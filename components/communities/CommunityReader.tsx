'use client';

/**
 * components/communities/CommunityReader.tsx
 *
 * The screen a person sees when they open one community: read the posts and
 * write one. One job, and Send is its only action. Everything else (pinned
 * posts, members, channels, invite, settings, apps, analytics, governance,
 * leaving) is behind one control, "Manage" (components/communities/CommunityManage.tsx),
 * a list of rows in this same style. A post sent here is stored unpinned.
 *
 * Two sources. By default posts are read from and written to
 * /api/chat/communities/:id/posts and the server can read every post; the screen says so in one
 * plain sentence and never calls these posts end-to-end encrypted. A community the operator has
 * flagged `communityMls` keeps its posts in an XMTP MLS group (lib/communities/mls.ts): they are
 * read and sent through the person's XMTP client, the server never receives them, and an admin's
 * client keeps the group's members equal to the server's list.
 *
 * A legacy community (made before 24 November 2026, posts stored by our server) is read-only
 * (lib/communities/legacy.ts): the old posts stay readable, the composer is replaced by a notice
 * that says why, and an owner or admin can re-create it end-to-end encrypted. Once re-created, every
 * member sees a button to join the new one; nobody is added for them and old posts are not copied.
 *
 * Built for people who do not want a guide: text at least 18px, labels in
 * ordinary words, text contrast at least 7:1 on its background, tap targets at
 * least 48px. No hashes, contract addresses or protocol names on this screen.
 *
 * Every post says who wrote it: the name the person saved for that wallet, else the author's
 * Ledger Chat name, else the shortened wallet. A name is always followed by the shortened wallet,
 * so two members with the same name are told apart. Right click (long press on a phone) on a post
 * opens its actions: copy the text, copy the wallet, write to the author privately, pin.
 * Private payments, agreements and invoices are never posted here.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Copy, MessageCircle, Pin, Wallet } from 'lucide-react';
import { ContextMenu, useContextMenuTrigger, type MenuAt, type MenuItem } from '@/components/chat/ui/ContextMenu';
import { tintFor, initials } from '@/components/chat/ui/kit';
import { addMissingMembers, mlsGroupOf, postToGroup, readGroupPosts, syncGroupMembers, type CommunityLike } from '@/lib/communities/mls';
import { createCommunityGroup } from '@/lib/communities/mls';
import { followSuccessor, recreateOnMls } from '@/lib/communities/recreate';
import { resolveInboxIdToAddress } from '@/lib/xmtp/client';
import { useT } from '@/lib/i18n/client';
import { UserAvatar, isWalletAddress } from '@/components/chat/UserAvatar';

export const VISIBILITY_SENTENCE = 'People in this community can read what you write here. It is not a private conversation.';
/** For a community whose posts live in an XMTP MLS group (lib/communities/mls.ts). */
/** For a read-only legacy community (lib/communities/legacy.ts): nothing new is written here. */
export const LEGACY_VISIBILITY_SENTENCE = 'Our server can read the posts in this community. That is why it no longer takes new ones.';
export const MLS_VISIBILITY_SENTENCE = 'Only members can read what you write here. Posts are end-to-end encrypted and our server does not store them. Who is a member is still known to our server.';

/** Text colours on white used here, with their contrast ratio. All are at least 7:1. */
const INK = '#15171c'; // 17.9:1
const INK_SOFT = '#3d424b'; // 10.4:1
const DANGER = '#9b1c16'; // 8.0:1

export interface ReaderPost {
  id: string;
  authorAddress?: string;
  /** The author's Ledger Chat name, from the server (null when they never set one). */
  authorName?: string | null;
  title?: string | null;
  content?: string | null;
  contentHtml?: string | null;
  createdAt?: string | number;
}

type Shown = ReaderPost & { state?: 'sending' | 'failed'; error?: string };

export interface CommunityReaderProps {
  communityId: string;
  myAddress: string;
  /** Name for a wallet address, if the person saved one. Otherwise "A member". */
  nameFor?: (address: string) => string | undefined;
  onBack: () => void;
  onManage: () => void;
  /** Opens a private conversation with a wallet (the post menu's "Message privately"). */
  onMessage?: (address: string) => void;
  /** Injected in tests; the browser's fetch otherwise. */
  fetchImpl?: typeof fetch;
  /** The signed-in XMTP client; needed only for a community whose posts live in an MLS group. */
  xmtpClient?: any;
  /** Opens another community (the encrypted re-creation of a read-only one). */
  onOpenCommunity?: (id: string) => void;
}

/** Why a legacy community no longer takes posts, in one place for the screen and its tests. */
export const READ_ONLY_TITLE = 'This community is read-only';
export const READ_ONLY_SENTENCE = 'It was made before 24 November 2026, when posts were stored on our server, which can read them. It no longer accepts new posts. The old posts stay here as they were: our server can still read them, and they are not moved.';

const DEFAULT_TITLE = /^community post$/i;

/** Plain text of a post. HTML from the rich editor is reduced to its text: nothing from a post is rendered as markup here. */
export function postText(p: ReaderPost): string {
  const raw = (p.content || p.contentHtml || '').toString();
  if (!/[<&]/.test(raw)) return raw.trim();
  const withBreaks = raw.replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, '\n');
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(withBreaks, 'text/html');
    return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  }
  return withBreaks.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function whenLabel(t: string | number | undefined): string {
  if (t === undefined) return '';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `Yesterday, ${time}`;
  return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' }) + `, ${time}`;
}

/** A sentence for a refused post, from the server's status. */
export function sendFailure(status: number | null, serverError?: string): string {
  if (status === null) return 'Not sent. This device could not reach the server. Check your connection and try again.';
  if (status === 403) return 'Not sent. You are not a member of this community yet. Join it first, then write here.';
  if (status === 413) return 'Not sent. This post is too long. Make it shorter and try again.';
  if (status === 410) return 'Not sent. This community does not accept posts on our server.';
  if (status === 401) return 'Not sent. You are signed out. Sign in again, then try again.';
  return `Not sent. ${serverError && serverError.length < 120 ? serverError.replace(/\.?$/, '.') : 'Something went wrong on the server.'} Try again.`;
}

/** 0x1234…abcd: enough to tell two wallets apart at a glance. */
export function shortWallet(a?: string | null): string {
  const s = (a || '').trim();
  return /^0x[0-9a-fA-F]{40}$/.test(s) ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

/** Who wrote a post: your saved name for them, else their Ledger Chat name, else their wallet. */
export function authorLabel(p: ReaderPost, me: string, nameFor?: (address: string) => string | undefined): { name: string; wallet: string; mine: boolean } {
  const addr = (p.authorAddress || '').toLowerCase();
  const wallet = shortWallet(addr);
  if (addr && addr === me) return { name: 'You', wallet, mine: true };
  const saved = addr ? nameFor?.(addr)?.trim() : undefined;
  const own = (p.authorName || '').trim();
  const name = saved || own || wallet || 'A member';
  return { name, wallet: name === wallet ? '' : wallet, mine: false };
}

export function CommunityReader({ communityId, myAddress, nameFor, onBack, onManage, onMessage, fetchImpl, xmtpClient, onOpenCommunity }: CommunityReaderProps) {
  const tr = useT();
  // Stable across renders: the loaders below depend on it, and a new function each render would refetch in a loop.
  const f = useMemo<typeof fetch>(() => fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a)), [fetchImpl]);
  const me = myAddress.toLowerCase();
  const headers = useMemo(() => ({ 'x-web3-address': me, 'x-verified-session-address': me }), [me]);

  const [name, setName] = useState('');
  const [members, setMembers] = useState<number | null>(null);
  const [mayPin, setMayPin] = useState(false);
  const [menu, setMenu] = useState<{ at: MenuAt; post: Shown } | null>(null);
  const [posts, setPosts] = useState<Shown[]>([]);
  const [load, setLoad] = useState<'loading' | 'ready' | 'error' | 'waiting'>('loading');
  const [draft, setDraft] = useState('');
  // Set from the community: the XMTP group that carries the posts, when the community is on MLS.
  const [mlsGroup, setMlsGroup] = useState<string | null>(null);
  const [mlsAdmin, setMlsAdmin] = useState<CommunityLike | null>(null);
  const [mlsMember, setMlsMember] = useState<CommunityLike | null>(null);
  // A legacy community: read-only, with the community it was re-created as, if any.
  const [readOnly, setReadOnly] = useState(false);
  const [successorId, setSuccessorId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [about, setAbout] = useState<{ description: string; isPrivate: boolean }>({ description: '', isPrivate: true });
  const [moving, setMoving] = useState<'idle' | 'confirm' | 'working'>('idle');
  const [moveError, setMoveError] = useState('');
  const senders = useRef(new Map<string, string>());
  const listEnd = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  const fetchCommunity = useCallback(async () => {
    try {
      const res = await f(`/api/chat/communities/${encodeURIComponent(communityId)}`, { headers, credentials: 'include' });
      if (!res.ok) return;
      const d = await res.json();
      const c = d.community ?? d;
      if (typeof c?.name === 'string') setName(c.name);
      const count = c?.membersCount ?? c?._count?.members ?? (Array.isArray(c?.members) ? c.members.length : null);
      setMembers(typeof count === 'number' ? count : null);
      // Same rule as the server (PATCH /api/chat/communities PIN_MESSAGE): owner, admin, or a member where members may pin.
      const mine = (Array.isArray(c?.members) ? c.members : []).find((m: any) => String(m?.walletAddress || '').toLowerCase() === me);
      const owner = String(c?.ownerAddress || '').toLowerCase() === me;
      setMayPin(owner || mine?.role === 'ADMIN' || (!!mine && c?.permissions?.pinMessages === true));
      setIsAdmin(owner || mine?.role === 'ADMIN');
      setReadOnly(c?.postsReadOnly === true);
      setSuccessorId(typeof c?.successorId === 'string' && c.successorId ? c.successorId : null);
      setAbout({ description: typeof c?.description === 'string' ? c.description : '', isPrivate: c?.isPrivate !== false });
      const group = mlsGroupOf(c);
      setMlsGroup(group);
      setMlsAdmin(group && (owner || mine?.role === 'ADMIN') ? (c as CommunityLike) : null);
      setMlsMember(group && mine && !(owner || mine?.role === 'ADMIN') ? (c as CommunityLike) : null);
    } catch { /* the header falls back to "Community" */ }
  }, [communityId, f, headers, me]);

  const fetchPosts = useCallback(async () => {
    if (mlsGroup) {
      // Posts live in the XMTP group: read them there, never from the server.
      if (!xmtpClient) { setLoad('error'); return; }
      try {
        // Not in the group yet: a member who is online adds people who joined (lib/communities/mls.ts).
        await xmtpClient.conversations?.sync?.().catch?.(() => {});
        const inGroup = await xmtpClient.conversations?.getConversationById?.(mlsGroup).catch?.(() => null);
        if (!inGroup) { setLoad((st) => (st === 'ready' ? 'ready' : 'waiting')); return; }
        const list = await readGroupPosts(xmtpClient, mlsGroup);
        const incoming: ReaderPost[] = [];
        for (const m of list) {
          let addr = senders.current.get(m.senderInboxId);
          if (addr === undefined) {
            addr = (await resolveInboxIdToAddress(m.senderInboxId, xmtpClient).catch(() => null)) ?? '';
            senders.current.set(m.senderInboxId, addr);
          }
          incoming.push({ id: m.id, authorAddress: addr || undefined, content: m.content, createdAt: m.createdAt });
        }
        setPosts((prev) => {
          const local = prev.filter((p) => p.state);
          const ids = new Set(incoming.map((p) => p.id));
          return [...incoming, ...local.filter((p) => !ids.has(p.id))].sort((a, b) => time(a) - time(b));
        });
        setLoad('ready');
      } catch {
        setLoad((st) => (st === 'ready' ? 'ready' : 'error'));
      }
      return;
    }
    try {
      const res = await f(`/api/chat/communities/${encodeURIComponent(communityId)}/posts`, { headers, credentials: 'include', cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      // 410 COMMUNITY_MLS: the posts live in an XMTP group; the community's details are still loading.
      if (res.status === 410 && d?.code === 'COMMUNITY_MLS') return;
      if (!res.ok) {
        setLoad('error');
        return;
      }
      if (d?.readOnly === true) setReadOnly(true);
      if (typeof d?.successorId === 'string' && d.successorId) setSuccessorId(d.successorId);
      const incoming: ReaderPost[] = Array.isArray(d.posts) ? d.posts : [];
      setPosts((prev) => {
        // Posts still sending or failed on this device stay until they are resolved.
        const local = prev.filter((p) => p.state);
        const ids = new Set(incoming.map((p) => p.id));
        return [...incoming.filter((p) => !!p.id), ...local.filter((p) => !ids.has(p.id))].sort((a, b) => time(a) - time(b));
      });
      setLoad('ready');
    } catch {
      setLoad((s) => (s === 'ready' ? 'ready' : 'error'));
    }
  }, [communityId, f, headers, mlsGroup, xmtpClient]);

  // An admin's client keeps the MLS group's members equal to the server's list (MLS_MIGRATION.md, step 2).
  useEffect(() => {
    if (!mlsGroup || !mlsAdmin || !xmtpClient) return;
    syncGroupMembers(xmtpClient, mlsGroup, mlsAdmin, me).catch(() => { /* retried next time the community opens */ });
  }, [mlsGroup, mlsAdmin, xmtpClient, me]);
  // Any other member's client adds people who joined while no admin was online (never removes).
  useEffect(() => {
    if (!mlsGroup || !mlsMember || !xmtpClient) return;
    addMissingMembers(xmtpClient, mlsGroup, mlsMember, me).catch(() => { /* retried next time the community opens */ });
  }, [mlsGroup, mlsMember, xmtpClient, me]);

  useEffect(() => {
    setLoad('loading');
    setPosts([]);
    fetchCommunity();
    fetchPosts();
    const t = setInterval(() => { if (typeof document === 'undefined' || document.visibilityState === 'visible') fetchPosts(); }, 15_000);
    return () => clearInterval(t);
  }, [fetchCommunity, fetchPosts]);

  // Follow the newest post, and bring a post that just failed into view: its error must be seen.
  const lastKey = posts.length ? `${posts[posts.length - 1].id}:${posts[posts.length - 1].state ?? ''}` : '';
  const failedKey = posts.filter((p) => p.state === 'failed').map((p) => p.id).join(',');
  useEffect(() => { listEnd.current?.scrollIntoView?.({ block: 'end' }); }, [lastKey, failedKey]);

  const submit = async (text: string, retryId?: string) => {
    const body = text.trim();
    if (!body) return;
    const localId = retryId ?? `local-${Date.now()}`;
    const pending: Shown = { id: localId, authorAddress: me, content: body, createdAt: Date.now(), state: 'sending' };
    setPosts((prev) => [...prev.filter((p) => p.id !== localId), pending]);
    if (!retryId) setDraft('');
    let status: number | null = null;
    let serverError: string | undefined;
    if (mlsGroup) {
      try {
        if (!xmtpClient) throw new Error('Not sent. Encrypted messaging is not connected on this device yet. Try again in a moment.');
        await postToGroup(xmtpClient, mlsGroup, body);
        setPosts((prev) => prev.map((p) => (p.id === localId ? { ...p, state: undefined } : p)));
        fetchPosts();
      } catch (e) {
        const text = e instanceof Error && e.message.startsWith('Not sent.') ? e.message : 'Not sent. The encrypted group did not accept it. Check your connection and try again.';
        setPosts((prev) => prev.map((p) => (p.id === localId ? { ...p, state: 'failed', error: text } : p)));
      }
      return;
    }
    try {
      const res = await f(`/api/chat/communities/${encodeURIComponent(communityId)}/posts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ title: tr("Community post"), content: body }),
      });
      status = res.status;
      const d = await res.json().catch(() => ({}));
      if (res.ok && d?.post?.id) {
        setPosts((prev) => [...prev.filter((p) => p.id !== localId), d.post as ReaderPost].sort((a, b) => time(a) - time(b)));
        return;
      }
      serverError = typeof d?.error === 'string' ? d.error : undefined;
      if (res.status === 410 && d?.code === 'COMMUNITY_LEGACY_READ_ONLY') {
        // The screen was out of date: show the notice, and keep the text so nothing is lost.
        setReadOnly(true);
        if (typeof d?.successorId === 'string' && d.successorId) setSuccessorId(d.successorId);
        setDraft(body);
        setPosts((prev) => prev.filter((p) => p.id !== localId));
        return;
      }
    } catch { /* status stays null: no answer */ }
    // A failed post stays on screen, marked, with what to do next. It never looks sent.
    setPosts((prev) => prev.map((p) => (p.id === localId ? { ...p, state: 'failed', error: sendFailure(status, serverError) } : p)));
  };

  const recreate = async () => {
    setMoving('working');
    setMoveError('');
    const r = await recreateOnMls({
      community: { id: communityId, name: name || 'Community', description: about.description, isPrivate: about.isPrivate },
      headers,
      fetchImpl: f,
      createGroup: async (n) => {
        if (!xmtpClient) throw new Error('not ready');
        return createCommunityGroup(xmtpClient, n);
      },
    });
    if (r.ok) {
      setSuccessorId(r.id);
      setMoving('idle');
      toast.success(tr("The encrypted community is ready. Invite people, or they join from here."));
      onOpenCommunity?.(r.id);
      return;
    }
    setMoving('confirm');
    setMoveError(tr(r.error));
  };

  const follow = async () => {
    if (!successorId) return;
    setMoving('working');
    setMoveError('');
    const r = await followSuccessor(communityId, headers, f);
    setMoving('idle');
    if (r.ok) { onOpenCommunity?.(r.id); return; }
    setMoveError(tr(r.error));
  };

  const dismiss = (id: string) => setPosts((prev) => prev.filter((p) => p.id !== id));

  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(tr(done));
    } catch {
      toast.error(tr("Could not copy on this device."));
    }
  };

  const pin = async (id: string) => {
    try {
      const res = await f('/api/chat/communities', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ action: 'PIN_MESSAGE', communityId, messageId: id }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d?.ok) toast.success(tr("Pin added. You find it in Manage."));
      else toast.error(typeof d?.error === 'string' ? d.error : tr("The pin was not added. Try again."));
    } catch {
      toast.error(tr("This device could not reach the server. Check your connection and try again."));
    }
  };

  const menuItems = (p: Shown): MenuItem[] => {
    const addr = (p.authorAddress || '').toLowerCase();
    const mine = addr === me;
    const items: MenuItem[] = [{ label: tr("Copy text"), icon: <Copy size={16} strokeWidth={1.9} />, onSelect: () => copy(postText(p), 'Text copied.') }];
    if (/^0x[0-9a-f]{40}$/.test(addr)) {
      items.push({ label: mine ? 'Copy your wallet' : 'Copy wallet address', icon: <Wallet size={16} strokeWidth={1.9} />, onSelect: () => copy(addr, 'Wallet address copied.') });
      if (!mine && onMessage) items.push({ label: tr("Message privately"), icon: <MessageCircle size={16} strokeWidth={1.9} />, onSelect: () => onMessage(addr) });
    }
    if (mayPin && !mlsGroup && !p.state && !p.id.startsWith('local-')) items.push({ label: tr("Pin"), icon: <Pin size={16} strokeWidth={1.9} />, onSelect: () => pin(p.id) });
    return items;
  };

  const title = name || 'Community';
  const btn = 'min-h-[48px] min-w-[48px] px-4 rounded-2xl text-[18px] font-semibold flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#15171c]/25';

  return (
    <section className="flex-1 flex flex-col h-full min-h-0 bg-white" aria-label={title}>
      <header className="shrink-0 flex items-center gap-2 px-3 sm:px-5 py-3 border-b border-[#d4d8de] bg-white">
        <button type="button" onClick={onBack} className={`${btn} px-3 hover:bg-[#eff1f4]`} style={{ color: INK }} aria-label={tr("Back to your communities")}>
          <span aria-hidden="true" className="text-[22px] leading-none">‹</span>
          <span className="hidden sm:inline">{tr("Back")}</span>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[21px] sm:text-[22px] font-semibold leading-tight truncate" style={{ color: INK }}>{title}</h1>
          {members !== null && (
            <p className="text-[16px] leading-snug" style={{ color: INK_SOFT }}>{members === 1 ? tr("1 member") : tr("{members} members", { members })}</p>
          )}
        </div>
        <button type="button" onClick={onManage} className={`${btn} border-2 border-[#15171c] bg-white hover:bg-[#f2f4f7]`} style={{ color: INK }}>
          {tr("Manage")}
        </button>
      </header>

      <p className="shrink-0 px-4 sm:px-6 py-3 text-[18px] leading-snug bg-[#f2f4f7] border-b border-[#d4d8de]" style={{ color: INK }} role="note">
        {tr(mlsGroup ? MLS_VISIBILITY_SENTENCE : readOnly ? LEGACY_VISIBILITY_SENTENCE : VISIBILITY_SENTENCE)}
      </p>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4" aria-live="polite">
        {load === 'loading' && posts.length === 0 && (
          <p className="text-[18px] py-10 text-center" style={{ color: INK_SOFT }} role="status">{tr("Loading the posts…")}</p>
        )}
        {load === 'waiting' && posts.length === 0 && (
          <div className="py-10 text-center" role="status" data-testid="mls-waiting">
            <p className="text-[18px] leading-snug" style={{ color: INK }}>{tr("You are in. The posts here are end-to-end encrypted: they appear as soon as a member who is online adds you to the encrypted channel.")}</p>
          </div>
        )}
        {load === 'error' && posts.length === 0 && (
          <div className="py-10 text-center" role="alert">
            <p className="text-[18px] leading-snug" style={{ color: INK }}>{tr("The posts could not be loaded. Check your connection and try again.")}</p>
            <button type="button" onClick={() => { setLoad('loading'); fetchPosts(); }} className={`${btn} mx-auto mt-4 bg-[#15171c] text-white hover:bg-[#2a2d34]`}>{tr("Try again")}</button>
          </div>
        )}
        {load === 'ready' && posts.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-[18px] leading-snug" style={{ color: INK }}>{readOnly ? tr("There are no old posts in this community.") : tr("No posts yet. Write the first one below.")}</p>
          </div>
        )}
        <ol className="flex flex-col gap-4 max-w-[720px] mx-auto">
          {posts.map((p) => {
            const author = authorLabel(p, me, nameFor);
            const text = postText(p);
            const heading = p.title && !DEFAULT_TITLE.test(p.title.trim()) ? p.title.trim() : '';
            const when = p.state !== 'sending' && p.state !== 'failed' ? whenLabel(p.createdAt) : '';
            return (
              <PostItem
                key={p.id}
                failed={p.state === 'failed'}
                mine={author.mine}
                label={tr("Post by {name}", { name: author.name })}
                onMenu={(at) => setMenu({ at, post: p })}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {isWalletAddress(p.authorAddress) ? <UserAvatar address={p.authorAddress} size={36} /> : (
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[14px] font-semibold shrink-0 select-none"
                    style={tintFor(p.authorAddress)}
                    aria-hidden="true"
                  >
                    {initials(author.mine ? '' : author.name, p.authorAddress)}
                  </span>
                  )}
                  <p className="min-w-0 flex-1 text-[16px] leading-tight">
                    <span className="font-semibold" style={{ color: INK }}>{author.name}</span>
                    {author.wallet ? <span className="ml-1.5 tabular-nums" style={{ color: INK_SOFT }}>{author.wallet}</span> : null}
                    {when ? <span className="block text-[15px] mt-0.5" style={{ color: INK_SOFT }}>{when}</span> : null}
                  </p>
                </div>
                {heading && <p className="text-[19px] font-semibold mt-2" style={{ color: INK }}>{heading}</p>}
                <p className="text-[18px] leading-relaxed mt-2 whitespace-pre-wrap break-words" style={{ color: INK }}>{text}</p>
                {p.state === 'sending' && <p className="text-[16px] mt-2" style={{ color: INK_SOFT }} role="status">{tr("Sending…")}</p>}
                {p.state === 'failed' && (
                  <div className="mt-2" role="alert">
                    <p className="text-[17px] font-semibold leading-snug" style={{ color: DANGER }}>{p.error}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button type="button" onClick={() => submit(text, p.id)} className={`${btn} bg-[#15171c] text-white hover:bg-[#2a2d34]`}>{tr("Try again")}</button>
                      <button type="button" onClick={() => dismiss(p.id)} className={`${btn} border-2 border-[#15171c] bg-white`} style={{ color: INK }}>{tr("Remove")}</button>
                    </div>
                  </div>
                )}
              </PostItem>
            );
          })}
        </ol>
        {menu && <ContextMenu at={menu.at} items={menuItems(menu.post)} label={tr("Post actions")} onClose={() => setMenu(null)} />}
        <div ref={listEnd} />
      </div>

      {readOnly ? (
        <div
          className="shrink-0 border-t border-[#d4d8de] bg-[#f2f4f7] px-4 sm:px-6 pt-4 pb-[max(16px,env(safe-area-inset-bottom))]"
          role="region"
          aria-label={tr(READ_ONLY_TITLE)}
          data-testid="legacy-read-only"
        >
          <div className="max-w-[720px] mx-auto">
            <h2 className="text-[19px] font-semibold leading-snug" style={{ color: INK }}>{tr(READ_ONLY_TITLE)}</h2>
            <p className="text-[18px] leading-snug mt-1" style={{ color: INK }}>{tr(READ_ONLY_SENTENCE)}</p>
            {successorId ? (
              <>
                <p className="text-[18px] leading-snug mt-3" style={{ color: INK }}>{tr("It continues as a new community where posts are end-to-end encrypted and our server does not store them. Joining is your choice.")}</p>
                <button type="button" onClick={follow} disabled={moving === 'working'} className={`${btn} mt-3 px-6 bg-[#15171c] text-white hover:bg-[#2a2d34] disabled:bg-[#e4e7ec] disabled:text-[#3d424b]`}>
                  {moving === 'working' ? tr("Joining…") : tr("Join the encrypted community")}
                </button>
              </>
            ) : isAdmin ? (
              moving === 'idle' ? (
                <button type="button" onClick={() => { setMoveError(''); setMoving('confirm'); }} className={`${btn} mt-3 px-6 bg-[#15171c] text-white hover:bg-[#2a2d34]`}>
                  {tr("Re-create it end-to-end encrypted")}
                </button>
              ) : (
                <div className="mt-3" data-testid="legacy-recreate-confirm">
                  <p className="text-[18px] leading-snug" style={{ color: INK }}>{tr("A new community starts with the same name, and its posts are end-to-end encrypted. Members are not added for them: each one sees a button here to join. Old posts are not copied.")}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button type="button" onClick={recreate} disabled={moving === 'working'} className={`${btn} px-6 bg-[#15171c] text-white hover:bg-[#2a2d34] disabled:bg-[#e4e7ec] disabled:text-[#3d424b]`}>
                      {moving === 'working' ? tr("Creating…") : tr("Create the encrypted community")}
                    </button>
                    <button type="button" onClick={() => setMoving('idle')} disabled={moving === 'working'} className={`${btn} border-2 border-[#15171c] bg-white`} style={{ color: INK }}>{tr("Cancel")}</button>
                  </div>
                </div>
              )
            ) : (
              <p className="text-[18px] leading-snug mt-3" style={{ color: INK_SOFT }}>{tr("An owner or admin can re-create it end-to-end encrypted. You will then see a button here to join.")}</p>
            )}
            {moveError && <p className="text-[17px] font-semibold leading-snug mt-2" style={{ color: DANGER }} role="alert">{moveError}</p>}
          </div>
        </div>
      ) : (
      <form
        className="shrink-0 border-t border-[#d4d8de] bg-white px-3 sm:px-6 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"
        onSubmit={(e) => { e.preventDefault(); submit(draft); }}
      >
        <div className="max-w-[720px] mx-auto">
          <label htmlFor={`community-write-${communityId}`} className="block text-[18px] font-semibold mb-2" style={{ color: INK }}>
            {tr("Write a post")}
          </label>
          <textarea
            id={`community-write-${communityId}`}
            ref={field}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            maxLength={8000}
            data-allow-context
            placeholder={tr("Write your message here")}
            className="w-full rounded-2xl border-2 border-[#9aa1ac] focus:border-[#15171c] outline-none px-4 py-3 text-[18px] leading-relaxed resize-none placeholder:text-[#4a505c] bg-white"
            style={{ color: INK }}
          />
          {/* Send is the only action here. */}
          <div className="flex justify-end gap-2 mt-2">
            <button type="submit" disabled={!draft.trim()} className={`${btn} px-6 bg-[#15171c] text-white hover:bg-[#2a2d34] disabled:bg-[#e4e7ec] disabled:text-[#3d424b]`}>
              {tr("Send")}
            </button>
          </div>
        </div>
      </form>
      )}
    </section>
  );
}

/** One post. Right click, or a long press on a touch screen, opens its actions. */
function PostItem({ failed, mine, label, onMenu, children }: { failed: boolean; mine: boolean; label: string; onMenu: (at: MenuAt) => void; children: React.ReactNode }) {
  const { handlers } = useContextMenuTrigger(onMenu);
  return (
    <li
      {...handlers}
      aria-label={label}
      className={`rounded-2xl border px-4 py-3 ${failed ? 'border-[#9b1c16] bg-[#fdf3f2]' : mine ? 'border-[#c9d6f2] bg-[#f4f7fe]' : 'border-[#d4d8de] bg-white'}`}
      style={{ WebkitTouchCallout: 'none' }}
    >
      {children}
    </li>
  );
}

function time(p: ReaderPost): number {
  const t = p.createdAt === undefined ? 0 : new Date(p.createdAt).getTime();
  return Number.isNaN(t) ? 0 : t;
}
