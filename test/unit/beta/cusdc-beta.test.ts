/** The closed cUSDC beta: a separate, fail-closed path that never touches CUSDC_GATES. */
import fs from 'node:fs';
import {
  BETA_NOTICE, BETA_NOTICE_VERSION, BETA_REASONS, MAX_BETA_TESTERS, betaCapacity, cusdcBetaDecision, cusdcBetaEntry, cusdcBetaProgram,
  cusdcBetaVisibility, cusdcCap, recordedCusdc,
} from '@/lib/beta/cusdc-beta';
import { CUSDC_GATES, cusdcReady } from '@/lib/payments/assets';
import { BANNED } from '@/lib/landing/claims';

const ADDR = '0x30112e52178143b74cf6037d047bbba924f4b0db8aab587a340aacfc6ecb4f38';
const now = new Date('2026-12-01T00:00:00Z');
const open = {
  entry: { enabled: true, until: '2027-02-01T00:00:00Z', maxTesters: 100 },
  cusdc: { symbol: 'cUSDC', address: ADDR, decimals: 6, verifiedOnChain: true },
  cap: 5_000_000n,
  now,
};
const member = { active: true, noticeVersion: BETA_NOTICE_VERSION };

describe('program', () => {
  it('opens only with the switch, an end date, the on-chain confirmation and a cap', () => {
    expect(cusdcBetaProgram(open)).toEqual({ ok: true });
    expect(cusdcBetaProgram({ ...open, entry: { ...open.entry, enabled: false } })).toEqual({ ok: false, reasons: [BETA_REASONS.off] });
    expect(cusdcBetaProgram({ ...open, entry: null })).toEqual({ ok: false, reasons: [BETA_REASONS.off] });
    expect(cusdcBetaProgram({ ...open, entry: { ...open.entry, until: null } })).toMatchObject({ ok: false, reasons: [BETA_REASONS.noEnd] });
    expect(cusdcBetaProgram({ ...open, now: new Date('2027-02-01T00:00:00Z') })).toMatchObject({ ok: false, reasons: [BETA_REASONS.ended] });
    expect(cusdcBetaProgram({ ...open, cusdc: { ...open.cusdc, verifiedOnChain: false } })).toMatchObject({ ok: false, reasons: [BETA_REASONS.notVerified] });
    expect(cusdcBetaProgram({ ...open, cusdc: null })).toMatchObject({ ok: false, reasons: [BETA_REASONS.notVerified] });
    expect(cusdcBetaProgram({ ...open, cusdc: { ...open.cusdc, address: '0x1234' } })).toMatchObject({ ok: false, reasons: [BETA_REASONS.notVerified] });
    expect(cusdcBetaProgram({ ...open, cap: null })).toMatchObject({ ok: false, reasons: [BETA_REASONS.noCap] });
    expect(cusdcBetaProgram({ ...open, cap: 0n })).toMatchObject({ ok: false, reasons: [BETA_REASONS.noCap] });
  });
});

describe('member decision and visibility', () => {
  it('sends only for an active member who confirmed the current notice', () => {
    expect(cusdcBetaDecision({ ...open, member })).toEqual({ ok: true });
    expect(cusdcBetaVisibility({ ...open, member })).toBe('send');
  });
  it('refuses non-members and hides cUSDC from them', () => {
    expect(cusdcBetaDecision({ ...open, member: null })).toEqual({ ok: false, reasons: [BETA_REASONS.member] });
    expect(cusdcBetaVisibility({ ...open, member: null })).toBe('hidden');
  });
  it('a revoked member, an old notice or a paused beta keeps exits only', () => {
    expect(cusdcBetaDecision({ ...open, member: { ...member, active: false } })).toEqual({ ok: false, reasons: [BETA_REASONS.revoked] });
    expect(cusdcBetaVisibility({ ...open, member: { ...member, active: false } })).toBe('exits');
    expect(cusdcBetaDecision({ ...open, member: { ...member, noticeVersion: 'old' } })).toEqual({ ok: false, reasons: [BETA_REASONS.notice] });
    expect(cusdcBetaVisibility({ ...open, member: { ...member, noticeVersion: null } })).toBe('exits');
    expect(cusdcBetaVisibility({ ...open, entry: { ...open.entry, enabled: false }, member })).toBe('exits');
    expect(cusdcBetaVisibility({ ...open, cap: null, member })).toBe('exits');
  });
  it('never lists a contract that was not confirmed on the network, even for members', () => {
    expect(cusdcBetaVisibility({ ...open, cusdc: { ...open.cusdc, verifiedOnChain: false }, member })).toBe('hidden');
  });
});

describe('capacity, cap and record', () => {
  it('at most 100 members; the record may lower it, never raise it', () => {
    expect(MAX_BETA_TESTERS).toBe(100);
    expect(betaCapacity({ enabled: true, until: null, maxTesters: 40 })).toBe(40);
    expect(betaCapacity({ enabled: true, until: null, maxTesters: 500 })).toBe(100);
    expect(betaCapacity({ enabled: true, until: null, maxTesters: -1 })).toBe(100);
    expect(betaCapacity(null)).toBe(100);
  });
  it('reads the cap of the cUSDC address only', () => {
    expect(cusdcCap({ [ADDR]: 7n }, open.cusdc)).toBe(7n);
    expect(cusdcCap({ ['0x' + 'ab'.repeat(32)]: 7n }, open.cusdc)).toBeNull();
    expect(cusdcCap(null, open.cusdc)).toBeNull();
  });
  it('the switch ships on, with a limit of 100 and an end date', () => {
    const m = JSON.parse(fs.readFileSync('deployments/aztec-mainnet.json', 'utf8'));
    expect(m.cusdcBeta).toEqual({ enabled: true, until: '2027-02-23T23:59:59Z', maxTesters: 100 });
    expect(cusdcBetaEntry(m)).toEqual({ enabled: true, until: '2027-02-23T23:59:59Z', maxTesters: 100 });
    expect(recordedCusdc(m)?.address).toBe(ADDR);
    // The program is open now (but still needs a cap to pass fully)
    expect(cusdcBetaProgram({ entry: cusdcBetaEntry(m), cusdc: recordedCusdc(m), cap: 1n, now }).ok).toBe(true);
  });
});

describe('the gates are untouched', () => {
  it('every CUSDC gate is still unmet and the public wallet still hides cUSDC', () => {
    expect(CUSDC_GATES).toHaveLength(9);
    expect(CUSDC_GATES.every((g) => g.met === false)).toBe(true);
    expect(cusdcReady()).toBe(false);
  });
  it('the beta code never reads or changes the gates', () => {
    for (const f of ['lib/beta/cusdc-beta.ts', 'lib/beta/cusdc-beta-store.ts', 'lib/beta/cusdc-beta-prisma.ts']) {
      expect(fs.readFileSync(f, 'utf8')).not.toMatch(/met:\s*true|CUSDC_GATES\s*=/);
    }
  });
});

describe('the beta notice', () => {
  it('states the facts of the test without banned words', () => {
    const text = BETA_NOTICE.join(' ');
    for (const re of BANNED) expect(text, String(re)).not.toMatch(re);
    expect(text).toMatch(/at most 100/);
    expect(text).toMatch(/cannot be reversed/);
    expect(text).toMatch(/no external audit/);
    expect(text).toMatch(/fee is public/);
  });
});
