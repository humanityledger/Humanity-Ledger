'use client';
/**
 * A progress ring around the island's leading mark. It only ever shows what the code doing the
 * work reported: a percentage from a toast ("Sending photo.jpg, 42%") or the step a private payment
 * is on (segments: one per step, filled as each one finishes).
 */
import React from 'react';
import s from './activities.module.css';

const R = 10.5;
const C = 2 * Math.PI * R;

export function Ring({ value, segments, tone = 'violet', children }: {
  /** 0..1 */
  value: number;
  /** Draw this many separate arcs instead of one continuous one. */
  segments?: number;
  tone?: 'violet' | 'live' | 'warn' | 'danger' | 'neutral';
  children?: React.ReactNode;
}) {
  const v = Math.max(0, Math.min(1, value));
  const color = `var(--${tone === 'neutral' ? 'island-text' : tone})`;
  const gap = segments && segments > 1 ? 3.2 : 0;
  const arcs = segments && segments > 1
    ? Array.from({ length: segments }, (_, i) => {
        const len = C / segments - gap;
        const filled = Math.max(0, Math.min(1, v * segments - i));
        return { offset: -(i * (C / segments)), len, filled };
      })
    : [{ offset: 0, len: C, filled: v }];
  return (
    <span className={s.ring} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="24" height="24">
        {arcs.map((a, i) => (
          <g key={i} transform="rotate(-90 12 12)">
            <circle cx="12" cy="12" r={R} fill="none" stroke="var(--island-track)" strokeWidth="2.4" strokeLinecap="round"
              strokeDasharray={`${a.len} ${C - a.len}`} strokeDashoffset={a.offset} />
            {a.filled > 0 && (
              <circle className={s.ringArc} cx="12" cy="12" r={R} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round"
                strokeDasharray={`${a.len * a.filled} ${C - a.len * a.filled}`} strokeDashoffset={a.offset} />
            )}
          </g>
        ))}
      </svg>
      <span className={s.ringCore}>{children}</span>
    </span>
  );
}

export default Ring;
