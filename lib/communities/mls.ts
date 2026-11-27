/**
 * lib/communities/mls.ts — communities whose posts live in an XMTP MLS group (R-17, item 73).
 *
 * Design: docs/communities/MLS_MIGRATION.md. A community flagged `communityMls` (only the operator
 * flips it) keeps each channel's posts in an XMTP group whose id is stored on the channel
 * (`CommunityChannel.xmtpGroupId`). Our server then holds the community's metadata (name, members,
 * channels, invite codes) and never the posts: its post route answers 410 for these communities.
 *
 * Membership: the server decides who is a member (invite codes, approvals). Any member's client adds
 * the server's members who are not in the group yet (XMTP's default group policy lets members add),
 * so a person who joins while no admin is online can read as soon as any member opens the
 * community. Only an admin's client removes, from a complete member list. Removing a member starts
 * a new MLS epoch, so they cannot read what is posted afterwards.
 *
 * New communities start on MLS (24/11/2026): the creator's client makes the first channel's group,
 * with the creator only, before the community is created, and the server stores its id
 * (app/api/chat/communities/route.ts POST). Existing communities are not migrated.
 */

import { isSyncWaitError } from '@/lib/xmtp/syncErrors';
import {
  addGroupMember,
  createSecureGroup,
  getGroupMessages,
  removeGroupMember,
  resolveGroupForClient,
  runGroupSerial,
  sendGroupMessage,
} from '@/lib/xmtp/groups';

import { membersComplete, reconcileMembers, serverMembers, type CommunityLike } from './mls-membership';
export { isMlsCommunity, membersComplete, mlsGroupOf, reconcileMembers, serverMembers, type CommunityLike } from './mls-membership';

const ADDR = /^0x[0-9a-fA-F]{40}$/;
const normInst = (x: unknown): string => String(x ?? '').replace(/^0x/i, '').toLowerCase();

async function checksumIdentifiers(list: readonly string[]): Promise<{ identifier: string; identifierKind: 'Ethereum' }[]> {
  try {
    const { getAddress } = await import('viem');
    return list.map((a) => ({ identifier: getAddress(a), identifierKind: 'Ethereum' as const }));
  } catch {
    return list.map((a) => ({ identifier: a, identifierKind: 'Ethereum' as const }));
  }
}

export interface GroupPost {
  id: string;
  senderInboxId: string;
  content: string;
  createdAt: number;
}

/** Text posts of the group, oldest first. Non-text content (reactions, receipts) is left out. */
export async function readGroupPosts(client: any, groupId: string): Promise<GroupPost[]> {
  const msgs = await getGroupMessages(client, groupId);
  return msgs
    .filter((m: any) => typeof m?.content === 'string' && m.content.trim() && m?.deliveryStatus !== 2 && m?.deliveryStatus !== 'failed')
    .map((m: any) => ({
      id: String(m.id),
      senderInboxId: String(m.senderInboxId ?? ''),
      content: String(m.content),
      createdAt: m.sentAtNs !== undefined ? Number(BigInt(m.sentAtNs) / 1_000_000n) : Date.now(),
    }))
    .sort((a: GroupPost, b: GroupPost) => a.createdAt - b.createdAt);
}

export async function postToGroup(client: any, groupId: string, text: string): Promise<string | undefined> {
  return sendGroupMessage(client, groupId, text);
}

/** Wallet addresses currently in the group, from the SDK's member list. */
export async function groupMemberAddresses(client: any, groupId: string): Promise<string[]> {
  const group = await resolveGroupForClient(client, groupId);
  if (!group) return [];
  const members: any[] = await runGroupSerial(groupId, async () => {
    await Promise.resolve(group.sync?.()).catch(() => {});
    return (await group.members?.()) ?? [];
  });
  const out: string[] = [];
  for (const m of members) {
    const ids: any[] = m?.accountIdentifiers ?? [];
    for (const id of ids) {
      const a = String(id?.identifier ?? '').toLowerCase();
      if (ADDR.test(a)) out.push(a);
    }
  }
  return out;
}

/**
 * Welcome any new XMTP installations (for instance, a computer just linked via Linked Devices)
 * belonging to existing group members who are still in the server's member list.
 */
