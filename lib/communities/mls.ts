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

import { getGroupMessages, sendGroupMessage, addGroupMember, removeGroupMember, createSecureGroup } from '@/lib/xmtp/groups';

import { membersComplete, reconcileMembers, serverMembers, type CommunityLike } from './mls-membership';
export { isMlsCommunity, membersComplete, mlsGroupOf, reconcileMembers, serverMembers, type CommunityLike } from './mls-membership';

const ADDR = /^0x[0-9a-fA-F]{40}$/;

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
    .filter((m: any) => typeof m?.content === 'string' && m.content.trim())
    .map((m: any) => ({
      id: String(m.id),
      senderInboxId: String(m.senderInboxId ?? ''),
      content: String(m.content),
      createdAt: m.sentAtNs !== undefined ? Number(BigInt(m.sentAtNs) / 1_000_000n) : Date.now(),
    }))
    .sort((a: GroupPost, b: GroupPost) => a.createdAt - b.createdAt);
}

export async function postToGroup(client: any, groupId: string, text: string): Promise<void> {
  await sendGroupMessage(client, groupId, text);
}

/** Wallet addresses currently in the group, from the SDK's member list. */
export async function groupMemberAddresses(client: any, groupId: string): Promise<string[]> {
  const group = await client?.conversations?.getConversationById?.(groupId);
  if (!group) return [];
  await group.sync?.();
  const members: any[] = (await group.members?.()) ?? [];
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
 * Admin only: make the group match the server's members. Returns what changed.
 *
 * Adds go in one commit and removals in one commit (one MLS epoch each, not one per person). The
 * group's creator (the community owner, XMTP super admin) also makes the community's admins XMTP
 * admins, so their apps can remove people too; before 27/11/2026 only the owner's app could, and a
 * person removed by another admin kept reading new posts until the owner opened the community.
 */
export async function syncGroupMembers(client: any, groupId: string, c: CommunityLike, self: string): Promise<{ added: number; removed: number }> {
  const plan = reconcileMembers(serverMembers(c), await groupMemberAddresses(client, groupId), self);
  // Removing needs a complete list (membersComplete): a partial answer from the server must never
  // empty the group.
  const remove = membersComplete(c) ? plan.remove : [];
  const group = await client?.conversations?.getConversationById?.(groupId);
  if (!group) return { added: 0, removed: 0 };
  const ids = (list: string[]) => list.map((a) => ({ identifier: a, identifierKind: 'Ethereum' as const }));
  let added = 0, removed = 0;
  if (plan.add.length) {
    try { await group.addMembersByIdentifiers(ids(plan.add)); added = plan.add.length; }
    catch { for (const a of plan.add) { try { await addGroupMember(client, groupId, a); added++; } catch { /* not on XMTP yet */ } } }
  }
  if (remove.length) {
    try { await group.removeMembersByIdentifiers(ids(remove)); removed = remove.length; }
    catch { for (const a of remove) { try { await removeGroupMember(client, groupId, a); removed++; } catch { /* retried next time */ } } }
  }
  await grantAdmins(client, group, c).catch(() => { /* only the super admin can; others skip */ });
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
  const plan = reconcileMembers(serverMembers(c), await groupMemberAddresses(client, groupId), self);
  let n = 0;
  for (const a of plan.add) { try { await addGroupMember(client, groupId, a); n++; } catch { /* not on XMTP yet */ } }
  return n;
}

/** The first channel's group of a community being created: the creator only, members join later. */
export async function createCommunityGroup(client: any, communityName: string): Promise<string> {
  return createSecureGroup(client, [], `${communityName} · general`.slice(0, 100), '', { allowCreatorOnly: true });
}

/** Creates the group for a new channel of an MLS community, with every current member but `self`. */
export async function createChannelGroup(client: any, c: CommunityLike, channelName: string, self: string): Promise<string> {
  const others = serverMembers(c).filter((a) => a !== self.toLowerCase());
  if (!others.length) throw new Error('Invite at least one member before adding an encrypted channel.');
  return createSecureGroup(client, others, channelName);
}
