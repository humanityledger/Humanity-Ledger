/**
 * Agreement policy: anything on testnet; on Alpha mainnet only recorded
 * classes, acknowledged while unaudited, and within a per-token cap.
 */
import { describe, it, expect } from 'vitest';
import { authorizedMainnetRecord, checkAgreementContext, checkAgreementPolicy, type MainnetRecord } from '@/lib/aztec/agreement-policy';
import { parseAgreementCaps } from '@/lib/aztec/wallet/config';
import fs from 'node:fs';
import path from 'node:path';

const CLASS = '0x' + 'ab'.repeat(32);
const TOKEN = '0x' + 'cd'.repeat(32);
const record: MainnetRecord = { audit: null, contracts: [{ classId: CLASS, tracksCurrentArtifact: true }] };
const base = { network: 'mainnet' as const, classId: CLASS, token: TOKEN, amount: 50n, mainnetRecord: record, caps: { [TOKEN]: 100n }, acknowledgedUnaudited: true, acknowledgedPublicFeePayer: true, peerVerified: true };

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

  it('refuses on mainnet without a verified G7 binding or the fee-payer acknowledgement', () => {
    expect(checkAgreementPolicy({ ...base, peerVerified: false })).toEqual({ ok: false, reasons: ["the counterparty's Aztec address has no verified proof of control (G7)"] });
    expect(checkAgreementPolicy({ ...base, peerVerified: undefined }).ok).toBe(false);
    expect(checkAgreementPolicy({ ...base, acknowledgedPublicFeePayer: undefined })).toEqual({ ok: false, reasons: ['the fee payer is public and the user has not acknowledged it'] });
  });

  it('never authorises a do-not-use class, even if flagged current', () => {
    const bad: MainnetRecord = { audit: null, contracts: [{ classId: CLASS, tracksCurrentArtifact: true, status: 'do-not-use' }] };
    expect(checkAgreementPolicy({ ...base, mainnetRecord: bad })).toEqual({ ok: false, reasons: ['contract class is not a recorded mainnet deployment'] });
  });

  it('refuses a missing or exceeded cap and a non-positive amount', () => {
    expect(checkAgreementPolicy({ ...base, caps: undefined }).ok).toBe(false);
    expect(checkAgreementPolicy({ ...base, amount: 101n })).toEqual({ ok: false, reasons: ['amount exceeds the mainnet cap of 100 base units'] });
    expect(checkAgreementPolicy({ ...base, amount: 0n })).toEqual({ ok: false, reasons: ['amount must be positive'] });
    expect(checkAgreementPolicy({ ...base, amount: -1n }).ok).toBe(false);
  });
});

describe('checkAgreementContext', () => {
  const A = '0x' + '1a'.repeat(32);
  const ctx = { nodeNetwork: 'testnet' as const, buildNetwork: 'testnet' as const, alphaEnabled: false, pinnedAddress: A, claimedAddress: A };

  it('passes on a matching network with the pinned address', () => {
    expect(checkAgreementContext(ctx)).toEqual({ ok: true });
    expect(checkAgreementContext({ ...ctx, nodeNetwork: 'local' })).toEqual({ ok: true });
    expect(checkAgreementContext({ ...ctx, claimedAddress: A.toUpperCase().replace('0X', '0x') })).toEqual({ ok: true });
    expect(checkAgreementContext({ ...ctx, nodeNetwork: 'mainnet', buildNetwork: 'mainnet', alphaEnabled: true })).toEqual({ ok: true });
  });

  it('fails closed when the node network differs from the build, is unknown, or Alpha is not enabled', () => {
    expect(checkAgreementContext({ ...ctx, nodeNetwork: 'mainnet' }).ok).toBe(false);
    expect(checkAgreementContext({ ...ctx, buildNetwork: 'mainnet', alphaEnabled: true }).ok).toBe(false);
    expect(checkAgreementContext({ ...ctx, nodeNetwork: undefined }).ok).toBe(false);
    expect(checkAgreementContext({ ...ctx, nodeNetwork: 'mainnet', buildNetwork: 'mainnet', alphaEnabled: false })).toEqual({ ok: false, reasons: ['Aztec Alpha is not enabled in this app'] });
  });

  it('refuses an address other than the pinned one, a missing pin, or a malformed address', () => {
    const r = { ok: false, reasons: ['this is not the Aztec address saved for this person'] };
    expect(checkAgreementContext({ ...ctx, claimedAddress: '0x' + '2b'.repeat(32) })).toEqual(r);
    expect(checkAgreementContext({ ...ctx, pinnedAddress: undefined })).toEqual(r);
    expect(checkAgreementContext({ ...ctx, pinnedAddress: '0x1a', claimedAddress: '0x1a' })).toEqual(r);
    expect(checkAgreementContext({ ...ctx, pinnedAddress: A + '00', claimedAddress: A + '00' })).toEqual(r);
  });
});

