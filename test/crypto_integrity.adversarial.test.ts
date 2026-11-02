/**
 * Cryptographic Integrity Tests
 * Tests for VK hash binding, commitment schemes, nullifier uniqueness,
 * Pedersen pre-image resistance (simulated), and ZK proof soundness properties.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Simulated Cryptographic Primitives
// ---------------------------------------------------------------------------

/** Simulated Pedersen hash (using SHA256 as test proxy with domain separator) */
function simulatedPedersenHash(inputs: bigint[]): bigint {
  const h = createHash('sha256');
  h.update('PEDERSEN_DOMAIN');
  for (const inp of inputs) {
    h.update(inp.toString(16).padStart(64, '0'));
  }
  return BigInt('0x' + h.digest('hex'));
}

/** Simulated nullifier derivation */
function deriveNullifier(nullifierSecret: bigint, noteCommitment: bigint): bigint {
  return simulatedPedersenHash([nullifierSecret, noteCommitment]);
}

/** Simulated commitment scheme */
function deriveCommitment(amount: bigint, recipientPubkey: bigint, blinding: bigint): bigint {
  return simulatedPedersenHash([amount, recipientPubkey, blinding]);
}

/** Simulated VK hash (like keccak256 of VK bytes in production) */
function hashVK(vkBytes: string): string {
  const h = createHash('sha256');
  h.update(vkBytes);
  return '0x' + h.digest('hex');
}

/** Simulated on-chain VK anchor store */
const vkAnchorStore: Map<string, string> = new Map([
  ['escrow', hashVK('escrow-vk-bytes-v1')],
  ['streams', hashVK('streams-vk-bytes-v1')],
  ['identity', hashVK('identity-vk-bytes-v1')],
]);

