/**
 * lib/xmtp/group-routing.ts
 *
 * Pure classification & routing helpers for XMTP conversations and streams.
 *
 * Critical invariant:
 *   A message from an XMTP Group (or an unresolved conversation whose type has
 *   not been confirmed as a 1:1 DM yet) MUST NEVER fall back to resolving
 *   `msg.senderInboxId` into a DM wallet row in the Chats list. Violating that
 *   invariant turned every active speaker in a group or community into a
 *   separate phantom wallet chat row in the user's sidebar.
 */

import { hasSyncGroupName } from '@/lib/sync/xmtpSyncChannel';

const CONVO_ID_RE = /^[0-9a-f]{32}$/i;
const COMM_CACHE_PREFIX = 'hl_comm_gids_v1_';

export function isXmtpConversationId(v: unknown): v is string {
  return typeof v === 'string' && CONVO_ID_RE.test(v.trim());
}

/** True when an XMTP Conversation wrapper represents a Group rather than a DM. */
export function isGroupConversation(conv: any): boolean {
  if (!conv) return false;
  if (typeof conv.peerInboxId === 'function') return false;
  if (conv?.metadata?.conversationType === 'group') return true;
  if (typeof conv.addMembersByIdentifiers === 'function' || typeof conv.addMembers === 'function') return true;
  if (typeof conv.updateName === 'function' || typeof conv.isAdmin === 'function') return true;
  return false;
}

/** True when an XMTP Conversation wrapper represents a 1:1 DM. */
export function isDmConversation(conv: any): boolean {
  if (!conv || isGroupConversation(conv)) return false;
  return conv?.metadata?.conversationType === 'dm' || typeof conv?.peerInboxId === 'function';
}

