import { describe, expect, it } from 'vitest';
import { isSlow, loadTimings, recordTiming, typicalMs } from '@/lib/perf/proof-timings';

function memory() { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; }

describe('proof timings on this device', () => {
  it('keeps the last 20 sane values', () => {
    const s = memory();
    for (let i = 1; i <= 25; i++) recordTiming(i * 1000, s);
    recordTiming(-5, s);
    recordTiming(Number.NaN, s);
    const t = loadTimings(s);
    expect(t).toHaveLength(20);
    expect(t[0]).toBe(6000);
  });
  it('median needs three, and slow means twice the median and over 30 s', () => {
    expect(typicalMs([10_000, 20_000])).toBeNull();
    expect(typicalMs([10_000, 40_000, 20_000])).toBe(20_000);
    expect(typicalMs([10_000, 20_000, 30_000, 40_000])).toBe(25_000);
    expect(isSlow(45_000, 20_000)).toBe(true);
    expect(isSlow(25_000, 10_000)).toBe(false);
    expect(isSlow(99_000, null)).toBe(false);
  });
});
