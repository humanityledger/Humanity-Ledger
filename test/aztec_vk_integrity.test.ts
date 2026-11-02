import { describe, it, expect, vi } from 'vitest';
import {
  hashVK,
  getLocalVK,
  getLocalVKHash,
  assertVKIntegrity,
  LOCAL_CIRCUIT_VKS,
  type OnChainCircuitRecord,
} from '../lib/aztec/verifier';

describe('Task T6 / Invariant P4 — Aztec Verification Key Integrity & Lifecycle Verifier', () => {
  it('Has all 3 production circuits registered in local VK bundle', () => {
    expect(Object.keys(LOCAL_CIRCUIT_VKS).sort()).toEqual(['escrow', 'identity', 'streams']);
    expect(getLocalVK('escrow')).toBeDefined();
    expect(getLocalVK('streams')).toBeDefined();
    expect(getLocalVK('identity')).toBeDefined();
  });

  it('Throws when querying an unknown circuit', () => {
    expect(() => getLocalVK('nonexistent_circuit')).toThrow(
      '[VK VERIFIER] Unknown circuit requested: "nonexistent_circuit"',
    );
  });

  it('hashVK produces deterministic digests regardless of object property ordering', () => {
    const objA = { z: 1, a: 'test', nested: { b: 2, a: 1 } };
    const objB = { a: 'test', z: 1, nested: { a: 1, b: 2 } };

    const hashA = hashVK(objA);
    const hashB = hashVK(objB);

    expect(hashA).toBe(hashB);
    expect(hashA.startsWith('0x')).toBe(true);
    expect(hashA.length).toBe(66); // 0x + 64 hex chars
  });

  it('assertVKIntegrity succeeds when all on-chain hashes match local hashes with ACTIVE status', () => {
    const registry: Record<string, OnChainCircuitRecord> = {
      escrow: { hash: getLocalVKHash('escrow'), status: 'ACTIVE' },
      streams: { hash: getLocalVKHash('streams'), status: 'ACTIVE' },
      identity: { hash: getLocalVKHash('identity'), status: 'ACTIVE' },
    };

    const results = assertVKIntegrity(registry);
    expect(results).toHaveLength(3);
    for (const record of results) {
      expect(record.status).toBe('ACTIVE');
      expect(record.localHash.toLowerCase()).toBe(record.onChainHash?.toLowerCase());
    }
  });

  it('assertVKIntegrity throws when a circuit hash does not match on-chain registry', () => {
    const corruptedHash = '0x' + '0'.repeat(64);
    const registry: Record<string, OnChainCircuitRecord> = {
      escrow: { hash: corruptedHash, status: 'ACTIVE' },
      streams: { hash: getLocalVKHash('streams'), status: 'ACTIVE' },
      identity: { hash: getLocalVKHash('identity'), status: 'ACTIVE' },
    };

    expect(() => assertVKIntegrity(registry)).toThrow(/does not match on-chain registry/);
  });

  it('assertVKIntegrity throws when an active circuit is missing from the on-chain registry', () => {
    const partialRegistry: Record<string, OnChainCircuitRecord> = {
      escrow: { hash: getLocalVKHash('escrow'), status: 'ACTIVE' },
      // streams is missing
      identity: { hash: getLocalVKHash('identity'), status: 'ACTIVE' },
    };

    expect(() => assertVKIntegrity(partialRegistry)).toThrow(
      'Circuit "streams" is not registered in the on-chain registry.',
    );
  });

  it('assertVKIntegrity emits a warning and allows proving for DEPRECATED VKs', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const registry: Record<string, OnChainCircuitRecord> = {
      escrow: { hash: getLocalVKHash('escrow'), status: 'DEPRECATED' },
      streams: { hash: getLocalVKHash('streams'), status: 'ACTIVE' },
      identity: { hash: getLocalVKHash('identity'), status: 'ACTIVE' },
    };

    const results = assertVKIntegrity(registry);
    expect(results).toHaveLength(3);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[VK INTEGRITY] WARNING: Circuit "escrow" VK is DEPRECATED'),
    );

    warnSpy.mockRestore();
  });

  it('assertVKIntegrity strictly blocks proof construction for RETIRED VKs', () => {
    const registry: Record<string, OnChainCircuitRecord> = {
      escrow: { hash: getLocalVKHash('escrow'), status: 'RETIRED' },
      streams: { hash: getLocalVKHash('streams'), status: 'ACTIVE' },
      identity: { hash: getLocalVKHash('identity'), status: 'ACTIVE' },
    };

    expect(() => assertVKIntegrity(registry)).toThrow(
      '[VK INTEGRITY] Circuit "escrow" VK is RETIRED. Proof construction is blocked.',
    );
  });
});
