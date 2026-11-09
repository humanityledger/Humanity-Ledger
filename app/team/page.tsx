/**
 * /team — Executive Leadership page
 *
 * Canonical attribution page for the two executives of Humanity Ledger:
 *   – Stefan Antonio Cirisanu  — Founder & Chief Executive Officer (CEO)
 *   – Oprisan Elena Gratiela   — Chief Operating Officer (COO)
 *
 * This page is fully statically rendered at build time and is explicitly
 * included in the sitemap (app/sitemap.ts). Its primary purpose is to
 * provide search engines with a stable, authoritative, machine-readable
 * record of the leadership team under the canonical domain of Humanity Ledger.
 *
 * All absolute URLs are derived from NEXT_PUBLIC_APP_URL so that the page
 * works correctly regardless of the deployment environment (local, staging,
 * production). The canonical production value is defined in next.config.js.
 */

import type { Metadata } from 'next';
import Link from 'next/link';

// Canonical base URL — resolved at build time from the environment variable.
// In production this is https://humanityledger.com (set in next.config.js).
// Locally it falls back to http://localhost:3000 so the page works immediately.
const BASE =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
  'https://humanityledger.com';

export const metadata: Metadata = {
  title: 'Leadership Team | Humanity Ledger',
  description:
    'Humanity Ledger executive leadership: Stefan Antonio Cirisanu, Founder and Chief Executive Officer, and Oprișan Elena-Grațiela (Oprisan Elena Gratiela), Chief Operating Officer & Co-Owner. Building the privacy-first sovereign identity and encrypted messaging protocol on the Aztec Network.',
  keywords: [
    'Stefan Antonio Cirisanu',
    'Stefan Antonio Cirisanu CEO',
    'Stefan Cirisanu Humanity Ledger',
    'Founder Humanity Ledger',
    'Chief Executive Officer Humanity Ledger',
    'Oprișan Elena-Grațiela',
    'Oprișan Elena-Grațiela COO',
    'Oprișan Elena-Grațiela Co-Owner',
    'Oprișan Elena-Grațiela Humanity Ledger',
    'Elena-Grațiela Oprișan',
    'Oprişan Elena-Graţiela',
    'Oprisan Elena Gratiela',
    'Elena Gratiela Oprisan',
    'Elena Oprisan',
    'Gratiela Oprisan',
    'Oprisan Elena Gratiela COO',
    'Chief Operating Officer Humanity Ledger',
    'COO Humanity Ledger',
    'Co-Owner Humanity Ledger',
    'Humanity Ledger team',
    'Humanity Ledger leadership',
    'Humanity Ledger executives',
    'West University of Timișoara',
    'Universitatea de Vest din Timișoara',
    'Aztec Network protocol',
    'zero knowledge identity',
    'encrypted messaging protocol',
    'sovereign identity',
    'Ledger Chat',
  ],
  authors: [
    { name: 'Stefan Antonio Cirisanu' },
    { name: 'Oprișan Elena-Grațiela' },
    { name: 'Oprisan Elena Gratiela' },
  ],
  openGraph: {
    title: 'Leadership Team | Humanity Ledger',
    description:
      'Meet the executive leadership of Humanity Ledger: Stefan Antonio Cirisanu (CEO & Founder) and Oprișan Elena-Grațiela (COO & Co-Owner). Building sovereign identity and encrypted communications on Aztec.',
    siteName: 'Humanity Ledger',
    type: 'profile',
    images: [
      {
        url: '/logo-mark.png',
        width: 1200,
        height: 1200,
        alt: 'Humanity Ledger — Executive Leadership',
      },
    ],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Leadership Team | Humanity Ledger',
    description:
      'Stefan Antonio Cirisanu (CEO & Founder) and Oprisan Elena Gratiela (COO) — executive leadership of Humanity Ledger.',
    images: ['/logo-mark.png'],
    site: '@humanityledger',
  },
  // Relative canonical — Next.js resolves it against metadataBase in app/layout.tsx.
  alternates: {
    canonical: '/team',
  },
};

