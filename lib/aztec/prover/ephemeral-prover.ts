/**
 * EphemeralKernelProver — zero-residency Chonk proving for the browser PXE.
 *
 * The SDK prover (BBPrivateKernelProver.createChonkProof) proves through
 * the Barretenberg singleton, which keeps bb.js's WebAssembly worker alive
 * for the life of the tab. WebAssembly memory only grows, never shrinks, so
 * after the first private payment ~1–2 GB stays mapped until the tab closes
 * (or iOS kills it).
 *
 * This subclass changes only createChonkProof:
 *  - a fresh Barretenberg instance per proof (Barretenberg.new, not the singleton);
 *  - threads sized to the device (lib/aztec/prover/threads.ts);
 *  - inputs inflated with the native DecompressionStream just before proving, dropped right after;
 *  - `destroy()` in `finally`: bb.js terminates its worker, and the browser
 *    returns the whole linear memory to the OS — on success, error or abort.
 * Witness generation (ACVM simulator) and every other method are the SDK's own.
 */
import { BBLazyPrivateKernelProver } from '@aztec-labs/bb-prover/client/lazy';
import { AztecClientBackend, Barretenberg } from '@aztec-foundation/bb.js';
import { serializeWitness } from '@aztec-foundation/noir-noirc_abi';
import { ChonkProofWithPublicInputs } from '@aztec-labs/stdlib/proofs';
import { gunzip } from '@/lib/aztec/prover/gunzip';
import { proverThreads, readDeviceCaps } from '@/lib/aztec/prover/threads';
import { recordProverRun } from '@/lib/perf/memory-observatory';

type Steps = Parameters<BBLazyPrivateKernelProver['createChonkProof']>[0];

async function withWakeLock<T>(run: () => Promise<T>): Promise<T> {
  let lock: { release(): Promise<void> } | undefined;
  try {
    const wl = (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock;
    if (wl && document.visibilityState === 'visible') lock = await wl.request('screen');
  } catch { /* not supported or denied: prove anyway */ }
  try { return await run(); } finally { try { await lock?.release(); } catch {} }
}

export class EphemeralKernelProver extends BBLazyPrivateKernelProver {
  override async createChonkProof(executionSteps: Steps): Promise<ChonkProofWithPublicInputs> {
    const threads = proverThreads(readDeviceCaps());
    return withWakeLock(async () => {
      const started = performance.now();
      let barretenberg: Barretenberg | undefined;
      try {
        barretenberg = await Barretenberg.new({ threads });
        let bytecodes: Uint8Array[] | null = await Promise.all(executionSteps.map(s => gunzip(s.bytecode)));
        let witnesses: Uint8Array[] | null = await Promise.all(executionSteps.map(s => gunzip(serializeWitness(s.witness))));
        const backend = new AztecClientBackend(bytecodes, barretenberg, executionSteps.map(s => s.functionName), executionSteps.map(s => s.kind));
        const result = await backend.prove(witnesses, executionSteps.map(s => s.vk), { compress: true });
        bytecodes = null; witnesses = null; // drop the inflated inputs before building the proof object
        const proof = ChonkProofWithPublicInputs.fromBufferArray(result.proofFields);
        proof.compressedProof = result.compressedProof ? Buffer.from(result.compressedProof) : undefined;
        return proof;
      } finally {
        // Terminates bb.js's worker: its WebAssembly memory goes back to the OS now.
        try { await barretenberg?.destroy(); } catch {}
        recordProverRun({ threads, ms: performance.now() - started, steps: executionSteps.length });
      }
    });
  }
}

/** The prover handed to EmbeddedWallet.create({ pxe: { proverOrOptions } }). */
export function createEphemeralProver(simulator: ConstructorParameters<typeof BBLazyPrivateKernelProver>[0]): EphemeralKernelProver {
  return new EphemeralKernelProver(simulator);
}
