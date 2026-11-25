'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { useT } from '@/lib/i18n/client';

/** Loads the dashboard in the browser only: it reads this device's wallet and storage. */
function Loading() {
  const t = useT();
  return (
    <div role="status" aria-live="polite" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh', color: '#5b606b', fontSize: 14 }}>
      {t('Loading your dashboard')}
    </div>
  );
}

const DashboardApp = dynamic(() => import('./DashboardApp').then((m) => m.DashboardApp), { ssr: false, loading: () => <Loading /> });

export function DashboardEntry() {
  return <DashboardApp />;
}
