/**
 * lib/zk/prover-client.ts — main-thread handle to lib/zk/prover.worker.ts (R-16).
 *
 *   const prover = createProverClient();
 *   const proof = await prover.prove('streams', witness);
 *   const ok = await prover.verify('streams', proof);
 *   prover.terminate();
 */
import type { BrowserProof, WitnessFor } from './browser-prover';
import type { CircuitName } from './vk-pins';

export interface ProverClient {
  prove<C extends CircuitName>(circuit: C, witness: WitnessFor<C>): Promise<BrowserProof>;
  verify(circuit: CircuitName, proof: { proof: Uint8Array; publicInputs: string[] }): Promise<boolean>;
  terminate(): void;
}

export function createProverClient(): ProverClient {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    throw new Error('The browser prover needs Web Workers.');
  }
  const worker = new Worker(new URL('./prover.worker.ts', import.meta.url), { type: 'module' });
  let next = 0;
  const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  worker.onmessage = (e: MessageEvent<any>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.ok) p.resolve(e.data.proof ?? e.data.valid);
    else p.reject(new Error(e.data.error));
  };
  worker.onerror = () => {
    for (const p of pending.values()) p.reject(new Error('The prover worker stopped.'));
    pending.clear();
  };
  const call = <T>(msg: object) =>
    new Promise<T>((resolve, reject) => {
      const id = ++next;
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, ...msg });
    });
  return {
    prove: (circuit, witness) => call({ type: 'prove', circuit, witness }),
    verify: (circuit, proof) => call({ type: 'verify', circuit, proof }),
    terminate: () => {
      worker.terminate();
      for (const p of pending.values()) p.reject(new Error('The prover was closed.'));
      pending.clear();
    },
  };
}
