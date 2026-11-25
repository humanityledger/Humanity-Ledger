/**
 * lib/dashboard/live.ts — how the dashboard keeps its numbers live without lying about them.
 *
 * One LiveSource per thing that can change while the page is open: the node's block height, the
 * private wallet's notes (balances and activity), Fee Juice. Each source:
 *
 *   - reads on a fixed interval while the page is visible, and stops while it is hidden;
 *   - after a failure, retries quietly with a doubling delay (base interval / 4, then ×2, capped),
 *     and keeps showing the last good value with its age instead of blanking it;
 *   - reads at once when the browser comes back online, when the page becomes visible again,
 *     or when the person asks (kick);
 *   - never runs two reads at the same time, and lets a caller skip a read (the wallet is proving).
 *
 * Every read is a call the caller injects (`read`). In the dashboard those calls are methods of the
 * private wallet that already runs in this tab (lib/aztec/wallet/client.ts): `networkStatus()` reads
 * the Aztec node, `refresh()` asks the PXE in this browser for balances and decrypted activity,
 * `refreshFeeJuice()` reads public Fee Juice state. None of them calls a Ledger Chat server, and this
 * file has no network API of its own (test/unit/dashboard/privacy.test.ts). Pure logic: timers and
 * clock are injectable, so test/unit/dashboard/live.test.ts drives it without waiting.
 */

export type LiveStatus = 'idle' | 'reading' | 'live' | 'retrying' | 'offline' | 'paused';

export interface LiveState<T> {
  status: LiveStatus;
  value?: T;
  /** Time of the last successful read (ms). */
  okAt?: number;
  /** Consecutive failed reads. */
  failures: number;
  /** When the next read is due (ms), while one is scheduled. */
  nextAt?: number;
  error?: string;
}

export interface LiveOptions<T> {
  read: () => Promise<T>;
  /** Interval between reads while everything works (ms). */
  everyMs: number;
  /** Ceiling of the retry delay (ms). */
  maxBackoffMs?: number;
  /** Delay before the first read (ms): sources that start together do not all read at once. */
  firstReadMs?: number;
  /** Return false to skip this read without counting a failure (for example while proving). */
  canRead?: () => boolean;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (h: unknown) => void;
}

export class LiveSource<T> {
  private s: LiveState<T> = { status: 'idle', failures: 0 };
  private timer: unknown = null;
  private running = false;
  private visible = true;
  private online = true;
  private inFlight = false;
  private listeners = new Set<(s: LiveState<T>) => void>();
  private readonly o: Required<Omit<LiveOptions<T>, 'canRead' | 'firstReadMs'>> & Pick<LiveOptions<T>, 'canRead' | 'firstReadMs'>;

  constructor(opts: LiveOptions<T>) {
    // An option passed as undefined keeps its default: `{ maxBackoffMs: undefined }` must not turn
    // the retry delay into NaN (a timer of NaN ms fires at once, so a failing node would be
    // asked again and again without pause).
    const given = Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined)) as LiveOptions<T>;
    this.o = {
      maxBackoffMs: 5 * 60_000,
      now: () => Date.now(),
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      ...given,
    };
    if (!(this.o.everyMs > 0)) throw new Error('LiveSource: everyMs must be a positive number of milliseconds.');
  }

  get state(): LiveState<T> {
    return this.s;
  }

  subscribe(fn: (s: LiveState<T>) => void): () => void {
    this.listeners.add(fn);
    fn(this.s);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<LiveState<T>>) {
    this.s = { ...this.s, ...patch };
    for (const fn of this.listeners) fn(this.s);
  }

  private clear() {
    if (this.timer !== null) this.o.clearTimer(this.timer);
    this.timer = null;
  }

  private schedule(ms: number) {
    this.clear();
    if (!this.running || !this.visible || !this.online) return;
    this.set({ nextAt: this.o.now() + ms });
    this.timer = this.o.setTimer(() => void this.tick(), ms);
  }

  /** Delay after `failures` consecutive failures: everyMs/4, ×2 each time, capped. */
  backoff(failures: number): number {
    const first = Math.max(1000, Math.floor(this.o.everyMs / 4));
    return Math.min(this.o.maxBackoffMs, first * 2 ** Math.max(0, failures - 1));
  }

  private async tick(): Promise<void> {
    this.timer = null;
    if (!this.running || !this.visible || !this.online || this.inFlight) return;
    if (this.o.canRead && !this.o.canRead()) {
      this.schedule(this.o.everyMs);
      return;
    }
    this.inFlight = true;
    this.set({ status: 'reading', nextAt: undefined });
    try {
      const value = await this.o.read();
      this.inFlight = false;
      if (!this.running) return;
      this.set({ status: 'live', value, okAt: this.o.now(), failures: 0, error: undefined });
      this.schedule(this.o.everyMs);
    } catch (e) {
      this.inFlight = false;
      if (!this.running) return;
      const failures = this.s.failures + 1;
      this.set({ status: this.online ? 'retrying' : 'offline', failures, error: e instanceof Error ? e.message : String(e) });
      this.schedule(this.backoff(failures));
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    if (this.o.firstReadMs) this.schedule(this.o.firstReadMs);
    else void this.tick();
  }

  stop(): void {
    this.running = false;
    this.clear();
    this.set({ status: 'idle', nextAt: undefined });
  }

  /** Read now (a person pressed Refresh, the page came back, the network returned). */
  kick(): void {
    if (!this.running) return;
    this.clear();
    void this.tick();
  }

  setVisible(v: boolean): void {
    if (v === this.visible) return;
    this.visible = v;
    if (!v) {
      this.clear();
      if (this.running) this.set({ status: 'paused', nextAt: undefined });
    } else this.kick();
  }

  setOnline(v: boolean): void {
    if (v === this.online) return;
    this.online = v;
    if (!v) {
      this.clear();
      if (this.running) this.set({ status: 'offline', nextAt: undefined });
    } else this.kick();
  }
}

/** "12 s ago", "4 min ago", "at 14:02": the age of a value, for a status line. */
export function ageText(okAt: number | undefined, now: number): { key: string; vars?: Record<string, string | number> } {
  if (okAt === undefined) return { key: 'not read yet' };
  const s = Math.max(0, Math.round((now - okAt) / 1000));
  if (s < 5) return { key: 'just now' };
  if (s < 60) return { key: '{n} s ago', vars: { n: s } };
  if (s < 3600) return { key: '{n} min ago', vars: { n: Math.floor(s / 60) } };
  return { key: 'at {time}', vars: { time: new Date(okAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } };
}