async function syncMemberInstallations(client: any, groupId: string, group: any, allowedAddresses: readonly string[]): Promise<void> {
  const inboxStateFn = client?.preferences?.inboxStateFromInboxIds;
  if (typeof inboxStateFn !== 'function' || typeof group?.addMembers !== 'function') return;
  const members: any[] = await runGroupSerial<any[]>(groupId, async () => (await group.members?.().catch(() => [])) ?? []).catch(() => []);
  if (!members.length) return;
  const allowed = new Set(allowedAddresses.map((a) => a.toLowerCase()));
  const candidates = members.filter((m) =>
    (m?.accountIdentifiers ?? []).some((id: any) => allowed.has(String(id?.identifier ?? '').toLowerCase()))
  );
  if (!candidates.length) return;
  const states: any[] = await inboxStateFn.call(client.preferences, candidates.map((m) => String(m.inboxId)), true).catch(() => []);
  const byInbox = new Map(states.map((s) => [String(s?.inboxId ?? '').toLowerCase(), s]));

  const missingByInbox = new Map<string, string[]>();
  const allMissingInstIds: string[] = [];
  for (const m of candidates) {
    const inboxId = String(m?.inboxId ?? '');
    const st = byInbox.get(inboxId.toLowerCase());
    if (!inboxId || !st?.installations?.length) continue;
    const inGroup = new Set((m?.installationIds ?? []).map(normInst));
    const missing = st.installations
      .map((inst: any) => normInst(inst?.id))
      .filter((id: string) => id && !inGroup.has(id));
    if (missing.length) {
      missingByInbox.set(inboxId, missing);
      allMissingInstIds.push(...missing);
    }
  }
  if (!missingByInbox.size) return;

  // Skip expired/invalid legacy installations so they do not force FailedToVerifyInstallations commits.
  let statuses: Map<string, any> | null = null;
  if (typeof client?.getKeyPackageStatusesForInstallationIds === 'function' && allMissingInstIds.length) {
    const res = await client.getKeyPackageStatusesForInstallationIds(allMissingInstIds).catch(() => null);
    if (res instanceof Map) statuses = res;
  }

  const needsWelcome: string[] = [];
  for (const [inboxId, missing] of missingByInbox) {
    if (!statuses) {
      needsWelcome.push(inboxId);
      continue;
    }
    const hasValidMissing = missing.some((id) => {
      const st = statuses!.get(id) ?? statuses!.get(`0x${id}`);
      return !st || !st.validationError;
    });
    if (hasValidMissing) needsWelcome.push(inboxId);
  }
  if (!needsWelcome.length) return;

  try {
    await runGroupSerial(groupId, () => Promise.resolve(group.addMembers(needsWelcome)));
  } catch {
    for (const inboxId of needsWelcome) {
      await runGroupSerial(groupId, () => Promise.resolve(group.addMembers([inboxId]))).catch(() => {});
    }
  }
}

/**
 * Admin only: make the group match the server's members. Returns what changed.
 *
 * Adds go in one commit and removals in one commit (one MLS epoch each, not one per person). The
 * group's creator (the community owner, XMTP super admin) also makes the community's admins XMTP
 * admins, so their apps can remove people too; before 27/11/2026 only the owner's app could, and a
 * person removed by another admin kept reading new posts until the owner opened the community.
 */
