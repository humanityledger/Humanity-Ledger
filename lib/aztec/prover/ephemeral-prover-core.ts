/**
 * Pure core of the zero-residency prover (no SDK imports, unit-testable).
 */
export interface ChonkApi<Kind = number> {
  chonkStart(c: { kinds: Kind[] }): Promise<unknown>;
  chonkLoad(c: { circuit: { name: string; bytecode: Uint8Array; verificationKey: Uint8Array }; kind: Kind }): Promise<unknown>;
  chonkAccumulate(c: { witness: Uint8Array }): Promise<unknown>;
  chonkProve(c: Record<string, never>): Promise<{ proof: unknown }>;
  chonkVerify(c: { proof: unknown; vk: Uint8Array }): Promise<{ valid: boolean }>;
  chonkCompressProof(c: { proof: unknown }): Promise<{ compressedProof: Uint8Array }>;
}

export interface StreamStep<Kind = number> { name: string; kind: Kind; vk: Uint8Array; load(): Promise<{ bytecode: Uint8Array; witness: Uint8Array }> }

/**
 * StreamingChonkExecutor — the same bb calls, checks and order as
 * AztecClientBackend.prove (bb.js 6.0.0 backend.js), but only ONE step is
 * inflated at a time: load step i → chonkLoad → chonkAccumulate → drop it →
 * step i+1. The old Promise.all inflated every bytecode and witness at once.
 * Returns the flat proof fields and the compressed proof, byte-identical.
 */
export async function streamChonk<Kind>(
  api: ChonkApi<Kind>,
  steps: StreamStep<Kind>[],
  flatten: (proof: unknown) => Uint8Array[],
  hidingKernelKind: Kind,
  onStep?: (i: number, liveBytes: number) => void,
): Promise<{ proofFields: Uint8Array[]; compressedProof: Uint8Array }> {
  if (!steps.length) throw new Error('No execution steps to prove.');
  const last = steps.length - 1;
  if (steps[last].kind !== hidingKernelKind) throw new Error('Last circuit must be tagged CircuitKind.HidingKernel.');
  steps.forEach((s, i) => { if (!s.vk?.length) throw new Error(`Missing precomputed VK for circuit ${i} (${s.name}).`); });
  await api.chonkStart({ kinds: steps.map(s => s.kind) });
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    // Block scope: this step's inflated buffers are unreachable before the next one is created.
    {
      const { bytecode, witness } = await step.load();
      onStep?.(i, bytecode.byteLength + witness.byteLength);
      await api.chonkLoad({ circuit: { name: step.name, bytecode, verificationKey: step.vk }, kind: step.kind });
      await api.chonkAccumulate({ witness });
    }
  }
  const { proof } = await api.chonkProve({});
  const proofFields = flatten(proof);
  if (!(await api.chonkVerify({ proof, vk: steps[last].vk })).valid) {
    throw new Error('Failed to verify the private (Chonk) transaction proof!');
  }
  const { compressedProof } = await api.chonkCompressProof({ proof });
  return { proofFields, compressedProof };
}

