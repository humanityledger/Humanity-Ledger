/**
 * lib/aztec/verifier.ts
 *
 * Verification key (VK) pinning and lifecycle checks for the three standalone
 * Noir circuits (escrow, identity, streams).
 *
 * What this module checks (master prompt, tasks R-02 and R-03):
 * 1. The binary VK each circuit ships (`circuits/<c>/target/vk`, written by
 *    Barretenberg) has the SHA-256 pinned below. The pin lives in code so that
 *    swapping the file on disk cannot change what is accepted.
 * 2. The metadata file `circuits/<c>/target/<c>.vk.json` carries the same hash.
 * 3. Against a registry the caller supplies, the local hash matches and the
 *    circuit is not RETIRED (DEPRECATED only warns).
 *
 * What it does NOT do: there is no on-chain VK registry deployed. Callers that
 * pass a "registry" today build it themselves; it is not read from any chain.
 *
 * Earlier versions hashed the JSON metadata (which held invented Plonk-style
 * fields) instead of the binary VK, so the "integrity" check never touched the
 * key Barretenberg actually uses.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import escrowVK from '../../circuits/escrow/target/escrow.vk.json';
import streamsVK from '../../circuits/streams/target/streams.vk.json';
import identityVK from '../../circuits/identity/target/identity.vk.json';

export type CircuitName = 'escrow' | 'identity' | 'streams';
export type VKStatus = 'ACTIVE' | 'DEPRECATED' | 'RETIRED';

export interface VKRecord {
  circuit: string;
  localHash: string;
  onChainHash: string | null;
  status: VKStatus;
}

/** A registry entry supplied by the caller. Nothing is read from a chain. */
export interface OnChainCircuitRecord {
  hash: string;
  status: VKStatus;
}

export interface VKMetadata {
  circuit: CircuitName;
  vkSha256: string;
  [key: string]: unknown;
}

/**
 * SHA-256 of each binary VK (`target/vk`), produced by @aztec/bb.js 5.3.0 from
 * the ACIR compiled by nargo 1.0.0. Changing a circuit means recompiling,
 * regenerating the VK (scripts/zk/check-artifacts.mjs --write) and updating
 * these constants in the same commit.
 */
export const PINNED_VK_SHA256: Readonly<Record<CircuitName, string>> = Object.freeze({
  escrow: '0x4e3cc4c8ce03607dcb2b98bd50c0d31084300634ee8f70f4674919682eb915c2',
  identity: '0xcd02d2407de202d61e1a03c360633a9b0cdd8fe4b4d67b007cce108990632194',
  streams: '0xa79000bf70441f02ce5ec092f15771e93dfc3d990977a33de9991795bc374346',
});

export const CIRCUITS: readonly CircuitName[] = Object.freeze(['escrow', 'identity', 'streams']);

/** Metadata files (`target/<c>.vk.json`). They describe the VK; they are not the VK. */
export const LOCAL_CIRCUIT_VKS: Readonly<Record<CircuitName, VKMetadata>> = Object.freeze({
  escrow: escrowVK as VKMetadata,
  identity: identityVK as VKMetadata,
  streams: streamsVK as VKMetadata,
});

function assertCircuit(circuit: string): asserts circuit is CircuitName {
  if (!(CIRCUITS as readonly string[]).includes(circuit)) {
    throw new Error(`[VK VERIFIER] Unknown circuit requested: "${circuit}"`);
  }
}

export function sha256Hex(bytes: Uint8Array): string {
  return `0x${createHash('sha256').update(bytes).digest('hex')}`;
}

/**
 * Deterministic key-sorted JSON hash. Kept as a general utility; it is no
 * longer used for VK integrity (see the module comment).
 */
export function hashVK(vk: object): string {
  const canonical = (obj: unknown): string => {
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return `[${obj.map(canonical).join(',')}]`;
    const record = obj as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(',')}}`;
  };
  return `0x${createHash('sha256').update(canonical(vk)).digest('hex')}`;
}

/** Path of the binary VK Barretenberg wrote for a circuit. */
export function vkBinaryPath(circuit: CircuitName): string {
  return resolve(process.cwd(), 'circuits', circuit, 'target', 'vk');
}

/** Reads the binary VK from disk. */
export function readLocalVKBytes(circuit: string): Uint8Array {
  assertCircuit(circuit);
  return new Uint8Array(readFileSync(vkBinaryPath(circuit)));
}

/** Returns the metadata record for a circuit. */
export function getLocalVK(circuit: string): VKMetadata {
  assertCircuit(circuit);
  return LOCAL_CIRCUIT_VKS[circuit];
}

/** SHA-256 of the binary VK on disk. */
export function getLocalVKHash(circuit: string): string {
  return sha256Hex(readLocalVKBytes(circuit));
}

/**
 * Throws unless the binary VK on disk and the metadata file both match the
 * hash pinned in code.
 */
export function assertLocalVKMatchesPin(circuit: string): string {
  assertCircuit(circuit);
  const pinned = PINNED_VK_SHA256[circuit];
  const onDisk = getLocalVKHash(circuit);
  if (onDisk !== pinned) {
    throw new Error(
      `[VK INTEGRITY] Binary VK for circuit "${circuit}" does not match the pinned hash. ` +
        `On disk: ${onDisk.slice(0, 18)}... Pinned: ${pinned.slice(0, 18)}...`,
    );
  }
  const declared = String(LOCAL_CIRCUIT_VKS[circuit].vkSha256 ?? '').toLowerCase();
  if (declared !== pinned) {
    throw new Error(
      `[VK INTEGRITY] Metadata file for circuit "${circuit}" declares a different VK hash than the pinned one.`,
    );
  }
  return pinned;
}

/**
 * Checks every circuit against a caller-supplied registry.
 *
 * - Throws if the local binary VK does not match its pin.
 * - Throws if a circuit is missing from the registry or its hash differs.
 * - Throws if the circuit is RETIRED; warns if DEPRECATED.
 */
export function assertVKIntegrity(
  registry: Record<string, OnChainCircuitRecord>,
): VKRecord[] {
  const results: VKRecord[] = [];

  for (const circuit of CIRCUITS) {
    const localHash = assertLocalVKMatchesPin(circuit);
    const entry = registry[circuit];

    if (!entry) {
      throw new Error(`[VK INTEGRITY] Circuit "${circuit}" is not in the registry.`);
    }

    const { hash, status } = entry;
    if (!hash || localHash.toLowerCase() !== hash.toLowerCase()) {
      throw new Error(
        `[VK INTEGRITY] Local VK hash for circuit "${circuit}" does not match the registry. ` +
          `Local: ${localHash.slice(0, 18)}... Registry: ${String(hash).slice(0, 18)}...`,
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

    results.push({ circuit, localHash, onChainHash: hash, status });
  }

  return results;
}
