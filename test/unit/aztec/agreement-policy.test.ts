/**
 * Agreement policy: anything on testnet; on Alpha mainnet only recorded
 * classes, acknowledged while unaudited, and within a per-token cap.
 */
import { describe, it, expect } from 'vitest';
import { checkAgreementPolicy, type MainnetRecord } from '@/lib/aztec/agreement-policy';
import fs from 'node:fs';
import path from 'node:path';

const CLASS = '0x' + 'ab'.repeat(32);
const TOKEN = '0x' + 'cd'.repeat(32);
const record: MainnetRecord = { audit: null, contracts: [{ classId: CLASS, tracksCurrentArtifact: true }] };
const base = { network: 'mainnet' as const, classId: CLASS, token: TOKEN, amount: 50n, mainnetRecord: record, caps: { [TOKEN]: 100n }, acknowledgedUnaudited: true };

describe('checkAgreementPolicy', () => {
  it('allows anything on testnet and the local network', () => {
    expect(checkAgreementPolicy({ network: 'testnet', classId: CLASS, token: TOKEN, amount: 10n ** 30n })).toEqual({ ok: true });
    expect(checkAgreementPolicy({ network: 'local', classId: CLASS, token: TOKEN, amount: 1n })).toEqual({ ok: true });
  });

  it('allows a recorded class, acknowledged, within the cap on mainnet', () => {
    expect(checkAgreementPolicy(base)).toEqual({ ok: true });
    expect(checkAgreementPolicy({ ...base, token: TOKEN.toUpperCase().replace('0X', '0x'), amount: 100n })).toEqual({ ok: true });
  });

  it('refuses on mainnet with a reason for each gap', () => {
    const r = checkAgreementPolicy({ ...base, classId: '0x' + 'ee'.repeat(32), amount: 101n, acknowledgedUnaudited: false });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reasons).toContain('contract class is not a recorded mainnet deployment');
      expect(r.reasons).toContain('contracts are unaudited and the user has not acknowledged it');
      expect(r.reasons).toContain('amount exceeds the mainnet cap of 100 base units');
    }
    expect(checkAgreementPolicy({ ...base, caps: {} })).toEqual({ ok: false, reasons: ['no amount cap configured for this token on mainnet'] });
    expect(checkAgreementPolicy({ ...base, mainnetRecord: undefined }).ok).toBe(false);
  });

  it('needs no acknowledgement once an audit is recorded', () => {
    expect(checkAgreementPolicy({ ...base, acknowledgedUnaudited: false, mainnetRecord: { ...record, audit: { report: 'r', date: '2027-01-01' } } })).toEqual({ ok: true });
  });

  it('refuses every agreement on mainnet with the record as committed today', () => {
    const committed = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../deployments/aztec-mainnet.json'), 'utf8'));
    const r = checkAgreementPolicy({ ...base, mainnetRecord: committed });
    expect(r.ok).toBe(false);
  });
});