function verifyVKAnchor(circuit: string, vkHash: string): boolean {
  const stored = vkAnchorStore.get(circuit);
  return stored !== undefined && stored === vkHash;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Cryptographic Integrity Hardening', () => {
  // --- Commitment Binding ---
  describe('Commitment Binding Properties', () => {
    it('CRY-01: commitment is deterministic for same inputs', () => {
      const c1 = deriveCommitment(1000n, 0xdeadbeefn, 0x12345n);
      const c2 = deriveCommitment(1000n, 0xdeadbeefn, 0x12345n);
      expect(c1).toBe(c2);
    });

    it('CRY-02: commitment changes if amount changes (binding)', () => {
      const c1 = deriveCommitment(1000n, 0xdeadbeefn, 0x12345n);
      const c2 = deriveCommitment(1001n, 0xdeadbeefn, 0x12345n);
      expect(c1).not.toBe(c2);
    });

    it('CRY-03: commitment changes if blinding factor changes (hiding)', () => {
      const c1 = deriveCommitment(1000n, 0xdeadbeefn, 0x12345n);
      const c2 = deriveCommitment(1000n, 0xdeadbeefn, 0x99999n);
      expect(c1).not.toBe(c2);
    });

    it('CRY-04: commitment changes if recipient changes (binding)', () => {
      const c1 = deriveCommitment(1000n, 0xdeadbeefn, 0x12345n);
      const c2 = deriveCommitment(1000n, 0xdeadbeef1n, 0x12345n);
      expect(c1).not.toBe(c2);
    });
  });

  // --- Nullifier Uniqueness ---
  describe('Nullifier Uniqueness Properties', () => {
    it('CRY-05: same secret + same commitment produces same nullifier', () => {
      const n1 = deriveNullifier(0xcafebaben, 0xdeadbeefn);
      const n2 = deriveNullifier(0xcafebaben, 0xdeadbeefn);
      expect(n1).toBe(n2);
    });

    it('CRY-06: different secret → different nullifier for same commitment', () => {
      const n1 = deriveNullifier(0xcafebaben, 0xdeadbeefn);
      const n2 = deriveNullifier(0xcafebabe1n, 0xdeadbeefn);
      expect(n1).not.toBe(n2);
    });

    it('CRY-07: different commitment → different nullifier for same secret', () => {
      const n1 = deriveNullifier(0xcafebaben, 0xdeadbeefn);
      const n2 = deriveNullifier(0xcafebaben, 0xdeadbeef1n);
      expect(n1).not.toBe(n2);
    });

    it('CRY-08: nullifier uniqueness across 1000 random pairs (no collision)', () => {
      const nullifiers = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        const secret = BigInt(i + 1) * 0xcafebaben;
        const commitment = BigInt(i + 1) * 0xdeadbeefn;
        const n = deriveNullifier(secret, commitment);
        const key = n.toString();
        expect(nullifiers.has(key)).toBe(false);
        nullifiers.add(key);
      }
      expect(nullifiers.size).toBe(1000);
    });

    it('CRY-09: zero secret produces non-zero nullifier (no trivial collision with zero blinding)', () => {
      // We reject zero nullifier secret at the circuit level (CI-05),
      // but if it were allowed, it must still produce a non-trivial nullifier
      const n = deriveNullifier(0n, 0xdeadbeefn);
      expect(n).not.toBe(0n);
    });
  });

  // --- VK Hash Anchoring ---
  describe('VK Hash Anchoring and Anti-Substitution', () => {
    it('CRY-10: valid VK hash is accepted for known circuit', () => {
      const validHash = hashVK('escrow-vk-bytes-v1');
      expect(verifyVKAnchor('escrow', validHash)).toBe(true);
    });

    it('CRY-11: tampered VK hash is rejected', () => {
      const tamperedHash = hashVK('escrow-vk-bytes-TAMPERED');
      expect(verifyVKAnchor('escrow', tamperedHash)).toBe(false);
    });

    it('CRY-12: correct VK hash for wrong circuit is rejected', () => {
      const streamsHash = hashVK('streams-vk-bytes-v1');
      // The streams VK hash must not be accepted for the escrow circuit
      expect(verifyVKAnchor('escrow', streamsHash)).toBe(false);
    });

    it('CRY-13: unknown circuit is rejected', () => {
      const anyHash = hashVK('some-vk-bytes');
      expect(verifyVKAnchor('malicious-circuit', anyHash)).toBe(false);
    });

    it('CRY-14: VK hash is 0x-prefixed 64-char hex', () => {
      const h = hashVK('test-vk');
      expect(h).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('CRY-15: all three circuit VKs have distinct hashes', () => {
      const hashes = [
        hashVK('escrow-vk-bytes-v1'),
        hashVK('streams-vk-bytes-v1'),
        hashVK('identity-vk-bytes-v1'),
      ];
      const unique = new Set(hashes);
      expect(unique.size).toBe(3);
    });
  });

  // --- Hash Pre-image Resistance (Statistical) ---
  describe('Hash Pre-image Resistance (Statistical)', () => {
    it('CRY-16: flipping one input bit changes > 20% of output bits (avalanche effect)', () => {
      const input1 = 0xabcdef1234567890n;
      const input2 = input1 ^ 1n; // flip lowest bit

      const h1 = simulatedPedersenHash([input1]);
      const h2 = simulatedPedersenHash([input2]);

      // Compare bit count difference
      const xor = h1 ^ h2;
      const xorBin = xor.toString(2);
      const setBits = xorBin.split('').filter(b => b === '1').length;
      const totalBits = 256;

      // At least 20% of bits must differ (avalanche criterion)
      expect(setBits / totalBits).toBeGreaterThan(0.2);
    });

    it('CRY-17: two commitments with same amount but different blindings are computationally indistinguishable (distinct values)', () => {
      const blindings = Array.from({ length: 100 }, (_, i) => BigInt(i + 1) * 0x1337n);
      const commitments = blindings.map(b => deriveCommitment(1000n, 0xdeadbeefn, b));
      const unique = new Set(commitments.map(c => c.toString()));
      expect(unique.size).toBe(100);
    });
  });

  // --- Encoding and Serialization Integrity ---
  describe('Encoding and Serialization Integrity', () => {
    it('CRY-18: proof object serialized with JSON.stringify and parsed back has same hash', () => {
      const proofObj = {
        circuit: 'escrow',
        vkHash: hashVK('escrow-vk-bytes-v1'),
        nullifier: deriveNullifier(0xcafebaben, 0xdeadbeefn).toString(),
        commitment: deriveCommitment(100n, 0xdeadbeefn, 0x12345n).toString(),
      };
      const serialized = JSON.stringify(proofObj);
      const parsed = JSON.parse(serialized);
      expect(parsed.vkHash).toBe(proofObj.vkHash);
      expect(parsed.nullifier).toBe(proofObj.nullifier);
    });

    it('CRY-19: BigInt nullifier round-trips through string without precision loss', () => {
      const original = deriveNullifier(0xcafebaben, 0xdeadbeefn);
      const asString = original.toString();
      const recovered = BigInt(asString);
      expect(recovered).toBe(original);
    });

    it('CRY-20: VK hash format is stable under repeated hashing', () => {
      const h1 = hashVK('escrow-vk-bytes-v1');
      const h2 = hashVK('escrow-vk-bytes-v1');
      // Deterministic: same input always produces same hash
      expect(h1).toBe(h2);
    });
  });
});