export async function syncGroupMembers(client: any, groupId: string, c: CommunityLike, self: string): Promise<{ added: number; removed: number }> {
  const group = await resolveGroupForClient(client, groupId);
  if (!group) return { added: 0, removed: 0 };

  await runGroupSerial(groupId, async () => {
    if (typeof group.consentState === 'function' && typeof group.updateConsentState === 'function') {
      const st = await group.consentState().catch(() => 1);
      if (st !== 1) await group.updateConsentState(1).catch(() => {});
    }
    await Promise.resolve(group.sync?.()).catch(() => {});
    if (typeof group.isActive === 'function' && (await group.isActive().catch(() => true)) === false) {
      await Promise.resolve(group.publishMessages?.()).catch(() => {});
      await Promise.resolve(group.sync?.()).catch(() => {});
    }
  }).catch(() => {});

  const server = serverMembers(c);
  const plan = reconcileMembers(server, await groupMemberAddresses(client, groupId), self);
  // Removing needs a complete list (membersComplete): a partial answer from the server must never
  // empty the group.
  const remove = membersComplete(c) ? plan.remove : [];
  const ids = (list: string[]) => list.map((a) => ({ identifier: a, identifierKind: 'Ethereum' as const }));
  let added = 0, removed = 0;
  if (plan.add.length) {
    const addIds = await checksumIdentifiers(plan.add);
    try {
      await runGroupSerial(groupId, () => group.addMembersByIdentifiers(addIds));
      added = plan.add.length;
    } catch (err) {
      if (isSyncWaitError(err)) {
        await runGroupSerial(groupId, () => Promise.resolve(group.sync?.())).catch(() => {});
        added = plan.add.length;
      } else {
        for (const a of plan.add) {
          try { await addGroupMember(client, groupId, a); added++; } catch { /* not on XMTP yet */ }
        }
      }
    }
  }
  if (remove.length) {
    try { await runGroupSerial(groupId, () => group.removeMembersByIdentifiers(ids(remove))); removed = remove.length; }
    catch { for (const a of remove) { try { await removeGroupMember(client, groupId, a); removed++; } catch { /* retried next time */ } } }
  }
  await syncMemberInstallations(client, groupId, group, server).catch(() => {});
  await runGroupSerial(groupId, () => grantAdmins(client, group, c)).catch(() => { /* only the super admin can; others skip */ });
  return { added, removed };
}

/** The super admin's app: community ADMINs (and the owner) are XMTP admins; nobody else is. */
async function grantAdmins(client: any, group: any, c: CommunityLike): Promise<void> {
  const selfInbox: string = client?.inboxId ?? '';
  if (!selfInbox || !(await group.isSuperAdmin?.(selfInbox))) return;
  const wanted = new Set<string>();
  for (const m of c.members ?? []) {
    const a = String(m?.walletAddress ?? '').toLowerCase();
    if (m?.role === 'ADMIN' && ADDR.test(a)) {
      const inbox = await client.findInboxIdByIdentifier?.({ identifier: a, identifierKind: 'Ethereum' }).catch(() => undefined);
      if (inbox) wanted.add(inbox);
    }
  }
  const current: string[] = (await group.listAdmins?.()) ?? [];
  for (const inbox of wanted) if (!current.includes(inbox)) await group.addAdmin(inbox).catch(() => {});
  for (const inbox of current) if (!wanted.has(inbox) && inbox !== selfInbox) await group.removeAdmin(inbox).catch(() => {});
}

/** Non-admin members: add the server's members missing from the group, never remove anyone. */
export async function addMissingMembers(client: any, groupId: string, c: CommunityLike, self: string): Promise<number> {
  const group = await resolveGroupForClient(client, groupId);
  if (!group) return 0;
  const server = serverMembers(c);
  const plan = reconcileMembers(server, await groupMemberAddresses(client, groupId), self);
  let n = 0;
  for (const a of plan.add) { try { await addGroupMember(client, groupId, a); n++; } catch { /* not on XMTP yet */ } }
  await syncMemberInstallations(client, groupId, group, server).catch(() => {});
  return n;
}

/** Sync membership across EVERY MLS channel in a community. */
export async function syncAllCommunityChannels(client: any, c: CommunityLike, self: string, isAdmin: boolean): Promise<void> {
  if (!client || !c || c.communityMls !== true) return;
  const seen = new Set<string>();
  for (const ch of c.channels ?? []) {
    const gid = typeof ch?.xmtpGroupId === 'string' ? ch.xmtpGroupId.trim() : '';
    if (!gid || seen.has(gid)) continue;
    seen.add(gid);
    if (isAdmin) await syncGroupMembers(client, gid, c, self).catch(() => {});
    else await addMissingMembers(client, gid, c, self).catch(() => {});
  }
}

const mlsSyncInFlight = new Map<string, Promise<Set<string>>>();
const mlsSyncLastAt = new Map<string, number>();
const mlsKnownGroupIds = new Map<string, Set<string>>();

/**
 * Background community MLS sync (throttled per account to once every 20s).
 * Keeps owners/admins welcoming newly joined members even while they are on Chats, Manage, or Invite
 * instead of inside CommunityReader. Also returns all known community XMTP channel groupIds so
 * standalone Group Chat discovery can keep community MLS channels separate.
 */
