/**
 * test/zk/vk-pinning.test.ts — master prompt tasks R-02 and R-03.
 *
 * The VK "integrity" check used to hash the JSON metadata, which held invented
 * Plonk-style fields, so it never touched the key Barretenberg uses. These tests
 * tie the pinned hash in code, the metadata file and the binary VK together.
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CIRCUITS,
  PINNED_VK_SHA256,
  LOCAL_CIRCUIT_VKS,
  getLocalVKHash,
  assertLocalVKMatchesPin,
  readLocalVKBytes,
} from '../../lib/aztec/verifier';
import { validateFieldElement, validateUnsigned, BN254_SCALAR_MODULUS } from '../../lib/zk/prover';

describe('VK pinning (R-02)', () => {
  for (const circuit of CIRCUITS) {
    it(`${circuit}: binary VK on disk hashes to the pinned constant`, () => {
      expect(getLocalVKHash(circuit)).toBe(PINNED_VK_SHA256[circuit]);
    });

    it(`${circuit}: metadata declares the same hash and no invented fields`, () => {
      const meta = LOCAL_CIRCUIT_VKS[circuit] as Record<string, unknown>;
      expect(meta.vkSha256).toBe(PINNED_VK_SHA256[circuit]);
      for (const invented of ['verificationKey', 'qM', 'sigma1', 'l1Anchoring', 'circuitSize', 'vkHash']) {
        if (invented === 'verificationKey') {
          expect(meta[invented]).toBe('target/vk');
        } else {
          expect(meta[invented]).toBeUndefined();
        }
      }
      expect(meta.onChainRegistry).toBeNull();
    });

    it(`${circuit}: metadata header matches the first fields of the binary VK`, () => {
      const bytes = readLocalVKBytes(circuit);
      const field = (i: number) => BigInt('0x' + Buffer.from(bytes.slice(i * 32, i * 32 + 32)).toString('hex'));
      const header = (LOCAL_CIRCUIT_VKS[circuit] as any).vkHeader;
      expect(Number(field(0))).toBe(header.logCircuitSize);
      expect(Number(field(1))).toBe(header.numPublicInputs);
      expect(Number(field(2))).toBe(header.publicInputsOffset);
      expect(bytes.length).toBe((LOCAL_CIRCUIT_VKS[circuit] as any).vkBytes);
    });
  }

  it('rejects a binary VK that was changed on disk', () => {
    const root = mkdtempSync(join(tmpdir(), 'hl-vk-'));
    const original = process.cwd();
    try {
      mkdirSync(join(root, 'circuits', 'escrow', 'target'), { recursive: true });
      copyFileSync(join(original, 'circuits/escrow/target/vk'), join(root, 'circuits/escrow/target/vk'));
      const tampered = readFileSync(join(root, 'circuits/escrow/target/vk'));
      tampered[tampered.length - 1] ^= 0x01;
      writeFileSync(join(root, 'circuits/escrow/target/vk'), tampered);
      process.chdir(root);
      expect(() => assertLocalVKMatchesPin('escrow')).toThrow(/does not match the pinned hash/);
    } finally {
      process.chdir(original);
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('Prover input rules (R-03)', () => {
  it('refuses JavaScript numbers, which lose precision above 2^53', () => {
    expect(() => validateFieldElement(12345 as unknown, 'salt')).toThrow(TypeError);
    expect(() => validateUnsigned(1000 as unknown, 'amount')).toThrow(TypeError);
  });

  it('accepts decimal strings, hex strings and bigints', () => {
    expect(validateFieldElement('255', 'x')).toBe('0xff');
    expect(validateFieldElement('0xff', 'x')).toBe('0xff');
    expect(validateFieldElement(BigInt(255), 'x')).toBe('0xff');
    expect(validateUnsigned('18446744073709551615', 'deadline')).toBe('18446744073709551615');
  });

  it('rejects values outside the BN254 field or the integer range', () => {
    expect(() => validateFieldElement(BN254_SCALAR_MODULUS.toString(), 'salt')).toThrow(RangeError);
    expect(() => validateUnsigned('18446744073709551616', 'deadline')).toThrow(RangeError);
    expect(() => validateUnsigned('4294967296', 'jurisdiction_code', BigInt(4294967295))).toThrow(RangeError);
  });

  it('never puts the rejected value in the error message', () => {
    const secret = (BN254_SCALAR_MODULUS + BigInt(987654321)).toString();
    try {
      validateFieldElement(secret, 'sender_secret');
      throw new Error('expected a rejection');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('sender_secret');
      expect(message).not.toContain(secret);
      expect(message).not.toContain('987654321');
    }
  });
});
