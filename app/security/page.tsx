import type { Metadata } from 'next';
import React from 'react';
import mainnet from '../../deployments/aztec-mainnet.json';
import { EXTERNAL_LINKS } from '@/lib/constants/links';
import { versions } from '@/lib/landing/facts';
import { VISIBILITY } from '@/lib/landing/chapters';
import { SiteFooter, SiteHeader, Arrow } from '@/components/landing/site/Chrome';
import s from '@/components/landing/site/site.module.css';

/**
 * /security: the security architecture, part by part (verdict prompt, "Enterprise-grade landing
 * page and documentation"). Every row names the standard and where its keys live, and every limit
 * sits next to the part it limits. Versions are read from the repository.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Security architecture: Ledger Chat',
  description: 'How Ledger Chat protects messages, calls, files and payments, where the keys live, what each party can see, and the limits.',
  alternates: { canonical: '/security' },
};

const REPO = EXTERNAL_LINKS.github.repo;
const review = (mainnet as { internalReview?: { report: string; date: string } }).internalReview;

export default function SecurityPage() {
  const v = versions();
  const crypto: { part: string; how: string; standard: string; keys: string }[] = [
    { part: 'Messages', how: `XMTP browser SDK${v.xmtp ? ` ${v.xmtp}` : ''}; group state and keys updated as members and time change`, standard: 'MLS, RFC 9420', keys: 'Made and kept on your device. The local message database is encrypted, its key held under a non-extractable browser key' },
    { part: 'Calls', how: 'WebRTC, peer to peer; a TURN relay with one-hour credentials when a direct path is blocked', standard: 'DTLS-SRTP', keys: 'Negotiated for each call between the two devices. The relay passes encrypted packets' },
    { part: 'Attachments and large files', how: 'Encrypted on the sender’s device; files above 20 MB in 16 MiB pieces bound to their position', standard: 'AES-256-GCM, HKDF-SHA256', keys: 'Fresh for every file, sent only inside the MLS message that references it' },
    { part: 'Private payments', how: `Aztec PXE in the browser builds the proof; balances are notes, spending one publishes a nullifier${v.aztecNr ? `; contracts in Noir with aztec-nr ${v.aztecNr}` : ''}`, standard: 'Client-side zero-knowledge proofs', keys: 'Derived on your device from a signature by your Ethereum wallet; never sent anywhere' },
    { part: 'Paying the right person', how: 'Before value moves, a proof that the person in the conversation controls the Aztec address, bound to the network', standard: 'Schnorr signature over Grumpkin', keys: 'Checked on the payer’s device' },
    { part: 'Sign-in', how: 'A signed message names this website, your address and a one-time code from the server', standard: 'EIP-4361 (Sign-In with Ethereum)', keys: 'Your wallet. The server keeps a session' },
  ];
  const threats: { who: string; can: string; cannot: string; mitigation: string }[] = [
    { who: 'Someone who takes over our server', can: 'Read contacts, community posts, Status and push metadata; see sign-in sessions; block service', cannot: 'Read direct or group messages, call media, files, or payment amounts and recipients', mitigation: 'Moving contacts, communities and Status to MLS; Ledger Relay so others can run every server we run' },
    { who: 'An observer of the network', can: 'See that two inboxes exchange traffic, and when', cannot: 'Read content', mitigation: 'XMTP protects content, not all metadata. Stated next to the claim' },
    { who: 'An observer of the chain', can: 'See that a transaction happened, its fee and the account that paid it', cannot: 'See the amount or the recipient of a private transfer', mitigation: 'Private fee payment is evaluated, not in use' },
    { who: 'A contact who tries to redirect a payment', can: 'Announce an address that is not theirs', cannot: 'Pass the peer check: the payment is refused', mitigation: 'Network-bound proof of address control, checked on the payer’s device' },
    { who: 'A phishing site', can: 'Ask your wallet to sign a message', cannot: 'Produce a message that names ledgerchat.org from another domain', mitigation: 'The sign-in screen shows every field of the message and checks the website against the page' },
    { who: 'Someone with your unlocked device', can: 'Read your chats on that device', cannot: 'Spend without your wallet or an enrolled passkey', mitigation: 'App PIN, the device lock, and the passkey list in the wallet’s Security view' },
  ];
  const limits = [
    'There is no external audit yet. Our contracts have had an internal security review.',
    'The account that pays an Aztec network fee is public, so its transactions can be linked to each other.',
    'Contacts, community posts and Status are stored on our server and are not end-to-end encrypted today.',
    'Calls across two strict networks depend on the TURN relay; signalling uses the public PeerJS cloud unless our own server is configured.',
    'Aztec Alpha is an early network; payments on it have a cap per payment.',
  ];

  return (
    <div className={s.site} data-site="public">
      <a href="#main" className={s.skip}>Skip to content</a>
      <SiteHeader home={false} />
      <main id="main">
        <section className={s.pageHead}>
          <div className={s.wrap}>
            <p className={s.eyebrow}>Security</p>
            <h1 className={s.h1}>How Ledger Chat protects you, part by part.</h1>
            <p className={s.lede}>
              The standard each part uses, where its keys live, what every party can see, and the limits, each next to the part it limits.
            </p>
            <nav className={s.toc} aria-label="On this page">
              <a href="#cryptography">Cryptography</a>
              <a href="#visibility">What each party sees</a>
              <a href="#threats">Threat model</a>
              <a href="#limits">Limits</a>
              <a href="#report">Report a vulnerability</a>
            </nav>
          </div>
        </section>

        <section id="cryptography" className={s.section} aria-labelledby="cryptography-title">
          <div className={s.wrap}>
            <header className={s.head}>
              <h2 className={s.h2} id="cryptography-title">Cryptography and keys</h2>
              <p className={s.body}>No new cryptography of our own: every part uses a published standard or the primitives of the network it runs on.</p>
            </header>
            <div className={`${s.tableWrap} ${s.tableCard}`}>
              <table className={`${s.table} ${s.vis}`}>
                <thead><tr><th scope="col">Part</th><th scope="col">How</th><th scope="col">Standard</th><th scope="col">Keys</th></tr></thead>
                <tbody>
                  {crypto.map((r) => (
                    <tr key={r.part}>
                      <th scope="row">{r.part}</th>
                      <td data-k="How">{r.how}</td>
                      <td data-k="Standard">{r.standard}</td>
                      <td data-k="Keys">{r.keys}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="visibility" className={`${s.section} ${s.sectionWash}`} aria-labelledby="visibility-title">
          <div className={s.wrap}>
            <header className={s.head}>
              <h2 className={s.h2} id="visibility-title">What each party can see</h2>
              <p className={s.body}>{VISIBILITY.body}</p>
            </header>
            <div className={`${s.tableWrap} ${s.tableCard}`}>
              <table className={`${s.table} ${s.vis}`}>
                <thead><tr>{VISIBILITY.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
                <tbody>
                  {VISIBILITY.rows.map((r) => (
                    <tr key={r.part}>
                      <th scope="row">{r.part}</th>
                      <td data-k={VISIBILITY.head[1]}>{r.who}</td>
                      <td data-k={VISIBILITY.head[2]}>{r.server}</td>
                      <td data-k={VISIBILITY.head[3]}>{r.next || 'No change needed'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="threats" className={s.section} aria-labelledby="threats-title">
          <div className={s.wrap}>
            <header className={s.head}>
              <h2 className={s.h2} id="threats-title">Threat model, in short</h2>
              <p className={s.body}>
                Who might attack, what they could do today, what they cannot, and what limits them. The full model, component by component, is in the repository.
              </p>
            </header>
            <div className={`${s.tableWrap} ${s.tableCard}`}>
              <table className={`${s.table} ${s.vis}`}>
                <thead><tr><th scope="col">Who</th><th scope="col">Can today</th><th scope="col">Cannot</th><th scope="col">What limits it</th></tr></thead>
                <tbody>
                  {threats.map((t) => (
                    <tr key={t.who}>
                      <th scope="row">{t.who}</th>
                      <td data-k="Can today">{t.can}</td>
                      <td data-k="Cannot">{t.cannot}</td>
                      <td data-k="What limits it">{t.mitigation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={s.note}>
              <a className={s.extLink} href={`${REPO}/blob/main/docs/security/THREAT_MODEL.md`} target="_blank" rel="noopener noreferrer">The full threat model (STRIDE and LINDDUN)</a>
            </p>
          </div>
        </section>

        <section id="limits" className={`${s.section} ${s.sectionWash}`} aria-labelledby="limits-title">
          <div className={`${s.wrap} ${s.prose}`}>
            <h2 className={s.h2} id="limits-title">Limits</h2>
            <ul>{limits.map((l) => <li key={l}>{l}</li>)}</ul>
            {review ? (
              <p className={s.note}>
                Internal security review of {review.date}:{' '}
                <a className={s.extLink} href={`${REPO}/blob/main/${review.report}`} target="_blank" rel="noopener noreferrer">read the report</a>.
              </p>
            ) : null}
          </div>
        </section>

        <section id="report" className={s.section} aria-labelledby="report-title">
          <div className={s.wrap}>
            <div className={s.closing}>
              <h2 className={s.h2} id="report-title">Found a vulnerability?</h2>
              <p className={s.body}>Report it privately, first. Please do not open a public issue. The disclosure policy is in the trust centre.</p>
              <a className={s.btn} href={EXTERNAL_LINKS.github.security} target="_blank" rel="noopener noreferrer">Report privately on GitHub<Arrow /></a>
              <p style={{ marginTop: 20 }}><a href="/trust#disclosure" style={{ color: '#fff', textDecoration: 'underline' }}>Read the disclosure policy</a></p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
