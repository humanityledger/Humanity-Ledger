import React from 'react';
import s from './site.module.css';
import type { ClaimLabel } from '@/lib/landing/claims';

const TONE: Record<ClaimLabel, string> = {
  Live: 'live',
  'Closed alpha': 'alpha',
  'Not enabled yet': 'off',
  'In design': 'design',
};

/** The four status words of the claims register, and nothing else. */
export function StatusLabel({ label }: { label: ClaimLabel }) {
  return (
    <span className={s.label} data-tone={TONE[label]}>
      <span className={s.dot} aria-hidden="true" />
      {label}
    </span>
  );
}
