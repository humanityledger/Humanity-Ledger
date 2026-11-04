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
 * 4. Against the on-chain registry (contracts/ZKVerificationKeyRegistry.sol,
 *    task R-19), read through `readVKRegistry` / `assertVKIntegrityOnChain`.
 *    The contract is written and tested but NOT deployed to any network yet,
 *    so `assertVKIntegrityOnChain` throws until ZK_VK_REGISTRY_ADDRESS and
 *    ZK_VK_REGISTRY_RPC_URL point at a deployment. It never falls back to
 *    "accepted".
 *
 * Earlier versions hashed the JSON metadata (which held invented Plonk-style
 * fields) instead of the binary VK, so the "integrity" check never touched the
 * key Barretenberg actually uses.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ethers } from 'ethers';
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

// ─── On-chain registry (contracts/ZKVerificationKeyRegistry.sol) ───────────

/** Minimal ABI of ZKVerificationKeyRegistry used by the off-chain check. */
export const VK_REGISTRY_ABI = [
  'function getVK(bytes32 circuitId) view returns (bytes32 vkHash, uint8 status, uint64 activatedAt)',
  'function isAccepted(bytes32 circuitId, bytes32 vkHash) view returns (bool)',
] as const;

/** Registry status codes (enum Status in the contract). */
const REGISTRY_STATUS = { NONE: 0, ACTIVE: 1, REVOKED: 2 } as const;

/** Circuit id used by the registry: keccak256("hl.<circuit>.<version>"). */
export function circuitRegistryId(circuit: CircuitName, version = 'v1'): string {
  return ethers.id(`hl.${circuit}.${version}`);
}

/** Reads one registry entry; injectable so the mapping can be tested without a chain. */
export type RegistryReader = (circuitId: string) => Promise<{ vkHash: string; status: number }>;

export interface RegistryLocation {
  rpcUrl: string;
  address: string;
}

/** A reader backed by a JSON-RPC endpoint. */
export function rpcRegistryReader({ rpcUrl, address }: RegistryLocation): RegistryReader {
  if (!ethers.isAddress(address)) {
    throw new Error('[VK REGISTRY] The registry address is not a valid address.');
  }
  const contract = new ethers.Contract(address, VK_REGISTRY_ABI, new ethers.JsonRpcProvider(rpcUrl));
  return async (circuitId) => {
    const [vkHash, status] = await contract.getVK(circuitId);
    return { vkHash: String(vkHash), status: Number(status) };
  };
}

/**
 * Builds the registry map `assertVKIntegrity` expects from the on-chain
 * records. A circuit that was never registered is left out (so the integrity
 * check reports it as missing); a revoked key maps to RETIRED.
 */
export async function readVKRegistry(
  reader: RegistryReader,
  version = 'v1',
): Promise<Record<string, OnChainCircuitRecord>> {
  const registry: Record<string, OnChainCircuitRecord> = {};
  for (const circuit of CIRCUITS) {
    const { vkHash, status } = await reader(circuitRegistryId(circuit, version));
    if (status === REGISTRY_STATUS.ACTIVE) registry[circuit] = { hash: vkHash, status: 'ACTIVE' };
    else if (status === REGISTRY_STATUS.REVOKED) registry[circuit] = { hash: vkHash, status: 'RETIRED' };
  }
  return registry;
}

/**
 * Checks the local VKs against the on-chain registry. Throws when no
 * registry is configured: absence of a registry is not a pass.
 */
export async function assertVKIntegrityOnChain(
  options: { reader?: RegistryReader; location?: RegistryLocation } = {},
): Promise<VKRecord[]> {
  let reader = options.reader;
  if (!reader) {
    const location = options.location ?? {
      rpcUrl: process.env.ZK_VK_REGISTRY_RPC_URL ?? '',
      address: process.env.ZK_VK_REGISTRY_ADDRESS ?? '',
    };
    if (!location.rpcUrl || !location.address) {
      throw new Error(
        '[VK REGISTRY] No on-chain VK registry is configured (ZK_VK_REGISTRY_ADDRESS, ZK_VK_REGISTRY_RPC_URL). ' +
          'The registry contract is not deployed yet.',
      );
    }
    reader = rpcRegistryReader(location);
  }
  return assertVKIntegrity(await readVKRegistry(reader));
}
