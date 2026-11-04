/**
 * lib/zk/prover.worker.ts — Web Worker that runs lib/zk/browser-prover.ts off
 * the UI thread (task R-16). Messages:
 *   { id, type: 'prove', circuit, witness }   -> { id, ok: true, proof } | { id, ok: false, error }
 *   { id, type: 'verify', circuit, proof }    -> { id, ok: true, valid }
 * Errors carry the prover's message, which never includes input values.
 */
import { proveInBrowser, verifyInBrowser } from './browser-prover';
import type { CircuitName } from './vk-pins';

type Request =
  | { id: number; type: 'prove'; circuit: CircuitName; witness: any }
  | { id: number; type: 'verify'; circuit: CircuitName; proof: { proof: Uint8Array; publicInputs: string[] } };

// Typed loosely: the app's tsconfig uses the DOM lib, not the WebWorker one.
const ctx = self as unknown as { onmessage: ((e: MessageEvent<Request>) => void) | null; postMessage: (msg: unknown) => void };

ctx.onmessage = async (event: MessageEvent<Request>) => {
  const msg = event.data;
  try {
    if (msg.type === 'prove') {
      const proof = await proveInBrowser(msg.circuit, msg.witness);
      ctx.postMessage({ id: msg.id, ok: true, proof });
    } else if (msg.type === 'verify') {
      ctx.postMessage({ id: msg.id, ok: true, valid: await verifyInBrowser(msg.circuit, msg.proof) });
    }
  } catch (err) {
    ctx.postMessage({ id: msg.id, ok: false, error: err instanceof Error ? err.message : 'Proving failed.' });
  }
};
