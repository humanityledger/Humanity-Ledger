/** Package 4: nobody enters the closed alpha without the signed terms and the operator's checks. */
import fs from 'node:fs';
import { acceptanceProblem, inviteChecksProblem, retainUntil, termsProblem } from '@/lib/alpha/rules.mjs';

const H = 'a'.repeat(64);
const signed = { version: '1.0 (signed 2026-11-20)', sha256: H };
const yes = { accept: { terms: true, risks: true, eligibility: true }, termsSha256: H };

describe('terms (OD-8)', () => {
  it('without a signed version, no code is redeemed', () => {
    expect(termsProblem({ version: '', sha256: '' })).toMatch(/No signed version/);
    expect(acceptanceProblem(yes, { version: '', sha256: H })).toMatch(/No signed version/);
    expect(termsProblem({ version: '1.0', sha256: 'abc' })).toMatch(/SHA-256/);
  });
  it('three separate boxes, each required, and the hash of the exact signed text', () => {
    expect(acceptanceProblem(yes, signed)).toBeNull();
    expect(acceptanceProblem({ ...yes, accept: { ...yes.accept, terms: false } }, signed)).toMatch(/terms/);
    expect(acceptanceProblem({ ...yes, accept: { ...yes.accept, risks: undefined } }, signed)).toMatch(/clause 6/);
    expect(acceptanceProblem({ ...yes, accept: { ...yes.accept, eligibility: 'yes' } }, signed)).toMatch(/18/);
    expect(acceptanceProblem({ ...yes, termsSha256: 'b'.repeat(64) }, signed)).toMatch(/terms changed/);
    expect(acceptanceProblem({ code: 'X' }, signed)).toMatch(/Accept the terms/);
  });
});

describe('operator checks before a code', () => {
  const ok = { sanctionsListDate: '2026-11-19', sanctionsResult: 'clear', adultChecked: true };
  it('sanctions clear with the date of the list, and age checked', () => expect(inviteChecksProblem(ok)).toBeNull());
  it('a match never gets a code', () => expect(inviteChecksProblem({ ...ok, sanctionsResult: 'match' })).toMatch(/matched/));
  it('without the sanctions check or the age check, no code', () => {
    expect(inviteChecksProblem({ ...ok, sanctionsListDate: '' })).toMatch(/sanctions list/);
    expect(inviteChecksProblem({ ...ok, sanctionsResult: '' })).toMatch(/sanctions result/);
    expect(inviteChecksProblem({ ...ok, adultChecked: false })).toMatch(/18/);
  });
  it('personal fields are kept until 6 months after the end of the alpha', () => {
    expect(retainUntil('2027-01-14T00:00:00Z')?.toISOString()).toBe('2027-07-14T00:00:00.000Z');
    expect(retainUntil(null)).toBeNull();
  });
});

describe('wiring', () => {
  it('redeem checks the acceptance and stores each box with its time and hash; the script checks before a code', () => {
    const redeem = fs.readFileSync('app/api/alpha/redeem/route.ts', 'utf8');
    expect(redeem).toMatch(/acceptanceProblem\(body, terms\)/);
    for (const f of ['termsAcceptedAt', 'termsSha256', 'risksAcceptedAt', 'risksSha256', 'eligibilityAcceptedAt', 'eligibilitySha256', 'retainUntil']) expect(redeem).toContain(f);
    const script = fs.readFileSync('scripts/alpha/invites.mjs', 'utf8');
    expect(script).toMatch(/inviteChecksProblem\(checks\)/);
    expect(script).toMatch(/--count 1/);
    const sql = fs.readFileSync('prisma/migrations/20261119140000_alpha_admission/migration.sql', 'utf8');
    expect(sql).toMatch(/ADD COLUMN "sanctionsResult"/);
    expect(sql).not.toMatch(/DROP|DELETE/i);
    expect(fs.existsSync('scripts/alpha/purge.mjs')).toBe(true);
  });
});
