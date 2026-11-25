/**
 * lib/zk/browser-prover.ts — master prompt task R-16.
 *
 * Browser-safe UltraHonk proving for the three standalone Noir circuits, meant
 * to run inside a Web Worker (lib/zk/prover.worker.ts) so proving never blocks
 * the UI thread.
 *
 * - No node:fs / node:crypto / node:path: the ACIR is imported statically from
 *   the committed artifacts and hashed with Web Crypto.
 * - The VK Barretenberg derives from that ACIR must hash to the pin in
 *   lib/zk/vk-pins.ts before anything is proved or verified.
 * - Inputs go through lib/zk/inputs.ts (strings/bigints, field and range
 *   checks); errors never contain input values.
 *
 * Status: same as lib/zk/prover.ts. The circuits have known soundness issues
 * (docs/zk/MASTER_PROMPT.md, ZK-01 to ZK-07); the app does not use these
 * proofs to authorise value.
 */
import escrowArtifact from '../../circuits/escrow/target/zk_escrow.json';
import identityArtifact from '../../circuits/identity/target/zk_identity.json';
import streamsArtifact from '../../circuits/streams/target/zk_streams.json';
import { PINNED_VK_SHA256, type CircuitName } from './vk-pins';
import {
  escrowInputs,
  identityInputs,
  streamsInputs,
  type CircuitInputs,
  type EscrowWitness,
  type IdentityWitness,
  type StreamsWitness,
} from './inputs';

interface Artifact {
  bytecode: string;
  [k: string]: unknown;
}

const ARTIFACTS: Readonly<Record<CircuitName, Artifact>> = Object.freeze({
  escrow: escrowArtifact as unknown as Artifact,
  identity: identityArtifact as unknown as Artifact,
  streams: streamsArtifact as unknown as Artifact,
});

export interface BrowserProof {
  circuit: CircuitName;
  proof: Uint8Array;
  publicInputs: string[];
  vkHash: string;
  provingTimeMs: number;
}

export type WitnessFor<C extends CircuitName> = C extends 'escrow'
  ? EscrowWitness
  : C extends 'identity'
    ? IdentityWitness
    : StreamsWitness;

export function toHex(bytes: Uint8Array): string {
  let s = '0x';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

/** SHA-256 with Web Crypto (available in browsers, workers and Node >= 19). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return toHex(new Uint8Array(digest));
}

let api: any = null;
async function barretenberg() {
  if (!api) {
    const { Barretenberg } = await import('@aztec/bb.js');
    api = await Barretenberg.new();
  }
  return api;
}

/** Frees the Barretenberg WASM instance. */
export async function destroyBrowserProver(): Promise<void> {
  if (api) {
    await api.destroy();
    api = null;
  }
}

async function pinnedBackend(circuit: CircuitName, artifact: Artifact = ARTIFACTS[circuit]) {
  const { UltraHonkBackend } = await import('@aztec/bb.js');
  const backend = new UltraHonkBackend(artifact.bytecode, await barretenberg());
  const vkHash = await sha256Hex(await backend.getVerificationKey());
  return { backend, vkHash, pinned: vkHash === PINNED_VK_SHA256[circuit] };
}

function inputsFor(circuit: CircuitName, witness: unknown): CircuitInputs {
  if (circuit === 'escrow') return escrowInputs(witness as EscrowWitness);
  if (circuit === 'identity') return identityInputs(witness as IdentityWitness);
  if (circuit === 'streams') return streamsInputs(witness as StreamsWitness);
  throw new Error('[ZK PROVER] Unknown circuit.');
}

/** Proves `circuit` from a witness; refuses if the artifact's VK is not the pinned one. */
export async function proveInBrowser<C extends CircuitName>(circuit: C, witness: WitnessFor<C>): Promise<BrowserProof> {
  const start = performance.now();
  const inputs = inputsFor(circuit, witness);
  const { backend, vkHash, pinned } = await pinnedBackend(circuit);
  if (!pinned) {
    throw new Error(`[ZK PROVER] The artifact for circuit "${circuit}" does not produce the pinned verification key.`);
  }
  const { Noir } = await import('@noir-lang/noir_js');
  const { witness: solved } = await new Noir(ARTIFACTS[circuit] as any).execute(inputs);
  const proof = await backend.generateProof(solved);
  return {
    circuit,
    proof: proof.proof,
    publicInputs: proof.publicInputs.map((f: any) => (typeof f === 'string' ? f : toHex(f))),
    vkHash,
    provingTimeMs: Math.round(performance.now() - start),
  };
}

/**
 * Verifies a proof against the pinned VK. Returns false (never throws) for a
 * malformed proof, a WASM abort or an artifact whose VK is not pinned.
 * `artifact` is only for tests that show a swapped artifact is rejected.
 */
export async function verifyInBrowser(
  circuit: CircuitName,
  proof: { proof: Uint8Array; publicInputs: string[] },
  artifact?: Artifact,
): Promise<boolean> {
  try {
    const { backend, pinned } = await pinnedBackend(circuit, artifact);
    if (!pinned) return false;
    return Boolean(await backend.verifyProof(proof));
  } catch {
    return false;
  }
}

export const BROWSER_ARTIFACTS = ARTIFACTS;
