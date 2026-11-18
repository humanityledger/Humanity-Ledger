import type { Metadata } from 'next';
import { ImmersiveLanding } from '@/components/landing/immersive/ImmersiveLanding';
import { ONE_LINE } from '@/lib/landing/content';

/**
 * Rendered per request because the site's CSP gives every response its own script nonce
 * (middleware.ts): a page generated at build time carries no nonce and its scripts would be
 * refused. The render touches no database: live numbers arrive from the client
 * (GET /api/stats/live), and the repository figures are computed once per server process.
 */
export const dynamic = 'force-dynamic';

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
    <div className="w-full flex-1 flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <ImmersiveLanding />
    </div>
  );
}
