/**
 * The statically imported poseidon2 matches the separators the contracts
 * use: the escrow claim hash computed here equals the one confirmAgreement
 * compared against the stored note on testnet.
 */
import { describe, it, expect } from 'vitest';
import { Fr } from '@aztec-labs/aztec.js/fields';
import { poseidon2WithSeparator } from '@/lib/aztec/poseidon';
import { claimSecretHash, DOM_SEP__CLAIM_SECRET } from '@/lib/aztec/agreements';

describe('poseidon2 with separator', () => {
  it('is deterministic, separator-dependent and a field element', async () => {
    const a = await poseidon2WithSeparator([new Fr(1n)], DOM_SEP__CLAIM_SECRET);
    expect((await poseidon2WithSeparator([new Fr(1n)], DOM_SEP__CLAIM_SECRET)).equals(a)).toBe(true);
    expect((await poseidon2WithSeparator([new Fr(1n)], DOM_SEP__CLAIM_SECRET + 1)).equals(a)).toBe(false);
    expect(a.toBigInt() < Fr.MODULUS).toBe(true);
  });

  it('is what claimSecretHash uses', async () => {
    const s = new Fr(0xc1a1n);
    expect((await claimSecretHash(s)).equals(await poseidon2WithSeparator([s], DOM_SEP__CLAIM_SECRET))).toBe(true);
  });
});