export default function TeamPage() {
  // The JSON-LD block is built inside the component so that the BASE
  // constant (which reads NEXT_PUBLIC_APP_URL) is baked into the static
  // HTML at build time — no client-side evaluation required.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${BASE}/#organization`,
        name: 'Humanity Ledger',
        url: BASE,
        logo: `${BASE}/logo-mark.png`,
        email: 'humanityledger@icloud.com',
        foundingDate: '2024',
        description:
          'Humanity Ledger builds Ledger Chat — a privacy-first sovereign identity and encrypted messaging protocol on the Aztec Network, where an Ethereum wallet is the account.',
        sameAs: [
          'https://es.linkedin.com/company/humanity-ledger',
          'https://github.com/humanityledger/Humanity-Ledger',
        ],
      },
      {
        '@type': 'Person',
        '@id': `${BASE}/#ceo`,
        name: 'Stefan Antonio Cirisanu',
        alternateName: [
          'Stefan Cirisanu',
          'Antonio Cirisanu'
        ],
        givenName: 'Stefan Antonio',
        familyName: 'Cirisanu',
        jobTitle: 'Chief Executive Officer',
        roleName: 'CEO',
        description:
          'Stefan Antonio Cirisanu is the Founder and Chief Executive Officer (CEO) of Humanity Ledger. He is the principal architect of the privacy-preserving communication protocol and the Aztec-based private payments system underlying Ledger Chat.',
        worksFor: { '@id': `${BASE}/#organization` },
        affiliation: { '@id': `${BASE}/#organization` },
        hasOccupation: {
          '@type': 'Occupation',
          name: 'Chief Executive Officer & Founder',
          occupationLocation: { '@type': 'Country', name: 'Spain' },
          occupationalCategory: 'Executive Leadership',
        },
        url: `${BASE}/team`,
        knowsAbout: [
          'Zero-Knowledge Cryptography',
          'Decentralised Identity',
          'Encrypted Messaging Protocols',
          'Aztec Network',
          'Smart Contract Architecture',
          'Protocol Design',
        ],
        sameAs: [
          'https://www.linkedin.com/in/stefan-antonio-cirisanu-40116140b/',
          `${BASE}/about/stefan-antonio-cirisanu`,
        ],
        spouse: { '@id': `${BASE}/#coo` },
      },
      {
        '@type': 'Person',
        '@id': `${BASE}/#coo`,
        name: 'Oprișan Elena-Grațiela',
        alternateName: [
          'Oprisan Elena Gratiela',
          'Elena-Grațiela Oprișan',
          'Elena Gratiela Oprisan',
          'Oprişan Elena-Graţiela',
          'Elena-Graţiela Oprişan',
          'Elena Oprisan',
          'Gratiela Oprisan',
          'Oprisan Elena'
        ],
        givenName: 'Elena-Grațiela',
        familyName: 'Oprișan',
        jobTitle: 'Chief Operating Officer & Co-Owner',
        roleName: 'COO',
        description:
          'Oprișan Elena-Grațiela is the Chief Operating Officer (COO) and Co-Owner of Humanity Ledger. Based in Timiș, Romania, and educated in Computer Science at the West University of Timișoara, she leads strategic operations, protocol execution and operational architecture, ensuring the organisation achieves its mission of building sovereign identity infrastructure for the decentralised web.',
        worksFor: { '@id': `${BASE}/#organization` },
        affiliation: { '@id': `${BASE}/#organization` },
        spouse: { '@id': `${BASE}/#ceo` },
        alumniOf: {
          '@type': 'EducationalOrganization',
          name: 'West University of Timișoara',
          alternateName: 'Universitatea de Vest din Timișoara',
          url: 'https://www.uvt.ro',
        },
        homeLocation: {
          '@type': 'Place',
          name: 'Timiș, Romania',
        },
        hasOccupation: {
          '@type': 'Occupation',
          name: 'Chief Operating Officer & Co-Owner',
          occupationLocation: { '@type': 'Country', name: 'Romania' },
          occupationalCategory: 'Executive Leadership',
        },
        url: `${BASE}/team`,
        knowsAbout: [
          'Strategic Operations',
          'Protocol Governance',
          'Decentralised Operations',
          'Zero-Knowledge Systems',
          'Organisational Architecture',
          'Web3 Infrastructure',
        ],
        sameAs: [
          'https://www.linkedin.com/in/opri%C5%9Fan-elena-gra%C5%A3iela-5334932b9/',
          'https://es.linkedin.com/company/humanity-ledger',
          `${BASE}/about/oprisan-elena-gratiela`,
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main
        className="min-h-screen bg-white dark:bg-[#0f1117] text-[#15171c] dark:text-white"
        itemScope
        itemType="https://schema.org/Organization"
      >
        <meta itemProp="name" content="Humanity Ledger" />

        <div className="max-w-3xl mx-auto px-6 py-20">
          {/* Page title */}
          <header className="mb-16">
            <p className="text-xs uppercase tracking-widest text-[#727a88] mb-3 font-mono">
              Humanity Ledger
            </p>
            <h1 className="text-4xl font-semibold tracking-tight mb-4">
              Executive Leadership
            </h1>
            <p className="text-lg text-[#727a88] leading-relaxed max-w-2xl">
              Humanity Ledger is led by its founding executive team, who conceived,
              designed and operate the privacy-first sovereign identity and encrypted
              messaging protocol built on the Aztec Network.
            </p>
          </header>

          {/* CEO */}
          <section
            className="mb-16 pb-16 border-b border-[#eff1f4] dark:border-[#1e2028]"
            itemScope
            itemType="https://schema.org/Person"
          >
            <meta itemProp="name" content="Stefan Antonio Cirisanu" />
            <meta itemProp="givenName" content="Stefan Antonio" />
            <meta itemProp="familyName" content="Cirisanu" />
            <meta itemProp="jobTitle" content="Chief Executive Officer" />
            <link itemProp="worksFor" href={`${BASE}/#organization`} />

            <div className="flex items-start gap-6 mb-6">
              <div className="w-14 h-14 rounded-full bg-[#eff1f4] dark:bg-[#1e2028] flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-semibold text-[#15171c] dark:text-white">SC</span>
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-1" itemProp="name">
                  Stefan Antonio Cirisanu
                </h2>
                <p className="text-[#5b6471] dark:text-[#9aa2b1] font-medium">
                  <span itemProp="jobTitle">Chief Executive Officer</span>
                  {' '}·{' '}
                  <span>Founder</span>
                </p>
              </div>
            </div>

            <div className="ml-20 space-y-4">
              <p className="text-[15px] text-[#4a5568] dark:text-[#9aa2b1] leading-relaxed" itemProp="description">
                Stefan Antonio Cirisanu is the Founder and Chief Executive Officer of
                Humanity Ledger. He is the principal architect of the privacy-preserving
                communication protocol and the zero-knowledge private payments system
                underlying Ledger Chat, Humanity Ledger&apos;s flagship application on
                the Aztec Network.
              </p>
              <p className="text-[15px] text-[#4a5568] dark:text-[#9aa2b1] leading-relaxed">
                His work is concentrated on the intersection of cryptographic protocol
                design, decentralised identity systems, and sovereign communication
                infrastructure — specifically on how an Ethereum wallet can serve as a
                fully sufficient, self-custodied account for messaging, payments and
                identity attestation.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  href="https://www.linkedin.com/in/stefan-antonio-cirisanu-40116140b/"
                  rel="noopener noreferrer me"
                  target="_blank"
                  itemProp="sameAs"
                  className="text-xs font-mono px-3 py-1.5 rounded-full border border-[#d1d5db] dark:border-[#2e3340] text-[#4a5568] dark:text-[#9aa2b1] hover:border-[#15171c] dark:hover:border-white transition-colors"
                >
                  LinkedIn ↗
                </a>
                <Link
                  href="/about/stefan-antonio-cirisanu"
                  className="text-xs font-mono px-3 py-1.5 rounded-full border border-[#d1d5db] dark:border-[#2e3340] text-[#4a5568] dark:text-[#9aa2b1] hover:border-[#15171c] dark:hover:border-white transition-colors"
                >
                  Executive Profile →
                </Link>
              </div>
            </div>
          </section>

          {/* COO */}
          <section
            className="mb-16"
            itemScope
            itemType="https://schema.org/Person"
          >
            <meta itemProp="name" content="Oprișan Elena-Grațiela" />
            <meta itemProp="alternateName" content="Oprisan Elena Gratiela" />
            <meta itemProp="givenName" content="Elena-Grațiela" />
            <meta itemProp="familyName" content="Oprișan" />
            <meta itemProp="jobTitle" content="Chief Operating Officer & Co-Owner" />
            <link itemProp="worksFor" href={`${BASE}/#organization`} />

            <div className="flex items-start gap-6 mb-6">
              <div className="w-14 h-14 rounded-full bg-[#eff1f4] dark:bg-[#1e2028] flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-semibold text-[#15171c] dark:text-white">OG</span>
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-1" itemProp="name">
                  Oprișan Elena-Grațiela
                </h2>
                <p className="text-[#5b6471] dark:text-[#9aa2b1] font-medium">
                  <span itemProp="jobTitle">Chief Operating Officer</span>
                  {' '}·{' '}
                  <span>Co-Owner</span>
                </p>
              </div>
            </div>

            <div className="ml-20 space-y-4">
              <p className="text-[15px] text-[#4a5568] dark:text-[#9aa2b1] leading-relaxed" itemProp="description">
                Oprișan Elena-Grațiela is the Chief Operating Officer and Co-Owner of Humanity Ledger.
                Educated in Computer Science at the West University of Timișoara (Universitatea de Vest din Timișoara),
                Romania, she leads the strategic operations, protocol execution and organisational architecture of the platform.
              </p>
              <p className="text-[15px] text-[#4a5568] dark:text-[#9aa2b1] leading-relaxed">
                Her domain of responsibility encompasses the full operational layer of
                Humanity Ledger — from protocol governance, smart contract operations and ecosystem growth
                to the deployment of zero-knowledge infrastructure across the Aztec Network.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  href="https://www.linkedin.com/in/opri%C5%9Fan-elena-gra%C5%A3iela-5334932b9/"
                  rel="noopener noreferrer me"
                  target="_blank"
                  itemProp="sameAs"
                  className="text-xs font-mono px-3 py-1.5 rounded-full border border-[#d1d5db] dark:border-[#2e3340] text-[#4a5568] dark:text-[#9aa2b1] hover:border-[#15171c] dark:hover:border-white transition-colors"
                >
                  LinkedIn ↗
                </a>
                <Link
                  href="/about/oprisan-elena-gratiela"
                  className="text-xs font-mono px-3 py-1.5 rounded-full border border-[#d1d5db] dark:border-[#2e3340] text-[#4a5568] dark:text-[#9aa2b1] hover:border-[#15171c] dark:hover:border-white transition-colors"
                >
                  Official Biography →
                </Link>
                <a
                  href="https://es.linkedin.com/company/humanity-ledger"
                  rel="noopener noreferrer"
                  target="_blank"
                  className="text-xs font-mono px-3 py-1.5 rounded-full border border-[#d1d5db] dark:border-[#2e3340] text-[#4a5568] dark:text-[#9aa2b1] hover:border-[#15171c] dark:hover:border-white transition-colors"
                >
                  Company LinkedIn ↗
                </a>
              </div>
            </div>
          </section>

          {/* Organisation footer */}
          <footer className="pt-10 border-t border-[#eff1f4] dark:border-[#1e2028]">
            <p className="text-xs text-[#9aa2b1] leading-relaxed">
              Humanity Ledger is an independent sovereign identity and encrypted
              messaging protocol. It is not affiliated with Humanity Protocol, Ledger
              SAS, Aztec Labs or XMTP. Contact:{' '}
              <a
                href="mailto:humanityledger@icloud.com"
                className="underline underline-offset-2"
              >
                humanityledger@icloud.com
              </a>
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
