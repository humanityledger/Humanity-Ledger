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
import { BarChart3, Copy, CornerUpRight, Forward, Images, MessageCircle, Mic, Paperclip, Pin, Search, SmilePlus, Square, Users, Wallet, X } from 'lucide-react';
import { QUICK_REACTIONS, encodeReaction, encodeReply, encodeUnreact, plainSnippet, searchPosts, tallyReactions, unwrap } from '@/lib/communities/interactions';
import { recordTiming } from '@/lib/perf/client-timings';
import { CommunityMediaSheet } from '@/components/communities/CommunityMediaSheet';
import { MemberSheet, MembersPanel, useCommunityMembers } from '@/components/communities/MemberSheet';
import { PostBody, PollComposer } from '@/components/communities/PostBody';
import { isControlMessage, type IndexInput } from '@/lib/communities/media-index';
import { ContextMenu, useContextMenuTrigger, type MenuAt, type MenuItem } from '@/components/chat/ui/ContextMenu';
import { tintFor, initials } from '@/components/chat/ui/kit';
import { addMissingMembers, mlsGroupOf, postToGroup, readGroupPosts, syncAllCommunityChannels, syncGroupMembers, type CommunityLike } from '@/lib/communities/mls';
import { createCommunityGroup } from '@/lib/communities/mls';
import { checkPost, effectivePermissions, encodePin, isPrivileged, mayPinFor, rankIn, spamIds, type CommunityPermissions, type PostKind, type Rank } from '@/lib/communities/settings';
import { followSuccessor, recreateOnMls } from '@/lib/communities/recreate';
import { resolveInboxIdToAddress } from '@/lib/xmtp/client';
import { resolveGroupForClient } from '@/lib/xmtp/groups';
import { useT } from '@/lib/i18n/client';
import { AVATAR_RADIUS, UserAvatar, isWalletAddress } from '@/components/chat/UserAvatar';

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
  /** Opens a private conversation and its Pay sheet (the member profile's "Pay"). */
  onPay?: (address: string) => void;
  /** Forwards a post's content to another chat (the chat's own forward picker). */
  onForward?: (content: string) => void;
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
  /** Channel to open first (Manage → Channels → Open). Falls back to the main channel when unknown. */
  initialChannelId?: string | null;
}

/** A channel as the reading screen shows it: the server's metadata, never its posts. */
export interface ReaderChannel {
  id: string;
  name: string;
  xmtpGroupId: string | null;
}

/**
 * The channels a reader can open. In an encrypted community only channels whose MLS group exists
 * are listed (a channel still being created has nowhere to read from or post to).
 */
export function readerChannels(c: { channels?: unknown } | null | undefined, mls: boolean): ReaderChannel[] {
  const raw = Array.isArray(c?.channels) ? (c!.channels as Array<Record<string, unknown>>) : [];
  const out: ReaderChannel[] = [];
  for (const ch of raw) {
    const id = typeof ch?.id === 'string' ? ch.id : '';
    if (!id) continue;
    const gid = typeof ch?.xmtpGroupId === 'string' && ch.xmtpGroupId.trim() ? ch.xmtpGroupId.trim() : null;
    if (mls && !gid) continue;
    out.push({ id, name: typeof ch?.name === 'string' && ch.name ? ch.name : 'general', xmtpGroupId: gid });
  }
  return out;
}

