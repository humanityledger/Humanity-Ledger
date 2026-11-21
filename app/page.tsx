import type { Metadata } from 'next';
import { SiteLanding } from '@/components/landing/site/SiteLanding';

/**
 * Rendered per request because the site's CSP gives every response its own script nonce
 * (middleware.ts): a page generated at build time carries no nonce and its scripts would be
 * refused. The render touches no database.
 *
 * One tree for every screen since 21 November 2026 (components/landing/site): a server-rendered
 * page with four small client islands and native scrolling. Phones still get the light document
 * shell from app/layout.tsx (the middleware marks the request), which this page does not need
 * anything from. The previous trees (components/landing/immersive and components/landing/mobile)
 * are no longer rendered and are removed in a follow-up change.
 */
export const dynamic = 'force-dynamic';

const DESCRIPTION =
  'Talk, call and pay in one conversation. Messages are end-to-end encrypted with MLS through XMTP; private payments are proved on your device with Aztec Network. Closed alpha.';

export const metadata: Metadata = {
  title: 'Ledger Chat: talk, call and pay in one private conversation',
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: { title: 'Ledger Chat', description: DESCRIPTION, type: 'website', url: 'https://ledgerchat.org/' },
  twitter: { card: 'summary_large_image', title: 'Ledger Chat', description: DESCRIPTION },
};

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Ledger Chat',
  applicationCategory: 'CommunicationApplication',
  operatingSystem: 'Web, iOS, Android, macOS, Windows, Linux',
  description: DESCRIPTION,
  url: 'https://ledgerchat.org',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <SiteLanding />
    </>
  );
}
