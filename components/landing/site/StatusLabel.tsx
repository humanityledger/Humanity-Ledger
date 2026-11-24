import React from 'react';
import s from './site.module.css';
import type { ClaimLabel } from '@/lib/landing/claims';
import { getT } from '@/lib/i18n/server';

const TONE: Record<ClaimLabel, string> = {
  Live: 'live',
  'Closed alpha': 'alpha',
  'Not enabled yet': 'off',
  'In design': 'design',
};

/**
 * The four status words of the claims register, and nothing else. The register's word picks the
 * colour; only the text shown is translated, so a translated page keeps the right tone.
 */
export async function StatusLabel({ label }: { label: ClaimLabel }) {
  const t = await getT();
  return (
    <span className={s.label} data-tone={TONE[label]}>
      <span className={s.dot} aria-hidden="true" />
      {t(label)}
    </span>
  );
}
