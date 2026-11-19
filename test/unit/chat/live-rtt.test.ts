import { describe, expect, it } from 'vitest';
import {
  exactClientMs,
  GOOD_UNDER_MS,
  matchingEntry,
  measurePing,
  qualityForMs,
  SLOW_UNDER_MS,
  type TimingEntry,
} from '@/lib/chat/liveRtt';

const entry = (over: Partial<TimingEntry>): TimingEntry => ({
  name: 'https://ledger.example/api/ping?n=1',
  startTime: 1000,
  requestStart: 0,
  responseStart: 0,
  connectStart: 0,
  connectEnd: 0,
  ...over,
});

describe('exact client milliseconds', () => {
  it('uses the first-byte gap, rounded to the nearest millisecond, not a 25 ms bucket', () => {
    expect(exactClientMs({ wallMs: 81.6, netMs: 80.4, handshakeMs: null })).toBe(80);
    // A first-byte gap 0.2 ms longer than the wall clock is still this probe (clock rounding).
    expect(exactClientMs({ wallMs: 81.4, netMs: 81.6, handshakeMs: null })).toBe(82);
  });

  it('falls back to the wait the client recorded when iOS leaves the timing fields at 0', () => {
    expect(exactClientMs({ wallMs: 42.2, netMs: null, handshakeMs: null })).toBe(42);
  });

  it('drops a one-off handshake from the fallback so the first probe matches the warm connection', () => {
    expect(exactClientMs({ wallMs: 250.4, netMs: null, handshakeMs: 180.2 })).toBe(70);
  });

  it('rejects a stale timing row that is longer than the wait just measured', () => {
    expect(exactClientMs({ wallMs: 30.2, netMs: 400, handshakeMs: null })).toBe(30);
  });

  it('does not subtract a handshake that is larger than the wait', () => {
    expect(exactClientMs({ wallMs: 40, netMs: null, handshakeMs: 90 })).toBe(40);
  });

  it('colours good, medium and poor on the same cutoffs everywhere', () => {
    expect(qualityForMs(0)).toBe('good');
    expect(qualityForMs(GOOD_UNDER_MS - 1)).toBe('good');
    expect(qualityForMs(GOOD_UNDER_MS)).toBe('mid');
    expect(qualityForMs(SLOW_UNDER_MS - 1)).toBe('mid');
    expect(qualityForMs(SLOW_UNDER_MS)).toBe('bad');
    expect(qualityForMs(1483)).toBe('bad');
  });
});

describe('which timing row belongs to this probe', () => {
  it('ignores an older ping still sitting in the buffer', () => {
    const older = entry({ name: 'https://ledger.example/api/ping?n=old', startTime: 100 });
    const current = entry({ name: 'https://ledger.example/api/ping?n=new', startTime: 5000, requestStart: 5010, responseStart: 5091 });
    expect(matchingEntry([older, current], 'https://ledger.example/api/ping?n=new', 5000)).toBe(current);
    expect(matchingEntry([older], 'https://ledger.example/api/ping?n=new', 5000)).toBeNull();
  });
});

describe('measurePing', () => {
  it('reports the resource-timing round trip for the request it just made', async () => {
    let t = 1000;
    let seen = '';
    const ms = await measurePing({
      now: () => t,
      fetchImpl: async (input) => {
        seen = String(input);
        t = 1081.6;
        return {
          ok: true,
          url: `https://ledger.example${seen}`,
          type: 'basic',
          arrayBuffer: async () => new ArrayBuffer(2),
        } as Response;
      },
      readEntries: () => [entry({
        name: `https://ledger.example${seen}`,
        startTime: 1000,
        requestStart: 1005,
        responseStart: 1085.4,
      })],
    });
    expect(seen.startsWith('/api/ping?n=')).toBe(true);
    expect(ms).toEqual({ ms: 80 });
  });

  it('uses the performance.now() span when the browser recorded no first-byte time', async () => {
    let t = 2000;
    const ms = await measurePing({
      now: () => t,
      fetchImpl: async () => {
        t = 2042.4;
        return { ok: true, url: '', type: 'basic', arrayBuffer: async () => new ArrayBuffer(2) } as Response;
      },
      readEntries: () => [],
    });
    expect(ms).toEqual({ ms: 42 });
  });

  it('does not invent a number when the network fails', async () => {
    const ms = await measurePing({
      now: () => 0,
      fetchImpl: async () => { throw new Error('offline'); },
      readEntries: () => [],
    });
    expect(ms).toEqual({ ms: null });
  });
});
