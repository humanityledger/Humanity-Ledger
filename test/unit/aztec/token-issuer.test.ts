import { describe, expect, it } from 'vitest';
import { issueCap, recordedAdmin } from '@/lib/aztec/token-issuer';

const HLC = '0x1f49571a48699da4e70e1b7dbc5afcea5bb712f7b2cfaf432353e694851e24e5';
const ADMIN = '0x1cf28fb5c786f5d7587c3a97790cef3d5e4dc453d485efd0b463cb1a8e81fe42';

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
