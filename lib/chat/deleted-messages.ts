/**
 * lib/chat/deleted-messages.ts
 *
 * Persistent deletion and revocation helpers for Ledger Chat.
 * Guarantees that messages deleted for the local user ("Delete for me")
 * or revoked by their original author ("Delete for everyone") never resurrect
 * upon conversation reloads, page refreshes, or XMTP network re-fetches.
 */

export const MAX_DELETED_IDS = 2000;

function getStorage(): Storage | undefined {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return undefined;
}

export function scopeFor(peer?: string | null): string {
  return (peer || 'global').toLowerCase().trim();
}

export function getDeletedKey(peer?: string | null): string {
  return `hl_deleted_msg_${scopeFor(peer)}`;
}

export function getRevokedKey(): string {
  return 'hl_revoked_msg_global';
}

/**
 * Returns set of IDs hidden/deleted for this peer or globally.
 */
export function hiddenIds(peer?: string | null, storage: Storage | undefined = getStorage()): Set<string> {
  const set = new Set<string>();
  if (!storage) return set;

  // Peer-scoped deleted
  try {
    const rawPeer = storage.getItem(getDeletedKey(peer));
    if (rawPeer) {
      const arr = JSON.parse(rawPeer);
      if (Array.isArray(arr)) {
        for (const id of arr) {
          if (typeof id === 'string') set.add(id);
        }
      }
    }
  } catch {}

  // Global deleted for me (when peer is null/global or cross-conversation fallback)
  if (scopeFor(peer) !== 'global') {
    try {
      const rawGlobalDeleted = storage.getItem(getDeletedKey(null));
      if (rawGlobalDeleted) {
        const arr = JSON.parse(rawGlobalDeleted);
        if (Array.isArray(arr)) {
          for (const id of arr) {
            if (typeof id === 'string') set.add(id);
          }
        }
      }
    } catch {}
  }

  // Globally revoked
  try {
    const rawRevoked = storage.getItem(getRevokedKey());
    if (rawRevoked) {
      const arr = JSON.parse(rawRevoked);
      if (Array.isArray(arr)) {
        for (const id of arr) {
          if (typeof id === 'string') set.add(id);
        }
      }
    }
  } catch {}

  return set;
}

export function isHidden(peer: string | null | undefined, id: unknown, storage?: Storage): boolean {
  if (typeof id !== 'string' || !id) return false;
  return hiddenIds(peer, storage).has(id);
}

export function markDeletedForMe(
  peer: string | null | undefined,
  messageId: string,
  storage: Storage | undefined = getStorage()
): void {
  if (!storage || !messageId) return;
  try {
    const key = getDeletedKey(peer);
    const existing: string[] = JSON.parse(storage.getItem(key) || '[]');
    if (!existing.includes(messageId)) {
      existing.push(messageId);
      if (existing.length > MAX_DELETED_IDS) existing.shift();
      storage.setItem(key, JSON.stringify(existing));
    }
  } catch {}
}

export function markRevoked(
  messageId: string,
  storage: Storage | undefined = getStorage()
): void {
  if (!storage || !messageId) return;
  try {
    const key = getRevokedKey();
    const existing: string[] = JSON.parse(storage.getItem(key) || '[]');
    if (!existing.includes(messageId)) {
      existing.push(messageId);
      if (existing.length > MAX_DELETED_IDS) existing.shift();
      storage.setItem(key, JSON.stringify(existing));
    }
  } catch {}
}

export type RevokeVerdict = 'honour' | 'reject' | 'unknown';

export interface RevocableTarget {
  senderInboxId?: string;
  senderAddress?: string;
}

export function verifyRevoke(
  target: RevocableTarget | undefined,
  revokerId: string | undefined
): RevokeVerdict {
  if (!target) return 'unknown';
  if (!revokerId) return 'reject';

  const targetId = (target.senderInboxId || target.senderAddress || '').toLowerCase();
  const revoker = revokerId.toLowerCase();

  if (!targetId) return 'reject';
  return targetId === revoker ? 'honour' : 'reject';
}

export function shouldHonourRevoke(
  target: RevocableTarget | undefined,
  revokerId: string | undefined
): boolean {
  return verifyRevoke(target, revokerId) === 'honour';
}

export const DELETED_PREVIEW_SENTINEL = '__HL_DELETED_PREVIEW__';

export function isDeletedPreview(content: unknown): boolean {
  return typeof content === 'string' && content.includes(DELETED_PREVIEW_SENTINEL);
}

export function markDeletedPreview(): string {
  return DELETED_PREVIEW_SENTINEL;
}
