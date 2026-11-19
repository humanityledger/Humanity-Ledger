import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { CLOSED_ALPHA_REASONS as R, closedAlphaDecision } from '@/lib/alpha/gate';
import { AUDIT_REFUSED, deployRefusal } from '@/lib/protocol/agreement-gate';
import { CROCKFORD, hashInviteCode, MAX_TESTERS, newInviteCode, normalizeInviteCode, parseAlphaAdmins, sameHash } from '@/lib/alpha/invites';

const C = '0x' + 'ab'.repeat(32);
const entry = { enabled: true, until: '2027-01-13T00:00:00Z', classes: [C] };
const base = { entry, now: new Date('2026-12-01T00:00:00Z'), classId: C, deployedClasses: [C], member: { active: true, riskAcknowledged: true } };

describe('closed alpha gate: every branch', () => {
  it('opens only when everything holds', () => expect(closedAlphaDecision(base)).toEqual({ ok: true }));
  it('off', () => {
    expect(closedAlphaDecision({ ...base, entry: null })).toEqual({ ok: false, reasons: [R.off] });
    expect(closedAlphaDecision({ ...base, entry: { ...entry, enabled: false } })).toEqual({ ok: false, reasons: [R.off] });
  });
  it('ended, or no end date', () => {
    expect(closedAlphaDecision({ ...base, now: new Date('2027-01-13T00:00:00Z') })).toEqual({ ok: false, reasons: [R.ended] });
    expect(closedAlphaDecision({ ...base, entry: { ...entry, until: null } })).toEqual({ ok: false, reasons: [R.noEnd] });
  });
  it('class not in the alpha, or not deployed', () => {
    const other = '0x' + 'cd'.repeat(32);
    expect(closedAlphaDecision({ ...base, classId: other, deployedClasses: [C, other] })).toEqual({ ok: false, reasons: [R.class] });
    expect(closedAlphaDecision({ ...base, deployedClasses: [] })).toEqual({ ok: false, reasons: [R.notDeployed] });
  });
  it('member, revoked, risk not acknowledged', () => {
    expect(closedAlphaDecision({ ...base, member: null })).toEqual({ ok: false, reasons: [R.member] });
    expect(closedAlphaDecision({ ...base, member: { active: false, riskAcknowledged: true } })).toEqual({ ok: false, reasons: [R.revoked] });
    expect(closedAlphaDecision({ ...base, member: { active: true, riskAcknowledged: false } })).toEqual({ ok: false, reasons: [R.ack] });
  });
});

describe('invitation codes', () => {
  it('16 Crockford characters, 80 bits, grouped by four', () => {
    const c = newInviteCode((n) => new Uint8Array(randomBytes(n)));
    expect(c).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    expect(newInviteCode((n) => new Uint8Array(n).fill(255))).toBe('ZZZZ-ZZZZ-ZZZZ-ZZZZ');
    expect(newInviteCode((n) => new Uint8Array(n))).toBe('0000-0000-0000-0000');
    expect(CROCKFORD).toHaveLength(32);
  });
  it('normalises what people type and refuses the rest', () => {
    expect(normalizeInviteCode('abcd-efgh-jkmn-pqrs')).toBe('ABCDEFGHJKMNPQRS');
    expect(normalizeInviteCode('O0IL 1111 2222 3333')).toBe('0011111122223333');
    expect(normalizeInviteCode('UUUU-UUUU-UUUU-UUUU')).toBeNull();
    expect(normalizeInviteCode('short')).toBeNull();
  });
  it('the server keeps an HMAC with a long pepper, compared in constant time', () => {
    const pepper = 'p'.repeat(32);
    const h = hashInviteCode('ABCDEFGHJKMNPQRS', pepper);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(sameHash(h, hashInviteCode('ABCDEFGHJKMNPQRS', pepper))).toBe(true);
    expect(sameHash(h, hashInviteCode('ABCDEFGHJKMNPQRT', pepper))).toBe(false);
    expect(() => hashInviteCode('X', 'short')).toThrow(/32 characters/);
  });
  it('ALPHA_ADMINS keeps valid addresses only', () => {
    expect([...parseAlphaAdmins(' 0x' + 'A'.repeat(40) + ',bad,0x12 ')]).toEqual(['0x' + 'a'.repeat(40)]);
  });
});

describe('registry', () => {
  it('closedAlpha is recorded off, with the two wave-1 classes, and never as an audit', () => {
    const m = JSON.parse(fs.readFileSync('deployments/aztec-mainnet.json', 'utf8'));
    expect(m.audit).toBeNull();
    expect(m.closedAlpha.enabled).toBe(false);
    expect(m.closedAlpha.until).toBeNull();
    expect(m.closedAlpha.maxTesters).toBe(50);
    expect(m.closedAlpha.maxTesters).toBe(MAX_TESTERS);
    const t = JSON.parse(fs.readFileSync('deployments/aztec-testnet.json', 'utf8'));
    const current = t.contracts.filter((c: any) => c.tracksCurrentArtifact && /^(PrivateEscrow|PaymentStream)/.test(c.name)).map((c: any) => c.classId);
    expect([...m.closedAlpha.classes].sort()).toEqual([...current].sort());
  });
});

describe('deploy gate with the closed alpha', () => {
  const g = { kind: 'escrow' as const, network: 'mainnet' as const, audit: null, pendingContracts: [] as string[], treasurySet: true };
  it('without a closed alpha decision, Alpha stays refused for lack of an audit', () => {
    expect(deployRefusal(g)).toBe(AUDIT_REFUSED);
  });
  it('a refused decision says why; only an ok decision opens an unaudited class', () => {
    expect(deployRefusal({ ...g, closedAlpha: { ok: false, reasons: [R.member] } })).toBe(R.member);
    expect(deployRefusal({ ...g, closedAlpha: { ok: true } })).toBeNull();
  });
  it('the closed alpha never skips the treasury or recompile rules', () => {
    expect(deployRefusal({ ...g, closedAlpha: { ok: true }, treasurySet: false })).not.toBeNull();
    expect(deployRefusal({ ...g, closedAlpha: { ok: true }, pendingContracts: ['PrivateEscrow'] })).not.toBeNull();
  });
});
