/**
 * The order of the chat list: pinned chats first, then by the time of the last message, sent or
 * received, newest at the top. Ties (same millisecond, or no message yet) fall back to the address,
 * so the list never reshuffles on its own between renders or devices.
 *
 * `lastAt` arrives in every shape the app stores (Date, ISO string, ms, ns): toMs() reads them all.
 * A chat with no known message time sorts below every chat that has one.
 */
import { toMs } from '@/lib/chat/cleared-chats';

export interface Orderable { peerAddress: string; lastAt?: unknown }

export function lastActivityMs(c: Orderable): number {
  return toMs(c.lastAt);
}

export function compareChats(a: Orderable, b: Orderable, pinned: ReadonlySet<string> = new Set()): number {
  const pa = pinned.has(a.peerAddress.toLowerCase()) ? 1 : 0;
  const pb = pinned.has(b.peerAddress.toLowerCase()) ? 1 : 0;
  if (pa !== pb) return pb - pa;
  const d = lastActivityMs(b) - lastActivityMs(a);
  if (d !== 0) return d;
  return a.peerAddress.toLowerCase() < b.peerAddress.toLowerCase() ? -1 : a.peerAddress.toLowerCase() > b.peerAddress.toLowerCase() ? 1 : 0;
}

export function orderChats<T extends Orderable>(list: readonly T[], pinned?: ReadonlySet<string>): T[] {
  return [...list].sort((a, b) => compareChats(a, b, pinned));
}

/** A list line moves forward in time only: an older message arriving late never pulls it down. */
export function newerLastAt(current: unknown, incoming: unknown): unknown {
  return toMs(incoming) >= toMs(current) ? incoming : current;
}
