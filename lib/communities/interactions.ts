/**
 * lib/communities/interactions.ts — reactions, replies, forwards, poll closing and search for
 * community posts. All of them are ordinary messages in the community's MLS group, in the same
 * formats private chats use, so the server never sees them (docs/plan/COMMUNITIES_V2.md §Phase 2).
 *
 *   __REACT__<postId>__::<emoji>          one reaction per member per post; the same emoji again,
 *                                         or "-", removes it (last message wins)
 *   __REPLY__<postId>__SNIPPET__<text>__::<body>
 *   __FORWARD__<from>__::<body>
 *   __POLL_CLOSE__<pollId>                only the poll's author can close it
 */
import { parsePoll } from './media-index';

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;
const SAFE_EMOJI = /^[\p{Extended_Pictographic}‍️\u{1F3FB}-\u{1F3FF}]{1,16}$/u;

export interface Msg { id: string; content?: string | null; authorAddress?: string; createdAt?: number | string }

export const encodeReaction = (postId: string, emoji: string) => `__REACT__${postId}__::${emoji}`;
export const encodeUnreact = (postId: string) => `__REACT__${postId}__::-`;

/** postId → emoji → count, plus what I reacted with. */
export function tallyReactions(messages: Msg[], me: string): Map<string, { counts: Map<string, number>; mine?: string }> {
  const byAuthor = new Map<string, string>(); // `${postId}|${author}` → emoji
  for (const m of messages) {
    const c = typeof m.content === 'string' ? m.content : '';
    if (!c.startsWith('__REACT__') || !m.authorAddress) continue;
    const [postId, emoji = ''] = c.slice(9).split('__::');
    if (!postId) continue;
    const key = `${postId}|${m.authorAddress.toLowerCase()}`;
    const prev = byAuthor.get(key);
    if (emoji === '-' || emoji === prev) byAuthor.delete(key);
    else if (SAFE_EMOJI.test(emoji)) byAuthor.set(key, emoji);
  }
  const out = new Map<string, { counts: Map<string, number>; mine?: string }>();
  const self = me.toLowerCase();
  for (const [key, emoji] of byAuthor) {
    const [postId, author] = key.split('|');
    const e = out.get(postId) ?? { counts: new Map<string, number>() };
    e.counts.set(emoji, (e.counts.get(emoji) ?? 0) + 1);
    if (author === self) e.mine = emoji;
    out.set(postId, e);
  }
  return out;
}

export function encodeReply(postId: string, snippet: string, body: string): string {
  const s = snippet.replace(/__::|__SNIPPET__/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return `__REPLY__${postId}__SNIPPET__${s}__::${body}`;
}
export const encodeForward = (from: string, body: string) => `__FORWARD__${from.replace(/__::/g, ' ').slice(0, 60)}__::${body}`;

export interface Unwrapped { body: string; reply?: { id: string; snippet: string }; forwardedFrom?: string }
/** Strips reply/forward envelopes (in either order), keeping what to show above the body. */
export function unwrap(content: string): Unwrapped {
  let body = content;
  const out: Unwrapped = { body };
  for (let i = 0; i < 2; i++) {
    if (body.startsWith('__FORWARD__')) {
      const k = body.indexOf('__::');
      if (k < 0) break;
      out.forwardedFrom = body.slice(11, k).trim() || 'a chat';
      body = body.slice(k + 4);
    } else if (body.startsWith('__REPLY__')) {
      const k = body.indexOf('__::');
      if (k < 0) break;
      const meta = body.slice(9, k);
      const [id, snippet = ''] = meta.split('__SNIPPET__');
      out.reply = { id, snippet };
      body = body.slice(k + 4);
    }
  }
  out.body = body;
  return out;
}

/** Short, plain description of a post for reply quotes and search (never attachment JSON). */
export function plainSnippet(content: string): string {
  const { body } = unwrap(content.trim());
  if (body.startsWith('{') && body.includes('"hl.attachment"')) {
    try { const j = JSON.parse(body); return j.kind === 'image' ? 'Photo' : j.kind === 'video' ? 'Video' : j.kind === 'audio' ? (j.durationSec !== undefined ? 'Voice message' : String(j.filename || 'Audio')) : String(j.filename || 'File'); } catch { return 'File'; }
  }
  if (body.startsWith('{') && body.includes('"hl.largefile"')) return 'File';
  if (body.startsWith('[GIF]')) return 'GIF';
  const poll = parsePoll(body);
  if (poll) return `Poll: ${poll.question}`;
  return body.replace(/\s+/g, ' ').trim();
}

export const encodePollClose = (pollId: string) => `__POLL_CLOSE__${pollId}`;
/** A poll is closed only by a close message from the account that created it. */
export function isPollClosed(messages: Msg[], pollId: string, pollAuthor?: string): boolean {
  const a = (pollAuthor || '').toLowerCase();
  return !!a && messages.some((m) => m.content === encodePollClose(pollId) && (m.authorAddress || '').toLowerCase() === a);
}

/** Client-side search over decrypted posts: text, file names, poll questions and author names. */
export function searchPosts<T extends Msg>(posts: T[], q: string, nameOf?: (a: string) => string | undefined): T[] {
  const s = q.trim().toLowerCase();
  if (!s) return posts;
  return posts.filter((p) => {
    const text = plainSnippet(String(p.content ?? '')).toLowerCase();
    const who = p.authorAddress ? `${nameOf?.(p.authorAddress) ?? ''} ${p.authorAddress}`.toLowerCase() : '';
    return text.includes(s) || who.includes(s);
  });
}