export async function syncCommunitiesMlsMembership(
  client: any,
  myAddress: string,
  fetchImpl: typeof fetch = fetch,
  minIntervalMs = 20_000,
): Promise<Set<string>> {
  const me = (myAddress || '').trim().toLowerCase();
  const cached = mlsKnownGroupIds.get(me) ?? new Set<string>();
  if (!client || !ADDR.test(me)) return cached;
  const now = Date.now();
  const prev = mlsSyncLastAt.get(me) ?? 0;
  if (now - prev < minIntervalMs) return cached;
  const running = mlsSyncInFlight.get(me);
  if (running) return running;

  const task = (async (): Promise<Set<string>> => {
    const groupIds = new Set<string>(cached);
    try {
      const headers = { 'x-web3-address': me, 'x-verified-session-address': me };
      const listRes = await fetchImpl('/api/chat/communities', { credentials: 'include', headers, cache: 'no-store' });
      if (!listRes.ok) return groupIds;
      const listJson = await listRes.json().catch(() => ({}));
      const list: any[] = Array.isArray(listJson?.communities) ? listJson.communities : [];
      const mlsOnes = list.filter((c) => c?.communityMls === true && c?.id && Array.isArray(c?.channels) && c.channels.some((ch: any) => ch?.xmtpGroupId));
      for (const summary of mlsOnes) {
        for (const ch of summary.channels ?? []) {
          if (typeof ch?.xmtpGroupId === 'string' && ch.xmtpGroupId.trim()) {
            groupIds.add(ch.xmtpGroupId.trim().toLowerCase());
          }
        }
        try {
          const detRes = await fetchImpl(`/api/chat/communities/${encodeURIComponent(summary.id)}`, { credentials: 'include', headers, cache: 'no-store' });
          if (!detRes.ok) continue;
          const detJson = await detRes.json().catch(() => ({}));
          const full = detJson?.community ?? detJson;
          if (!full || full.communityMls !== true) continue;
          for (const ch of full.channels ?? []) {
            if (typeof ch?.xmtpGroupId === 'string' && ch.xmtpGroupId.trim()) {
              groupIds.add(ch.xmtpGroupId.trim().toLowerCase());
            }
          }
          const isOwner = String(full.ownerAddress || '').toLowerCase() === me;
          const mine = Array.isArray(full.members)
            ? full.members.find((m: any) => String(m?.walletAddress || '').toLowerCase() === me)
            : null;
          const isAdmin = isOwner || mine?.role === 'ADMIN';
          if (isOwner || mine) {
            await syncAllCommunityChannels(client, full, me, isAdmin);
          }
        } catch { /* retry on next tick */ }
      }
      mlsKnownGroupIds.set(me, groupIds);
      mlsSyncLastAt.set(me, Date.now());
    } catch {
      /* background best-effort */
    } finally {
      mlsSyncInFlight.delete(me);
    }
    return groupIds;
  })();
  mlsSyncInFlight.set(me, task);
  return task;
}

/** The first channel's group of a community being created: the creator only, members join later. */
export async function createCommunityGroup(client: any, communityName: string): Promise<string> {
  return createSecureGroup(client, [], `${communityName} · general`.slice(0, 100), '', { allowCreatorOnly: true });
}

/**
 * Creates the group for a new channel of an MLS community with every current member.
 * If batch creation fails because one member does not have an XMTP inbox yet, creates the
 * group optimistically and adds every reachable member individually (periodic sync adds the rest).
 */
export async function createChannelGroup(client: any, c: CommunityLike, channelName: string, self: string): Promise<string> {
  const me = self.toLowerCase();
  const others = serverMembers(c).filter((a) => a !== me);
  let groupId: string;
  try {
    groupId = await createSecureGroup(client, others, channelName, '', { allowCreatorOnly: true });
  } catch (err) {
    if (!others.length) throw err;
    groupId = await createSecureGroup(client, [], channelName, '', { allowCreatorOnly: true });
    for (const a of others) {
      try { await addGroupMember(client, groupId, a); } catch { /* not on XMTP yet; periodic sync welcomes them later */ }
    }
  }
  const group = await resolveGroupForClient(client, groupId).catch(() => null);
  if (group) {
    await syncMemberInstallations(client, groupId, group, serverMembers(c)).catch(() => {});
    await runGroupSerial(groupId, () => grantAdmins(client, group, c)).catch(() => {});
  }
  return groupId;
}
