/** Redeeming a cUSDC beta invitation and confirming the notice, against an in-memory store. */
import fs from 'node:fs';
import { hashInviteCode } from '@/lib/alpha/invites';
import { BETA_NOTICE_VERSION } from '@/lib/beta/cusdc-beta';
import { BAD_CODE, confirmBetaNotice, memberState, redeemBetaInvite, type BetaMemberRow, type BetaStore } from '@/lib/beta/cusdc-beta-store';

const PEPPER = 'p'.repeat(40);
const CODE = '0123-4567-89AB-CDEF';
const W = '0x' + '1'.repeat(40);
const now = new Date('2026-12-01T00:00:00Z');

function memoryStore(codes: string[], existing: BetaMemberRow[] = []) {
  const invites = new Map(codes.map((c) => [hashInviteCode(c.replace(/-/g, ''), PEPPER), { redeemedBy: null as string | null, revoked: false }]));
  const members = new Map(existing.map((m) => [m.walletAddress, m]));
  const store: BetaStore = {
    async findMember(w) { return members.get(w) ?? null; },
    async redeem({ wallet, codeHash, capacity, noticeVersion, at }) {
      if (members.size >= capacity) return 'full';
      const inv = invites.get(codeHash);
      if (!inv || inv.redeemedBy || inv.revoked) return 'bad';
      inv.redeemedBy = wallet;
      const row = { walletAddress: wallet, revokedAt: null, noticeVersion, noticeAckAt: at };
      members.set(wallet, row);
      return row;
    },
    async confirmNotice(w, v, at) { const m = { ...members.get(w)!, noticeVersion: v, noticeAckAt: at }; members.set(w, m); return m; },
  };
  return { store, members, invites };
}

const base = { wallet: W, code: CODE, notice: true, noticeVersion: BETA_NOTICE_VERSION, pepper: PEPPER, capacity: 100, open: true, now };

describe('redeem', () => {
  it('joins with a valid code and the confirmed notice', async () => {
    const { store, members } = memoryStore([CODE]);
    expect(await redeemBetaInvite(store, base)).toEqual({ status: 200, body: { member: true } });
    expect(memberState(members.get(W)!)).toEqual({ active: true, noticeVersion: BETA_NOTICE_VERSION });
  });
  it('accepts the code typed with look-alikes and without separators', async () => {
    const { store } = memoryStore([CODE]);
    expect((await redeemBetaInvite(store, { ...base, code: 'o123 4567 89ab cdef' })).status).toBe(200);
  });
  it('is closed while the switch is off or the pepper is missing', async () => {
    const { store } = memoryStore([CODE]);
    expect((await redeemBetaInvite(store, { ...base, open: false })).status).toBe(503);
    expect((await redeemBetaInvite(store, { ...base, pepper: 'short' })).status).toBe(503);
  });
  it('needs the current notice confirmed', async () => {
    const { store } = memoryStore([CODE]);
    expect((await redeemBetaInvite(store, { ...base, notice: false })).status).toBe(400);
    expect((await redeemBetaInvite(store, { ...base, noticeVersion: 'old' })).status).toBe(400);
  });
  it('one answer for every bad code, and a code works once', async () => {
    const { store } = memoryStore([CODE]);
    expect(await redeemBetaInvite(store, { ...base, code: 'nope' })).toEqual({ status: 400, body: { error: BAD_CODE } });
    expect(await redeemBetaInvite(store, { ...base, code: 'ZZZZ-ZZZZ-ZZZZ-ZZZZ' })).toEqual({ status: 400, body: { error: BAD_CODE } });
    expect((await redeemBetaInvite(store, base)).status).toBe(200);
    expect(await redeemBetaInvite(store, { ...base, wallet: '0x' + '2'.repeat(40) })).toEqual({ status: 400, body: { error: BAD_CODE } });
  });
  it('refuses past the member limit', async () => {
    const { store } = memoryStore([CODE], [{ walletAddress: '0x' + '9'.repeat(40), revokedAt: null, noticeVersion: null, noticeAckAt: null }]);
    expect((await redeemBetaInvite(store, { ...base, capacity: 1 })).status).toBe(409);
  });
  it('a revoked member cannot rejoin; an existing member gets the same answer', async () => {
    const revoked = memoryStore([CODE], [{ walletAddress: W, revokedAt: now, noticeVersion: null, noticeAckAt: null }]);
    expect((await redeemBetaInvite(revoked.store, base)).status).toBe(403);
    const joined = memoryStore([], [{ walletAddress: W, revokedAt: null, noticeVersion: BETA_NOTICE_VERSION, noticeAckAt: now }]);
    expect(await redeemBetaInvite(joined.store, base)).toEqual({ status: 200, body: { member: true } });
  });
});

describe('notice', () => {
  it('records the current version for members only', async () => {
    const { store, members } = memoryStore([], [{ walletAddress: W, revokedAt: null, noticeVersion: 'old', noticeAckAt: now }]);
    expect((await confirmBetaNotice(store, { wallet: W, notice: true, noticeVersion: BETA_NOTICE_VERSION, now })).status).toBe(200);
    expect(members.get(W)!.noticeVersion).toBe(BETA_NOTICE_VERSION);
    expect((await confirmBetaNotice(store, { wallet: '0x' + '3'.repeat(40), notice: true, noticeVersion: BETA_NOTICE_VERSION, now })).status).toBe(403);
    expect((await confirmBetaNotice(store, { wallet: W, notice: true, noticeVersion: 'x', now })).status).toBe(400);
  });
  it('a member who never confirmed has no notice version', () => {
    expect(memberState({ walletAddress: W, revokedAt: null, noticeVersion: BETA_NOTICE_VERSION, noticeAckAt: null })).toEqual({ active: true, noticeVersion: null });
    expect(memberState(null)).toBeNull();
  });
});

describe('wiring', () => {
  it('the routes need a signed session, rate limit redemption and use the store', () => {
    const redeem = fs.readFileSync('app/api/beta/cusdc/redeem/route.ts', 'utf8');
    expect(redeem).toMatch(/getVerifiedCaller/);
    expect(redeem).toMatch(/checkRateLimit/);
    expect(redeem).toMatch(/redeemBetaInvite\(prismaBetaStore/);
    const status = fs.readFileSync('app/api/beta/cusdc/status/route.ts', 'utf8');
    expect(status).toMatch(/getVerifiedCaller/);
    expect(status).toMatch(/cusdcBetaVisibility/);
  });
  it('redemptions run under a lock and the migration is additive', () => {
    expect(fs.readFileSync('lib/beta/cusdc-beta-prisma.ts', 'utf8')).toMatch(/pg_advisory_xact_lock/);
    const sql = fs.readFileSync('prisma/migrations/20261122150000_cusdc_beta/migration.sql', 'utf8');
    expect(sql).not.toMatch(/\b(DROP|ALTER)\b/);
    expect(sql).toMatch(/CREATE TABLE "CusdcBetaInvite"/);
    expect(sql).toMatch(/CREATE TABLE "CusdcBetaMember"/);
  });
  it('the operator script applies the same sanctions and age checks as the alpha', () => {
    const s = fs.readFileSync('scripts/beta/cusdc-invites.mjs', 'utf8');
    expect(s).toMatch(/inviteChecksProblem/);
    expect(s).toMatch(/ALPHA_ADMINS/);
  });
});
