/** 4.19: a second call while the first is running is dropped, not queued. */
import { describe, it, expect } from 'vitest';
import { singleFlight } from '@/lib/aztec/single-flight';

describe('singleFlight', () => {
  it('drops a concurrent second call (double tap)', async () => {
    const once = singleFlight();
    let runs = 0;
    let release!: () => void;
    const first = once(() => new Promise<string>((r) => { runs++; release = () => r('paid'); }));
    const second = await once(async () => { runs++; return 'paid twice'; });
    expect(second).toBeUndefined();
    release();
    expect(await first).toBe('paid');
    expect(runs).toBe(1);
  });

  it('runs again after the first settles, including after a failure', async () => {
    const once = singleFlight();
    await expect(once(async () => { throw new Error('proof failed'); })).rejects.toThrow('proof failed');
    expect(await once(async () => 'retry ok')).toBe('retry ok');
  });

  it('separate guards do not block each other', async () => {
    const a = singleFlight();
    const b = singleFlight();
    let release!: () => void;
    const pending = a(() => new Promise<void>((r) => { release = r; }));
    expect(await b(async () => 'other card')).toBe('other card');
    release();
    await pending;
  });
});

describe('valueActionsRunning (local wipe gate)', () => {
  it('counts actions in flight across guards and drops to 0 after success or failure', async () => {
    const { valueActionsRunning } = await import('@/lib/aztec/single-flight');
    const a = singleFlight();
    const b = singleFlight();
    let ra!: () => void;
    const pa = a(() => new Promise<void>((r) => { ra = r; }));
    const pb = b(async () => { throw new Error('rejected'); });
    expect(valueActionsRunning()).toBe(2);
    await expect(pb).rejects.toThrow('rejected');
    expect(valueActionsRunning()).toBe(1);
    ra();
    await pa;
    expect(valueActionsRunning()).toBe(0);
  });
});
