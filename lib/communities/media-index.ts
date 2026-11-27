/**
 * lib/communities/media-index.ts — Shared Media of a community, built on this device.
 *
 * Every post is classified from its own text, the same message formats the private chats use:
 *   hl.attachment / hl.largefile JSON (encrypted attachments; lib/chat/remote-attachment.ts),
 *   legacy inline __AUDIO__data:… and [ATTACHMENT:mime]data:…|name, [GIF]url, __POLL__ polls,
 *   and links found in text.
 * Nothing is sent anywhere: the index is derived from messages the device already decrypted, so the
 * server never learns what a community shares (spec: docs/plan/COMMUNITIES_V2.md §3).
 */
import { parseAttachmentMessage, type AttachmentMessage } from '@/lib/chat/remote-attachment';

export type MediaTab = 'media' | 'files' | 'links' | 'voice' | 'gifs' | 'polls' | 'music';
export const MEDIA_TABS: readonly MediaTab[] = ['media', 'files', 'links', 'voice', 'gifs', 'polls', 'music'];

export interface IndexInput { id: string; content?: string | null; authorAddress?: string; createdAt?: number | string }

export type MediaItem =
  | { tab: 'media'; id: string; at: number; author?: string; att: AttachmentMessage; video: boolean }
  | { tab: 'files'; id: string; at: number; author?: string; att?: AttachmentMessage; name: string; size?: number; mime: string }
  | { tab: 'links'; id: string; at: number; author?: string; url: string; host: string; text: string }
  | { tab: 'voice'; id: string; at: number; author?: string; att?: AttachmentMessage; inline?: string; durationSec?: number }
  | { tab: 'gifs'; id: string; at: number; author?: string; url: string }
  | { tab: 'polls'; id: string; at: number; author?: string; pollId: string; question: string; options: string[] }
  | { tab: 'music'; id: string; at: number; author?: string; att: AttachmentMessage; name: string };

/** Control messages (reactions, receipts, votes, typing…) are not posts and never shown as such. */
export const CONTROL_PREFIXES = ['__REACT__', '__READ__', '__DELIVERED__', '__TYPING__', '__VOTE__', '__EDIT__', '__REVOKE__', '__PIN__', '__UNPIN__', '__CALL_', '__CLEAR__', '__POLL_CLOSE__'];
export const isControlMessage = (c: unknown) => typeof c === 'string' && CONTROL_PREFIXES.some((p) => c.startsWith(p));

const URL_RE = /\bhttps?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)\]]/gi;
const SAFE_GIF = /^https:\/\/[^\s]+$/i;

const toMs = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? Date.parse(v) || 0 : 0);

export interface PollShape { pollId: string; question: string; options: string[]; /** Results hidden until the author closes the poll. */ hideResults?: boolean }
/** __POLL__<pollId>__::<question>__::<opt1|opt2|…> (same as private chats). */
export function parsePoll(content: string): PollShape | null {
  if (!content.startsWith('__POLL__')) return null;
  const [pollId, question, opts, flags = ''] = content.slice('__POLL__'.length).split('__::');
  const options = (opts || '').split('|').map((o) => o.trim()).filter(Boolean).slice(0, 12);
  if (!pollId || !question || options.length < 2) return null;
  const shape: PollShape = { pollId: pollId.slice(0, 64), question: question.slice(0, 300), options: options.map((o) => o.slice(0, 100)) };
  if (flags.split(',').includes('hide')) shape.hideResults = true;
  return shape;
}
export function encodePoll(question: string, options: string[], id = Math.random().toString(36).slice(2, 12), opts: { hideResults?: boolean } = {}): string {
  const clean = (s: string) => s.replace(/__::|\|/g, ' ').trim();
  return `__POLL__${id}__::${clean(question)}__::${options.map(clean).filter(Boolean).join('|')}${opts.hideResults ? '__::hide' : ''}`;
}
/** __VOTE__<pollId>__::<optionIndex> — one vote per voter; the last one counts. */
export function encodeVote(pollId: string, option: number): string { return `__VOTE__${pollId}__::${option}`; }
export function parseVote(content: string): { pollId: string; option: number } | null {
  if (!content.startsWith('__VOTE__')) return null;
  const [pollId, opt] = content.slice('__VOTE__'.length).split('__::');
  const option = Number(opt);
  return pollId && Number.isInteger(option) && option >= 0 && option < 12 ? { pollId, option } : null;
}
/** Votes per option, one per voter (their latest), in message order. */
export function tallyVotes(messages: { content?: string | null; authorAddress?: string }[], pollId: string, optionCount: number): { counts: number[]; voters: Map<string, number> } {
  const voters = new Map<string, number>();
  for (const m of messages) {
    const v = typeof m.content === 'string' ? parseVote(m.content) : null;
    if (v && v.pollId === pollId && v.option < optionCount && m.authorAddress) voters.set(m.authorAddress.toLowerCase(), v.option);
  }
  const counts = Array.from({ length: optionCount }, () => 0);
  for (const o of voters.values()) counts[o]++;
  return { counts, voters };
}

