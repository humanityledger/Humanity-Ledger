/**
 * One shared, visibility-aware clock. Each period has a single timer for all
 * subscribers; while the page is hidden every timer stops (no background CPU
 * on iOS Safari / Android Chrome), and on return each subscriber runs once at
 * once, then on schedule. Callbacks are isolated: one throwing never stops others.
 */
type Tick = (now: number) => void;
interface Bucket { subs: Set<Tick>; timer: ReturnType<typeof setInterval> | null; background: boolean }

const buckets = new Map<string, Bucket>();
let listening = false;

const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
function run(b: Bucket) {
  const now = Date.now();
  for (const f of [...b.subs]) { try { f(now); } catch (e) { console.warn('[clock] tick failed', e); } }
}
function start(period: number, b: Bucket) {
  if (b.timer || !b.subs.size || (hidden() && !b.background)) return;
  b.timer = setInterval(() => run(b), period);
}
function stop(b: Bucket) { if (b.timer) { clearInterval(b.timer); b.timer = null; } }
function listen() {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  document.addEventListener('visibilitychange', () => {
    for (const [key, b] of buckets) {
      if (b.background) continue;
      if (hidden()) stop(b);
      else { run(b); start(Number(key.split(':')[0]), b); }
    }
  });
}

/** Calls `fn` every `periodMs` while the page is visible (or always, with background: true). Returns unsubscribe. */
export function every(periodMs: number, fn: Tick, opts: { background?: boolean } = {}): () => void {
  const key = `${periodMs}:${opts.background ? 'bg' : 'fg'}`;
  let b = buckets.get(key);
  if (!b) { b = { subs: new Set(), timer: null, background: !!opts.background }; buckets.set(key, b); }
  b.subs.add(fn);
  listen();
  start(periodMs, b);
  return () => {
    const cur = buckets.get(key);
    if (!cur) return;
    cur.subs.delete(fn);
    if (!cur.subs.size) { stop(cur); buckets.delete(key); }
  };
}

/** Live timer count (diagnostics/tests). */
export function activeTimers(): number {
  let n = 0;
  for (const b of buckets.values()) if (b.timer) n++;
  return n;
}
