/// <reference lib="webworker" />
/** Proof of work for G8 HumanGate, off the main thread: sha256(seed ":" n) with `difficulty` leading zero bits. */
import { leadingZeroBits } from '@/lib/g8/humanGateMath';

self.onmessage = async (e: MessageEvent<{ seedHex: string; difficulty: number }>) => {
  const { seedHex, difficulty } = e.data;
  const enc = new TextEncoder();
  for (let n = 0; n < 50_000_000; n++) {
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`${seedHex}:${n}`)));
    if (leadingZeroBits(h) >= difficulty) { (self as unknown as Worker).postMessage({ nonce: String(n) }); return; }
  }
  (self as unknown as Worker).postMessage({ error: 'exhausted' });
};
