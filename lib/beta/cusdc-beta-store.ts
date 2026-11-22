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
   * unrevoked, unexpired invite with this hash for `wallet` and create the member with the notice
   * confirmation. Returns 'full', 'bad' (no such usable code) or the new member.
   */
  redeem(input: { wallet: string; codeHash: string; capacity: number; noticeVersion: string; at: Date }): Promise<'full' | 'bad' | BetaMemberRow>;
  confirmNotice(wallet: string, noticeVersion: string, at: Date): Promise<BetaMemberRow>;
}

export const BAD_CODE = 'This invitation code does not work. Check it, or ask for a new one.';

export type RedeemAnswer =
  | { status: 200; body: { member: true } }
  | { status: 400 | 403 | 409 | 503; body: { error: string } };

export function memberState(row: BetaMemberRow | null): MemberState | null {
  return row ? { active: !row.revokedAt, noticeVersion: row.noticeAckAt ? row.noticeVersion : null } : null;
}

export async function redeemBetaInvite(
  store: BetaStore,
  input: { wallet: string; code: unknown; notice: unknown; noticeVersion: unknown; pepper: string; capacity: number; open: boolean; now: Date },
): Promise<RedeemAnswer> {
  if (!input.open) return { status: 503, body: { error: 'The cUSDC beta is not open.' } };
  if (input.pepper.length < 32) return { status: 503, body: { error: 'The cUSDC beta is not open.' } };
  if (input.notice !== true || input.noticeVersion !== BETA_NOTICE_VERSION) {
    return { status: 400, body: { error: 'Read and confirm the current beta notice.' } };
  }
  const code = normalizeInviteCode(typeof input.code === 'string' ? input.code.slice(0, 40) : '');
  if (!code) return { status: 400, body: { error: BAD_CODE } };
  const existing = await store.findMember(input.wallet);
  if (existing) {
    return existing.revokedAt
      ? { status: 403, body: { error: 'This account’s cUSDC beta access was revoked.' } }
      : { status: 200, body: { member: true } };
  }
  const result = await store.redeem({
    wallet: input.wallet,
    codeHash: hashInviteCode(code, input.pepper),
    capacity: input.capacity,
    noticeVersion: BETA_NOTICE_VERSION,
    at: input.now,
  });
  if (result === 'full') return { status: 409, body: { error: 'The cUSDC beta is full.' } };
  if (result === 'bad') return { status: 400, body: { error: BAD_CODE } };
  return { status: 200, body: { member: true } };
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
