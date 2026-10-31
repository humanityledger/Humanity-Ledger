/**
 * lib/aztec/verifier.ts
 *
 * Client-Side Verification Key (VK) Hash Assertion & Lifecycle Enforcer.
 *
 * Invariant P4 (Private State Integrity):
 * Prior to generating UltraHonk proofs or constructing note transitions,
 * the client MUST assert that local circuit verification keys match the
 * on-chain registered VK hash anchored under the 14-day timelock.
 *
 * Rules enforced:
 * 1. ACTIVE: Proving permitted if local SHA-256 VK hash matches on-chain commitment.
 * 2. DEPRECATED: Warning issued to client console/UI, migration encouraged, proving allowed.
 * 3. RETIRED: Proof construction is strictly BLOCKED.
 * 4. HASH MISMATCH: Proof construction is strictly BLOCKED with critical error.
 *
 * Authority: docs/PROTOCOL_SPEC.md §8 & docs/VK_MONITORING.md
 */

import { createHash } from 'node:crypto';
import escrowVK from '../../circuits/escrow/target/escrow.vk.json';
import streamsVK from '../../circuits/streams/target/streams.vk.json';
import identityVK from '../../circuits/identity/target/identity.vk.json';

export type VKStatus = 'ACTIVE' | 'DEPRECATED' | 'RETIRED';

export interface VKRecord {
  circuit: string;
  localHash: string;
  onChainHash: string | null;
  status: VKStatus;
}

export interface OnChainCircuitRecord {
  hash: string;
  status: VKStatus;
}

/**
 * Deterministically stringifies an object by sorting its keys recursively.
 * Guarantees consistent hash output across runtime environments regardless
 * of JSON key order.
 */
function canonicalStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalStringify).join(',')}]`;
  }
  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalStringify((obj as Record<string, unknown>)[key])}`,
  );
  return `{${entries.join(',')}}`;
}

/**
 * Computes the canonical SHA-256 hash of a VK JSON artifact.
 *
 * @param vk The verification key artifact object.
 * @returns Hex-encoded SHA-256 digest prefixed with "0x".
 */
export function hashVK(vk: object): string {
  const serialized = canonicalStringify(vk);
  return `0x${createHash('sha256').update(serialized).digest('hex')}`;
}

/**
 * Registry of bundled local verification keys for production circuits.
 */
export const LOCAL_CIRCUIT_VKS: Record<string, object> = Object.freeze({
  escrow: escrowVK,
  streams: streamsVK,
  identity: identityVK,
});

/**
 * Retrieves the local verification key artifact for a given circuit.
 */
export function getLocalVK(circuit: string): object {
  const vk = LOCAL_CIRCUIT_VKS[circuit];
  if (!vk) {
    throw new Error(`[VK VERIFIER] Unknown circuit requested: "${circuit}"`);
  }
  return vk;
}

/**
 * Returns the canonical local hash for a given circuit.
 */
export function getLocalVKHash(circuit: string): string {
  return hashVK(getLocalVK(circuit));
}

/**
 * Asserts that local VK hashes match the on-chain registry commitments.
 *
 * - Throws on hash mismatch.
 * - Throws if the circuit is marked RETIRED.
 * - Issues a console warning if the circuit is DEPRECATED.
 * - Returns an array of validated VKRecords upon success.
 *
 * @param onChainRegistry Map of circuit name to on-chain hash & status
 */
export function assertVKIntegrity(
  onChainRegistry: Record<string, OnChainCircuitRecord>,
): VKRecord[] {
  const results: VKRecord[] = [];

  for (const [circuit, vk] of Object.entries(LOCAL_CIRCUIT_VKS)) {
    const localHash = hashVK(vk);
    const onChain = onChainRegistry[circuit];

    if (!onChain) {
      // If the registry does not contain an entry for this circuit, block proving
      throw new Error(
        `[VK INTEGRITY] CRITICAL: Circuit "${circuit}" is not registered in the on-chain registry.`,
      );
    }

    const { hash: onChainHash, status } = onChain;

    // Normalizing hex hashes for comparison (case-insensitive)
    const normalizedLocal = localHash.toLowerCase();
    const normalizedOnChain = onChainHash.toLowerCase();

    if (normalizedOnChain && normalizedLocal !== normalizedOnChain) {
      throw new Error(
        `[VK INTEGRITY] CRITICAL: Local VK hash for circuit "${circuit}" does not match on-chain registry. ` +
          `Local: ${localHash.slice(0, 18)}... On-chain: ${onChainHash.slice(0, 18)}...`,
      );
    }

    if (status === 'RETIRED') {
      throw new Error(
        `[VK INTEGRITY] Circuit "${circuit}" VK is RETIRED. ` +
          `Proof construction is blocked. Please update the application.`,
      );
    }

    if (status === 'DEPRECATED') {
      console.warn(
        `[VK INTEGRITY] WARNING: Circuit "${circuit}" VK is DEPRECATED. ` +
          `Please migrate to the new circuit version before the retirement date.`,
      );
    }

    results.push({
      circuit,
      localHash,
      onChainHash,
      status,
    });
  }

  return results;
}
