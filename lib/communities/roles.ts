/**
 * lib/communities/roles.ts — Owner > Admin > Moderator > Member, one matrix for UI and tests.
 * The owner is `community.ownerAddress`; the others are `CommunityMember.role` (ADMIN, MODERATOR,
 * MEMBER). The server enforces its own checks (app/api/chat/communities/[id]/members); this only
 * decides what the screen offers, so nobody is shown a button that would be refused.
 */
export type CommunityRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
export const ROLE_RANK: Record<CommunityRole, number> = { OWNER: 3, ADMIN: 2, MODERATOR: 1, MEMBER: 0 };
export const ROLE_LABEL: Record<CommunityRole, string> = { OWNER: 'Owner', ADMIN: 'Admin', MODERATOR: 'Moderator', MEMBER: 'Member' };

export type Permission = 'post' | 'pin' | 'invite' | 'removeMember' | 'promote' | 'editInfo' | 'manageChannels' | 'deleteCommunity';

const MATRIX: Record<CommunityRole, readonly Permission[]> = {
  OWNER: ['post', 'pin', 'invite', 'removeMember', 'promote', 'editInfo', 'manageChannels', 'deleteCommunity'],
  ADMIN: ['post', 'pin', 'invite', 'removeMember', 'promote', 'editInfo', 'manageChannels'],
  MODERATOR: ['post', 'pin', 'invite', 'removeMember'],
  MEMBER: ['post'],
};

export function roleOf(address: string, c: { ownerAddress?: string | null; members?: { walletAddress?: string; role?: string }[] }): CommunityRole | null {
  const a = (address || '').toLowerCase();
  if (!a) return null;
  if ((c.ownerAddress || '').toLowerCase() === a) return 'OWNER';
  const m = (c.members || []).find((x) => (x.walletAddress || '').toLowerCase() === a);
  if (!m) return null;
  return m.role === 'ADMIN' || m.role === 'MODERATOR' ? m.role : 'MEMBER';
}

export const can = (role: CommunityRole | null, p: Permission) => !!role && MATRIX[role].includes(p);

/** Acting on another member: only on someone of a lower rank, never on the owner. */
export function canActOn(actor: CommunityRole | null, target: CommunityRole | null, p: 'removeMember' | 'promote'): boolean {
  if (!actor || !target || target === 'OWNER') return false;
  return can(actor, p) && ROLE_RANK[actor] > ROLE_RANK[target];
}

/** Roles an actor may give: strictly below their own (the owner may make admins). */
export function assignableRoles(actor: CommunityRole | null): CommunityRole[] {
  if (!can(actor, 'promote')) return [];
  return (['ADMIN', 'MODERATOR', 'MEMBER'] as CommunityRole[]).filter((r) => ROLE_RANK[r] < ROLE_RANK[actor!]);
}
