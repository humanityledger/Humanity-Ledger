/**
 * lib/perf/client-timings.ts — small ring buffer of client-side timings (encrypting and uploading
 * an attachment, recording a voice note, decrypting a thumbnail). Numbers stay on this device;
 * Settings → Storage → Memory shows the latest ones, so a change can be measured before and after
 * (protocol evolution document §7: every significant change carries a client-side number).
 */
export type TimingKind = 'attachment.encrypt+upload' | 'voice.encrypt+upload' | 'media.thumbnail.decrypt';
export interface Timing { kind: TimingKind; ms: number; bytes?: number; at: number }

const MAX = 50;
const ring: Timing[] = [];

export function recordTiming(kind: TimingKind, ms: number, bytes?: number): void {
  if (!(ms >= 0) || ms > 10 * 60_000) return;
  ring.push({ kind, ms: Math.round(ms), bytes, at: Date.now() });
  if (ring.length > MAX) ring.splice(0, ring.length - MAX);
}

export function timings(kind?: TimingKind): Timing[] { return kind ? ring.filter((t) => t.kind === kind) : ring.slice(); }

/** Median of the recorded timings of one kind, or null. */
export function medianMs(kind: TimingKind): number | null {
  const xs = timings(kind).map((t) => t.ms).sort((a, b) => a - b);
  if (!xs.length) return null;
  const m = xs.length >> 1;
  return xs.length % 2 ? xs[m] : Math.round((xs[m - 1] + xs[m]) / 2);
}
