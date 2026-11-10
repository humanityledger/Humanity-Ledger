/**
 * lib/security/integrity.ts
 *
 * Verifiable Proving Bundle Integrity & Checksum Verification.
 *
 * Enables clients and third-party auditors to verify that:
 * 1. The client-side proving bundle matches the deterministic build.
 * 2. Noir circuit Abstract Circuit Intermediate Representation (ACIR) and
 *    binary Verification Keys (VKs) match the pinned cryptographic hashes.
 * 3. Prover dependencies adhere to exact pinned versions.
 */

import { PINNED_VK_SHA256, type CircuitName } from '../zk/vk-pins';

export interface ProvingArtifactIntegrity {
  circuit: CircuitName;
  pinnedVkSha256: string;
  compiler: string;
  backend: string;
  curve: string;
}

export interface BundleIntegrityManifest {
  version: string;
  spec: string;
  circuits: Record<CircuitName, ProvingArtifactIntegrity>;
  toolchain: {
    nargo: string;
    barretenberg: string;
    aztecSdk: string;
    noirContracts: string;
  };
  policy: {
    clientProving: string;
    witnessEgress: string;
    storageEncryption: string;
    reproducibleBuilds: string;
  };
}

export const PROVING_INTEGRITY_MANIFEST: BundleIntegrityManifest = Object.freeze({
  version: '1.0.0',
  spec: 'hl-integrity-v1',
  circuits: {
    escrow: {
      circuit: 'escrow' as const,
      pinnedVkSha256: PINNED_VK_SHA256.escrow,
      compiler: 'nargo 1.0.0',
      backend: 'bb.js 5.3.0 UltraHonk',
      curve: 'BN254',
    },
    identity: {
      circuit: 'identity' as const,
      pinnedVkSha256: PINNED_VK_SHA256.identity,
      compiler: 'nargo 1.0.0',
      backend: 'bb.js 5.3.0 UltraHonk',
      curve: 'BN254',
    },
    streams: {
      circuit: 'streams' as const,
      pinnedVkSha256: PINNED_VK_SHA256.streams,
      compiler: 'nargo 1.0.0',
      backend: 'bb.js 5.3.0 UltraHonk',
      curve: 'BN254',
    },
  },
  toolchain: {
    nargo: '1.0.0',
    barretenberg: '5.3.0',
    aztecSdk: '6.0.0',
    noirContracts: '6.0.0',
  },
  policy: {
    clientProving: 'Browser Web Worker via Aztec PXE & bb.js UltraHonk',
    witnessEgress: 'Forbidden: Private witnesses and spending keys never leave client memory',
    storageEncryption: 'Enforced: AES-256 encrypted SQLite over OPFS via EIP-712 HKDF key',
    reproducibleBuilds: 'Enforced: Deterministic ACIR compilation & pinned lockfile (npm ci --ignore-scripts)',
  },
});

/**
 * Returns the public integrity manifest for proving bundles.
 */
export function getProvingIntegrityManifest(): BundleIntegrityManifest {
  return PROVING_INTEGRITY_MANIFEST;
}
