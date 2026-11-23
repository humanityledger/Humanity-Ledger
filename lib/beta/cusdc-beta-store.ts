/**
 * lib/beta/cusdc-beta-store.ts: redeeming a cUSDC beta invitation and confirming the notice,
 * written against a small store interface so the rules are tested without a database. The Prisma
 * implementation is in prismaBetaStore (app/api/beta/cusdc/*).
 *
 * Codes reuse the closed alpha format and hashing (lib/alpha/invites.ts): 16 Crockford base32
 * characters, only HMAC-SHA256(ALPHA_INVITE_PEPPER, code) is stored. One answer for every bad code
 * (unknown, used, revoked, expired), so the endpoint does not tell which codes exist. Nothing about
 * the request (IP, user agent) is stored.
 */
import { hashInviteCode, normalizeInviteCode } from '@/lib/alpha/invites';
import { BETA_NOTICE_VERSION, type MemberState } from './cusdc-beta';

export interface BetaMemberRow {
  walletAddress: string;
  revokedAt: Date | null;
  noticeVersion: string | null;
  noticeAckAt: Date | null;
}

export interface BetaStore {
  findMember(wallet: string): Promise<BetaMemberRow | null>;
  /**
   * In one transaction, under a lock: if fewer than `capacity` members exist, claim the unused,
   * unrevoked, unexpired invite with this hash whose operator checks are recorded (sanctions clear,
   * 18 or older: scripts/beta/cusdc-invites.mjs assign) for `wallet` and create the member with the
   * notice confirmation. Returns 'full', 'inactive' (a usable code whose checks are not recorded
   * yet), 'bad' (no such usable code) or the new member.
   */
  redeem(input: { wallet: string; codeHash: string; capacity: number; noticeVersion: string; at: Date }): Promise<'full' | 'inactive' | 'bad' | BetaMemberRow>;
  /**
   * The same as redeem, for the invitation the operator reserved for `wallet` when approving its
   * request from /beta (reservedFor): no code is typed. 'bad' when nothing is reserved for it.
   */
  redeemReserved(input: { wallet: string; capacity: number; noticeVersion: string; at: Date }): Promise<'full' | 'inactive' | 'bad' | BetaMemberRow>;
  /** Members ever admitted, revoked ones included: the same count the capacity check uses. */
  countMembers(): Promise<number>;
  confirmNotice(wallet: string, noticeVersion: string, at: Date): Promise<BetaMemberRow>;
}

export const BAD_CODE = 'This invitation code does not work. Check it, or ask for a new one.';
export const NOT_ACTIVE = 'This invitation is not active yet. Ask the person who invited you to activate it, then try again.';
export const BETA_FULL = 'The cUSDC beta is full: all 100 places are taken.';
export const NOTHING_RESERVED = 'No place is reserved for this wallet yet. Request one, or enter an invitation code.';

export type RedeemAnswer =
  | { status: 200; body: { member: true } }
  | { status: 400 | 403 | 409 | 503; body: { error: string } };

export function memberState(row: BetaMemberRow | null): MemberState | null {
  return row ? { active: !row.revokedAt, noticeVersion: row.noticeAckAt ? row.noticeVersion : null } : null;
}

export async function redeemBetaInvite(
  store: BetaStore,
  input: { wallet: string; code: unknown; notice: unknown; noticeVersion: unknown; pepper: string; capacity: number; open: boolean; now: Date; reserved?: boolean },
): Promise<RedeemAnswer> {
  if (!input.open) return { status: 503, body: { error: 'The cUSDC beta is not open.' } };
  if (input.pepper.length < 32) return { status: 503, body: { error: 'The cUSDC beta is not open.' } };
  if (input.notice !== true || input.noticeVersion !== BETA_NOTICE_VERSION) {
    return { status: 400, body: { error: 'Read and confirm the current beta notice.' } };
  }
  // A reserved invitation (an approved request) needs no code; anything else needs a valid one.
  const code = input.reserved === true ? '' : normalizeInviteCode(typeof input.code === 'string' ? input.code.slice(0, 40) : '');
  if (input.reserved !== true && !code) return { status: 400, body: { error: BAD_CODE } };
  const existing = await store.findMember(input.wallet);
  if (existing) {
    return existing.revokedAt
      ? { status: 403, body: { error: 'This account’s cUSDC beta access was revoked.' } }
      : { status: 200, body: { member: true } };
  }
  const result =
    input.reserved === true
      ? await store.redeemReserved({ wallet: input.wallet, capacity: input.capacity, noticeVersion: BETA_NOTICE_VERSION, at: input.now })
      : await store.redeem({
          wallet: input.wallet,
          codeHash: hashInviteCode(code as string, input.pepper),
          capacity: input.capacity,
          noticeVersion: BETA_NOTICE_VERSION,
          at: input.now,
        });
  if (result === 'full') return { status: 409, body: { error: BETA_FULL } };
  if (result === 'inactive') return { status: 403, body: { error: NOT_ACTIVE } };
  if (result === 'bad') return { status: 400, body: { error: input.reserved === true ? NOTHING_RESERVED : BAD_CODE } };
  return { status: 200, body: { member: true } };
}

/**
 * Whether a DM peer can receive cUSDC: an active member (not revoked). Only an active member may
 * ask, so the endpoint cannot be used by others to list who is in the beta. A non-member's cUSDC
 * notes are not lost, but they cannot see them until they join, so the payment form stops first.
 */
export function recipientAnswer(
  caller: BetaMemberRow | null,
  target: BetaMemberRow | null,
): { status: 200; body: { member: boolean } } | { status: 403; body: { error: string } } {
  if (!caller || caller.revokedAt) return { status: 403, body: { error: 'Only members of the cUSDC beta can check this.' } };
  return { status: 200, body: { member: !!target && !target.revokedAt } };
}

/** Places left, never below zero; null when the count is not available. */
export function remainingPlaces(capacity: number, members: number | null): number | null {
  return members === null ? null : Math.max(0, capacity - members);
}

export async function confirmBetaNotice(
  store: BetaStore,
  input: { wallet: string; notice: unknown; noticeVersion: unknown; now: Date },
): Promise<{ status: 200 | 400 | 403; body: Record<string, unknown> }> {
  if (input.notice !== true || input.noticeVersion !== BETA_NOTICE_VERSION) {
    return { status: 400, body: { error: 'Read and confirm the current beta notice.' } };
  }
  const m = await store.findMember(input.wallet);
  if (!m || m.revokedAt) return { status: 403, body: { error: 'This account has no cUSDC beta invitation.' } };
  const row = await store.confirmNotice(input.wallet, BETA_NOTICE_VERSION, input.now);
  return { status: 200, body: { member: true, active: true, noticeVersion: row.noticeVersion } };
}
