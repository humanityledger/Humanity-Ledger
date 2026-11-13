/** Out-of-band address check: a hash fingerprint, not the grindable first/last hex digits. */
import { describe, it, expect } from 'vitest';
import { addressFingerprint } from '@/lib/aztec/address-fingerprint';

const A = '0x' + '1a'.repeat(32);
const B = '0x' + '1a'.repeat(31) + '1b';

describe('addressFingerprint', () => {
  it('is 64 bits in 4 groups, stable, case-insensitive', async () => {
    const f = await addressFingerprint(A);
    expect(f).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(await addressFingerprint(A.toUpperCase().replace('0X', '0x'))).toBe(f);
  });
  it('changes when one byte changes, even with equal first/last digits', async () => {
    const C = '0x1a1a' + '00'.repeat(28) + '1a1a';
    const D = '0x1a1a' + '01'.repeat(28) + '1a1a';
    expect(await addressFingerprint(C)).not.toBe(await addressFingerprint(D));
    expect(await addressFingerprint(A)).not.toBe(await addressFingerprint(B));
  });
  it('rejects malformed addresses', async () => {
    await expect(addressFingerprint('0x1234')).rejects.toThrow('Not an Aztec address.');
  });
});
