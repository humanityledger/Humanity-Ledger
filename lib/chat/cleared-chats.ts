/**
 * lib/chat/cleared-chats.ts
 *
 * "Clear chat" is local: it removes this person's copy of a conversation,
 * not the other side's. The only record is a cut-off time per conversation,
 * in localStorage (`ledger_cleared_<account>_<peer>`, plus the older
 * `ledger_cleared_<peer>`), and in the synced device state (`cleared:<peer>`).
 *
 * Every path that can put a message back on screen (the thread, the cache,
 * the offline queue, the stream, the list line under the address) asks the
 * same question here: was this message sent after the cut-off?
 *
 * Timestamps are milliseconds. A value above 1e14 is taken as nanoseconds
 * (XMTP's sentAtNs) and converted.
 */

export function toMs(t: unknown): number {
  let n: number;
  if (typeof t === 'number') n = t;
  else if (typeof t === 'bigint') n = Number(t);
  else if (t instanceof Date) n = t.getTime();
  else if (typeof t === 'string' && t.trim() !== '') n = /^\d+$/.test(t.trim()) ? Number(t) : new Date(t).getTime();
  else return 0;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 1e14 ? Math.floor(n / 1e6) : n;
}

function storage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

function keysFor(peer: string, owners: ReadonlyArray<string | null | undefined>): string[] {
  const p = peer.toLowerCase();
  const keys = [`ledger_cleared_${p}`];
  for (const o of owners) {
    if (!o) continue;
    keys.push(`ledger_cleared_${o.toLowerCase()}_${p}`);
    // Earlier builds also wrote the checksummed form; it is still read.
    if (o !== o.toLowerCase()) keys.push(`ledger_cleared_${o}_${p}`);
  }
  return [...new Set(keys)];
}

/** The cut-off for a conversation, in ms, or 0 when it was never cleared. */
export function clearedAtMs(
  peer: string | null | undefined,
  owners: ReadonlyArray<string | null | undefined>,
  s: Storage | undefined = storage(),
): number {
  if (!peer || !s) return 0;
  let max = 0;
  for (const k of keysFor(peer, owners)) {
    try {
      const v = parseInt(s.getItem(k) || '0', 10);
      if (Number.isFinite(v) && v > max) max = v;
    } catch { /* unreadable key: ignored */ }
  }
  return max;
}

/**
 * Records the cut-off. Returns false when it could not be written, so the
 * caller can say so instead of showing an empty thread that comes back.
 */
export function markCleared(
  peer: string,
  owners: ReadonlyArray<string | null | undefined>,
  atMs: number,
  s: Storage | undefined = storage(),
): boolean {
  if (!s || !peer || !(atMs > 0)) return false;
  try {
    for (const k of keysFor(peer, owners)) s.setItem(k, String(atMs));
    return clearedAtMs(peer, owners, s) >= atMs;
  } catch {
    return false;
  }
}

/**
 * The cut-off to record when the person clears a chat now: the present, or
 * the newest message on screen if its timestamp is ahead of this device's
 * clock. No margin into the future, so a reply sent a second later shows.
 */
export function clearCutoff(nowMs: number, shownTimes: ReadonlyArray<unknown>): number {
  let max = nowMs;
  for (const t of shownTimes) {
    const ms = toMs(t);
    if (ms > max) max = ms;
  }
  return max;
}

/** True when a message sent at `sentAt` is still shown after a clear at `clearedAt`. */
export function survivesClear(sentAt: unknown, clearedAt: number): boolean {
  if (!(clearedAt > 0)) return true;
  return toMs(sentAt) > clearedAt;
}

export interface PreviewLine {
  peerAddress: string;
  lastMessage?: string;
  lastAt?: Date | string | number;
}

/**
 * The list line under the address. A line from before the cut-off is blank;
 * a line from after it (a new message) is kept. A line with no time is blank
 * once the chat was cleared, because nothing shows it came later.
 */
export function previewAfterClear<C extends PreviewLine>(c: C, clearedAt: number): C {
  if (!(clearedAt > 0) || !c.lastMessage) return c;
  return survivesClear(c.lastAt, clearedAt) ? c : { ...c, lastMessage: '' };
}

/**
 * The list must not invent a preview from messages still in memory once the
 * line under the address was cleared. A later message, with a time after the
 * cut-off, is not cleared.
 */
export function lineWasCleared(c: PreviewLine, clearedAt: number): boolean {
  if (!(clearedAt > 0)) return false;
  if (previewAfterClear(c, clearedAt).lastMessage) return false;
  return !survivesClear(c.lastAt, clearedAt);
}

export interface ThreadMessage {
  id: string;
  content?: unknown;
  sentAtNs?: number;
}

/**
 * "Delete for me": what the list line should show once `deletedId` is gone.
 * `thread` is the conversation as shown (oldest first is not required).
 * - unchanged: the deleted message was not the last visible one;
 * - previous:  it was, and this is the message now last;
 * - empty:     it was, and nothing visible is left.
 */
export type PreviewAfterDelete =
  | { kind: 'unchanged' }
  | { kind: 'previous'; content: string; atMs: number }
  | { kind: 'empty' };

export function previewAfterDelete(
  thread: ReadonlyArray<ThreadMessage>,
  deletedId: string,
  isSystem: (content: string) => boolean,
): PreviewAfterDelete {
  const visible = thread
    .filter((m): m is ThreadMessage & { content: string } => typeof m.content === 'string' && !isSystem(m.content))
    .map((m, i) => ({ m, i, at: toMs(m.sentAtNs) }))
    .sort((a, b) => a.at - b.at || a.i - b.i)
    .map((x) => x.m);
  const last = visible[visible.length - 1];
  if (!last || last.id !== deletedId) return { kind: 'unchanged' };
  const prev = visible[visible.length - 2];
  return prev ? { kind: 'previous', content: prev.content, atMs: toMs(prev.sentAtNs) } : { kind: 'empty' };
}