/** Which channel is open: the one asked for if it exists, else the current one, else the first. */
export function pickChannel(list: readonly ReaderChannel[], current: string | null, wanted?: string | null): string | null {
  if (current && list.some((c) => c.id === current)) return current;
  if (wanted && list.some((c) => c.id === wanted)) return wanted;
  return list[0]?.id ?? null;
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

export function CommunityReader({ communityId, myAddress, nameFor, onBack, onManage, onMessage, onPay, onForward, fetchImpl, xmtpClient, onOpenCommunity, initialChannelId }: CommunityReaderProps) {
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
  const [mlsOn, setMlsOn] = useState(false);
  const [channels, setChannels] = useState<ReaderChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(initialChannelId ?? null);
  const [checking, setChecking] = useState(false);
  /** The group a read is in flight for: one read per group at a time, and a stale read never lands in another channel. */
  const fetchingPosts = useRef<string | null>(null);
  const openGroup = useRef<string | null>(null);
  const activeChannel = useMemo(() => channels.find((c) => c.id === activeChannelId) ?? channels[0] ?? null, [channels, activeChannelId]);
  // The open channel's MLS group: posts are read from and written to that group only.
  const mlsGroup = mlsOn ? activeChannel?.xmtpGroupId ?? null : null;
  openGroup.current = mlsGroup;
  const [mlsAdmin, setMlsAdmin] = useState<CommunityLike | null>(null);
  const [mlsMember, setMlsMember] = useState<CommunityLike | null>(null);
  // A legacy community: read-only, with the community it was re-created as, if any.
  const [readOnly, setReadOnly] = useState(false);
  const [successorId, setSuccessorId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // The community's rules and roles (lib/communities/settings.ts): applied by this app to what it sends
  // and shows, because posts of an encrypted community never reach our server.
  const [rules, setRules] = useState<CommunityPermissions>(effectivePermissions(null));
  const [roleInfo, setRoleInfo] = useState<{ ownerAddress?: string | null; members?: { walletAddress?: string | null; role?: string | null }[] } | null>(null);
  const [communityLoaded, setCommunityLoaded] = useState(false);
  const myRank: Rank | null = useMemo(() => rankIn(roleInfo, me), [roleInfo, me]);
  const [about, setAbout] = useState<{ description: string; isPrivate: boolean }>({ description: '', isPrivate: true });
  const [moving, setMoving] = useState<'idle' | 'confirm' | 'working'>('idle');
  const [moveError, setMoveError] = useState('');
  // Communities V2 (docs/plan/COMMUNITIES_V2.md): every group message (votes included) for poll
  // results and Shared Media; member list and profiles; attachments and polls from the composer.
  const [rawMsgs, setRawMsgs] = useState<IndexInput[]>([]);
  const [ownerAddress, setOwnerAddress] = useState<string | null>(null);
  const [peopleKey, setPeopleKey] = useState(0);
  const [openMember, setOpenMember] = useState<string | null>(null);
  const [panel, setPanel] = useState<'media' | 'members' | null>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const [attaching, setAttaching] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const filePick = useRef<HTMLInputElement>(null);
  // Phase 2: replies, reactions, search and voice notes (all MLS application messages).
  const [replyTo, setReplyTo] = useState<{ id: string; snippet: string } | null>(null);
  const [reactFor, setReactFor] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [rec, setRec] = useState<{ started: number; recorder: MediaRecorder; chunks: Blob[]; stream: MediaStream } | null>(null);
  const [recSecs, setRecSecs] = useState(0);
  const reactions = useMemo(() => tallyReactions(rawMsgs, me), [rawMsgs, me]);
  const sendControl = useCallback(async (msg: string) => {
    if (!mlsGroup || !xmtpClient) return;
    try {
      await postToGroup(xmtpClient, mlsGroup, msg);
    } catch (e) {
      const m = e instanceof Error ? e.message : typeof (e as any)?.message === 'string' ? (e as any).message : '';
      toast.error(tr(m.startsWith('Not sent.') ? m : 'Not sent. Check your connection and try again.'));
    }
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mlsGroup, xmtpClient]);
  const memberRows = useCommunityMembers(communityId, peopleKey);
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
      setOwnerAddress(typeof c?.ownerAddress === 'string' ? c.ownerAddress.toLowerCase() : null);
      const p = effectivePermissions(c?.permissions);
      setRules(p);
      const memberRowsList: { walletAddress?: string | null; role?: string | null }[] = Array.isArray(c?.members)
        ? c.members.map((m: any) => ({ ...m, role: typeof m?.role === 'string' ? m.role.toUpperCase() : m?.role }))
        : [];
      const fallbackRole = typeof c?.myRole === 'string' && c.myRole.trim() ? c.myRole.trim().toUpperCase() : 'MEMBER';
      if (!owner && !mine && c?.isMember === true) {
        memberRowsList.push({ walletAddress: me, role: fallbackRole });
      }
      const nextRoleInfo = { ownerAddress: c?.ownerAddress, members: memberRowsList };
      setRoleInfo(nextRoleInfo);
      setCommunityLoaded(true);
      const myRoleUpper = typeof (mine?.role ?? c?.myRole) === 'string' ? String(mine?.role ?? c?.myRole).toUpperCase() : '';
      const isOwnerOrAdmin = owner || myRoleUpper === 'ADMIN';
      setMayPin(mayPinFor(p, rankIn(nextRoleInfo, me)));
      setIsAdmin(isOwnerOrAdmin);
      setReadOnly(c?.postsReadOnly === true);
      setSuccessorId(typeof c?.successorId === 'string' && c.successorId ? c.successorId : null);
      setAbout({ description: typeof c?.description === 'string' ? c.description : '', isPrivate: c?.isPrivate !== false });
      const group = mlsGroupOf(c);
      const list = readerChannels(c, group !== null);
      setMlsOn(group !== null);
      setChannels((prev) => (JSON.stringify(prev) === JSON.stringify(list) ? prev : list));
      setActiveChannelId((cur) => pickChannel(list, cur, initialChannelId));
      const effectiveCommunity = memberRowsList.length !== (c?.members?.length ?? 0) ? { ...c, members: memberRowsList } : c;
      setMlsAdmin(group && isOwnerOrAdmin ? (effectiveCommunity as CommunityLike) : null);
      setMlsMember(group && (mine || c?.isMember === true) && !isOwnerOrAdmin ? (effectiveCommunity as CommunityLike) : null);
    } catch { /* the header falls back to "Community" */ }
  }, [communityId, f, headers, me, initialChannelId]);

  const pendingRefetch = useRef(false);
  const fetchPosts = useCallback(async () => {
    if (mlsGroup) {
      // Posts live in the XMTP group: read them there, never from the server.
      if (!xmtpClient) { setLoad((s) => (s === 'ready' ? 'ready' : 'loading')); return; }
      if (fetchingPosts.current === mlsGroup) { pendingRefetch.current = true; return; }
      fetchingPosts.current = mlsGroup;
      pendingRefetch.current = false;
      try {
        // Not in the group yet: a member who is online adds people who joined (lib/communities/mls.ts).
        // resolveGroupForClient syncs welcomes of unknown consent and matches the id case-insensitively.
        await xmtpClient.conversations?.sync?.().catch?.(() => {});
        const inGroup = await resolveGroupForClient(xmtpClient, mlsGroup).catch(() => null);
        if (openGroup.current !== mlsGroup) return;
        if (!inGroup) { setLoad((st) => (st === 'ready' ? 'ready' : 'waiting')); return; }
        // The server lists this person as a member: a welcome still marked Unknown is theirs to accept.
        if (typeof inGroup.consentState === 'function' && typeof inGroup.updateConsentState === 'function') {
          const st = await Promise.resolve(inGroup.consentState()).catch(() => 1);
          if (st !== 1) await Promise.resolve(inGroup.updateConsentState(1)).catch(() => {});
        }
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
        if (openGroup.current !== mlsGroup) return;
        // Votes, reactions and receipts are kept for poll results and media, never shown as posts.
        setRawMsgs(incoming.map((x) => ({ id: x.id, content: x.content, authorAddress: x.authorAddress, createdAt: x.createdAt })));
        const visible = incoming.filter((x) => !isControlMessage(x.content));
        setPosts((prev) => {
          const local = prev.filter((p) => p.state);
          const ids = new Set(visible.map((p) => p.id));
          // 1-to-1 match any in-flight 'sending' placeholder against an incoming confirmed copy from me
          const available = visible.map((v, i) => ({ v, i })).filter(({ v }) => (v.authorAddress || '').toLowerCase() === me);
          const consumedIdx = new Set<number>();
          const remainingLocal = local.filter((p) => {
            if (ids.has(p.id)) return false;
            if (p.state === 'sending') {
              const hit = available.find(
                ({ v, i }) => !consumedIdx.has(i) && (v.content || '') === (p.content || ''),
              );
              if (hit) { consumedIdx.add(hit.i); return false; }
            }
            return true;
          });
          return [...visible, ...remainingLocal].sort((a, b) => time(a) - time(b));
        });
        setLoad('ready');
      } catch {
        setLoad((st) => (st === 'ready' ? 'ready' : 'error'));
      } finally {
        const queued = pendingRefetch.current;
        if (fetchingPosts.current === mlsGroup) fetchingPosts.current = null;
        if (queued && openGroup.current === mlsGroup) {
          pendingRefetch.current = false;
          queueMicrotask(() => { void fetchPosts(); });
        }
      }
      return;
    }
    try {
      // If the community metadata hasn't loaded yet and we know it's MLS, skip the server call.
      if (!mlsGroup && mlsOn) return;
      const q = channels.length > 1 && activeChannel ? `?channelId=${encodeURIComponent(activeChannel.id)}` : '';
      const res = await f(`/api/chat/communities/${encodeURIComponent(communityId)}/posts${q}`, { headers, credentials: 'include', cache: 'no-store' });
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
  }, [communityId, f, headers, mlsGroup, mlsOn, xmtpClient, channels.length, activeChannel]);

  /** One click for a member still waiting: fetch welcomes, add anyone missing, read again. */
  const checkAccess = useCallback(async () => {
    if (!xmtpClient) {
      toast.error(tr("Encrypted messaging is still starting on this device. Try again in a few seconds."));
      return;
    }
    setChecking(true);
    try {
      await Promise.resolve(xmtpClient.conversations?.syncAll?.([0, 1])).catch(() => {});
      const c = mlsAdmin ?? mlsMember;
      if (c && mlsGroup) await addMissingMembers(xmtpClient, mlsGroup, c, me).catch(() => 0);
      fetchingPosts.current = null;
      await fetchPosts();
    } finally {
      setChecking(false);
    }
  }, [xmtpClient, mlsAdmin, mlsMember, mlsGroup, me, fetchPosts, tr]);

  /** Join a public community from Discover / Reader without a join code. */
  const joinCommunity = useCallback(async () => {
    setJoining(true);
    try {
      const res = await f('/api/chat/communities/join', {
        method: 'POST', credentials: 'include',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ communityId }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok && d?.code !== 'ALREADY_MEMBER' && d?.status !== 'ALREADY_MEMBER') {
        toast.error(tr(d?.error || 'Could not join'));
        return;
      }
      await fetchCommunity();
      await fetchPosts();
    } catch {
      toast.error(tr('Could not join'));
    } finally {
      setJoining(false);
    }
  }, [communityId, f, headers, fetchCommunity, fetchPosts, tr]);

  // Switching channel: a reply belongs to the channel it was started in.
  useEffect(() => { setReplyTo(null); setRawMsgs([]); }, [activeChannelId]);

  // An admin's client keeps every encrypted channel's members equal to the server's list (MLS_MIGRATION.md, step 2).
  useEffect(() => {
    if (!mlsGroup || !mlsAdmin || !xmtpClient) return;
    syncGroupMembers(xmtpClient, mlsGroup, mlsAdmin, me)
      .then(() => syncAllCommunityChannels(xmtpClient, mlsAdmin, me, true))
      .catch(() => { /* retried next time the community opens */ });
  }, [mlsGroup, mlsAdmin, xmtpClient, me]);
  // Any other member's client adds people who joined while no admin was online (never removes).
  useEffect(() => {
    if (!mlsGroup || !mlsMember || !xmtpClient) return;
    addMissingMembers(xmtpClient, mlsGroup, mlsMember, me)
      .then(() => syncAllCommunityChannels(xmtpClient, mlsMember, me, false))
      .catch(() => { /* retried next time the community opens */ });
  }, [mlsGroup, mlsMember, xmtpClient, me]);

  // While waiting for an online member's encrypted welcome, poll every 2.5 s so writing unlocks immediately.
  useEffect(() => {
    if (!mlsGroup || load !== 'waiting') return;
    const fast = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void fetchPosts();
      }
    }, 2_500);
    return () => clearInterval(fast);
  }, [mlsGroup, load, fetchPosts]);

  const mlsReady = load === 'ready';
  useEffect(() => {
    if (!mlsGroup || !xmtpClient || !mlsReady) return;
    let cancelled = false;
    const ac = new AbortController();
    let activeStream: { return?: () => Promise<any>; close?: () => any } | null = null;

    const run = async () => {
      // Self-healing reconnect loop: restart the stream on transient errors.
      while (!cancelled && !ac.signal.aborted && openGroup.current === mlsGroup) {
        try {
          const grp = await resolveGroupForClient(xmtpClient, mlsGroup).catch(() => null);
          if (cancelled || openGroup.current !== mlsGroup) return;
          const iterator =
            grp && typeof (grp as any).stream === 'function'
              ? await (grp as any).stream()
              : typeof xmtpClient.conversations?.streamAllGroupMessages === 'function'
                ? await xmtpClient.conversations.streamAllGroupMessages()
                : null;
          if (!iterator || cancelled) {
            try { await iterator?.return?.(); } catch {}
            return;
          }
          activeStream = iterator;
          const selfInbox = String((xmtpClient as any)?.inboxId || '').toLowerCase();
          for await (const m of iterator) {
            if (cancelled || ac.signal.aborted || openGroup.current !== mlsGroup) break;
            if (!m) continue;
            const tId = String((m as any).contentType?.typeId || '');
            if (
              (m as any).kind === 1 ||
              (m as any).kind === 'membership_change' ||
              tId === 'group_updated' ||
              tId === 'group_membership_change'
            ) continue;

            const msgConvId = String((m as any).conversationId || (m as any).groupId || (m as any).conversation?.id || mlsGroup).toLowerCase();
            if (msgConvId !== mlsGroup.toLowerCase()) continue;

            const rawContent = (m as any).content;
            const content =
              typeof rawContent === 'string'
                ? rawContent
                : typeof rawContent?.text === 'string'
                  ? rawContent.text
                  : typeof (m as any).fallback === 'string'
                    ? (m as any).fallback
                    : '';
            if (!content || content.includes('initiatedByInboxId') || content.includes('addedInboxes') || content.includes('removedInboxes')) continue;

            const id = String((m as any).id || '');
            if (!id) continue;
            const senderInbox = String((m as any).senderInboxId || '');
            let addr = senders.current.get(senderInbox);
            if (addr === undefined && senderInbox) {
              addr = (await resolveInboxIdToAddress(senderInbox, xmtpClient).catch(() => null)) ?? '';
              senders.current.set(senderInbox, addr);
            }
            if (cancelled || openGroup.current !== mlsGroup) return;
            const authorAddr = (addr || '').toLowerCase() || undefined;
            const isMineStream =
              (!!senderInbox && !!selfInbox && senderInbox.toLowerCase() === selfInbox) ||
              authorAddr === me;
            const createdAt =
              typeof (m as any).sentAtNs === 'bigint'
                ? Number((m as any).sentAtNs / BigInt(1_000_000))
                : typeof (m as any).sentAtNs === 'number'
                  ? ((m as any).sentAtNs > 1e14 ? Math.floor((m as any).sentAtNs / 1e6) : (m as any).sentAtNs)
                  : (m as any).sentAt
                    ? new Date((m as any).sentAt).getTime()
                    : Date.now();

            const nextEntry: ReaderPost = { id, authorAddress: authorAddr || (isMineStream ? me : undefined), content, createdAt };
            setLoad('ready');
            setRawMsgs((prev) => (prev.some((x) => x.id === id) ? prev : [...prev, { id, content, authorAddress: nextEntry.authorAddress, createdAt }]));
            if (!isControlMessage(content)) {
              setPosts((prev) => {
                if (prev.some((p) => p.id === id)) return prev;
                const sendingIdx = isMineStream
                  ? prev.findIndex(
                      (p) =>
                        p.state === 'sending' &&
                        (p.content || '') === content &&
                        (p.authorAddress || '').toLowerCase() === me,
                    )
                  : -1;
                const base = sendingIdx !== -1 ? prev.filter((_, idx) => idx !== sendingIdx) : prev;
                return [...base, nextEntry].sort((a, b) => time(a) - time(b));
              });
            }
          }
        } catch {
          // Transient stream error — wait 3 s then reconnect.
        }
        activeStream = null;
        if (!cancelled && openGroup.current === mlsGroup) {
          await new Promise((r) => setTimeout(r, 3_000));
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
      ac.abort();
      try { activeStream?.return?.(); } catch {}
      try { activeStream?.close?.(); } catch {}
    };
  }, [mlsGroup, xmtpClient, mlsReady, me]);

  const prevChannelGroupRef = useRef<string | null>(null);
  useEffect(() => {
    prevChannelGroupRef.current = null;
    setCommunityLoaded(false);
    setLoad('loading');
    setPosts([]);
    void fetchCommunity();
    const cTimer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void fetchCommunity();
      }
    }, 12_000);
    return () => clearInterval(cTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset state only when communityId changes
  }, [communityId]);

  // Fetch posts when community metadata, active channel group, or XMTP client becomes ready.
  useEffect(() => {
    const prevGroup = prevChannelGroupRef.current;
    if (prevGroup && mlsGroup && prevGroup !== mlsGroup) {
      setLoad('loading');
      setPosts([]);
    }
    prevChannelGroupRef.current = mlsGroup;
    void fetchPosts();
    const t = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void fetchPosts();
      }
    }, 15_000);
    return () => clearInterval(t);
  }, [communityId, mlsGroup, communityLoaded, xmtpClient, fetchPosts]);

  // Follow the newest post, and bring a post that just failed into view: its error must be seen.
  const lastKey = posts.length ? `${posts[posts.length - 1].id}:${posts[posts.length - 1].state ?? ''}` : '';
  const failedKey = posts.filter((p) => p.state === 'failed').map((p) => p.id).join(',');
  useEffect(() => { listEnd.current?.scrollIntoView?.({ block: 'end' }); }, [lastKey, failedKey]);

  /** The rule check for what this person is about to send (lib/communities/settings.ts checkPost). */
  const lastOwnPostAt = useMemo(() => {
    let at: number | null = null;
    for (const m of rawMsgs) {
      const when = typeof m.createdAt === 'number' ? m.createdAt : Date.parse(String(m.createdAt ?? '')) || 0;
      if ((m.authorAddress || '').toLowerCase() === me && !isControlMessage(m.content) && when > (at ?? 0)) at = when;
    }
    return at;
  }, [rawMsgs, me]);
  const allowed = (kind: PostKind, text = ''): boolean => {
    if (!mlsGroup) return true;
    const r = checkPost(rules, myRank ?? (!communityLoaded ? 'MEMBER' : null), kind, text, lastOwnPostAt);
    if (!r.ok) toast.error(tr(r.reason || 'Not sent.', { seconds: r.waitSec ?? 0 }));
    return r.ok;
  };
  const kindOf = (text: string): PostKind => (text.startsWith('__POLL__') ? 'poll' : /^\s*\{\s*"type"\s*:\s*"hl\.(attachment|largefile)"/.test(text) || text.startsWith('__AUDIO__') ? 'media' : 'text');
  const mayWrite = !mlsGroup || !communityLoaded || checkPost(rules, myRank, 'text', '', null).ok;
  // Spam filter: on every member's app, posts it catches are hidden (never for privileged people).
  const spam = useMemo(() => (mlsGroup && rules.antiSpam ? spamIds(posts.filter((p) => !p.state).map((p) => ({ id: p.id, content: postText(p), authorAddress: p.authorAddress, createdAt: time(p) })), (a) => rankIn(roleInfo, a)) : new Set<string>()), [mlsGroup, rules.antiSpam, posts, roleInfo]);

  const submit = async (text: string, retryId?: string) => {
    let body = text.trim();
    if (body && !retryId && !allowed(kindOf(body), body)) return;
    if (body && !retryId && replyTo && mlsGroup) { body = encodeReply(replyTo.id, replyTo.snippet, body); setReplyTo(null); }
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
        const sentId = await postToGroup(xmtpClient, mlsGroup, body);
        setLoad('ready');
        setPosts((prev) => {
          if (sentId && prev.some((p) => p.id === sentId && p.id !== localId)) {
            return prev.filter((p) => p.id !== localId);
          }
          return prev.map((p) => (p.id === localId ? { ...p, id: sentId || p.id, state: undefined } : p));
        });
        fetchPosts();
      } catch (e) {
        const msg = e instanceof Error ? e.message : typeof (e as any)?.message === 'string' ? (e as any).message : typeof e === 'string' ? e : '';
        const text = msg.startsWith('Not sent.') ? tr(msg) : tr('Not sent. The encrypted group did not accept it. Check your connection and try again.');
        setPosts((prev) => prev.map((p) => (p.id === localId ? { ...p, state: 'failed', error: text } : p)));
      }
      return;
    }
    try {
      const res = await f(`/api/chat/communities/${encodeURIComponent(communityId)}/posts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ title: tr("Community post"), content: body, ...(activeChannel ? { channelId: activeChannel.id } : {}) }),
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

  // Voice notes: recorded here, then the same encrypted path as files (isVoiceNote, duration).
  useEffect(() => {
    if (!rec) { setRecSecs(0); return; }
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - rec.started) / 1000);
      setRecSecs(s);
      if (s >= 300) void stopVoice(); // 5 minutes at most
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec]);
  useEffect(() => () => { rec?.stream.getTracks().forEach((tk) => tk.stop()); }, [rec]);

  const startVoice = async () => {
    if (!mlsGroup || rec) return;
    if (!allowed('media')) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const { pickRecordingMimeType } = await import('@/lib/chat/recording');
      const mimeType = pickRecordingMimeType(typeof MediaRecorder !== 'undefined' ? MediaRecorder.isTypeSupported?.bind(MediaRecorder) : undefined);
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.start(250);
      setRec({ started: Date.now(), recorder, chunks, stream });
    } catch {
      toast.error(tr("Microphone access was not allowed. Allow it in your browser settings to record."));
    }
  };

  const stopVoice = async () => {
    const r = rec;
    if (!r) return;
    setRec(null);
    const durationSec = Math.max(1, Math.round((Date.now() - r.started) / 1000));
    await new Promise<void>((done) => { r.recorder.onstop = () => done(); try { r.recorder.stop(); } catch { done(); } });
    r.stream.getTracks().forEach((tk) => tk.stop());
    const mime = (r.recorder.mimeType || 'audio/webm').split(';')[0];
    const blob = new Blob(r.chunks, { type: mime });
    if (blob.size < 512) return; // nothing was recorded
    const { prepareAttachmentMessage } = await import('@/lib/chat/send-attachment');
    const { extensionForRecording } = await import('@/lib/chat/recording');
    setAttaching(tr("Encrypting voice message…"));
    const t0 = performance.now();
    try {
      const prepared = await prepareAttachmentMessage(blob, { filename: `voice-${Date.now()}.${extensionForRecording(mime)}`, mimeType: mime, isVoiceNote: true, durationSec });
      recordTiming('voice.encrypt+upload', performance.now() - t0, blob.size);
      await submit(prepared.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("Could not send the voice message"));
    } finally { setAttaching(null); }
  };

  /** Encrypts each file on this device, uploads only ciphertext, and posts the attachment message. */
  const attachFiles = async (files: File[]) => {
    if (!mlsGroup || !files.length) return;
    if (!allowed('media')) return;
    const { prepareAttachmentMessage } = await import('@/lib/chat/send-attachment');
    for (const file of files.slice(0, 10)) {
      setAttaching(tr("Encrypting {name}…", { name: file.name }));
      try {
        const t0 = performance.now();
        const prepared = await prepareAttachmentMessage(file, { filename: file.name, mimeType: file.type || 'application/octet-stream' });
        recordTiming('attachment.encrypt+upload', performance.now() - t0, file.size);
        await submit(prepared.message);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : tr("Could not send the file"));
      }
    }
    setAttaching(null);
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
    if (mlsGroup) {
      if (!xmtpClient) { toast.error(tr("Encrypted messaging is not connected on this device yet. Try again in a moment.")); return; }
      try { await postToGroup(xmtpClient, mlsGroup, encodePin(id)); toast.success(tr("Pin added. You find it in Manage.")); fetchPosts(); }
      catch { toast.error(tr("The pin was not added. Try again.")); }
      return;
    }
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
    if (mlsGroup && !readOnly && !p.state && !p.id.startsWith('local-')) {
      items.unshift({ label: tr("Reply"), icon: <CornerUpRight size={16} strokeWidth={1.9} />, onSelect: () => { setReplyTo({ id: p.id, snippet: plainSnippet(postText(p)) }); field.current?.focus(); } });
      items.push({ label: tr("React"), icon: <SmilePlus size={16} strokeWidth={1.9} />, onSelect: () => setReactFor(p.id) });
    }
    if (onForward && !p.state) items.push({ label: tr("Forward to a chat"), icon: <Forward size={16} strokeWidth={1.9} />, onSelect: () => onForward(unwrap(postText(p)).body) });
    if (mayPin && !p.state && !p.id.startsWith('local-')) items.push({ label: tr("Pin"), icon: <Pin size={16} strokeWidth={1.9} />, onSelect: () => pin(p.id) });
    return items;
  };

  // In-community search runs on this device over decrypted posts; the query never leaves it.
  const shownPosts = useMemo(() => (query.trim() ? searchPosts(posts, query, nameFor) : posts), [posts, query, nameFor]);

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
        <button type="button" onClick={() => { setSearchOpen((o) => !o); setQuery(''); }} className={`${btn} px-3 hover:bg-[#eff1f4]`} style={{ color: INK }} aria-label={tr("Search in this community")} aria-pressed={searchOpen} title={tr("Search in this community")}>
          <Search size={21} strokeWidth={1.9} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setPanel('media')} className={`${btn} px-3 hover:bg-[#eff1f4]`} style={{ color: INK }} aria-label={tr("Shared media")} title={tr("Shared media")}>
          <Images size={21} strokeWidth={1.9} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setPanel('members')} className={`${btn} px-3 hover:bg-[#eff1f4]`} style={{ color: INK }} aria-label={tr("Members")} title={tr("Members")}>
          <Users size={21} strokeWidth={1.9} aria-hidden="true" />
        </button>
        <button type="button" onClick={onManage} className={`${btn} border-2 border-[#15171c] bg-white hover:bg-[#f2f4f7]`} style={{ color: INK }}>
          {tr("Manage")}
        </button>
      </header>
      {channels.length > 1 && (
        <nav className="shrink-0 flex items-center gap-2 px-3 sm:px-5 py-2 border-b border-[#d4d8de] bg-white overflow-x-auto" aria-label={tr("Channels")}>
          {channels.map((ch) => {
            const on = ch.id === activeChannel?.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => { if (!on) { setActiveChannelId(ch.id); } }}
                aria-pressed={on}
                className={`shrink-0 min-h-[44px] px-4 rounded-full text-[16px] font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-[#15171c]/25 ${on ? 'bg-[#15171c] text-white' : 'bg-[#f2f4f7] text-[#15171c] hover:bg-[#e4e7ec]'}`}
              >
                #{ch.name}
              </button>
            );
          })}
        </nav>
      )}
      {searchOpen && (
        <div className="shrink-0 flex items-center gap-2 px-3 sm:px-5 py-2 border-b border-[#d4d8de] bg-white">
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { setSearchOpen(false); setQuery(''); } }}
            placeholder={tr("Search posts, files and people")} aria-label={tr("Search in this community")}
            className="flex-1 min-w-0 h-11 px-4 rounded-xl bg-[#f2f4f7] outline-none text-[16px]" style={{ color: INK }} />
          {query && <span className="text-[14px] tabular-nums shrink-0" style={{ color: INK_SOFT }} role="status">{tr("{count} found", { count: shownPosts.length })}</span>}
        </div>
      )}
      {panel === 'media' && (
        <CommunityMediaSheet posts={posts.filter((p) => !p.state).map((p) => ({ id: p.id, content: postText(p), authorAddress: p.authorAddress, createdAt: p.createdAt }))} messages={rawMsgs} title={title} onClose={() => setPanel(null)} />
      )}
      {panel === 'members' && (
        <MembersPanel people={{ communityId, ownerAddress, members: memberRows ?? [] }} me={me} nameFor={nameFor} onOpen={(a) => setOpenMember(a)} onClose={() => setPanel(null)} />
      )}
      {openMember && (
        <MemberSheet
          people={{ communityId, ownerAddress, members: memberRows ?? [] }}
          address={openMember}
          me={me}
          nameFor={nameFor}
          onClose={() => setOpenMember(null)}
          onMessage={onMessage}
          onPay={onPay}
          onChanged={() => { setPeopleKey((k) => k + 1); fetchCommunity(); }}
        />
      )}
      {pollOpen && mlsGroup && (
        <PollComposer onClose={() => setPollOpen(false)} onSend={(encoded) => { setPollOpen(false); void submit(encoded); }} />
      )}

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
            {communityLoaded && myRank === null && !about.isPrivate && (
              <button type="button" disabled={joining} onClick={() => void joinCommunity()} className={`${btn} mx-auto mt-4 bg-[#15171c] text-white hover:bg-[#2a2d34] disabled:opacity-60`}>
                {joining ? tr("Joining...") : tr("Join community")}
              </button>
            )}
            <button type="button" onClick={() => { void checkAccess(); }} disabled={checking} aria-busy={checking} className={`${btn} mx-auto mt-4 border-2 border-[#15171c] bg-white hover:bg-[#f2f4f7] disabled:opacity-60`} style={{ color: INK }}>
              {checking ? tr("Checking…") : tr("Check encrypted access now")}
            </button>
            {!xmtpClient && (
              <p className="mt-3 text-[16px] leading-snug" style={{ color: INK_SOFT }}>{tr("Encrypted messaging is still starting on this device. Try again in a few seconds.")}</p>
            )}
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
        {spam.size > 0 && (
          <p className="max-w-[720px] mx-auto mb-3 text-[15px] leading-snug text-center" style={{ color: INK_SOFT }} role="note">{tr("The spam filter hid {count} posts in this community.", { count: spam.size })}</p>
        )}
        <ol className="flex flex-col gap-4 max-w-[720px] mx-auto">
          {shownPosts.filter((p) => !spam.has(p.id)).map((p) => {
            const author = authorLabel(p, me, nameFor);
            const text = postText(p);
            const heading = p.title && !DEFAULT_TITLE.test(p.title.trim()) ? p.title.trim() : '';
            const when = p.state !== 'sending' && p.state !== 'failed' ? whenLabel(p.createdAt) : '';
            return (
              <PostItem
                key={p.id}
                anchor={`post-${p.id}`}
                failed={p.state === 'failed'}
                mine={author.mine}
                label={tr("Post by {name}", { name: author.name })}
                onMenu={(at) => setMenu({ at, post: p })}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {isWalletAddress(p.authorAddress) ? (
                    <button type="button" onClick={() => setOpenMember(p.authorAddress!.toLowerCase())} className="shrink-0 flex items-center justify-center leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#15171c]" style={{ borderRadius: AVATAR_RADIUS }} aria-label={tr("Profile of {name}", { name: author.name })}>
                      <UserAvatar address={p.authorAddress} size={36} />
                    </button>
                  ) : (
                  <span
                    className="w-9 h-9 flex items-center justify-center text-[14px] font-semibold shrink-0 select-none"
                    style={{ borderRadius: AVATAR_RADIUS, ...tintFor(p.authorAddress) }}
                    aria-hidden="true"
                  >
                    {initials(author.mine ? '' : author.name, p.authorAddress)}
                  </span>
                  )}
                  <p className="min-w-0 flex-1 text-[16px] leading-tight">
                    {isWalletAddress(p.authorAddress)
                      ? <button type="button" onClick={() => setOpenMember(p.authorAddress!.toLowerCase())} className="font-semibold hover:underline underline-offset-2 text-left" style={{ color: INK }}>{author.name}</button>
                      : <span className="font-semibold" style={{ color: INK }}>{author.name}</span>}
                    {author.wallet ? <span className="ml-1.5 tabular-nums" style={{ color: INK_SOFT }}>{author.wallet}</span> : null}
                    {when ? <span className="block text-[15px] mt-0.5" style={{ color: INK_SOFT }}>{when}</span> : null}
                  </p>
                </div>
                {heading && <p className="text-[19px] font-semibold mt-2" style={{ color: INK }}>{heading}</p>}
                {(() => {
                  const u = unwrap(text);
                  const r = reactions.get(p.id);
                  return (
                    <>
                      {u.forwardedFrom && <p className="mt-2 text-[13.5px] italic" style={{ color: INK_SOFT }}>{tr("Forwarded from {from}", { from: u.forwardedFrom })}</p>}
                      {u.reply && (
                        <button type="button" onClick={() => document.getElementById(`post-${u.reply!.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })}
                          className="mt-2 w-full text-left border-l-[3px] border-[#15171c] bg-[#f2f4f7] rounded-r-xl px-3 py-1.5 text-[14.5px] truncate" style={{ color: INK_SOFT }}>
                          {u.reply.snippet || tr("Message")}
                        </button>
                      )}
                      <PostBody content={u.body} author={p.authorAddress} messages={rawMsgs} me={me} onVote={mlsGroup && !readOnly ? sendControl : undefined} />
                      {(r || reactFor === p.id) && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {r && [...r.counts].map(([emoji, n]) => (
                            <button key={emoji} type="button" disabled={!mlsGroup || readOnly} onClick={() => void sendControl(r.mine === emoji ? encodeUnreact(p.id) : encodeReaction(p.id, emoji))}
                              className={`h-8 px-2.5 rounded-full text-[14px] inline-flex items-center gap-1 border ${r.mine === emoji ? 'border-[#15171c] bg-[#eef2fb]' : 'border-[#d4d8de] bg-white'}`} aria-pressed={r.mine === emoji}>
                              <span>{emoji}</span><span className="tabular-nums text-[13px]" style={{ color: INK }}>{n}</span>
                            </button>
                          ))}
                          {reactFor === p.id && (
                            <span className="inline-flex items-center gap-0.5 h-9 px-1.5 rounded-full border border-[#d4d8de] bg-white" role="group" aria-label={tr("React")}>
                              {QUICK_REACTIONS.map((e) => (
                                <button key={e} type="button" onClick={() => { setReactFor(null); void sendControl(r?.mine === e ? encodeUnreact(p.id) : encodeReaction(p.id, e)); }} className="w-8 h-8 grid place-items-center rounded-full text-[18px] hover:bg-[#f2f4f7]" aria-label={e}>{e}</button>
                              ))}
                              <button type="button" onClick={() => setReactFor(null)} className="w-8 h-8 grid place-items-center rounded-full hover:bg-[#f2f4f7]" aria-label={tr("Close")}><X size={15} /></button>
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
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
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 border-l-[3px] border-[#15171c] bg-[#f2f4f7] rounded-r-xl pl-3 pr-1 py-1.5">
              <span className="flex-1 min-w-0 text-[14.5px] truncate" style={{ color: INK_SOFT }}>{tr("Replying to: {text}", { text: replyTo.snippet || tr("Message") })}</span>
              <button type="button" onClick={() => setReplyTo(null)} className="w-9 h-9 grid place-items-center rounded-full hover:bg-white" aria-label={tr("Cancel reply")}><X size={16} /></button>
            </div>
          )}
          {!mayWrite && communityLoaded && myRank === null && !about.isPrivate && (
            <button type="button" disabled={joining} onClick={() => void joinCommunity()} className="mb-2 w-full min-h-[44px] rounded-2xl bg-[#15171c] text-white text-[15px] font-semibold disabled:opacity-50">{joining ? tr("Joining...") : tr("Join community")}</button>
          )}
          {!mayWrite && communityLoaded && myRank === null && about.isPrivate && (
            <p className="mb-2 text-[16px] leading-snug" style={{ color: INK_SOFT }} role="note">{tr("Only members can post here.")}</p>
          )}
          {!mayWrite && (!communityLoaded || myRank !== null) && (
            <p className="mb-2 text-[16px] leading-snug" style={{ color: INK_SOFT }} role="note">{tr("Only the owner, admins and moderators can post in this community.")}</p>
          )}
          {mlsGroup && rules.slowModeSeconds > 0 && !isPrivileged(myRank) && (
            <p className="mb-2 text-[15px] leading-snug" style={{ color: INK_SOFT }}>{tr("Slow mode: one post every {time}.", { time: rules.slowModeSeconds >= 3600 ? tr('1 hour') : rules.slowModeSeconds >= 60 ? tr('{n} min', { n: rules.slowModeSeconds / 60 }) : tr('{n} s', { n: rules.slowModeSeconds }) })}</p>
          )}
          <textarea
            disabled={!mayWrite}
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
          {/* Attach (encrypted, same pipeline as private chats) and Poll exist only where posts are
              end-to-end encrypted (an MLS community); Send is always last. */}
          <div className="flex items-center gap-2 mt-2">
            {mlsGroup && (
              <>
                <input ref={filePick} type="file" className="hidden" multiple onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; void attachFiles(fs); }} />
                <button type="button" onClick={() => filePick.current?.click()} disabled={!!attaching} className={`${btn} px-3 hover:bg-[#eff1f4] disabled:opacity-50`} style={{ color: INK }} aria-label={tr("Attach photos or files")} title={tr("Attach photos or files")}>
                  <Paperclip size={21} strokeWidth={1.9} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => void (rec ? stopVoice() : startVoice())} disabled={!!attaching && !rec}
                  className={`${btn} px-3 ${rec ? 'bg-[#fdecec] text-[#b42318]' : 'hover:bg-[#eff1f4]'} disabled:opacity-50`} style={rec ? undefined : { color: INK }}
                  aria-label={rec ? tr("Stop and send voice message") : tr("Record a voice message")} title={rec ? tr("Stop and send voice message") : tr("Record a voice message")} aria-pressed={!!rec}>
                  {rec ? <Square size={18} strokeWidth={2.2} aria-hidden="true" /> : <Mic size={21} strokeWidth={1.9} aria-hidden="true" />}
                  {rec && <span className="tabular-nums text-[15px]">{Math.floor(recSecs / 60)}:{String(recSecs % 60).padStart(2, '0')}</span>}
                </button>
                <button type="button" onClick={() => { if (allowed('poll')) setPollOpen(true); }} className={`${btn} px-3 hover:bg-[#eff1f4]`} style={{ color: INK }} aria-label={tr("Create a poll")} title={tr("Create a poll")}>
                  <BarChart3 size={21} strokeWidth={1.9} aria-hidden="true" />
                </button>
                {attaching && <span className="text-[14px] truncate" style={{ color: INK_SOFT }} role="status">{attaching}</span>}
              </>
            )}
            <button type="submit" disabled={!draft.trim()} className={`${btn} ml-auto px-6 bg-[#15171c] text-white hover:bg-[#2a2d34] disabled:bg-[#e4e7ec] disabled:text-[#3d424b]`}>
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
function PostItem({ anchor, failed, mine, label, onMenu, children }: { anchor?: string; failed: boolean; mine: boolean; label: string; onMenu: (at: MenuAt) => void; children: React.ReactNode }) {
  const { handlers } = useContextMenuTrigger(onMenu);
  return (
    <li
      {...handlers}
      id={anchor}
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
