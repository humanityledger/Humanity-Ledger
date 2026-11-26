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
 *  - threads, SRS size (2^18 on constrained devices, iPadOS included) and a WebAssembly
 *    memory ceiling chosen per device (lib/aztec/prover/threads.ts);
 *  - steps streamed one at a time into bb (streamChonk), never all inflated at once;
 *  - `destroy()` in `finally`: bb.js terminates its worker, and the browser
 *    returns the whole linear memory to the OS — on success, error or abort.
 * Witness generation (ACVM simulator) and every other method are the SDK's own.
 */
import { BBLazyPrivateKernelProver } from '@aztec-labs/bb-prover/client/lazy';
import { Barretenberg, CircuitKind, flattenChonkProofFields } from '@aztec-foundation/bb.js';
import { serializeWitness } from '@aztec-foundation/noir-noirc_abi';
import { ChonkProofWithPublicInputs } from '@aztec-labs/stdlib/proofs';
import { gunzip } from '@/lib/aztec/prover/gunzip';
import { streamChonk, type ChonkApi, type StreamStep } from '@/lib/aztec/prover/ephemeral-prover-core';
import { proverProfile, readProverCaps, SRS_FULL } from '@/lib/aztec/prover/threads';
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

type Kind = Steps[number]['kind'];

const SRS_TOO_SMALL = /srs|crs|points|circuit size|dyadic/i;

export class EphemeralKernelProver extends BBLazyPrivateKernelProver {
  override async createChonkProof(executionSteps: Steps): Promise<ChonkProofWithPublicInputs> {
    const profile = proverProfile(readProverCaps());
    const attempt = async (srsSize: number, memoryMaxPages?: number) => {
      const started = performance.now();
      let peak = 0;
      let barretenberg: Barretenberg | undefined;
      try {
        barretenberg = await Barretenberg.new({ threads: profile.threads, srsSize, ...(memoryMaxPages ? { memory: { maximum: memoryMaxPages } } : {}) });
        const steps: StreamStep<Kind>[] = executionSteps.map(s => ({
          name: s.functionName, kind: s.kind, vk: s.vk,
          load: async () => ({ bytecode: await gunzip(s.bytecode), witness: await gunzip(serializeWitness(s.witness)) }),
        }));
        const result = await streamChonk(barretenberg as unknown as ChonkApi<Kind>, steps, p => flattenChonkProofFields(p as never), CircuitKind.HidingKernel as Kind, (_i, b) => { if (b > peak) peak = b; });
        const proof = ChonkProofWithPublicInputs.fromBufferArray(result.proofFields);
        proof.compressedProof = Buffer.from(result.compressedProof);
        return proof;
      } finally {
        // Terminates bb.js's worker: its WebAssembly memory goes back to the OS now.
        try { await barretenberg?.destroy(); } catch {}
        recordProverRun({ threads: profile.threads, ms: performance.now() - started, steps: executionSteps.length, srsSize, peakStepBytes: peak });
      }
    };
    return withWakeLock(async () => {
      try {
        return await attempt(profile.srsSize, profile.memoryMaxPages);
      } catch (e) {
        // A circuit larger than the small SRS: retry once with the full SRS and no page cap.
        if (profile.srsSize !== SRS_FULL && SRS_TOO_SMALL.test(String((e as Error)?.message ?? e))) return attempt(SRS_FULL);
        throw e;
      }
    });
  }
}

/** The prover handed to EmbeddedWallet.create({ pxe: { proverOrOptions } }). */
export function createEphemeralProver(simulator: ConstructorParameters<typeof BBLazyPrivateKernelProver>[0]): EphemeralKernelProver {
  return new EphemeralKernelProver(simulator);
}
