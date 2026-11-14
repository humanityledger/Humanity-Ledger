import { describe, expect, it } from 'vitest';
import { issueCap, recordedAdmin } from '@/lib/aztec/token-issuer';

const HLC = '0x2cd0f3775d129210ecf2165e338e1b6b708f2243ac1b30feb0ac49875366e55d';
const ADMIN = '0x01c7e18f1751ea94e3d63aad2d0b7221642ad299454f769103f0d32364ce549b';

describe('token issuer on Alpha', () => {
  it('reads the HLC admin from deployments/aztec-mainnet.json', () => {
    expect(recordedAdmin(HLC)).toBe(ADMIN);
    expect(recordedAdmin(HLC.toUpperCase().replace('0X', '0x'))).toBe(ADMIN);
  });
  it('knows no admin for an unrecorded or retired token', () => {
    expect(recordedAdmin('0x' + '1'.repeat(64))).toBeNull();
    expect(recordedAdmin(HLC, { tokens: [{ address: HLC, admin: ADMIN, status: 'do-not-use' }] })).toBeNull();
    expect(recordedAdmin(HLC, { tokens: [{ address: HLC, admin: 'nope' }] })).toBeNull();
  });
  it('caps one issue at 1,000 whole tokens', () => {
    expect(issueCap(6)).toBe(1_000_000_000n);
  });
});
