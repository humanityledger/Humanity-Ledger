/**
 * lib/chat/incoming-revival.ts — Delete ≠ Block.
 *
 * Deleting a chat hides its history on this account; it must never stop the
 * other person from reaching you. Blocking does that, and only blocking.
 *
 * The old cut-off was `Date.now()` on the deleting device. XMTP stamps
 * messages with network time, so a device clock a few minutes ahead (or a
 * reconnect during a poll) silently dropped real messages sent right after
 * the deletion. The cut-off is now a watermark of network times actually
 * seen on screen, plus the ids of the last messages shown (persisted, so a
 * reload or a history sync cannot bring them back).
 *
 * Every incoming path (live stream, late resolution, background stream, DM
 * poll, offline queue, server fallback) calls decideIncoming() with the same
 * inputs and gets the same answer.
 */

import { toMs, unmarkDeleted } from '@/lib/chat/cleared-chats';

/** Used only when nothing was on screen: how far behind the network this device may be. */
export const SKEW_GRACE_MS = 5 * 60_000;
/** How many pre-delete message ids are remembered per deleted chat (as 8-hex digests, ≤2.9 KB stored). */
export const SNAPSHOT_IDS = 256;

/** FNV-1a 32-bit as 8 hex chars: a compact, stable digest of a message id. */
export function idDigest(id: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
const HEX8 = /^[0-9a-f]{8}$/;
/** Entries written by the 64-raw-id build are hashed on read. */
const asDigest = (v: string) => (HEX8.test(v) ? v : idDigest(v));

/**
 * The cut-off to store for "Delete chat" / "Clear chat": the newest network
 * time on screen. Never the local clock, which may be ahead of the network.
 */
export function deletionWatermark(nowMs: number, shownTimes: ReadonlyArray<unknown>): number {
  let max = 0;
  for (const t of shownTimes) {
    const ms = toMs(t);
    if (ms > max && ms <= nowMs + SKEW_GRACE_MS) max = ms; // ignore absurd future stamps
  }
  return max > 0 ? max : Math.max(1, nowMs - SKEW_GRACE_MS);
}

function storage(): Storage | undefined {
  try { return typeof window !== 'undefined' ? window.localStorage : undefined; } catch { return undefined; }
}
const snapKey = (owner: string, peer: string) => `ledger_delsnap_${owner.toLowerCase()}_${peer.toLowerCase()}`;
const owners = (o: ReadonlyArray<string | null | undefined>) => [...new Set(o.filter((x): x is string => !!x && x !== '0x0').map(x => x.toLowerCase()))];

/** Remembers the ids that were on screen when the chat was deleted or cleared. */
export function saveDeleteSnapshot(peer: string, own: ReadonlyArray<string | null | undefined>, ids: ReadonlyArray<string>, s = storage()): void {
  if (!s || !peer) return;
  const prev = loadSnapshotIds(peer, own, s);
  const merged = [...new Set([...prev, ...ids.filter(Boolean).map(i => idDigest(String(i)))])].slice(-SNAPSHOT_IDS);
  for (const o of owners(own)) { try { s.setItem(snapKey(o, peer), JSON.stringify(merged)); } catch {} }
}

export function loadSnapshotIds(peer: string, own: ReadonlyArray<string | null | undefined>, s = storage()): string[] {
  if (!s || !peer) return [];
  for (const o of owners(own)) {
    try {
      const v = JSON.parse(s.getItem(snapKey(o, peer)) || '[]');
      if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string').map(asDigest);
    } catch {}
  }
  return [];
}

export function isPreDeleteId(peer: string, id: unknown, own: ReadonlyArray<string | null | undefined>, s = storage()): boolean {
  if (id === undefined || id === null || id === '') return false;
  return loadSnapshotIds(peer, own, s).includes(idDigest(String(id)));
}

export type IncomingVerdict = 'drop' | 'suppress' | 'deliver' | 'revive';

export interface IncomingFacts {
  /** I blocked this peer (their side is enforced by consent + the server). */
  blocked: boolean;
  /** Network time of the message, ms (ns accepted). */
  msgMs: unknown;
  /** Clear/delete cut-off on this account (ms), 0 if none. */
  cutMs: number;
  /** Deletion mark (ms), 0 if the chat is not deleted. */
  deletedAt: number;
  /** The id was on screen when the chat was deleted/cleared. */
  preDelete: boolean;
  /** Arrived on the live stream after it opened (not history replay). */
  live?: boolean;
  /** Explicitly rescued earlier (rescue list). */
  rescued?: boolean;
}

/** One rule for every path: block drops, history stays hidden, anything new comes through. */
export function decideIncoming(f: IncomingFacts): IncomingVerdict {
  if (f.blocked) return 'drop';
  if (f.preDelete) return 'suppress';
  const cut = f.cutMs > 0 ? f.cutMs : 0;
  const isNew = cut === 0 || !!f.live || !!f.rescued || toMs(f.msgMs) > cut;
  if (!isNew) return 'suppress';
  return f.deletedAt > 0 ? 'revive' : 'deliver';
}

/** How far a live message may be stamped before the cut-off and still be new (clock skew). */
export const LIVE_SKEW_MS = 180_000;

export interface StreamFacts {
  /** Deleted for me, on screen at the clear/delete (snapshot or this session's ids). */
  hidden: boolean;
  /** Network time of the message, ms (ns accepted). */
  msgMs: unknown;
  /** max(clear cut-off, deletion) on this account, ms; 0 if none. */
  cutMs: number;
  /** Deletion mark, ms; 0 if the chat is not deleted. */
  deletedAt: number;
  fromPeer: boolean;
  /** First time this session sees the id (not a replay after a reconnect). */
  firstSight: boolean;
  /** The stream had been open for a moment: not the burst of an opening sync. */
  liveAfterOpen: boolean;
  /** Newest network time that was on screen at the clear/delete, 0 if unknown. */
  preMaxMs: number;
  /** Rescued earlier (persisted rescue list). */
  rescued: boolean;
  /** Content a person wrote, or a call offer: may be rescued across clock skew. */
  rescuable: boolean;
}

export interface StreamDecision {
  verdict: IncomingVerdict;
  /** Record the id in the rescue list (a skewed live message kept). */
  rescueNow: boolean;
  /** Why a message is suppressed (diagnostics), absent otherwise. */
  reason?: 'deleted on this device' | 'before this chat was cleared';
}

/**
 * The live stream's gate, on top of decideIncoming (the one rule of every path). A live message
 * the other person just sent is new even when its network time is a little before the cut-off
 * (a deleting device whose clock is ahead), provided it is newer than anything shown at the
 * delete: that is the clock-skew rescue, now decided here instead of inline in the component.
 */
export function streamGate(f: StreamFacts): StreamDecision {
  if (f.hidden) return { verdict: 'suppress', rescueNow: false, reason: 'deleted on this device' };
  const msgMs = toMs(f.msgMs);
  const cut = f.cutMs > 0 ? f.cutMs : 0;
  let rescueNow = false;
  const after = cut === 0 || msgMs > cut || f.rescued;
  if (!after && f.fromPeer && f.firstSight && f.liveAfterOpen && f.rescuable && cut > 0) {
    const behind = cut - msgMs;
    const newerThanShown = f.preMaxMs === 0 || msgMs > f.preMaxMs;
    if (behind >= 0 && behind < LIVE_SKEW_MS && newerThanShown) rescueNow = true;
  }
  const verdict = decideIncoming({
    blocked: false,
    msgMs,
    cutMs: cut,
    deletedAt: f.deletedAt,
    preDelete: false,
    rescued: f.rescued || rescueNow,
  });
  return verdict === 'suppress'
    ? { verdict, rescueNow: false, reason: 'before this chat was cleared' }
    : { verdict, rescueNow };
}

/** Clears the deletion locally and tells the account's other devices. */
export function reviveDeletedChat(
  peer: string,
  own: ReadonlyArray<string | null | undefined>,
  announce?: (peerLower: string) => void,
  s = storage(),
): void {
  const p = peer.toLowerCase();
  unmarkDeleted(p, own, s);
  try { announce?.(p); } catch {}
}

/**
 * Pre-delete history read at the moment of deletion, beyond what is on screen:
 * the local message store (persisted before the deletion, so certainly old) and
 * the XMTP DM's own latest messages (bounded to `budgetMs`, so the UI never
 * waits). Returns ids to remember and the newest persisted network time.
 */
export async function collectPreDeleteHistory(
  sources: { db?: () => Promise<Array<{ id?: unknown; sentAtNs?: unknown }>>; xmtp?: () => Promise<Array<{ id?: unknown; sentAtNs?: unknown }>> },
  budgetMs = 300,
): Promise<{ ids: string[]; maxPersistedMs: number }> {
  const within = <T,>(p: Promise<T>, fallback: T) => Promise.race([p.catch(() => fallback), new Promise<T>(r => setTimeout(() => r(fallback), budgetMs))]);
  const [db, xm] = await Promise.all([
    sources.db ? within(sources.db(), []) : Promise.resolve([]),
    sources.xmtp ? within(sources.xmtp(), []) : Promise.resolve([]),
  ]);
  const ids: string[] = [];
  let maxPersistedMs = 0;
  for (const r of db) { if (r.id != null) ids.push(String(r.id)); const t = toMs(r.sentAtNs); if (t > maxPersistedMs) maxPersistedMs = t; }
  for (const r of xm) if (r.id != null) ids.push(String(r.id));
  return { ids: ids.slice(-SNAPSHOT_IDS), maxPersistedMs };
}
