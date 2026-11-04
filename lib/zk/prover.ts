/**
 * lib/zk/prover.ts
 *
 * UltraHonk proving and verification for the three standalone Noir circuits
 * (escrow, identity, streams), using @noir-lang/noir_js to execute the ACIR and
 * @aztec/bb.js (Barretenberg) to prove over BN254.
 *
 * Status: experimental, Node only (it reads artifacts with node:fs), used by
 * tests and scripts, not by the app. The circuits have known soundness issues
 * (docs/zk/MASTER_PROMPT.md, ZK-01 to ZK-07); a valid proof here is NOT an
 * authorisation to move value.
 *
 * Rules applied (master prompt, "Barretenberg y probador TypeScript", task R-03):
 * 1. Inputs are `string` or `bigint` only. A JS `number` above 2^53 is already
 *    corrupted before it can be checked, so numbers are refused.
 * 2. Field inputs must lie in [0, r) (BN254 scalar field); integer inputs within
 *    the range of their Noir type. Errors name the input, never its value.
 * 3. The VK is pinned: before proving or verifying, the VK Barretenberg derives
 *    from the bytecode on disk must hash to the constant in lib/aztec/verifier.ts.
 *    A swapped artifact makes `verifyProof` return false.
 * 4. Any failure inside verification (malformed bytes, WASM abort) returns false.
 * 5. Witnesses and private inputs are never logged.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PINNED_VK_SHA256, sha256Hex, type CircuitName } from '../aztec/verifier';

import {
  BN254_SCALAR_MODULUS,
  escrowInputs,
  identityInputs,
  streamsInputs,
  validateFieldElement,
  validateUnsigned,
  type EscrowWitness,
  type IdentityWitness,
  type StreamsWitness,
  type ZkInput,
} from './inputs';

export { BN254_SCALAR_MODULUS, validateFieldElement, validateUnsigned };
export type { EscrowWitness, IdentityWitness, StreamsWitness, ZkInput };


export interface UltraHonkProofResult {
  circuit: CircuitName;
  proof: Uint8Array;
  proofHex: string;
  publicInputs: string[];
  vkHash: string;
  isValid: boolean;
  provingTimeMs: number;
}

export interface CircuitArtifact {
  bytecode: string;
  [key: string]: unknown;
}

// ─── Barretenberg instance ────────────────────────────────────────────────────

let bbApiInstance: any = null;

async function getBarretenbergApi() {
  if (!bbApiInstance) {
    const { Barretenberg } = await import('@aztec/bb.js');
    bbApiInstance = await Barretenberg.new();
  }
  return bbApiInstance;
}

/** Frees the Barretenberg WASM instance. Call it when a long session ends. */
export async function destroyZkEngine(): Promise<void> {
  if (bbApiInstance) {
    await bbApiInstance.destroy();
    bbApiInstance = null;
  }
}

// ─── Artifacts and pinned VK (rule 3) ─────────────────────────────────────────

/** Loads the compiled ACIR artifact for a circuit from disk. */
export function loadCircuitArtifact(circuitName: CircuitName): CircuitArtifact {
  const possiblePaths = [
    resolve(process.cwd(), `circuits/${circuitName}/target/zk_${circuitName}.json`),
    resolve(process.cwd(), `circuits/${circuitName}/target/${circuitName}.json`),
  ];
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, 'utf8'));
    }
  }
  throw new Error(`Compiled ACIR artifact for circuit "${circuitName}" not found. Run "nargo compile" first.`);
}

async function backendFor(circuitName: CircuitName, artifact: CircuitArtifact) {
  const { UltraHonkBackend } = await import('@aztec/bb.js');
  const api = await getBarretenbergApi();
  return new UltraHonkBackend(artifact.bytecode, api);
}

/** SHA-256 of the VK Barretenberg derives for this backend. */
async function derivedVkHash(backend: any): Promise<string> {
  const vk: Uint8Array = await backend.getVerificationKey();
  return sha256Hex(vk);
}

async function assertPinnedBackend(circuitName: CircuitName, backend: any): Promise<string> {
  const hash = await derivedVkHash(backend);
  if (hash !== PINNED_VK_SHA256[circuitName]) {
    throw new Error(
      `[ZK PROVER] The artifact for circuit "${circuitName}" does not produce the pinned verification key.`,
    );
  }
  return hash;
}

// ─── Proving ──────────────────────────────────────────────────────────────────

async function prove(
  circuitName: CircuitName,
  inputs: Record<string, string | boolean>,
): Promise<UltraHonkProofResult> {
  const start = performance.now();
  const artifact = loadCircuitArtifact(circuitName);
  const backend = await backendFor(circuitName, artifact);
  const vkHash = await assertPinnedBackend(circuitName, backend);

  const { Noir } = await import('@noir-lang/noir_js');
  const noir = new Noir(artifact as any);
  const { witness } = await noir.execute(inputs);
  const proof = await backend.generateProof(witness);
  const isValid = await backend.verifyProof(proof);

  return {
    circuit: circuitName,
    proof: proof.proof,
    proofHex: '0x' + Buffer.from(proof.proof).toString('hex'),
    publicInputs: proof.publicInputs.map((f: any) =>
      typeof f === 'string' ? f : '0x' + Buffer.from(f).toString('hex'),
    ),
    vkHash,
    isValid,
    provingTimeMs: Math.round(performance.now() - start),
  };
}

/** Proves the escrow release circuit. */
export async function proveEscrow(w: EscrowWitness): Promise<UltraHonkProofResult> {
  return prove('escrow', escrowInputs(w));
}

/** Proves the identity circuit. */
export async function proveIdentity(w: IdentityWitness): Promise<UltraHonkProofResult> {
  return prove('identity', identityInputs(w));
}

/** Proves the stream withdrawal circuit. */
export async function proveStreams(w: StreamsWitness): Promise<UltraHonkProofResult> {
  return prove('streams', streamsInputs(w));
}

// ─── Verification (rules 3 and 4) ─────────────────────────────────────────────

/**
 * Verifies a proof against a given artifact, rejecting it unless the artifact
 * yields the pinned VK. Exposed so tests can show that a swapped artifact fails.
 */
export async function verifyProofWithArtifact(
  circuitName: CircuitName,
  artifact: CircuitArtifact,
  proof: { proof: Uint8Array; publicInputs: any[] },
): Promise<boolean> {
  try {
    const backend = await backendFor(circuitName, artifact);
    if ((await derivedVkHash(backend)) !== PINNED_VK_SHA256[circuitName]) {
      return false;
    }
    return Boolean(await backend.verifyProof(proof));
  } catch {
    // Malformed proof, unparseable point or WASM abort: rejected, never thrown.
    return false;
  }
}

/** Verifies a proof against the circuit artifact on disk and the pinned VK. */
export async function verifyProof(
  circuitName: CircuitName,
  proof: { proof: Uint8Array; publicInputs: any[] },
): Promise<boolean> {
  try {
    return await verifyProofWithArtifact(circuitName, loadCircuitArtifact(circuitName), proof);
  } catch {
    return false;
  }
}
