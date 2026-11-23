/**
 * Requests for a place from /beta (lib/beta/cusdc-beta-request.ts) and joining with an invitation
 * reserved for the wallet (redeemBetaInvite with reserved: true).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { requestPlace, requestState, type RequestRow, type RequestStore } from '@/lib/beta/cusdc-beta-request';
import { NOTHING_RESERVED, redeemBetaInvite, type BetaStore } from '@/lib/beta/cusdc-beta-store';
import type { BetaMemberRow } from '@/lib/beta/cusdc-beta-store';
import { BETA_NOTICE_VERSION } from '@/lib/beta/cusdc-beta';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../../..', p), 'utf8');
const W = '0x' + 'ab'.repeat(20);
const now = new Date('2026-11-23T15:00:00Z');

function requests(): RequestStore & { rows: Map<string, RequestRow> } {
  const rows = new Map<string, RequestRow>();
  return {
    rows,
    async find(w) { return rows.get(w) ?? null; },
    async create(w, at) { const r = rows.get(w) ?? { walletAddress: w, requestedAt: at, approvedAt: null, declinedAt: null }; rows.set(w, r); return r; },
  };
}

describe('requestPlace', () => {
  it('records one request per wallet and keeps the first date', async () => {
    const s = requests();
    expect(await requestPlace(s, { wallet: W, open: true, remaining: 10, isMember: false, now })).toEqual({ status: 200, body: { request: 'pending', requestedAt: now.toISOString() } });
    const later = new Date(now.getTime() + 60_000);
    expect((await requestPlace(s, { wallet: W, open: true, remaining: 10, isMember: false, now: later })).body).toMatchObject({ requestedAt: now.toISOString() });
    expect(s.rows.size).toBe(1);
  });

  it('refuses while the beta is off, when full, and for members', async () => {
    const s = requests();
    expect((await requestPlace(s, { wallet: W, open: false, remaining: 10, isMember: false, now })).status).toBe(503);
    expect((await requestPlace(s, { wallet: W, open: true, remaining: 0, isMember: false, now })).status).toBe(409);
    expect((await requestPlace(s, { wallet: W, open: true, remaining: 10, isMember: true, now })).status).toBe(409);
    expect(s.rows.size).toBe(0);
  });

  it('reports the state of a request', () => {
    const base = { walletAddress: W, requestedAt: now, approvedAt: null, declinedAt: null };
    expect(requestState(null)).toBe('none');
    expect(requestState(base)).toBe('pending');
    expect(requestState({ ...base, approvedAt: now })).toBe('approved');
    expect(requestState({ ...base, declinedAt: now })).toBe('declined');
  });
});

describe('joining with a reserved invitation', () => {
  function store(reserved: Set<string>): BetaStore & { members: Map<string, BetaMemberRow> } {
    const members = new Map<string, BetaMemberRow>();
    return {
      members,
      async findMember(w) { return members.get(w) ?? null; },
      async redeem() { return 'bad'; },
      async redeemReserved({ wallet, capacity, noticeVersion, at }) {
        if (members.size >= capacity) return 'full';
        if (!reserved.delete(wallet)) return 'bad';
        const row = { walletAddress: wallet, revokedAt: null, noticeVersion, noticeAckAt: at };
        members.set(wallet, row);
        return row;
      },
      async countMembers() { return members.size; },
      async confirmNotice(w) { return members.get(w)!; },
    };
  }
  const input = { wallet: W, code: undefined, notice: true, noticeVersion: BETA_NOTICE_VERSION, pepper: 'p'.repeat(32), capacity: 100, open: true, now, reserved: true };

  it('joins without a code when an invitation is reserved for the wallet, once', async () => {
    const s = store(new Set([W]));
    expect(await redeemBetaInvite(s, input)).toEqual({ status: 200, body: { member: true } });
    expect(s.members.has(W)).toBe(true);
  });

  it('says nothing is reserved otherwise, and still needs the notice and a free place', async () => {
    expect(await redeemBetaInvite(store(new Set()), input)).toEqual({ status: 400, body: { error: NOTHING_RESERVED } });
    expect((await redeemBetaInvite(store(new Set([W])), { ...input, notice: false })).status).toBe(400);
    expect((await redeemBetaInvite(store(new Set([W])), { ...input, capacity: 0 })).status).toBe(409);
  });

  it('without reserved, a missing code is still refused', async () => {
    expect((await redeemBetaInvite(store(new Set([W])), { ...input, reserved: false })).status).toBe(400);
  });
});

describe('wiring', () => {
  it('the request route is signed, JSON only and rate limited', () => {
    const src = read('app/api/beta/cusdc/request/route.ts');
    expect(src).toMatch(/getVerifiedCaller/);
    expect(src).toMatch(/status: 415/);
    expect(src).toMatch(/rl:cusdc-beta-request/);
  });

  it('the migration only adds, and stores no personal data beyond the wallet', () => {
    const sql = read('prisma/migrations/20261123160000_cusdc_beta_requests/migration.sql');
    expect(sql).not.toMatch(/DROP|DELETE|UPDATE /);
    expect(sql).toMatch(/ADD COLUMN "reservedFor" TEXT/);
    expect(sql).not.toMatch(/email|handle|name"/i);
  });

  it('a reserved invitation still needs the operator checks and the member limit, under the lock', () => {
    const src = read('lib/beta/cusdc-beta-prisma.ts');
    const reserved = src.slice(src.indexOf('redeemReserved:'));
    expect(reserved).toMatch(/pg_advisory_xact_lock/);
    expect(reserved).toMatch(/>= capacity/);
    expect(reserved).toMatch(/sanctionsResult: 'clear', adultCheckedAt: \{ not: null \}/);
  });

  it('/beta offers a request without a code, and joins with a reserved place', () => {
    const view = read('components/beta/BetaGateView.tsx');
    expect(view).toMatch(/Request a place/);
    expect(view).toMatch(/\/api\/beta\/cusdc\/request/);
    expect(view).toMatch(/reserved: true, notice: true/);
  });
});
