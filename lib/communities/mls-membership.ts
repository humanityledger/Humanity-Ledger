/**
 * lib/communities/mls-membership.ts — the pure rules for communities on MLS (lib/communities/mls.ts).
 * No SDK import, so they are tested without a browser.
 */

const ADDR = /^0x[0-9a-fA-F]{40}$/;

export interface CommunityLike {
  communityMls?: boolean | null;
  _count?: { members?: number } | null;
  channels?: { id?: string; xmtpGroupId?: string | null }[] | null;
  members?: { walletAddress?: string | null; role?: string | null }[] | null;
  ownerAddress?: string | null;
}

/** True for a community the operator moved to MLS (read only; nothing here turns it on). */
export function isMlsCommunity(c: CommunityLike | null | undefined): boolean {
  return !!c && c.communityMls === true;
}

/** The XMTP group that carries this community's posts, or null when it uses the server. */
export function mlsGroupOf(c: CommunityLike | null | undefined): string | null {
  if (!c || !isMlsCommunity(c)) return null;
  const ch = (c.channels ?? []).find((x) => typeof x?.xmtpGroupId === 'string' && x.xmtpGroupId.length > 0);
  return ch?.xmtpGroupId ?? null;
}

/** Server members, lower-cased, owner included, invalid entries dropped. */
export function serverMembers(c: CommunityLike): string[] {
  const out = new Set<string>();
  for (const m of c.members ?? []) {
    const a = String(m?.walletAddress ?? '').toLowerCase();
    if (ADDR.test(a)) out.add(a);
  }
  const owner = String(c.ownerAddress ?? '').toLowerCase();
  if (ADDR.test(owner)) out.add(owner);
  return [...out];
}

/** What an admin must change so the group matches the server's member list. Never removes `self`. */
export function reconcileMembers(server: readonly string[], group: readonly string[], self: string): { add: string[]; remove: string[] } {
  const s = new Set(server.map((a) => a.toLowerCase()));
  const g = new Set(group.map((a) => a.toLowerCase()));
  const me = self.toLowerCase();
  return {
    add: [...s].filter((a) => !g.has(a) && a !== me),
    remove: [...g].filter((a) => !s.has(a) && a !== me),
  };
}


/**
 * True only when the member list is known to be complete: present, and as long as the server's own
 * count. The community route can fall back to a query without members; reconciling against that
 * would remove everyone from the group. With an incomplete list an admin's client only adds.
 */
export function membersComplete(c: CommunityLike): boolean {
  if (!Array.isArray(c.members) || c.members.length === 0) return false;
  const n = c._count?.members;
  return n === undefined || n === null || n === c.members.length;
}
