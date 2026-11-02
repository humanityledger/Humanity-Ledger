/**
 * Cryptographic CRYPTOGRAPHIC VERIFICATION  Test Suite
 *
 * Tests the formal EIP-191 implementation with all security hardening layers:
 *   - Correct signature verification
 *   - Malleability protection (EIP-2 high-s rejection)
 *   - Timing-safe comparison
 *   - Nonce strength validation
 *   - Replay window enforcement
 *   - Clock skew tolerance
 *   - Edge cases (wrong address, corrupted sig, future timestamp)
 */

// @ts-ignore - Vitest types not fully linked in strict mode
// globals: true in vitest.config.ts
import { ethers } from 'ethers';
import {
  verifyEIP191Signature,
  verifySignedPayload,
  enforceLoSValue,
  validateNonce,
  generateNonce,
  safeAddressEqual,
  buildAuthMessage,
} from '@/lib/crypto/eip191-verify';

//  Test fixtures 

let wallet: ethers.Wallet;
let walletAddress: string;
let testMessage: string;
let validSignature: string;

beforeAll(async () => {
  // Deterministic test wallet (DO NOT use in production)
  wallet = new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
  walletAddress = wallet.address;
  testMessage = 'System Network Authentication  test message';
  validSignature = await wallet.signMessage(testMessage);
});

//  verifyEIP191Signature 

