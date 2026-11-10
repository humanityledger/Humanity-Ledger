/**
 * Gap 2.5: a chat stream starts STREAM_START_SLACK seconds in the past; the
 * upfront part is computed, bounded by a one-hour minimum, and never exceeds the total.
 */
import { describe, it, expect } from 'vitest';
import { MIN_STREAM_SECONDS, STREAM_START_SLACK, streamStart, streamTerms } from '@/lib/aztec/stream-terms';

describe('streamTerms', () => {
  it('starts the slack in the past and reports the upfront accrual', () => {
    const t = streamTerms(3600n * 10n, 3600, 1_000_000);
    expect(t).toEqual({ rate: 10n, start: 1_000_000 - STREAM_START_SLACK, upfront: 1200n });
    expect(streamStart(500)).toBe(500 - STREAM_START_SLACK);
  });

  it('keeps the upfront part at most slack/duration of the total (≈3.3 % at one hour)', () => {
    const total = 1_000_000n;
    const { upfront } = streamTerms(total, MIN_STREAM_SECONDS, 0);
    expect(upfront * BigInt(MIN_STREAM_SECONDS) <= total * BigInt(STREAM_START_SLACK)).toBe(true);
  });

  it('refuses a total smaller than the duration in seconds instead of ending the stream early', () => {
    expect(() => streamTerms(50n, 3600, 0)).toThrow(/too small/);
    expect(streamTerms(3600n, 3600, 0)).toEqual({ rate: 1n, start: -STREAM_START_SLACK, upfront: 120n });
  });

  it('refuses streams shorter than an hour, longer than a year, fractional durations, and non-positive totals', () => {
    expect(() => streamTerms(100n, 60, 0)).toThrow(/one hour and one year/);
    expect(() => streamTerms(100n, 3599, 0)).toThrow(/one hour/);
    expect(() => streamTerms(100n, 366 * 24 * 3600, 0)).toThrow(/one year/);
    expect(() => streamTerms(100n, 3600.5, 0)).toThrow();
    expect(() => streamTerms(0n, 3600, 0)).toThrow(/above zero/);
  });
});
