/**
 * lib/security/integrity.ts — what the product proves with, published at GET /api/security/integrity.
 *
 * Path A of Aztec: value moves only through aztec-nr contracts and the standard Token. Notes,
 * network nullifiers and private functions; the proof of each transaction is made on the user's
 * device by the PXE that runs in the browser. Each contract is listed with the SHA-256 of its
 * committed artifact (lib/aztec/artifact-pins.ts, checked by test/unit/aztec/artifact-pins.test.ts),
 * so anyone can compare what the app ships with what the repository compiles.
 *
 * The standalone Noir circuits (escrow, identity, streams, v1 and v2) had known soundness issues
 * ZK-01 to ZK-07 and no on-chain verifier holding state. They were retired on 25 November 2026
 * to archive/standalone-circuits and are listed here as retired, with no pins: nothing proves or
 * verifies with them.
 *
 * Where each contract runs is not decided here: deployments/aztec-testnet.json and
 * deployments/aztec-mainnet.json record it, with transaction hashes.
 */
import { AZTEC_ARTIFACT_PINS, type ArtifactPin } from '../aztec/artifact-pins';

export interface IntegrityManifest {
  version: string;
  spec: string;
  model: string;
  contracts: readonly ArtifactPin[];
  deploymentRecords: readonly string[];
  retired: readonly { name: string; path: string; reason: string; date: string }[];
  toolchain: {
    aztec: string;
    noir: string;
    proving: string;
  };
  policy: {
    clientProving: string;
    witnessEgress: string;
    externalAudit: string;
  };
}

const noirVersions = [...new Set(AZTEC_ARTIFACT_PINS.map((p) => p.noirVersion).filter(Boolean))];

export const INTEGRITY_MANIFEST: IntegrityManifest = Object.freeze({
  version: '2.0.0',
  spec: 'hl-integrity-v2',
  model: 'Aztec Path A: aztec-nr contracts, notes, network nullifiers, private functions',
  contracts: AZTEC_ARTIFACT_PINS,
  deploymentRecords: ['deployments/aztec-mainnet.json', 'deployments/aztec-testnet.json'],
  retired: [
    {
      name: 'Standalone Noir circuits v1 and v2 (escrow, identity, streams) and their prover and VK registry',
      path: 'archive/standalone-circuits',
      reason: 'Known soundness issues ZK-01 to ZK-07; no on-chain verifier holding state; replaced by aztec-nr contracts',
      date: '2026-11-25',
    },
  ],
  toolchain: {
    aztec: '6.0.0',
    noir: noirVersions.join(', ') || 'unknown',
    proving: 'Aztec PXE in the browser (Barretenberg)',
  },
  policy: {
    clientProving: 'Every private transaction is proved on the user device by the PXE in the browser',
    witnessEgress: 'Private inputs and spending keys never leave the device',
    externalAudit: 'No external audit report yet; one begins on 25 November 2026',
  },
});

/** The public integrity manifest. */
export function getIntegrityManifest(): IntegrityManifest {
  return INTEGRITY_MANIFEST;
}
