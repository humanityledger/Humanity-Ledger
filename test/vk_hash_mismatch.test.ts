import { describe, it, expect, vi } from 'vitest';
import { assertVKIntegrity, getLocalVKHash, type OnChainCircuitRecord } from '../lib/aztec/verifier';

/**
 * VK HASH_MISMATCH Integration Test
 *
 * Normative requirement (Section 4 of alignment document):
 * The client must unconditionally block proof synthesis when the locally
 * compiled VK SHA256 diverges from the on-chain anchored VK.
 *
 * HASH_MISMATCH must be treated identically to RETIRED: no proof can be
 * generated, and no configuration option or feature flag can override this.
 */
describe('VK HASH_MISMATCH Unconditional Block', () => {

  it('HASH_MISMATCH.1: Proof synthesis is blocked when local VK hash does not match on-chain anchor', () => {
    // Simulate a corrupted on-chain registry — hash was tampered post-deployment
    const corruptedEscrowHash = '0x' + 'deadbeef'.repeat(8); // 32 bytes, wrong value
    const registry: Record<string, OnChainCircuitRecord> = {
      escrow: { hash: corruptedEscrowHash, status: 'ACTIVE' },
      streams: { hash: getLocalVKHash('streams'), status: 'ACTIVE' },
      identity: { hash: getLocalVKHash('identity'), status: 'ACTIVE' },
    };

    // assertVKIntegrity must throw — local hash does not match on-chain
    expect(() => assertVKIntegrity(registry)).toThrow(/does not match on-chain registry/);
  });

  it('HASH_MISMATCH.2: A RETIRED VK unconditionally blocks proof synthesis, no override path exists', () => {
    const registry: Record<string, OnChainCircuitRecord> = {
      escrow: { hash: getLocalVKHash('escrow'), status: 'RETIRED' },
      streams: { hash: getLocalVKHash('streams'), status: 'ACTIVE' },
      identity: { hash: getLocalVKHash('identity'), status: 'ACTIVE' },
    };

    expect(() => assertVKIntegrity(registry)).toThrow(
      '[VK INTEGRITY] Circuit "escrow" VK is RETIRED. Proof construction is blocked.',
    );
  });

  it('HASH_MISMATCH.3: Hash mismatch and RETIRED produce identical block outcome (no differential treatment)', () => {
    const mismatchRegistry: Record<string, OnChainCircuitRecord> = {
      escrow: { hash: '0x' + '0'.repeat(64), status: 'ACTIVE' },
      streams: { hash: getLocalVKHash('streams'), status: 'ACTIVE' },
      identity: { hash: getLocalVKHash('identity'), status: 'ACTIVE' },
    };
    const retiredRegistry: Record<string, OnChainCircuitRecord> = {
      escrow: { hash: getLocalVKHash('escrow'), status: 'RETIRED' },
      streams: { hash: getLocalVKHash('streams'), status: 'ACTIVE' },
      identity: { hash: getLocalVKHash('identity'), status: 'ACTIVE' },
    };

    // Both must throw (block proof synthesis)
    expect(() => assertVKIntegrity(mismatchRegistry)).toThrow();
    expect(() => assertVKIntegrity(retiredRegistry)).toThrow();
  });

  it('HASH_MISMATCH.4: DEPRECATED VK within 90-day rollover window permits proving with warning', () => {
    const warnMock = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const registry: Record<string, OnChainCircuitRecord> = {
      escrow: { hash: getLocalVKHash('escrow'), status: 'DEPRECATED' },
      streams: { hash: getLocalVKHash('streams'), status: 'ACTIVE' },
      identity: { hash: getLocalVKHash('identity'), status: 'ACTIVE' },
    };

    // Must NOT throw — DEPRECATED within rollover window allows proving with migration warning
    expect(() => assertVKIntegrity(registry)).not.toThrow();
    expect(warnMock).toHaveBeenCalledWith(
      expect.stringContaining('[VK INTEGRITY] WARNING: Circuit "escrow" VK is DEPRECATED'),
    );

    warnMock.mockRestore();
  });

  it('HASH_MISMATCH.5: All three circuits must be registered — a missing circuit blocks the entire batch', () => {
    const registryMissingStreams: Record<string, OnChainCircuitRecord> = {
      escrow: { hash: getLocalVKHash('escrow'), status: 'ACTIVE' },
      identity: { hash: getLocalVKHash('identity'), status: 'ACTIVE' },
      // streams deliberately absent
    };

    expect(() => assertVKIntegrity(registryMissingStreams)).toThrow(
      'Circuit "streams" is not registered in the on-chain registry.',
    );
  });
});
