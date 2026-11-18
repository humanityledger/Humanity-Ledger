import type { Metadata } from 'next';
import { ImmersiveLanding } from '@/components/landing/immersive/ImmersiveLanding';
import { ONE_LINE } from '@/lib/landing/content';

/**
 * The landing is generated at build time and revalidated hourly. Live numbers arrive from the
 * client (GET /api/stats/live), so the HTML never waits on the database.
 */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Ledger Chat: your wallet is your account',
  description: ONE_LINE,
  alternates: { canonical: '/' },
  openGraph: { title: 'Ledger Chat', description: ONE_LINE, type: 'website' },
};

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Ledger Chat',
  applicationCategory: 'CommunicationApplication',
  operatingSystem: 'Web, iOS, Android, macOS, Windows, Linux',
  description: ONE_LINE,
  url: 'https://ledgerchat.org',
};

export default function Home() {
  return (
    <div className="w-full flex-1 flex flex-col hl-zoom-67-target">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <ImmersiveLanding />
    </div>
  );
}
