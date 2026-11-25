/**
 * lib/dashboard/live.ts: the dashboard's live reads are steady when the node answers, retry quietly
 * with a growing delay when it does not, keep the last good value, stop while the page is hidden or
 * offline, and read at once when it comes back.
 */
import { describe, expect, it } from 'vitest';
import { LiveSource, ageText } from '@/lib/dashboard/live';

/** A fake clock and timer queue: run() advances to the next timer and fires it. */
function clock() {
  let now = 1_000_000;
  let timers: { at: number; fn: () => void; id: number }[] = [];
  let id = 0;
  return {
    now: () => now,
    setTimer: (fn: () => void, ms: number) => { timers.push({ at: now + ms, fn, id: ++id }); return id; },
    clearTimer: (h: unknown) => { timers = timers.filter((t) => t.id !== h); },
    pending: () => timers.length,
    async next() {
      timers.sort((a, b) => a.at - b.at);
      const t = timers.shift();
      if (!t) return null;
      const waited = t.at - now;
      now = t.at;
      t.fn();
      await new Promise((r) => setTimeout(r, 0));
      return waited;
    },
    async settle() { await new Promise((r) => setTimeout(r, 0)); },
  };
}

describe('LiveSource', () => {
  it('reads at start, then every interval, and reports the value and when it was read', async () => {
    const c = clock();
    let n = 0;
    const s = new LiveSource({ read: async () => ++n, everyMs: 15_000, now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer });
    s.start();
    await c.settle();
    expect(s.state).toMatchObject({ status: 'live', value: 1, failures: 0, okAt: 1_000_000 });
    expect(await c.next()).toBe(15_000);
    expect(s.state.value).toBe(2);
  });

  it('after failures: keeps the last good value, retries at everyMs/4 doubling, capped, then recovers', async () => {
    const c = clock();
    let fail = false;
    let n = 0;
    const s = new LiveSource({ read: async () => { if (fail) throw new Error('node down'); return ++n; }, everyMs: 60_000, maxBackoffMs: 120_000, now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer });
    s.start();
    await c.settle();
    fail = true;
    expect(await c.next()).toBe(60_000);
    expect(s.state).toMatchObject({ status: 'retrying', value: 1, failures: 1, error: 'node down' });
    expect(await c.next()).toBe(15_000);
    expect(await c.next()).toBe(30_000);
    expect(await c.next()).toBe(60_000);
    expect(await c.next()).toBe(120_000);
    expect(await c.next()).toBe(120_000); // capped
    expect(s.state.value).toBe(1);
    fail = false;
    await c.next();
    expect(s.state).toMatchObject({ status: 'live', value: 2, failures: 0, error: undefined });
  });

  it('pauses while hidden and reads at once when visible again', async () => {
    const c = clock();
    let n = 0;
    const s = new LiveSource({ read: async () => ++n, everyMs: 15_000, now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer });
    s.start();
    await c.settle();
    s.setVisible(false);
    expect(s.state.status).toBe('paused');
    expect(c.pending()).toBe(0);
    s.setVisible(true);
    await c.settle();
    expect(s.state.value).toBe(2);
  });

  it('goes offline without counting failures, and reads at once when back online', async () => {
    const c = clock();
    let n = 0;
    const s = new LiveSource({ read: async () => ++n, everyMs: 15_000, now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer });
    s.start();
    await c.settle();
    s.setOnline(false);
    expect(s.state).toMatchObject({ status: 'offline', failures: 0, value: 1 });
    expect(c.pending()).toBe(0);
    s.setOnline(true);
    await c.settle();
    expect(s.state).toMatchObject({ status: 'live', value: 2 });
  });

  it('never runs two reads at once, and a skipped read (wallet proving) is not a failure', async () => {
    const c = clock();
    let calls = 0;
    let release: (v: number) => void = () => {};
    let busy = false;
    const s = new LiveSource({
      read: () => { calls++; return new Promise<number>((r) => { release = r; }); },
      canRead: () => !busy,
      everyMs: 15_000, now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer,
    });
    s.start();
    s.kick();
    s.kick();
    expect(calls).toBe(1);
    release(7);
    await c.settle();
    expect(s.state.value).toBe(7);
    busy = true;
    await c.next();
    expect(calls).toBe(1);
    expect(s.state.failures).toBe(0);
  });

  it('can wait before its first read, so sources that start together are staggered', async () => {
    const c = clock();
    let n = 0;
    const s = new LiveSource({ read: async () => ++n, everyMs: 60_000, firstReadMs: 2_000, now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer });
    s.start();
    await c.settle();
    expect(n).toBe(0);
    expect(await c.next()).toBe(2_000);
    expect(n).toBe(1);
  });

  it('an option passed as undefined keeps its default, so a failing source still waits between tries', async () => {
    const c = clock();
    const s = new LiveSource({ read: async () => { throw new Error('down'); }, everyMs: 15_000, maxBackoffMs: undefined, firstReadMs: undefined, now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer });
    s.start();
    await c.settle();
    expect(s.state.status).toBe('retrying');
    expect(s.state.nextAt).toBe(c.now() + 3_750);
    for (let i = 0; i < 12; i++) await c.next();
    expect(s.state.nextAt! - c.now()).toBe(5 * 60_000);
    expect(() => new LiveSource({ read: async () => 1, everyMs: Number.NaN })).toThrow('everyMs');
  });

  it('stop cancels everything, and a read that lands after stop is ignored', async () => {
    const c = clock();
    let release: (v: number) => void = () => {};
    const s = new LiveSource({ read: () => new Promise<number>((r) => { release = r; }), everyMs: 15_000, now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer });
    s.start();
    s.stop();
    release(3);
    await c.settle();
    expect(s.state).toMatchObject({ status: 'idle' });
    expect(s.state.value).toBeUndefined();
    expect(c.pending()).toBe(0);
  });
});

describe('ageText', () => {
  it('says how old a value is, plainly', () => {
    expect(ageText(undefined, 0).key).toBe('not read yet');
    expect(ageText(10_000, 12_000).key).toBe('just now');
    expect(ageText(0, 42_000)).toEqual({ key: '{n} s ago', vars: { n: 42 } });
    expect(ageText(0, 5 * 60_000)).toEqual({ key: '{n} min ago', vars: { n: 5 } });
    expect(ageText(0, 2 * 3600_000).key).toBe('at {time}');
  });
});
