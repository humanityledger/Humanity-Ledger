/**
 * lib/xmtp/group-routing.ts
 *
 * Pure classification & routing helpers for XMTP conversations and streams.
 *
 * Keeps community MLS channels in CommunityReader, routes standalone groups to
 * their group thread, routes 1:1 DMs cleanly without dropping on transient worker
 * errors, and prevents unresolved group conversations from spawning phantom DM
 * wallet rows for every speaker.
 */

import { hasSyncGroupName } from '@/lib/sync/xmtpSyncChannel';

const CONVO_ID_RE = /^[0-9a-f]{32}$/i;
const COMM_CACHE_PREFIX = 'hl_comm_gids_v1_';

export function isXmtpConversationId(v: unknown): v is string {
  return typeof v === 'string' && CONVO_ID_RE.test(v.trim());
}

/** True when an XMTP Conversation wrapper represents a Group rather than a DM. */
export function isGroupConversation(conv: any): boolean {
  if (!conv || typeof conv !== 'object') return false;
  if (typeof conv.peerInboxId === 'function') return false;
  if (conv?.metadata?.conversationType === 'group') return true;
  if (conv?.conversationType === 'group') return true;
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
  senderInboxId?: string;
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
    senderInboxId,
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

  const convs = client?.conversations;
  let lookupFailed = false;
  const safeGetConv = async (): Promise<any | null> => {
    if (typeof convs?.getConversationById !== 'function') return null;
    try {
      const hit = await convs.getConversationById(convoId);
      if (hit) return hit;
      return convoIdLower !== convoId ? await convs.getConversationById(convoIdLower) : null;
    } catch {
      lookupFailed = true;
      return null;
    }
  };
  const scanLists = async (): Promise<any | null> => {
    if (typeof convs?.listGroups === 'function') {
      const groups: any[] = await convs.listGroups({ consentStates: [0, 1] }).catch(() => convs.listGroups().catch(() => []));
      const grp = groups.find((g) => String(g?.id ?? '').toLowerCase() === convoIdLower);
      if (grp) return grp;
    }
    if (typeof convs?.listDms === 'function') {
      const dms: any[] = await convs.listDms({ includeDuplicateDms: true, consentStates: [0, 1] }).catch(() => convs.listDms().catch(() => []));
      const dm = dms.find((d) => String(d?.id ?? '').toLowerCase() === convoIdLower);
      if (dm) return dm;
    }
    return null;
  };

  let convObj: any = await safeGetConv();
  if (!convObj) convObj = await scanLists();

  if (!convObj && (typeof convs?.syncAll === 'function' || typeof convs?.sync === 'function')) {
    try {
      if (typeof convs.syncAll === 'function') {
        await convs.syncAll([0, 1]).catch(() => convs.sync?.());
      } else {
        await convs.sync();
      }
    } catch { /* best-effort */ }
    convObj = (await safeGetConv()) ?? (await scanLists());
  }

  // Fallback by sender inbox only when its DM conversation id matches this stream convoId.
  if (!convObj && senderInboxId && typeof convs?.getDmByInboxId === 'function') {
    const dmBySender = await convs.getDmByInboxId(senderInboxId).catch(() => null);
    if (dmBySender && !isGroupConversation(dmBySender) && (!dmBySender.id || String(dmBySender.id).toLowerCase() === convoIdLower)) {
      return { kind: 'dm', dmConvo: dmBySender };
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
  if (convObj && !isGroupConversation(convObj)) {
    return { kind: 'dm', dmConvo: convObj };
  }

  // If the worker threw on lookup without returning list results, do not drop a DM.
  if (lookupFailed) {
    return { kind: 'dm' };
  }

  return { kind: 'skip', reason: 'unresolved_group_or_conv' };
}