function stripEnvelopes(c: string): string {
  for (let i = 0; i < 2; i++) {
    if (!c.startsWith('__FORWARD__') && !c.startsWith('__REPLY__')) break;
    const k = c.indexOf('__::');
    if (k < 0) break;
    c = c.slice(k + 4);
  }
  return c;
}

export function classifyPost(p: IndexInput): MediaItem[] {
  const raw = typeof p.content === 'string' ? p.content.trim() : '';
  if (!raw || isControlMessage(raw)) return [];
  const c = stripEnvelopes(raw); // a reply or a forward is indexed by what it carries
  const base = { id: p.id, at: toMs(p.createdAt), author: p.authorAddress };
  const att = parseAttachmentMessage(c);
  if (att) {
    if (att.kind === 'image' || att.kind === 'video') return [{ ...base, tab: 'media', att, video: att.kind === 'video' }];
    if (att.kind === 'audio') {
      return att.durationSec !== undefined || /^voice|^recording/i.test(att.filename)
        ? [{ ...base, tab: 'voice', att, durationSec: att.durationSec }]
        : [{ ...base, tab: 'music', att, name: att.filename }];
    }
    return [{ ...base, tab: 'files', att, name: att.filename, size: att.contentLength, mime: att.mimeType }];
  }
  if (c.startsWith('{') && c.includes('"hl.largefile"')) {
    try { const j = JSON.parse(c); return [{ ...base, tab: 'files', name: String(j.filename || 'File').slice(0, 200), size: Number(j.size ?? j.contentLength) || undefined, mime: String(j.mimeType || 'application/octet-stream') }]; } catch { return []; }
  }
  if (c.startsWith('__AUDIO__data:')) return [{ ...base, tab: 'voice', inline: c.slice('__AUDIO__'.length) }];
  const legacy = c.match(/^\[ATTACHMENT:([^\]]+)\]data:[^|]*\|(.*)$/s);
  if (legacy) return [{ ...base, tab: 'files', name: (legacy[2] || 'File').slice(0, 200), mime: legacy[1] }];
  if (c.startsWith('[GIF]')) { const url = c.slice(5).trim(); return SAFE_GIF.test(url) ? [{ ...base, tab: 'gifs', url }] : []; }
  const poll = parsePoll(c);
  if (poll) return [{ ...base, tab: 'polls', ...poll }];
  const out: MediaItem[] = [];
  const seen = new Set<string>();
  for (const m of c.match(URL_RE) ?? []) {
    if (seen.has(m)) continue;
    seen.add(m);
    let host = '';
    try { host = new URL(m).hostname.replace(/^www\./, ''); } catch { continue; }
    out.push({ ...base, tab: 'links', url: m, host, text: c.slice(0, 280) });
  }
  return out;
}

export type MediaIndex = Record<MediaTab, MediaItem[]>;

/** Newest first in every tab. */
export function buildMediaIndex(posts: IndexInput[]): MediaIndex {
  const idx = Object.fromEntries(MEDIA_TABS.map((t) => [t, [] as MediaItem[]])) as MediaIndex;
  for (const p of posts) for (const it of classifyPost(p)) idx[it.tab].push(it);
  for (const t of MEDIA_TABS) idx[t].sort((a, b) => b.at - a.at);
  return idx;
}

/** Case-insensitive search over what each item shows (file name, link, host, poll text). */
export function searchMedia(items: MediaItem[], q: string): MediaItem[] {
  const s = q.trim().toLowerCase();
  if (!s) return items;
  return items.filter((it) => {
    const hay =
      it.tab === 'files' || it.tab === 'music' ? it.name :
      it.tab === 'links' ? `${it.url} ${it.host}` :
      it.tab === 'polls' ? `${it.question} ${it.options.join(' ')}` :
      it.tab === 'media' ? it.att.filename :
      it.tab === 'gifs' ? it.url :
      it.tab === 'voice' ? (it.att?.filename ?? 'voice') : '';
    return hay.toLowerCase().includes(s);
  });
}
