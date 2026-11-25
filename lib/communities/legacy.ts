/**
 * lib/communities/legacy.ts — communities whose posts our server stores and can read (decision of
 * 25 November 2026, docs/communities/LEGACY_READ_ONLY.md).
 *
 * Since 24 November 2026 a new community starts on MLS: its posts live in an XMTP group and our
 * server never receives them (lib/communities/mls.ts). Every community made before that keeps its
 * posts in PostgreSQL, readable by the server. Those communities are now read-only:
 *
 *   - Old posts stay readable by members, as before. Nothing is deleted or moved.
 *   - Our server accepts no new post for them, and writes no new system notice ("X joined").
 *   - An owner or admin can re-create the community on MLS. The old one then points to the new one
 *     (`successorId`), and each member decides whether to join it. Nobody is added for them.
 *
 * No data is migrated without the member seeing it: posts the server could read are never
 * "encrypted afterwards", and they are not copied into the new community.
 *
 * Operator switches (environment, read on the server only):
 *   COMMUNITY_LEGACY_READONLY=off  reopens posting on legacy communities (rollback).
 *   COMMUNITY_MLS_NEW=off          new communities are created without MLS again; legacy communities
 *                                  are then writable too, since otherwise nobody could post anywhere.
 */

export const LEGACY_CUTOFF_ISO = '2026-11-24';

export interface LegacyLike {
  communityMls?: boolean | null;
  successorId?: string | null;
}

type Env = Record<string, string | undefined>;

// Read by name, so scripts/env-inventory.mjs lists both switches in .env.example.
const env = (): Env =>
  typeof process !== 'undefined' && process.env
    ? { COMMUNITY_LEGACY_READONLY: process.env.COMMUNITY_LEGACY_READONLY, COMMUNITY_MLS_NEW: process.env.COMMUNITY_MLS_NEW }
    : {};

/** True while the read-only rule is in force (the default). */
export function legacyReadOnlyOn(e: Env = env()): boolean {
  return e.COMMUNITY_LEGACY_READONLY !== 'off' && e.COMMUNITY_MLS_NEW !== 'off';
}

/** A community whose posts our server stores: every one not on MLS. */
export function isLegacyCommunity(c: LegacyLike | null | undefined): boolean {
  return !!c && c.communityMls !== true;
}

/** True when our server must refuse new posts and system notices for this community. */
export function legacyPostsClosed(c: LegacyLike | null | undefined, e: Env = env()): boolean {
  return isLegacyCommunity(c) && legacyReadOnlyOn(e);
}

/** True when a new community may be created without an MLS group. */
export function serverStoredCreationAllowed(e: Env = env()): boolean {
  return !legacyReadOnlyOn(e);
}

export const LEGACY_READ_ONLY_CODE = 'COMMUNITY_LEGACY_READ_ONLY';

/** The answer every post route gives for a legacy community. Nothing is written. */
export function legacyReadOnlyBody(c: LegacyLike) {
  return {
    error:
      'This community was made before posts were end-to-end encrypted. Our server no longer accepts new posts for it. Old posts stay readable.',
    code: LEGACY_READ_ONLY_CODE,
    successorId: c.successorId ?? null,
  };
}

export interface RecreateCheck {
  ok: boolean;
  status?: number;
  error?: string;
  code?: string;
}

/**
 * Who may re-create a community on MLS, and when. Pure, so the server route and the tests share it.
 * `old` is the legacy community as stored; `callerIsAdmin` is owner or ADMIN membership.
 */
export function canRecreate(old: (LegacyLike & { id?: string }) | null | undefined, callerIsAdmin: boolean): RecreateCheck {
  if (!old) return { ok: false, status: 404, error: 'Community not found', code: 'NOT_FOUND' };
  if (!callerIsAdmin) return { ok: false, status: 403, error: 'Only an owner or admin can re-create this community.', code: 'NOT_ADMIN' };
  if (!isLegacyCommunity(old)) return { ok: false, status: 409, error: 'This community is already end-to-end encrypted.', code: 'ALREADY_MLS' };
  if (old.successorId) return { ok: false, status: 409, error: 'This community was already re-created.', code: 'ALREADY_RECREATED' };
  return { ok: true };
}

/** Whether a caller may join the successor of a legacy community through it (no invite code needed). */
export function canFollowSuccessor(old: LegacyLike | null | undefined, callerIsMember: boolean): RecreateCheck {
  if (!old) return { ok: false, status: 404, error: 'Community not found', code: 'NOT_FOUND' };
  if (!callerIsMember) return { ok: false, status: 404, error: 'Community not found', code: 'NOT_FOUND' };
  if (!old.successorId) return { ok: false, status: 404, error: 'This community has not been re-created.', code: 'NO_SUCCESSOR' };
  return { ok: true };
}
