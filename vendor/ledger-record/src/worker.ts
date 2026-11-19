/**
 * Chunk AES for the chat. The main thread sends one chunk and waits.
 * Heavy AES-GCM then runs off the UI thread. The protocol code stays the same.
 */
import { aesOpen, aesSeal } from './hex';

type Job = {
  id: number;
  op: 'encrypt' | 'decrypt';
  key: Uint8Array;
  nonce: Uint8Array;
  data: Uint8Array;
  aad: Uint8Array;
};

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<Job>) => void) | null;
  postMessage: (data: unknown, transfer?: Transferable[]) => void;
};

scope.onmessage = async (event) => {
  const job = event.data;
  try {
    const out = job.op === 'encrypt'
      ? await aesSeal(job.key, job.nonce, job.data, job.aad)
      : await aesOpen(job.key, job.nonce, job.data, job.aad);
    scope.postMessage({ id: job.id, out }, [out.buffer]);
  } catch {
    scope.postMessage({ id: job.id, error: 'chunk' });
  }
};