describe('parseAgreementCaps', () => {
  const T = '0x' + 'cd'.repeat(32);
  it('keeps positive decimal caps, lowercased', () => {
    expect(parseAgreementCaps({ [T.toUpperCase().replace('0X', '0x')]: '1000' })).toEqual({ [T]: 1000n });
  });
  it('drops zero, negative, hex, exponent, non-string and bad-address entries', () => {
    expect(parseAgreementCaps({ [T]: '0' })).toEqual({});
    expect(parseAgreementCaps({ [T]: '-5' })).toEqual({});
    expect(parseAgreementCaps({ [T]: '0x10' })).toEqual({});
    expect(parseAgreementCaps({ [T]: '1e3' })).toEqual({});
    expect(parseAgreementCaps({ [T]: 100 })).toEqual({});
    expect(parseAgreementCaps({ '0x1234': '100' })).toEqual({});
    expect(parseAgreementCaps(null)).toEqual({});
    expect(parseAgreementCaps([] as any)).toEqual({});
  });
});

describe('authorizedMainnetRecord (G5 at runtime)', () => {
  const PIN = { l1ChainId: 1, rollupVersion: 2070860440 };
  const H = (b: string) => '0x' + b.repeat(32);
  const entry = { name: 'PrivateEscrow', address: H('11'), classId: H('22'), deployTx: H('33'), deployBlock: 10, holdsPrivateBalance: true, keyed: true, status: 'active', tracksCurrentArtifact: true };
  const rec = (contracts: unknown[], extra: Record<string, unknown> = {}) => ({ network: { l1ChainId: 1, rollupVersion: 2070860440 }, audit: null, contracts, ...extra });

  it('authorises nothing with the record as committed today', () => {
    const committed = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../deployments/aztec-mainnet.json'), 'utf8'));
    expect(authorizedMainnetRecord(committed, PIN)).toEqual({ audit: null, contracts: [] });
  });

  it('keeps a fully recorded entry', () => {
    expect(authorizedMainnetRecord(rec([entry]), PIN)?.contracts).toEqual([{ name: 'PrivateEscrow', classId: H('22'), tracksCurrentArtifact: true, status: 'active' }]);
  });

  it('drops entries without transaction or block, not current, do-not-use, or holding tokens without keys', () => {
    for (const bad of [
      { ...entry, deployTx: undefined },
      { ...entry, deployTx: '0x1234' },
      { ...entry, deployBlock: 0 },
      { ...entry, deployBlock: '10' },
      { ...entry, tracksCurrentArtifact: false },
      { ...entry, status: 'do-not-use' },
      { ...entry, keyed: false },
      { ...entry, classId: 'nope' },
    ]) {
      expect(authorizedMainnetRecord(rec([bad]), PIN)?.contracts).toEqual([]);
    }
  });

  it('refuses the whole record on another network or when malformed', () => {
    expect(authorizedMainnetRecord(rec([entry], { network: { l1ChainId: 11155111, rollupVersion: 2070860440 } }), PIN)).toBeUndefined();
    expect(authorizedMainnetRecord(rec([entry], { network: { l1ChainId: 1, rollupVersion: 1 } }), PIN)).toBeUndefined();
    expect(authorizedMainnetRecord({ contracts: 'x' }, PIN)).toBeUndefined();
    expect(authorizedMainnetRecord(null, PIN)).toBeUndefined();
  });

  it('counts an audit only with a report and a date', () => {
    expect(authorizedMainnetRecord(rec([entry], { audit: { report: '', date: '2027-01-01' } }), PIN)?.audit).toBeNull();
    expect(authorizedMainnetRecord(rec([entry], { audit: true }), PIN)?.audit).toBeNull();
    expect(authorizedMainnetRecord(rec([entry], { audit: { report: 'r.pdf', date: '2027-01-01' } }), PIN)?.audit).toEqual({ report: 'r.pdf', date: '2027-01-01' });
  });

  it('feeds checkAgreementPolicy: a dropped entry never authorises its class', () => {
    const r = authorizedMainnetRecord(rec([{ ...entry, deployTx: undefined }]), PIN)!;
    expect(checkAgreementPolicy({ ...base, classId: H('22'), mainnetRecord: r }).ok).toBe(false);
    const ok = authorizedMainnetRecord(rec([entry]), PIN)!;
    expect(checkAgreementPolicy({ ...base, classId: H('22'), mainnetRecord: ok })).toEqual({ ok: true });
  });
});