export function loadCachedCommunityGroupIds(address: string | null | undefined, storage?: Storage): Set<string> {
  const addr = (address || '').trim().toLowerCase();
  if (!addr) return new Set();
  const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!s) return new Set();
  try {
    const raw = s.getItem(`${COMM_CACHE_PREFIX}${addr}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean));
  } catch {
    return new Set();
  }
}

export function saveCachedCommunityGroupIds(
  address: string | null | undefined,
  ids: Iterable<string>,
  storage?: Storage,
): void {
  const addr = (address || '').trim().toLowerCase();
  if (!addr) return;
  const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!s) return;
  try {
    const clean = Array.from(new Set(Array.from(ids, (x) => String(x || '').trim().toLowerCase()).filter(Boolean))).slice(0, 500);
    s.setItem(`${COMM_CACHE_PREFIX}${addr}`, JSON.stringify(clean));
  } catch { /* storage unavailable */ }
}

export type StreamConversationRoute =
  | { kind: 'skip'; reason: 'community' | 'sync' | 'unresolved_group_or_conv' }
  | { kind: 'group'; groupId: string; groupName?: string }
  | { kind: 'dm'; dmConvo?: any };

export async function classifyStreamConversation(params: {
  convoId: string;
  msgConversation?: any;
  client: any;
  standaloneGroupIds: Set<string>;
  communityGroupIds: Set<string>;
  visibleGroupIds: Set<string>;
  knownDmConvoIds: Set<string>;
  /** Optional lazy refresh of community group IDs before admitting an unseen group into Chats. */
  refreshCommunityGroupIds?: () => Promise<Set<string> | null>;
}): Promise<StreamConversationRoute> {
  const {
    convoId,
    msgConversation,
    client,
    standaloneGroupIds,
    communityGroupIds,
    visibleGroupIds,
    knownDmConvoIds,
    refreshCommunityGroupIds,
  } = params;
  const convoIdLower = (convoId || '').trim().toLowerCase();

  if (hasSyncGroupName(msgConversation)) {
    return { kind: 'skip', reason: 'sync' };
  }

  if (!convoIdLower) {
    // Legacy or mock message without conversationId: allow DM path as before.
    return { kind: 'dm', dmConvo: msgConversation };
  }

  if (communityGroupIds.has(convoIdLower)) {
    return { kind: 'skip', reason: 'community' };
  }

  const checkCommunityAfterRefresh = async (): Promise<boolean> => {
    if (communityGroupIds.has(convoIdLower)) return true;
    if (!refreshCommunityGroupIds) return false;
    const updated = await refreshCommunityGroupIds().catch(() => null);
    if (updated) {
      for (const gid of updated) communityGroupIds.add(gid.toLowerCase());
    }
    return communityGroupIds.has(convoIdLower);
  };

  if (standaloneGroupIds.has(convoIdLower) || visibleGroupIds.has(convoIdLower)) {
    // Even if previously seen in UI, still suppress if it is now known to belong to a community.
    if (communityGroupIds.has(convoIdLower)) return { kind: 'skip', reason: 'community' };
    return { kind: 'group', groupId: convoIdLower };
  }

  if (isGroupConversation(msgConversation)) {
    if (await checkCommunityAfterRefresh()) return { kind: 'skip', reason: 'community' };
    standaloneGroupIds.add(convoIdLower);
    const name = typeof msgConversation?.name === 'string' && msgConversation.name.trim() ? msgConversation.name.trim() : undefined;
    return { kind: 'group', groupId: convoIdLower, groupName: name };
  }

  if (knownDmConvoIds.has(convoId) || knownDmConvoIds.has(convoIdLower) || isDmConversation(msgConversation)) {
    return { kind: 'dm', dmConvo: msgConversation };
  }

  // Resolve conversation object from XMTP local DB (and after a quick sync if missing).
  const convs = client?.conversations;
  let convObj: any = await convs?.getConversationById?.(convoId).catch(() => null);
  if (!convObj && typeof convs?.listGroups === 'function') {
    const groups: any[] = await convs.listGroups({ consentStates: [0, 1] }).catch(() => convs.listGroups().catch(() => []));
    convObj = groups.find((g) => String(g?.id ?? '').toLowerCase() === convoIdLower) ?? null;
  }
  if (!convObj && typeof convs?.listDms === 'function') {
    const dms: any[] = await convs.listDms({ consentStates: [0, 1] }).catch(() => convs.listDms().catch(() => []));
    convObj = dms.find((d) => String(d?.id ?? '').toLowerCase() === convoIdLower) ?? null;
  }
  if (!convObj && (typeof convs?.syncAll === 'function' || typeof convs?.sync === 'function')) {
    try {
      if (typeof convs.syncAll === 'function') {
        await convs.syncAll([0, 1]).catch(() => convs.sync?.());
      } else {
        await convs.sync();
      }
    } catch { /* best-effort */ }
    convObj = await convs?.getConversationById?.(convoId).catch(() => null);
    if (!convObj && typeof convs?.listGroups === 'function') {
      const groups: any[] = await convs.listGroups({ consentStates: [0, 1] }).catch(() => convs.listGroups().catch(() => []));
      convObj = groups.find((g) => String(g?.id ?? '').toLowerCase() === convoIdLower) ?? null;
    }
    if (!convObj && typeof convs?.listDms === 'function') {
      const dms: any[] = await convs.listDms({ consentStates: [0, 1] }).catch(() => convs.listDms().catch(() => []));
      convObj = dms.find((d) => String(d?.id ?? '').toLowerCase() === convoIdLower) ?? null;
    }
  }

  if (hasSyncGroupName(convObj)) {
    return { kind: 'skip', reason: 'sync' };
  }
  if (isGroupConversation(convObj)) {
    if (await checkCommunityAfterRefresh()) return { kind: 'skip', reason: 'community' };
    standaloneGroupIds.add(convoIdLower);
    const name = typeof convObj?.name === 'string' && convObj.name.trim() ? convObj.name.trim() : undefined;
    return { kind: 'group', groupId: convoIdLower, groupName: name };
  }
  if (isDmConversation(convObj)) {
    return { kind: 'dm', dmConvo: convObj };
  }

  // ConvoId exists, yet even after sync XMTP could not classify it as a 1:1 DM.
  // NEVER fall back to resolving msg.senderInboxId as a wallet DM: doing so would spawn
  // phantom wallet chats for every group or community speaker while welcomes catch up.
  return { kind: 'skip', reason: 'unresolved_group_or_conv' };
}
