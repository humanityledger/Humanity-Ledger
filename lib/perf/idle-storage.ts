/**
 * IdleStorageWriter — localStorage.setItem is synchronous disk/IPC on Safari
 * (worst on iOS). Writes are queued per key (last write wins), serialized
 * once, and flushed in an idle period (requestIdleCallback, or a 16 ms timer
 * where Safari lacks it). A synchronous flush runs on pagehide and when the
 * page is hidden, so an iOS tab swipe never loses state. `read` sees queued
 * values, so callers never observe a stale copy.
 */
type Value = string | (() => string);

export class IdleStorageWriter {
  private pending = new Map<string, Value>();
  private scheduled = false;
  public flushes = 0;
  public writes = 0;
  constructor(private readonly storage: () => Storage | undefined = () => { try { return localStorage; } catch { return undefined; } }) {
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => this.flush());
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.flush(); });
    }
  }
  /** Queue a write; pass a function to defer JSON.stringify until the flush. */
  set(key: string, value: Value): void {
    this.writes++;
    this.pending.set(key, value);
    this.schedule();
  }
  remove(key: string): void { this.set(key, '\u0000__remove__'); }
  read(key: string): string | null {
    const v = this.pending.get(key);
    if (v !== undefined) { const s = typeof v === 'function' ? v() : v; return s === '\u0000__remove__' ? null : s; }
    try { return this.storage()?.getItem(key) ?? null; } catch { return null; }
  }
  flush(): void {
    this.scheduled = false;
    if (!this.pending.size) return;
    const s = this.storage();
    const batch = [...this.pending]; this.pending.clear();
    this.flushes++;
    if (!s) return;
    for (const [k, v] of batch) {
      try {
        const str = typeof v === 'function' ? v() : v;
        if (str === '\u0000__remove__') s.removeItem(k); else s.setItem(k, str);
      } catch { /* quota or private mode: dropped, like a failed setItem */ }
    }
  }
  private schedule(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(() => this.flush(), { timeout: 500 }); else setTimeout(() => this.flush(), 16);
  }
}

export const idleStorage = new IdleStorageWriter();
