import { describe, expect, it } from 'vitest';
import { approach, clamp01, easeOut, litBlocks, sceneProgress, segment, typedCount, videoTime } from '@/lib/landing/progress';

describe('landing progress functions are pure and reversible', () => {
  it('scene progress runs 0 → 1 across the pinned run and back', () => {
    const down = [0, 250, 500, 750, 1000, 1250].map((y) => sceneProgress(y, 250, 1900, 900));
    expect(down).toEqual([0, 0, 0.25, 0.5, 0.75, 1]);
    const up = [1250, 1000, 750, 500, 250, 0].map((y) => sceneProgress(y, 250, 1900, 900));
    expect(up).toEqual([...down].reverse());
  });
  it('a scene no taller than the viewport is a step', () => {
    expect(sceneProgress(99, 100, 800, 900)).toBe(0);
    expect(sceneProgress(100, 100, 800, 900)).toBe(1);
  });
  it('segments, easing and typing stay in range and are monotonic', () => {
    let last = -1;
    for (let i = 0; i <= 100; i++) {
      const p = i / 100;
      const e = easeOut(segment(p, 0.2, 0.6));
      expect(e).toBeGreaterThanOrEqual(last);
      expect(e).toBeGreaterThanOrEqual(0);
      expect(e).toBeLessThanOrEqual(1);
      last = e;
    }
    expect(typedCount(0, 14)).toBe(0);
    expect(typedCount(1, 14)).toBe(14);
    expect(typedCount(0.5, 14, 0.25, 0.75)).toBe(7);
    expect(clamp01(Number.NaN)).toBe(0);
  });
  it('video time never reaches past the last frame and is 0 without a duration', () => {
    expect(videoTime(1, 11.16)).toBeCloseTo(11.11, 5);
    expect(videoTime(0.5, Number.NaN)).toBe(0);
  });
  it('the lerp converges and lands exactly on its target', () => {
    let x = 0;
    for (let i = 0; i < 200; i++) x = approach(x, 5, 16);
    expect(x).toBe(5);
  });
  it('record points light in block order, and unlight in reverse', () => {
    expect(litBlocks(0, [28992, 29012])).toEqual([true, false]);
    expect(litBlocks(1, [28992, 29012])).toEqual([true, true]);
  });
});
