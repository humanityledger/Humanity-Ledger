/**
 * lib/chat/message-authority.ts — who may change a message after it was sent.
 *
 * Edits (`__EDIT__<id>__::<text>`) and deletions for everyone (`__REVOKE__<id>`) arrive as ordinary
 * messages. Before 24 November 2026 the open-chat stream applied them to any message with that id,
 * so the other person in a chat could rewrite or delete *your* messages on your screen by naming
 * their ids. Now a change is applied only when the message it names is already on this device and
 * was sent by the same XMTP inbox as the change (lib/chat/deleted-messages.ts verifyRevoke). Edits
 * also have a window: 24 hours after sending, as in Signal.
 */

import { verifyRevoke, type RevocableTarget } from './deleted-messages';

export const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Milliseconds since the epoch from this app's `sentAtNs`, which holds ms on some paths and ns on others. */
export function sentAtMs(v: unknown): number | null {
  const n = typeof v === 'bigint' ? Number(v) : typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 1e15 ? Math.floor(n / 1e6) : n;
}

export function withinEditWindow(target: { sentAtNs?: unknown }, now = Date.now()): boolean {
  const t = sentAtMs(target.sentAtNs);
  return t !== null && now - t <= EDIT_WINDOW_MS;
}

type Target = RevocableTarget & { sentAtNs?: unknown };

/** A deletion for everyone counts only from the message's own author. */
export function mayRevoke(target: Target | undefined, senderInboxId: string | undefined): boolean {
  return verifyRevoke(target, senderInboxId) === 'honour';
}

/** An edit counts only from the message's own author, within the edit window. */
export function mayEdit(target: Target | undefined, senderInboxId: string | undefined, now = Date.now()): boolean {
  return mayRevoke(target, senderInboxId) && !!target && withinEditWindow(target, now);
}
