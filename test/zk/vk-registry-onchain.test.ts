/**
 * Off-chain side of the on-chain VK registry (R-19).
 *
 * The contract itself is tested with Hardhat in
 * test/ZKVerificationKeyRegistry.test.ts; here the reader is injected so the
 * mapping from registry records to the integrity check is tested without a
 * chain.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { ethers } from 'ethers';
import {
  PINNED_VK_SHA256,
  CIRCUITS,
  circuitRegistryId,
  readVKRegistry,
  assertVKIntegrityOnChain,
  type RegistryReader,
} from '../../lib/aztec/verifier';

function readerFrom(records: Record<string, { vkHash: string; status: number }>): RegistryReader {
  return async (id) => records[id] ?? { vkHash: ethers.ZeroHash, status: 0 };
}

function allActive() {
  const r: Record<string, { vkHash: string; status: number }> = {};
  for (const c of CIRCUITS) r[circuitRegistryId(c)] = { vkHash: PINNED_VK_SHA256[c], status: 1 };
  return r;
}

describe('on-chain VK registry check', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('uses keccak256("hl.<circuit>.v1") as circuit id, as the Hardhat test does', () => {
    expect(circuitRegistryId('escrow')).toBe(ethers.keccak256(ethers.toUtf8Bytes('hl.escrow.v1')));
    expect(circuitRegistryId('streams', 'v2')).toBe(ethers.id('hl.streams.v2'));
  });

  it('accepts the local VKs when every pinned hash is active on chain', async () => {
    const records = await assertVKIntegrityOnChain({ reader: readerFrom(allActive()) });
    expect(records.map((r) => r.circuit)).toEqual([...CIRCUITS]);
    expect(records.every((r) => r.status === 'ACTIVE')).toBe(true);
  });

  it('rejects when the registry holds a different hash', async () => {
    const r = allActive();
    r[circuitRegistryId('identity')] = { vkHash: ethers.id('other-vk'), status: 1 };
    await expect(assertVKIntegrityOnChain({ reader: readerFrom(r) })).rejects.toThrow('does not match the registry');
  });

  it('rejects a revoked key as RETIRED', async () => {
    const r = allActive();
    r[circuitRegistryId('escrow')].status = 2;
    const map = await readVKRegistry(readerFrom(r));
    expect(map.escrow.status).toBe('RETIRED');
    await expect(assertVKIntegrityOnChain({ reader: readerFrom(r) })).rejects.toThrow('RETIRED');
  });

  it('rejects a circuit that was never registered', async () => {
    const r = allActive();
    delete r[circuitRegistryId('streams')];
    await expect(assertVKIntegrityOnChain({ reader: readerFrom(r) })).rejects.toThrow('is not in the registry.');
  });

  it('throws, rather than passing, when no registry is configured', async () => {
    delete process.env.ZK_VK_REGISTRY_ADDRESS;
    delete process.env.ZK_VK_REGISTRY_RPC_URL;
    await expect(assertVKIntegrityOnChain()).rejects.toThrow('No on-chain VK registry is configured');
  });
});
