/**
 * lib/communities/settings.ts — what each community setting does, its default, and how the app
 * applies it. One source for Manage (labels and explanations), the reader (composer rules, spam
 * filter, pins) and the tests.
 *
 * Where a setting is applied. Who is a member, roles, invites and join approval are decided by our
 * server. Posts of an encrypted (MLS) community never reach our server, so the posting rules
 * (who may post, media, polls, links, slow mode, spam filter, pins) are applied by the app of every
 * member: the composer refuses what the rule forbids, and every reader ignores pins from people who
 * may not pin and hides what the spam filter catches. A modified app could ignore a posting rule;
 * removing a member always works, because it changes the group's keys. Manage says this in words.
 */
import { unwrap } from './interactions';

export type Rank = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';

export interface CommunityPermissions {
  sendMessages: boolean;
  sendMedia: boolean;
  sendPolls: boolean;
  embedLinks: boolean;
  pinMessages: boolean;
  changeInfo: boolean;
  antiSpam: boolean;
  requireApproval: boolean;
  slowModeSeconds: number;
}

/** The database defaults (prisma CommunityPermission). A community without a row uses these. */
export const PERMISSION_DEFAULTS: CommunityPermissions = {
  sendMessages: true,
  sendMedia: true,
  sendPolls: true,
  embedLinks: true,
  pinMessages: false,
  changeInfo: false,
  antiSpam: false,
  requireApproval: false,
  slowModeSeconds: 0,
};

export function effectivePermissions(p: Partial<Record<keyof CommunityPermissions, unknown>> | null | undefined): CommunityPermissions {
  const out = { ...PERMISSION_DEFAULTS };
  for (const k of Object.keys(out) as (keyof CommunityPermissions)[]) {
    const v = p?.[k];
    if (k === 'slowModeSeconds') { if (typeof v === 'number' && v >= 0) out.slowModeSeconds = v; }
    else if (typeof v === 'boolean') (out as any)[k] = v;
  }
  return out;
}

export interface SettingInfo { key: keyof CommunityPermissions; label: string; help: string }

export const PERMISSION_SETTINGS: SettingInfo[] = [
  { key: 'sendMessages', label: 'Members can write posts', help: 'When off, only the owner, admins and moderators can post. Members can still read, react and vote.' },
  { key: 'sendMedia', label: 'Members can share photos, files and voice messages', help: 'When off, members can send text only. Media is always encrypted on the sender’s device.' },
  { key: 'sendPolls', label: 'Members can start polls', help: 'When off, only the owner, admins and moderators can start polls. Everyone can still vote.' },
  { key: 'embedLinks', label: 'Members can share links', help: 'When off, a member’s post that contains a web link is not sent. Helps keep scam links out.' },
  { key: 'pinMessages', label: 'Members can pin posts', help: 'When on, any member can pin a post for everyone. The owner, admins and moderators can always pin.' },
  { key: 'changeInfo', label: 'Members can change the name and description', help: 'When on, any member can edit the name and description. Privacy, channels and roles stay with admins.' },
];

export const MODERATION_SETTINGS: SettingInfo[] = [
  { key: 'antiSpam', label: 'Filter spam', help: 'Hides posts that repeat the same text within 10 minutes or carry more than 3 links. Posts by the owner, admins and moderators are never hidden.' },
  { key: 'requireApproval', label: 'Approve new members before they join', help: 'People who open the invite link send a request instead of joining. They see nothing until the owner or an admin approves them in Members. Personal invites skip this step.' },
];

export const SLOW_MODE_OPTIONS: Array<[seconds: number, label: string]> = [[0, 'Off'], [10, '10 seconds'], [30, '30 seconds'], [60, '1 minute'], [300, '5 minutes'], [3600, '1 hour']];
export const SLOW_MODE_HELP = 'How long each member waits between two posts. The owner, admins and moderators are not limited.';

/** One line under each row of Manage. */
export const ROW_HELP: Record<string, string> = {
  pinned: 'Important posts kept at the top for everyone.',
  members: 'Who is in, their roles, and requests to join.',
  invite: 'The link and QR code that bring people in.',
  profile: 'What people see before and after they join.',
  channels: 'Separate spaces for topics, each its own encrypted group.',
  permissions: 'What members can post and change.',
  moderation: 'Spam filter, join approval and posting pace.',
  privacy: 'Listed in Discover, or by invitation only.',
  apps: 'Small apps shared with the community.',
  analytics: 'Member growth and activity over time.',
  governance: 'Proposals and votes for community decisions.',
  leave: 'Stop being a member of this community.',
  delete: 'Remove the community for everyone.',
};

export const ENFORCEMENT_NOTE_MLS = 'Our server never sees the posts, so these rules are applied by the Ledger Chat app of every member. A modified app could ignore them. Removing a member always works: it changes the group’s keys.';

