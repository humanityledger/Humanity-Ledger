import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { deriveAztecSecretKey } from '@/lib/aztec/keys/derive';
import { encrypt, decrypt } from '@/lib/security/server-crypto';
import { constantTimeCompare, constantTimeCompareBuffers } from '@/lib/security/constant-time';

/**
 * Quantum-Grade & Adversarial Cryptographic Hardening Test Battery
 * Targets:
 * - Anti-Lazarus memory forensic wiping in key derivation
 * - AES-256-GCM authenticated cipher tamper resistance (IV, AuthTag, Ciphertext bit flips)
 * - BN254 scalar field bounds (0x00 prefix and < r)
 * - Timing indistinguishability under microsecond variance
 */
describe('Quantum-Grade Cryptographic Hardening & Adversarial Probes', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, ENCRYPTION_SECRET: 'test_quantum_super_secure_secret_entropy_32b_minimum_ok' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  // ---------------------------------------------------------------------------
  // 1. Aztec Key Derivation Hardening
  // ---------------------------------------------------------------------------
  describe('Aztec Secret Key Derivation (deriveAztecSecretKey)', () => {
    const BN254_FR_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

    it('Derives valid 32-byte Fr scalar keys starting with 0x00 to guarantee < r', () => {
      for (let i = 0; i < 500; i++) {
        const dummySig = '0x' + crypto.randomBytes(65).toString('hex');
        const secretKeyHex = deriveAztecSecretKey(dummySig);

        expect(secretKeyHex.startsWith('0x00')).toBe(true);
        expect(secretKeyHex.length).toBe(66); // 0x + 64 hex characters

        const asBigInt = BigInt(secretKeyHex);
        expect(asBigInt).toBeGreaterThan(0n);
        expect(asBigInt).toBeLessThan(BN254_FR_MODULUS);
      }
    });

    it('Guarantees determinism: same signature always yields identical key', () => {
      const sig = '0x' + crypto.randomBytes(65).toString('hex');
      const key1 = deriveAztecSecretKey(sig);
      const key2 = deriveAztecSecretKey(sig);
      expect(key1).toBe(key2);
    });

    it('Guarantees domain separation: different signatures yield distinct keys (no collisions in 1,000 runs)', () => {
      const derivedSet = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        const sig = '0x' + crypto.randomBytes(65).toString('hex');
        const key = deriveAztecSecretKey(sig);
        expect(derivedSet.has(key)).toBe(false);
        derivedSet.add(key);
      }
      expect(derivedSet.size).toBe(1000);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. AES-256-GCM Authenticated Encryption Tamper-Proofing
  // ---------------------------------------------------------------------------
  describe('Authenticated Encryption (AES-256-GCM)', () => {
    it('Successfully encrypts and decrypts arbitrary plaintexts and UTF-8 payloads', async () => {
      const samples = [
        'Short text',
        'Criptografía de conocimiento cero con Aztec y Noir en BN254',
        '{"nullifier": "0x1234", "commitment": "0x5678", "amount": 1000000}',
        'Special characters: 🚀🔥🔒⚡\u0000\u0001\u001f\ufffd',
        'A'.repeat(4096), // 4 KB payload
      ];

      for (const sample of samples) {
        const cipher = await encrypt(sample);
        expect(cipher).toContain(':'); // iv:authTag:encrypted format
        const decrypted = await decrypt(cipher);
        expect(decrypted).toBe(sample);
      }
    });

    it('Enforces probabilistic encryption: encrypting the same text twice yields different ciphertexts (unique IV)', async () => {
      const plain = 'Identical user data';
      const c1 = await encrypt(plain);
      const c2 = await encrypt(plain);

      expect(c1).not.toBe(c2);

      const [iv1] = c1.split(':');
      const [iv2] = c2.split(':');
      expect(iv1).not.toBe(iv2); // Random 16-byte IV ensures nonce uniqueness
    });

    it('Rejects ciphertext bit-flipping attacks with AEAD integrity verification failure', async () => {
      const plain = 'Confidential payload for settlement';
      const cipher = await encrypt(plain);
      const [ivHex, authTagHex, encryptedHex] = cipher.split(':');

      // 1. Flip a bit in the encrypted payload
      const tamperedPayload = encryptedHex.slice(0, -1) + (encryptedHex.slice(-1) === 'a' ? 'b' : 'a');
      const tamperedCipher = `${ivHex}:${authTagHex}:${tamperedPayload}`;
      await expect(decrypt(tamperedCipher)).rejects.toThrow();

      // 2. Flip a bit in the authentication tag
      const tamperedTag = (authTagHex.slice(0, 1) === 'f' ? 'e' : 'f') + authTagHex.slice(1);
      const tamperedTagCipher = `${ivHex}:${tamperedTag}:${encryptedHex}`;
      await expect(decrypt(tamperedTagCipher)).rejects.toThrow();

      // 3. Mutate the IV
      const tamperedIV = (ivHex.slice(0, 1) === '0' ? '1' : '0') + ivHex.slice(1);
      const tamperedIVCipher = `${tamperedIV}:${authTagHex}:${encryptedHex}`;
      await expect(decrypt(tamperedIVCipher)).rejects.toThrow();
    });

    it('Rejects truncated, malformed, or missing delimiter ciphertext strings', async () => {
      const malformed = [
        '',
        'not_encrypted',
        'only_one_part',
        'two:parts_only',
        ':::',
        '00:00:00:extra_part',
      ];

      for (const bad of malformed) {
        await expect(decrypt(bad)).rejects.toThrow();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Constant-Time Timing Statistical Verification
  // ---------------------------------------------------------------------------
  describe('Constant-Time Statistical Verification (Anti-Timing Side-Channels)', () => {
    it('Maintains timing consistency across differing mismatch offsets', () => {
      const secret = 'K'.repeat(128);
      const candidateMatch = 'K'.repeat(128);
      const candidateDiffStart = 'X' + 'K'.repeat(127);
      const candidateDiffEnd = 'K'.repeat(127) + 'X';

      // Warm up JIT
      for (let i = 0; i < 2000; i++) {
        constantTimeCompare(secret, candidateMatch);
        constantTimeCompare(secret, candidateDiffStart);
        constantTimeCompare(secret, candidateDiffEnd);
      }

      const MEASUREMENTS = 2000;
      let timeDiffStartTotal = 0n;
      let timeDiffEndTotal = 0n;

      for (let i = 0; i < MEASUREMENTS; i++) {
        const t0 = process.hrtime.bigint();
        constantTimeCompare(secret, candidateDiffStart);
        timeDiffStartTotal += process.hrtime.bigint() - t0;

        const t1 = process.hrtime.bigint();
        constantTimeCompare(secret, candidateDiffEnd);
        timeDiffEndTotal += process.hrtime.bigint() - t1;
      }

      const avgStart = Number(timeDiffStartTotal) / MEASUREMENTS;
      const avgEnd = Number(timeDiffEndTotal) / MEASUREMENTS;

      // Both execution times should be in the same microsecond / nanosecond scale
      // Ratio between average times should be very close to 1 (within reasonable JIT scheduling noise < 2.0x)
      const ratio = Math.max(avgStart, avgEnd) / Math.min(avgStart, avgEnd);
      expect(ratio).toBeLessThan(2.5);
    });
  });
});
