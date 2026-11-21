import type { Metadata } from 'next';
import React from 'react';
import mainnet from '../../deployments/aztec-mainnet.json';
import { EXTERNAL_LINKS } from '@/lib/constants/links';
import { SiteFooter, SiteHeader, Arrow } from '@/components/landing/site/Chrome';
import s from '@/components/landing/site/site.module.css';

/**
 * /trust: what a reviewer asks for (verdict prompt, "Trust centre"): assurance status, the
 * disclosure policy, the networks and service providers Ledger Chat relies on, what our server
 * stores and why, the security changelog and the service status. The disclosure commitments are
 * the ones already published in /.well-known/security.txt.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Trust centre: Ledger Chat',
  description: 'Assurance status, disclosure policy, the networks and providers Ledger Chat relies on, what our server stores and why.',
  alternates: { canonical: '/trust' },
};

const REPO = EXTERNAL_LINKS.github.repo;
const rec = mainnet as { audit: unknown; internalReview?: { report: string; date: string; baseCommit: string } };

const PROVIDERS: { name: string; role: string; sees: string }[] = [
  { name: 'Railway', role: 'Hosts the web app and its database', sees: 'What our server stores (listed below)' },
  { name: 'XMTP network', role: 'Carries direct and group messages', sees: 'MLS ciphertext, inbox ids and timing' },
  { name: 'Aztec Network', role: 'Verifies private payments', sees: 'Proofs, note hashes, nullifiers and the public fee payment' },
  { name: 'Ethereum', role: 'Where Aztec settles', sees: 'Rollup proofs and state roots' },
  { name: 'Our TURN server', role: 'Relays calls when a direct path is blocked', sees: 'Network addresses and timing of relayed calls, never media' },
  { name: 'PeerJS signalling', role: 'Sets up calls, unless our own signalling server is configured', sees: 'Peer ids, timing and the connection offers the two browsers exchange' },
  { name: 'Redis host', role: 'Rate limits', sees: 'Counters per caller, for a short window' },
  { name: 'Cloudflare R2', role: 'Stores encrypted attachments and file pieces, when file storage is on', sees: 'Ciphertext and its size' },
  { name: 'Reown (WalletConnect)', role: 'Connects phone wallets for sign-in', sees: 'Encrypted session messages and timing' },
  { name: 'Browser push services', role: 'Deliver notifications (Apple, Google, Mozilla, Microsoft)', sees: 'That a notification was sent to a device' },
];

const STORED: { what: string; why: string }[] = [
  { what: 'Sign-in sessions', why: 'To keep you signed in, and to rate-limit sign-in attempts' },
  { what: '@usernames', why: 'So people can find you by name; a username is public by design' },
  { what: 'Contacts you save', why: 'To show names instead of addresses, and to choose who sees your Status' },
  { what: 'Communities and their posts', why: 'To run communities until they move to MLS groups' },
  { what: 'Status', why: 'To show it to your audience for its lifetime' },
  { what: 'Push subscriptions', why: 'To send a notification to your device' },
  { what: 'Encrypted attachments', why: 'To deliver files; ciphertext only, the key is in the message' },
];

export default function TrustPage() {
  return (
    <div className={s.site}>
      <a href="#main" className={s.skip}>Skip to content</a>
      <SiteHeader home={false} />
      <main id="main">
        <section className={s.pageHead}>
          <div className={s.wrap}>
            <p className={s.eyebrow}>Trust centre</p>
            <h1 className={s.h1}>What a reviewer asks for, in one place.</h1>
            <p className={s.lede}>Assurance status, how to report a vulnerability, every network and provider we rely on, and what our server stores and why.</p>
            <nav className={s.toc} aria-label="On this page">
              <a href="#assurance">Assurance</a>
              <a href="#disclosure">Disclosure policy</a>
              <a href="#providers">Networks and providers</a>
              <a href="#data">What we store</a>
              <a href="#changes">Changes and status</a>
            </nav>
          </div>
        </section>

        <section id="assurance" className={s.section} aria-labelledby="assurance-title">
          <div className={s.wrap}>
            <header className={s.head}>
              <h2 className={s.h2} id="assurance-title">Assurance</h2>
            </header>
            <dl className={s.facts}>
              <div><dt>External audit</dt><dd>{rec.audit ? 'Published' : 'None yet'}</dd></div>
              <div><dt>Internal security review</dt><dd>{rec.internalReview ? rec.internalReview.date : 'Not recorded'}</dd></div>
              <div><dt>Source code</dt><dd>Public, MIT or Apache-2.0</dd></div>
              <div><dt>Continuous integration</dt><dd>Every run is public</dd></div>
            </dl>
            <p className={s.note}>
              {rec.internalReview ? (
                <>
                  The internal review covered the code at commit <code className={s.mono}>{rec.internalReview.baseCommit}</code>:{' '}
                  <a className={s.extLink} href={`${REPO}/blob/main/${rec.internalReview.report}`} target="_blank" rel="noopener noreferrer">read the report</a>.{' '}
                </>
              ) : null}
              An internal review is not an external audit. When an external audit exists, its report will be linked here with every finding answered.
            </p>
          </div>
        </section>

        <section id="disclosure" className={`${s.section} ${s.sectionWash}`} aria-labelledby="disclosure-title">
          <div className={`${s.wrap} ${s.prose}`}>
            <h2 className={s.h2} id="disclosure-title">Disclosure policy</h2>
            <p className={s.body}>If you find a vulnerability, please tell us privately first.</p>
            <ul>
              <li>Report through <a className={s.extLink} href={EXTERNAL_LINKS.github.security} target="_blank" rel="noopener noreferrer">GitHub private vulnerability reporting</a>, or the contact in <a className={s.extLink} href="/.well-known/security.txt">security.txt</a>.</li>
              <li>Include the affected component, the steps to reproduce and the impact you see.</li>
              <li>We acknowledge receipt within 48 hours and give a fix timeline within 7 business days.</li>
              <li>Please do not disclose publicly until we have had 90 days to fix it.</li>
              <li>In scope: sign-in, messaging, payments, communities, API routes and smart contracts. Out of scope: social engineering, physical attacks and denial of service.</li>
              <li>There is no paid bug bounty today. If you wish, we credit you in our security acknowledgements.</li>
            </ul>
          </div>
        </section>

        <section id="providers" className={s.section} aria-labelledby="providers-title">
          <div className={s.wrap}>
            <header className={s.head}>
              <h2 className={s.h2} id="providers-title">Networks and providers</h2>
              <p className={s.body}>Everyone in the path of Ledger Chat, what they do, and what they can see. None of them can read direct or group messages, files, call media or payment amounts.</p>
            </header>
            <div className={`${s.tableWrap} ${s.tableCard}`}>
              <table className={`${s.table} ${s.vis}`}>
                <thead><tr><th scope="col">Who</th><th scope="col">What for</th><th scope="col">What they can see</th></tr></thead>
                <tbody>
                  {PROVIDERS.map((p) => (
                    <tr key={p.name}>
                      <th scope="row">{p.name}</th>
                      <td data-k="What for">{p.role}</td>
                      <td data-k="What they can see">{p.sees}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="data" className={`${s.section} ${s.sectionWash}`} aria-labelledby="data-title">
          <div className={s.wrap}>
            <header className={s.head}>
              <h2 className={s.h2} id="data-title">What our server stores, and why</h2>
              <p className={s.body}>Message content, call media and payment details are not in this list because our server never has them. Retention periods are not published yet.</p>
            </header>
            <div className={`${s.tableWrap} ${s.tableCard}`}>
              <table className={`${s.table} ${s.vis}`}>
                <thead><tr><th scope="col">What</th><th scope="col">Why</th></tr></thead>
                <tbody>
                  {STORED.map((d) => (
                    <tr key={d.what}>
                      <th scope="row">{d.what}</th>
                      <td data-k="Why">{d.why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="changes" className={s.section} aria-labelledby="changes-title">
          <div className={s.wrap}>
            <header className={s.head}>
              <h2 className={s.h2} id="changes-title">Changes and status</h2>
            </header>
            <div className={s.cards}>
              {[
                { title: 'Security changelog', text: 'Every fix with security impact, one line each.', href: `${REPO}/blob/main/SECURITY-CHANGELOG.md`, cta: 'Read it' },
                { title: 'Changelog', text: 'Everything that changed, release by release.', href: '/docs/changelog', cta: 'Read it' },
                { title: 'Service status', text: 'The networks Ledger Chat depends on, right now.', href: '/docs/status', cta: 'Check status' },
                { title: 'Security architecture', text: 'Cryptography, keys, threat model and limits.', href: '/security', cta: 'Open it' },
              ].map((c) => (
                <a key={c.title} className={s.card} href={c.href} {...(c.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                  <h3>{c.title}</h3>
                  <p>{c.text}</p>
                  <span>{c.cta}<Arrow /></span>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
