/**
 * randomField draws agreement secrets from the platform CSPRNG and reduces
 * 512 bits modulo the field: every value is a valid field element and repeated
 * draws do not collide.
 */
import { describe, it, expect } from 'vitest';
import { Fr } from '@aztec-labs/aztec.js/fields';
import { randomField } from '@/lib/aztec/random';

describe('randomField', () => {
  it('returns field elements below the modulus', () => {
    for (let i = 0; i < 256; i++) {
      const f = randomField();
      expect(f).toBeInstanceOf(Fr);
      expect(f.toBigInt() < Fr.MODULUS).toBe(true);
    }
  });

  it('does not repeat across draws', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1024; i++) seen.add(randomField().toString());
    expect(seen.size).toBe(1024);
  });

  it('survives a string round trip, as in an invitation', () => {
    const f = randomField();
    expect(Fr.fromString(f.toString()).equals(f)).toBe(true);
  });
});
