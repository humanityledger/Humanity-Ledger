/**
 * lib/community-apps/access.ts
 *
 * Who may do what with a community's apps. Identity always comes from
 * requireWallet(); this file only decides what that identity is allowed.
 *
 *   view a published app     members; anyone signed in if the community is public
 *   write app data           members only (joining is a separate, explicit act)
 *   create, revise a draft   members; a draft is visible to its creator only
 *   publish                  the creator
 *   remove                   the creator, the owner, admins and moderators
 */

import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';

export const MAX_PUBLISHED_APPS = 40;
export const MAX_DRAFTS_PER_MEMBER = 12;

export interface CommunityAccess {
  community: { id: string; name: string; isPrivate: boolean; ownerAddress: string };
  caller: string;
  isMember: boolean;
  isAdmin: boolean;
  canView: boolean;
}

export async function resolveCommunityAccess(communityId: string, callerAddress: string): Promise<CommunityAccess | null> {
  const caller = callerAddress.toLowerCase();
  const community = await (prisma as any).community.findUnique({
    where: { id: communityId },
    select: { id: true, name: true, isPrivate: true, ownerAddress: true },
  });
  if (!community) return null;

  const isOwner = community.ownerAddress?.toLowerCase() === caller;
  const membership = await (prisma as any).communityMember.findFirst({
    where: { communityId, walletAddress: caller },
    select: { role: true },
  });
  const isMember = isOwner || !!membership;
  const isAdmin = isOwner || membership?.role === 'ADMIN' || membership?.role === 'MODERATOR';
  return {
    community,
    caller,
    isMember,
    isAdmin,
    canView: isMember || !community.isPrivate,
  };
}

/**
 * The identity an app sees for a member. `id` is a key that is stable inside
 * one community and different across communities. `label` is the shortened
 * address the member list already shows, so an app learns nothing about a
 * member that the community's own member list does not show.
 */
export function memberIdentity(communityId: string, address: string): { id: string; label: string } {
  const a = address.toLowerCase();
  const id = createHash('sha256').update(`hl/community-app/${communityId}/${a}`).digest('hex').slice(0, 12);
  return { id, label: `${a.slice(0, 6)}…${a.slice(-4)}` };
}

export function appVisibleTo(app: { status: string; creatorAddress: string }, access: CommunityAccess): boolean {
  if (app.status === 'published') return access.canView;
  return app.creatorAddress.toLowerCase() === access.caller;
}

export function appSummary(app: any, access: CommunityAccess) {
  const mine = app.creatorAddress?.toLowerCase() === access.caller;
  return {
    id: app.id,
    title: app.title,
    summary: app.summary,
    status: app.status,
    version: app.version,
    source: app.source,
    templateId: app.templateId,
    creator: memberIdentity(access.community.id, app.creatorAddress),
    mine,
    canRemove: mine || access.isAdmin,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  };
}
