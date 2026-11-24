import { describe, expect, it } from 'vitest';
import { PRIVATE_FPC_ADDRESS, PRIVATE_FPC_AZTEC_VERSION, maxFeeOf, nextPrivateSaltIndex, privateFeeChoice, versionMatches, type PrivateFeeDeposit } from '@/lib/aztec/private-fees';

const dep = (amount: bigint, i = 0): PrivateFeeDeposit => ({
  recipient: PRIVATE_FPC_ADDRESS,
  claimer: '0x' + '11'.repeat(32),
  claimAmount: amount.toString(),
  secretIndex: i,
  messageHash: '0x' + String(i).padStart(64, '0'),
  messageLeafIndex: String(i),
  createdAt: 0,
});
const base = { enabled: true, versionOk: true, balance: 0n, maxFee: 100n, deposits: [] as { deposit: PrivateFeeDeposit; ready: boolean }[] };

describe('private fees (PrivateFPC)', () => {
  it('uses the canonical address for Aztec 6.0.0 only', () => {
    expect(PRIVATE_FPC_ADDRESS).toMatch(/^0x[0-9a-f]{64}$/);
    expect(PRIVATE_FPC_AZTEC_VERSION).toBe('6.0.0');
    expect(versionMatches('6.0.0')).toBe(true);
    expect(versionMatches('v6.0.0')).toBe(true);
    expect(versionMatches('6.0.1')).toBe(false);
    expect(versionMatches('')).toBe(false);
    expect(versionMatches(undefined)).toBe(false);
  });

  it('is off unless enabled, and off on another Aztec version', () => {
    expect(privateFeeChoice({ ...base, enabled: false, balance: 1000n }).kind).toBe('none');
    expect(privateFeeChoice({ ...base, versionOk: false, balance: 1000n }).kind).toBe('none');
  });

  it('never runs without a gas estimate (the contract keeps the whole maximum fee)', () => {
    expect(privateFeeChoice({ ...base, balance: 10n ** 30n, maxFee: 0n })).toEqual({ kind: 'none', reason: 'no gas estimate' });
  });

  it('pays from the private balance when it covers the fee', () => {
    expect(privateFeeChoice({ ...base, balance: 100n }).kind).toBe('balance');
  });

  it('claims the smallest ready deposit that covers the fee on its own', () => {
    const r = privateFeeChoice({ ...base, deposits: [{ deposit: dep(500n, 1), ready: true }, { deposit: dep(150n, 2), ready: true }, { deposit: dep(90n, 3), ready: true }, { deposit: dep(1000n, 4), ready: false }] });
    expect(r.kind).toBe('mint-and-pay');
    expect(r.kind === 'mint-and-pay' && r.deposit.secretIndex).toBe(2);
  });

  it('falls back when nothing private covers the fee', () => {
    expect(privateFeeChoice({ ...base, balance: 10n, deposits: [{ deposit: dep(50n), ready: true }] }).kind).toBe('none');
    expect(privateFeeChoice({ ...base, deposits: [{ deposit: dep(500n), ready: false }] }).kind).toBe('none');
  });

  it('salt indexes skip pending and used ones', () => {
    expect(nextPrivateSaltIndex([{ secretIndex: 0 }, { secretIndex: 2 }], [1])).toBe(3);
    expect(nextPrivateSaltIndex(Array.from({ length: 15 }, (_, i) => ({ secretIndex: i })))).toBe(15);
  });

  it('max fee is limits times fees per gas, teardown included', () => {
    expect(maxFeeOf({ daGas: 10n, l2Gas: 20n }, { feePerDaGas: 3n, feePerL2Gas: 5n }, { daGas: 1n, l2Gas: 2n })).toBe(11n * 3n + 22n * 5n);
  });
});
