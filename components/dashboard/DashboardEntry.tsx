'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import s from './dashboard.module.css';
import { useT } from '@/lib/i18n/client';
import { useAfter } from './parts';

/** While the dashboard's code loads: nothing for the first moment, then one plain line. */
function Loading() {
  const t = useT();
  const shown = useAfter(true);
  return (
    <div className={s.dash}>
      <div className={s.wrap}>
        <div className={s.state} role="status" aria-live="polite">
          {shown ? <p className={s.stateText}>{t('Loading your dashboard')}</p> : null}
        </div>
      </div>
    </div>
  );
}

/** Loads the dashboard in the browser only: it reads this device's wallet and storage. */
const DashboardApp = dynamic(() => import('./DashboardApp').then((m) => m.DashboardApp), { ssr: false, loading: () => <Loading /> });

export function DashboardEntry() {
  return <DashboardApp />;
}
