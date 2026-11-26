/**
 * MemoryObservatory — zero-dependency memory diagnostics.
 * Reads what the browser exposes (performance.memory on Chromium,
 * measureUserAgentSpecificMemory where the page is cross-origin isolated),
 * plus counters the app reports itself: prover runs, LRU caches, blob URLs.
 * Nothing runs on a timer; callers ask for a snapshot.
 */
export interface ProverRun { threads: number; ms: number; steps: number; at: number }
export interface CacheStat { name: string; size: number; capacity: number; bytes?: number; hits: number; misses: number }

const proverRuns: ProverRun[] = [];
const caches = new Map<string, () => CacheStat>();
let liveBlobUrls = 0;

export function recordProverRun(r: Omit<ProverRun, 'at'>): void {
  proverRuns.push({ ...r, at: Date.now() });
  if (proverRuns.length > 20) proverRuns.shift();
}
export function registerCache(name: string, stat: () => CacheStat): void { caches.set(name, stat); }
export function trackBlobUrl(delta: 1 | -1): void { liveBlobUrls = Math.max(0, liveBlobUrls + delta); }

export interface MemorySnapshot {
  jsHeapUsedMb: number | null;
  jsHeapLimitMb: number | null;
  uaSpecificMb: number | null;
  liveBlobUrls: number;
  caches: CacheStat[];
  proverRuns: ProverRun[];
}

const mb = (b: number) => Math.round((b / 1048576) * 10) / 10;

export async function memorySnapshot(): Promise<MemorySnapshot> {
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
    measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>;
  };
  let ua: number | null = null;
  try {
    if ((globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated && perf.measureUserAgentSpecificMemory) {
      ua = mb((await perf.measureUserAgentSpecificMemory()).bytes);
    }
  } catch {}
  return {
    jsHeapUsedMb: perf.memory ? mb(perf.memory.usedJSHeapSize) : null,
    jsHeapLimitMb: perf.memory ? mb(perf.memory.jsHeapSizeLimit) : null,
    uaSpecificMb: ua,
    liveBlobUrls,
    caches: [...caches.values()].map(f => f()),
    proverRuns: [...proverRuns],
  };
}
