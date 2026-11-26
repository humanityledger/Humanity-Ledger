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
/** How many of the last shown message ids are remembered per deleted chat. */
export const SNAPSHOT_IDS = 64;

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
  const merged = [...new Set([...prev, ...ids.filter(Boolean).map(String)])].slice(-SNAPSHOT_IDS);
  for (const o of owners(own)) { try { s.setItem(snapKey(o, peer), JSON.stringify(merged)); } catch {} }
}

export function loadSnapshotIds(peer: string, own: ReadonlyArray<string | null | undefined>, s = storage()): string[] {
  if (!s || !peer) return [];
  for (const o of owners(own)) {
    try {
      const v = JSON.parse(s.getItem(snapKey(o, peer)) || '[]');
      if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
    } catch {}
  }
  return [];
}

export function isPreDeleteId(peer: string, id: unknown, own: ReadonlyArray<string | null | undefined>, s = storage()): boolean {
  if (id === undefined || id === null || id === '') return false;
  return loadSnapshotIds(peer, own, s).includes(String(id));
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
