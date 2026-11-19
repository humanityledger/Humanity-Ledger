/**
 * Runs chunk AES off the main thread when the browser allows a module worker.
 * If it does not, sealing still uses Web Crypto on this thread. The bytes
 * and the keys are unchanged either way.
 */
import { setRecordCipher } from '@/vendor/ledger-record/src/index';

type Reply = { id: number; out?: Uint8Array; error?: string };

export function installRecordWorker(): void {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return;
  let worker: Worker;
  try {
    worker = new Worker(new URL('../../vendor/ledger-record/src/worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return;
  }
  let next = 1;
  const pending = new Map<number, { resolve: (b: Uint8Array) => void; reject: (e: Error) => void }>();
  worker.onmessage = (event: MessageEvent<Reply>) => {
    const wait = pending.get(event.data.id);
    if (!wait) return;
    pending.delete(event.data.id);
    if (event.data.out) wait.resolve(event.data.out);
    else wait.reject(new Error(event.data.error || 'chunk'));
  };
  const call = (op: 'encrypt' | 'decrypt', key: Uint8Array, nonce: Uint8Array, data: Uint8Array, aad: Uint8Array) => new Promise<Uint8Array>((resolve, reject) => {
    const id = next++;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, op, key, nonce, data, aad });
  });
  setRecordCipher({
    encrypt: (key, nonce, data, aad) => call('encrypt', key, nonce, data, aad),
    decrypt: (key, nonce, data, aad) => call('decrypt', key, nonce, data, aad),
  });
}
