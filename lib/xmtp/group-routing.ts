/**
 * lib/xmtp/group-routing.ts — where a message from the XMTP stream belongs.
 *
 * Restored 27 Nov 2026: PR #318 (b16da4c) imported this module from LedgerChatV2.tsx but the file
 * was never committed, so `next build` failed on Railway ("Module not found: Can't resolve
 * '@/lib/xmtp/group-routing'"). Same behaviour as the inline code it replaced (#316):
 *  - a post in a community's MLS channel stays in the community reader, never in a chat row;
 *  - a message in a standalone group goes to that group's thread (its conversation id);
 *  - anything else is a DM. A DM is never skipped here: delivery of DMs is not this module's
 *    call (blocking is the only reason to drop one, lib/chat/incoming-revival.ts).
 */

/** An XMTP conversation id: 32 hex characters (a DM peer is a 0x wallet address instead). */
const CONVERSATION_ID_RE = /^[0-9a-f]{32}$/i;

export function isXmtpConversationId(id: unknown): boolean {
  return typeof id === 'string' && CONVERSATION_ID_RE.test(id);
}

/** A group handle or stream conversation object (not a DM). Works with property or method metadata. */
export function isGroupConversation(conv: unknown): boolean {
  if (!conv || typeof conv !== 'object') return false;
  const c = conv as Record<string, unknown>;
  const meta = c.metadata;
  if (meta && typeof meta === 'object' && (meta as Record<string, unknown>).conversationType === 'group') return true;
  if (c.conversationType === 'group') return true;
  if (typeof c.peerInboxId === 'function') return false; // a Dm
  return typeof c.addMembersByIdentifiers === 'function' || typeof c.addMembers === 'function';
}

export type StreamRoute =
  | { kind: 'skip'; reason: 'community' }
  | { kind: 'group'; groupId: string; groupName?: string }
  | { kind: 'dm'; dmConvo?: any };

export interface ClassifyStreamInput {
  convoId: string;
  msgConversation?: unknown;
  client: unknown;
  standaloneGroupIds: ReadonlySet<string>;
  communityGroupIds: ReadonlySet<string>;
  visibleGroupIds: ReadonlySet<string>;
  knownDmConvoIds: ReadonlySet<string>;
  /** Re-reads which groups are community channels (network); null when it could not. */
  refreshCommunityGroupIds?: () => Promise<ReadonlySet<string> | null>;
}

function groupNameOf(conv: unknown): string | undefined {
  const name = conv && typeof conv === 'object' ? (conv as Record<string, unknown>).name : undefined;
  return typeof name === 'string' && name.trim() ? name.trim() : undefined;
}

export async function classifyStreamConversation(input: ClassifyStreamInput): Promise<StreamRoute> {
  const convoId = String(input.convoId || '');
  const id = convoId.toLowerCase();
  if (!id) return { kind: 'dm' };
  if (input.communityGroupIds.has(id)) return { kind: 'skip', reason: 'community' };

  const known = input.standaloneGroupIds.has(id) || input.visibleGroupIds.has(id);
  let groupConv: unknown = isGroupConversation(input.msgConversation) ? input.msgConversation : null;
  let dmConvo: unknown;
  if (!known && !groupConv && isXmtpConversationId(id) && !input.knownDmConvoIds.has(convoId)) {
    const convs = (input.client as { conversations?: { getConversationById?: (x: string) => Promise<unknown> } } | null)?.conversations;
    const found = await Promise.resolve(convs?.getConversationById?.(convoId)).catch(() => null);
    if (isGroupConversation(found)) groupConv = found;
    else if (found) dmConvo = found;
  }

  if (known || groupConv) {
    // A group seen for the first time may be a community channel this device has not listed yet.
    if (!known && input.refreshCommunityGroupIds) {
      const fresh = await input.refreshCommunityGroupIds().catch(() => null);
      if (fresh?.has(id)) return { kind: 'skip', reason: 'community' };
    }
    return { kind: 'group', groupId: id, groupName: groupNameOf(groupConv ?? input.msgConversation) };
  }
  return dmConvo ? { kind: 'dm', dmConvo } : { kind: 'dm' };
}

/** Community channel ids cached per account, so the first stream messages after a reload route right. */
const CACHE_PREFIX = 'ledger_community_group_ids:';
const CACHE_MAX = 5000;

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadCachedCommunityGroupIds(address: string | null | undefined, store: Storage | null = storage()): Set<string> {
  if (!address || !store) return new Set();
  try {
    const raw = JSON.parse(store.getItem(CACHE_PREFIX + address.toLowerCase()) || '[]');
    return new Set((Array.isArray(raw) ? raw : []).filter(isXmtpConversationId).map((s: string) => s.toLowerCase()));
  } catch {
    return new Set();
  }
}

export function saveCachedCommunityGroupIds(address: string | null | undefined, ids: Iterable<string>, store: Storage | null = storage()): void {
  if (!address || !store) return;
  try {
    const list = [...ids].filter(isXmtpConversationId).map((s) => s.toLowerCase()).slice(0, CACHE_MAX);
    store.setItem(CACHE_PREFIX + address.toLowerCase(), JSON.stringify(list));
  } catch { /* storage full or blocked: the next sync lists them again */ }
}
