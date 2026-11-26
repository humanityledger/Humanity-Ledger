/**
 * Cooperative scheduling: long loops give the main thread back so taps,
 * typing and scrolling stay responsive (INP). Uses scheduler.yield()
 * (Chrome 129+), then scheduler.postTask, then a MessageChannel macrotask
 * (Safari), never setTimeout(0) clamping.
 */
type Sched = { yield?: () => Promise<void>; postTask?: (cb: () => void, o?: { priority?: string }) => Promise<void> };

let channel: MessageChannel | null = null;
const queue: Array<() => void> = [];
function viaChannel(): Promise<void> {
  if (typeof MessageChannel === 'undefined') return new Promise(r => setTimeout(r, 0));
  if (!channel) { channel = new MessageChannel(); channel.port1.onmessage = () => queue.shift()?.(); }
  return new Promise(r => { queue.push(r); channel!.port2.postMessage(0); });
}

export function yieldToMain(): Promise<void> {
  const s = (globalThis as { scheduler?: Sched }).scheduler;
  if (s?.yield) return s.yield();
  if (s?.postTask) return s.postTask(() => {}, { priority: 'user-visible' });
  return viaChannel();
}

/** Returns a function that yields only when `budgetMs` of work has passed since the last yield. */
export function frameBudget(budgetMs = 8): () => Promise<void> {
  let start = performance.now();
  return async () => {
    if (performance.now() - start < budgetMs) return;
    await yieldToMain();
    start = performance.now();
  };
}