export const isPrivileged = (r: Rank | null | undefined) => r === 'OWNER' || r === 'ADMIN' || r === 'MODERATOR';

const LINK = /\bhttps?:\/\/\S+|\bwww\.[a-z0-9-]+\.[a-z]{2,}\S*/gi;
export const countLinks = (text: string) => (text.match(LINK) || []).length;

export type PostKind = 'text' | 'media' | 'poll';

export interface ComposerCheck { ok: boolean; reason?: string; waitSec?: number }

/** May this person send this kind of post now? Same rules for every member's app. */
export function checkPost(p: CommunityPermissions, rank: Rank | null, kind: PostKind, text: string, lastOwnPostAt: number | null, now = Date.now()): ComposerCheck {
  if (!rank) return { ok: false, reason: 'Only members can post here.' };
  if (isPrivileged(rank)) return { ok: true };
  if (!p.sendMessages) return { ok: false, reason: 'Only the owner, admins and moderators can post in this community.' };
  if (kind === 'media' && !p.sendMedia) return { ok: false, reason: 'Photos, files and voice messages are turned off for members in this community.' };
  if (kind === 'poll' && !p.sendPolls) return { ok: false, reason: 'Polls are turned off for members in this community.' };
  if (kind === 'text' && !p.embedLinks && countLinks(unwrap(text).body) > 0) return { ok: false, reason: 'Links are turned off for members in this community. Remove the link to send.' };
  if (p.slowModeSeconds > 0 && lastOwnPostAt) {
    const left = Math.ceil((lastOwnPostAt + p.slowModeSeconds * 1000 - now) / 1000);
    if (left > 0) return { ok: false, reason: 'Slow mode is on. You can post again in {seconds} s.', waitSec: left };
  }
  return { ok: true };
}

interface Msg { id: string; content: string; authorAddress?: string; createdAt?: number }

/**
 * Spam filter (antiSpam): ids of posts to hide. A member's post is hidden when the same member
 * posted the same text in the previous 10 minutes, or when it carries more than 3 links. Posts of
 * privileged people are never hidden. Attachments and polls are not text and are left alone.
 */
export function spamIds(posts: Msg[], rankOf: (address: string) => Rank | null): Set<string> {
  const out = new Set<string>();
  const last = new Map<string, { text: string; at: number }[]>();
  const sorted = [...posts].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  for (const p of sorted) {
    const a = (p.authorAddress || '').toLowerCase();
    if (!a || isPrivileged(rankOf(a))) continue;
    const body = unwrap(p.content).body.trim();
    if (!body || body.startsWith('{') || body.startsWith('__')) continue;
    const norm = body.toLowerCase().replace(/\s+/g, ' ');
    const at = p.createdAt ?? 0;
    const mine = (last.get(a) || []).filter((x) => at - x.at <= 10 * 60_000);
    if (countLinks(body) > 3 || mine.some((x) => x.text === norm)) out.add(p.id);
    mine.push({ text: norm, at });
    last.set(a, mine);
  }
  return out;
}

// ── Pins of an encrypted community: group messages, never on our server ──────────────────────
export const encodePin = (postId: string) => `__PIN__${postId}`;
export const encodeUnpin = (postId: string) => `__UNPIN__${postId}`;

/** Pinned post ids, newest pin first. Pins from people who may not pin are ignored. */
export function pinnedIds(messages: Msg[], mayPin: (address: string) => boolean): string[] {
  const state = new Map<string, number>();
  const sorted = [...messages].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  sorted.forEach((m, i) => {
    const c = typeof m.content === 'string' ? m.content : '';
    const pin = c.startsWith('__PIN__'), unpin = c.startsWith('__UNPIN__');
    if (!pin && !unpin) return;
    if (!mayPin((m.authorAddress || '').toLowerCase())) return;
    const id = c.slice(pin ? 7 : 9).trim();
    if (!id || id.length > 128) return;
    if (pin) state.set(id, (m.createdAt ?? 0) * 1000 + i); else state.delete(id);
  });
  return [...state.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 50);
}

/** The rank of an address in a community answer (GET /api/chat/communities/:id). */
export function rankIn(c: { ownerAddress?: string | null; members?: { walletAddress?: string | null; role?: string | null }[] | null } | null | undefined, address: string): Rank | null {
  const a = (address || '').toLowerCase();
  if (!c || !a) return null;
  if (String(c.ownerAddress || '').toLowerCase() === a) return 'OWNER';
  const m = (c.members || []).find((x) => String(x?.walletAddress || '').toLowerCase() === a);
  if (!m) return null;
  return m.role === 'ADMIN' || m.role === 'MODERATOR' ? m.role : 'MEMBER';
}

export const mayPinFor = (p: CommunityPermissions, rank: Rank | null) => isPrivileged(rank) || (!!rank && p.pinMessages);
