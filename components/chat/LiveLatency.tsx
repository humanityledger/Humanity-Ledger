'use client';

import { useEffect, useState } from 'react';
import { qualityLabel, subscribeLiveRtt, type LatencyQuality, type LiveRttSample } from '@/lib/chat/liveRtt';

const TONE: Record<LatencyQuality, { background: string; color: string }> = {
  good: { background: '#e5f6ec', color: '#0f7a40' },
  mid: { background: '#fff4d6', color: '#8a5a00' },
  bad: { background: '#fde8e8', color: '#c4232b' },
  unknown: { background: '#f2f4f7', color: '#8b909a' },
};

const INITIAL: LiveRttSample = { ms: null, quality: 'unknown', offline: false };

/**
 * The live millisecond count. Green under 150, yellow from 150 to 399, red from 400.
 * The same component sits above the settings gear on wide screens and in the
 * phone header, because the rail is hidden there. One shared probe feeds every copy.
 */
export function LiveLatency({ className = '' }: { className?: string }) {
  const [sample, setSample] = useState<LiveRttSample>(INITIAL);
  useEffect(() => subscribeLiveRtt(setSample), []);

  const label = sample.offline
    ? 'Offline. No live latency.'
    : sample.ms == null
      ? 'Measuring live latency'
      : `${sample.ms} ms, ${qualityLabel(sample.quality)} connection`;

  return (
    <span
      data-testid="live-latency"
      data-quality={sample.quality}
      title={label}
      aria-label={label}
      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[12px] font-semibold tabular-nums leading-none select-none ${className}`}
      style={TONE[sample.quality]}
    >
      {sample.ms == null ? '·' : sample.ms}
    </span>
  );
}
