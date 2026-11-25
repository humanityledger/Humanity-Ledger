import type { Metadata } from 'next';
import React from 'react';
import { SiteFooter, SiteHeader } from '@/components/landing/site/Chrome';
import s from '@/components/landing/site/site.module.css';
import { getT } from '@/lib/i18n/server';
import { DashboardEntry } from '@/components/dashboard/DashboardEntry';

/**
 * /dashboard (25 November 2026): everything Ledger Chat can show about your account, computed in
 * your browser from your private wallet and your own records (components/dashboard/DashboardApp.tsx,
 * docs/DASHBOARD.md). The server renders only the frame; it never receives anything private.
 */
export const metadata: Metadata = {
  title: 'Dashboard: Ledger Chat',
  description: 'Your private balances, payments, counterparties and network state, computed on your own device. Nothing private leaves it.',
  alternates: { canonical: '/dashboard' },
  robots: { index: false },
};

export default async function DashboardPage() {
  const t = await getT();
  return (
    <div className={s.site} data-site="public">
      <a href="#main" className={s.skip}>{t('Skip to content')}</a>
      <SiteHeader home={false} />
      <main id="main">
        <DashboardEntry />
      </main>
      <SiteFooter />
    </div>
  );
}