describe('verifyEIP191Signature', () => {
  it('accepts a valid EIP-191 signature', () => {
    const result = verifyEIP191Signature(testMessage, validSignature, walletAddress);
    expect(result.valid).toBe(true);
    expect(result.recoveredAddress?.toLowerCase()).toBe(walletAddress.toLowerCase());
  });

  it('rejects signature from wrong signer', async () => {
    const other = ethers.Wallet.createRandom();
    const sig = await other.signMessage(testMessage);
    const result = verifyEIP191Signature(testMessage, sig, walletAddress);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('ADDRESS_MISMATCH');
  });

  it('rejects tampered message', async () => {
    const result = verifyEIP191Signature(
      testMessage + ' [tampered]',
      validSignature,
      walletAddress
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe('ADDRESS_MISMATCH');
  });

  it('rejects malformed signature (too short)', () => {
    const result = verifyEIP191Signature(testMessage, '0xdeadbeef', walletAddress);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('INVALID_SIGNATURE_FORMAT');
  });

  it('rejects signature without 0x prefix', () => {
    const sig = validSignature.slice(2); // remove 0x
    const result = verifyEIP191Signature(testMessage, sig, walletAddress);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('INVALID_SIGNATURE_FORMAT');
  });

  it('is case-insensitive on address comparison', () => {
    const upperResult = verifyEIP191Signature(testMessage, validSignature, walletAddress.toUpperCase());
    const lowerResult = verifyEIP191Signature(testMessage, validSignature, walletAddress.toLowerCase());
    expect(upperResult.valid).toBe(true);
    expect(lowerResult.valid).toBe(true);
  });
});

//  enforceLoSValue 

describe('enforceLoSValue (EIP-2 anti-malleability)', () => {
  it('accepts valid signature with low-s', () => {
    // ethers.Wallet always produces low-s signatures since v5
    expect(enforceLoSValue(validSignature)).toBe(true);
  });

  it('rejects high-s signature', () => {
    // Construct a high-s signature by reflecting s across n
    const sig = ethers.Signature.from(validSignature);
    const n = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
    const highS = (n - BigInt(sig.s)).toString(16).padStart(64, '0');
    const rHex = sig.r.slice(2).padStart(64, '0');
    const vHex = sig.v.toString(16).padStart(2, '0');
    const highSSig = '0x' + rHex + highS + vHex;
    expect(enforceLoSValue(highSSig)).toBe(false);
  });

  it('rejects malformed signature gracefully', () => {
    expect(enforceLoSValue('0xinvalid')).toBe(false);
  });
});

//  safeAddressEqual 

describe('safeAddressEqual (timing-safe)', () => {
  it('returns true for identical addresses', () => {
    expect(safeAddressEqual(walletAddress, walletAddress)).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(safeAddressEqual(walletAddress.toUpperCase(), walletAddress.toLowerCase())).toBe(true);
  });

  it('returns false for different addresses', () => {
    const other = ethers.Wallet.createRandom().address;
    expect(safeAddressEqual(walletAddress, other)).toBe(false);
  });

  it('returns false for invalid length', () => {
    expect(safeAddressEqual(walletAddress, '0x1234')).toBe(false);
  });
});

//  validateNonce 

describe('validateNonce', () => {
  it('accepts valid 64-char hex nonce (256 bits)', () => {
    const nonce = generateNonce();
    expect(nonce).toHaveLength(64);
    expect(validateNonce(nonce)).toBe(true);
  });

  it('rejects short nonce', () => {
    expect(validateNonce('deadbeef')).toBe(false);
  });

  it('rejects nonce with non-hex characters', () => {
    expect(validateNonce('z'.repeat(64))).toBe(false);
  });

  it('rejects empty nonce', () => {
    expect(validateNonce('')).toBe(false);
  });
});

//  verifySignedPayload 

describe('verifySignedPayload', () => {
  it('accepts valid payload within time window', async () => {
    const nonce = generateNonce();
    const timestamp = Date.now();
    const sig = await wallet.signMessage(testMessage);
    const usedNonces = new Set<string>();

    const result = verifySignedPayload(
      { message: testMessage, signature: sig, address: walletAddress, timestamp, nonce },
      30_000,
      usedNonces
    );
    expect(result.valid).toBe(true);
    // Nonce should be consumed
    expect(usedNonces.has(nonce)).toBe(true);
  });

  it('rejects expired payload (> 30s old)', async () => {
    const sig = await wallet.signMessage(testMessage);
    const result = verifySignedPayload(
      { message: testMessage, signature: sig, address: walletAddress, timestamp: Date.now() - 31_000, nonce: 'mock-nonce' },
      30_000
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/PAYLOAD_EXPIRED/);
  });

  it('rejects payload from the future (> 5s clock skew)', async () => {
    const sig = await wallet.signMessage(testMessage);
    const result = verifySignedPayload(
      { message: testMessage, signature: sig, address: walletAddress, timestamp: Date.now() + 10_000, nonce: 'mock-nonce' },
      30_000
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe('PAYLOAD_FROM_FUTURE');
  });

  it('rejects replay: same nonce used twice', async () => {
    const nonce = generateNonce();
    const sig = await wallet.signMessage(testMessage);
    const usedNonces = new Set<string>([nonce]); // pre-consumed

    const result = verifySignedPayload(
      { message: testMessage, signature: sig, address: walletAddress, timestamp: Date.now(), nonce },
      30_000,
      usedNonces
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe('REPLAY_DETECTED: nonce already consumed');
  });

  it('rejects weak nonce (< 256 bits)', async () => {
    const sig = await wallet.signMessage(testMessage);
    const result = verifySignedPayload(
      { message: testMessage, signature: sig, address: walletAddress, timestamp: Date.now(), nonce: 'deadbeef' },
      30_000
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/WEAK_NONCE/);
  });
});

//  buildAuthMessage 

describe('buildAuthMessage', () => {
  it('produces deterministic, canonical message format', () => {
    const nonce = 'a'.repeat(64);
    const issuedAt = '2026-04-28T20:00:00.000Z';
    const msg = buildAuthMessage({
      domain: 'humanityledger.io',
      address: walletAddress,
      nonce,
      issuedAt,
    });
    // Must contain all required fields
    expect(msg).toContain('humanityledger.io');
    expect(msg).toContain(walletAddress);
    expect(msg).toContain(`Nonce: ${nonce}`);
    expect(msg).toContain(`Issued At: ${issuedAt}`);
  });

  it('canonical message round-trips through EIP-191 signing', async () => {
    const nonce = generateNonce();
    const msg = buildAuthMessage({
      domain: 'humanityledger.io',
      address: walletAddress,
      nonce,
      issuedAt: new Date().toISOString(),
    });
    const sig = await wallet.signMessage(msg);
    const result = verifyEIP191Signature(msg, sig, walletAddress);
    expect(result.valid).toBe(true);
  });
});
