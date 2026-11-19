'use client';

import { useEffect, useState } from 'react';
import { qualityLabel, subscribeLiveRtt, type LatencyQuality, type LiveRttSample } from '@/lib/chat/liveRtt';

const BAR = '#d8dde4';
const INK: Record<LatencyQuality, string> = {
  good: '#12a150',
  mid: '#c48a00',
  bad: '#d23b3b',
  unknown: '#98a0ab',
};

/** Four bars. Good fills all of them, medium the first two, poor only the first. */
function barsFor(quality: LatencyQuality): number {
  if (quality === 'good') return 4;
  if (quality === 'mid') return 2;
  if (quality === 'bad') return 1;
  return 0;
}

const HEIGHTS = [3, 5, 7, 9];
const INITIAL: LiveRttSample = { ms: null, quality: 'unknown', offline: false };

/**
 * Signal bars, then the exact millisecond count underneath. No circle.
 * Green under 150, yellow from 150 to 399, red from 400.
 */
export function LiveLatency({ className = '' }: { className?: string }) {
  const [sample, setSample] = useState<LiveRttSample>(INITIAL);
  useEffect(() => subscribeLiveRtt(setSample), []);

  const label = sample.offline
    ? 'Offline. No live latency.'
    : sample.ms == null
      ? 'Measuring live latency'
      : `${sample.ms} ms, ${qualityLabel(sample.quality)} connection`;
  const ink = INK[sample.quality];
  const lit = barsFor(sample.quality);

  return (
    <span
      data-testid="live-latency"
      data-quality={sample.quality}
      title={label}
      aria-label={label}
      className={`inline-flex flex-col items-center gap-[3px] select-none ${className}`}
    >
      <span className="flex items-end gap-[2px] h-[9px]" aria-hidden="true">
        {HEIGHTS.map((height, i) => (
          <span
            key={height}
            className="w-[2.5px] rounded-[1px]"
            style={{ height, background: i < lit ? ink : BAR }}
          />
        ))}
      </span>
      <span className="text-[10px] font-semibold tabular-nums leading-none" style={{ color: ink }}>
        {sample.ms == null ? '–' : sample.ms}
      </span>
    </span>
  );
}
