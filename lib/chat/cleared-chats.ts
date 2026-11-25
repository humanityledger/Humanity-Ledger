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

function validOwners(owners: ReadonlyArray<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const o of owners) {
    if (!o || o === '0x0') continue;
    out.push(o);
  }
  return out;
}

function keysFor(peer: string, owners: ReadonlyArray<string | null | undefined>, forWrite = false): string[] {
  const p = peer.toLowerCase();
  const real = validOwners(owners);
  const scoped: string[] = [];
  for (const o of real) {
    scoped.push(`ledger_cleared_${o.toLowerCase()}_${p}`);
    // Earlier builds also wrote the checksummed form; it is still read.
    if (o !== o.toLowerCase()) scoped.push(`ledger_cleared_${o}_${p}`);
  }
  if (forWrite && scoped.length > 0) return [...new Set(scoped)];
  return [...new Set([`ledger_cleared_${p}`, ...scoped])];
}

/** The cut-off for a conversation, in ms, or 0 when it was never cleared. */
export function clearedAtMs(
  peer: string | null | undefined,
  owners: ReadonlyArray<string | null | undefined>,
  s: Storage | undefined = storage(),
): number {
  if (!peer || !s) return 0;
  let max = 0;
  for (const k of keysFor(peer, owners, false)) {
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
    for (const k of keysFor(peer, owners, true)) s.setItem(k, String(atMs));
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

/*
 * "Delete chat" (21 November 2026). It used to remove the conversation from the screen only: on
 * the next sync the person and every message came back. Deleting now records two things:
 *   - the same cut-off as "Clear chat", so no message from before it is shown again;
 *   - a deletion time (`ledger_deleted_<account>_<peer>`, and `deleted:<peer>` in the synced
 *     device state), so the conversation stays out of the list until a message newer than the
 *     deletion arrives. Then it comes back with that message only, as in other messengers.
 */

function deletedKeysFor(peer: string, owners: ReadonlyArray<string | null | undefined>, forWrite = false): string[] {
  const p = peer.toLowerCase();
  const real = validOwners(owners);
  const scoped: string[] = [];
  for (const o of real) scoped.push(`ledger_deleted_${o.toLowerCase()}_${p}`);
  if (forWrite && scoped.length > 0) return [...new Set(scoped)];
  return [...new Set([`ledger_deleted_${p}`, ...scoped])];
}

/** When this conversation was deleted on this device (ms), or 0. */
export function deletedAtMs(
  peer: string | null | undefined,
  owners: ReadonlyArray<string | null | undefined>,
  s: Storage | undefined = storage(),
): number {
  if (!peer || !s) return 0;
  let max = 0;
  for (const k of deletedKeysFor(peer, owners, false)) {
    try {
      const v = parseInt(s.getItem(k) || '0', 10);
      if (Number.isFinite(v) && v > max) max = v;
    } catch { /* unreadable key: ignored */ }
  }
  return max;
}

/**
 * Records a deletion at `atMs`: the clear cut-off and the deletion time. Returns false when it
 * could not be written, so the caller can say so instead of a deletion that comes back.
 */
export function markDeleted(
  peer: string,
  owners: ReadonlyArray<string | null | undefined>,
  atMs: number,
  s: Storage | undefined = storage(),
): boolean {
  if (!s || !peer || !(atMs > 0)) return false;
  if (!markCleared(peer, owners, atMs, s)) return false;
  try {
    for (const k of deletedKeysFor(peer, owners, true)) s.setItem(k, String(atMs));
    return deletedAtMs(peer, owners, s) >= atMs;
  } catch {
    return false;
  }
}

/**
 * Removes the deletion mark for a peer on this device, allowing the conversation
 * to be restored and new messages to be shown properly when communication resumes.
 */
export function unmarkDeleted(
  peer: string,
  owners: ReadonlyArray<string | null | undefined>,
  s: Storage | undefined = storage(),
): void {
  if (!s || !peer) return;
  for (const k of deletedKeysFor(peer, owners, false)) {
    try {
      s.removeItem(k);
    } catch { /* ignored */ }
  }
}

/**
 * Removes the clear mark for a peer on this device.
 */
export function unmarkCleared(
  peer: string,
  owners: ReadonlyArray<string | null | undefined>,
  s: Storage | undefined = storage(),
): void {
  if (!s || !peer) return;
  for (const k of keysFor(peer, owners, false)) {
    try {
      s.removeItem(k);
    } catch { /* ignored */ }
  }
}

function rescuedKey(peer: string, owners: ReadonlyArray<string | null | undefined>): string {
  const real = validOwners(owners);
  const o = real[0]?.toLowerCase();
  const p = peer.toLowerCase();
  return o ? `ledger_rescued_${o}_${p}` : `ledger_rescued_${p}`;
}

/** Records a newly received post-clear message id rescued across clock skew so reloads keep it. */
export function markRescuedMessage(
  peer: string,
  msgId: string,
  owners: ReadonlyArray<string | null | undefined>,
  s: Storage | undefined = storage(),
): void {
  if (!s || !peer || !msgId) return;
  try {
    const key = rescuedKey(peer, owners);
    const cur: string[] = JSON.parse(s.getItem(key) || '[]');
    if (Array.isArray(cur) && !cur.includes(msgId)) {
      const next = [...cur.slice(-49), msgId];
      s.setItem(key, JSON.stringify(next));
    }
  } catch { /* ignored */ }
}

export function isRescuedMessage(
  peer: string | null | undefined,
  msgId: string | null | undefined,
  owners: ReadonlyArray<string | null | undefined>,
  s: Storage | undefined = storage(),
): boolean {
  if (!s || !peer || !msgId) return false;
  try {
    const cur = JSON.parse(s.getItem(rescuedKey(peer, owners)) || '[]');
    return Array.isArray(cur) && cur.includes(msgId);
  } catch {
    return false;
  }
}

export function clearRescuedMessages(
  peer: string,
  owners: ReadonlyArray<string | null | undefined>,
  s: Storage | undefined = storage(),
): void {
  if (!s || !peer) return;
  try {
    s.removeItem(rescuedKey(peer, owners));
    s.removeItem(`ledger_rescued_${peer.toLowerCase()}`);
  } catch { /* ignored */ }
}

/** True when a list line belongs to a deleted conversation with nothing newer than the deletion. */
export function hiddenAfterDelete(c: PreviewLine, deletedAt: number): boolean {
  if (!(deletedAt > 0)) return false;
  return !survivesClear(c.lastAt, deletedAt);
}
