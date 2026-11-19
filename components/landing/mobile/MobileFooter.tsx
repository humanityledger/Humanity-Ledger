/**
 * The footer of the phone landing: the same links, credit and fine print as SiteFooter
 * (components/landing/v2/SiteFooter.tsx), without its full-width wordmark over a blurred field,
 * which costs paint on a phone. test/unit/landing/mobile-tree.test.ts fails if a link or a line of
 * fine print in SiteFooter is missing here, so the two never drift apart.
 */
import React from 'react';
import { EXTERNAL_LINKS } from '@/lib/constants/links';
import { LEGAL_ENTITY } from '@/lib/constants/legalEntity';
import { AZTEC_WALLET_CONFIG } from '@/lib/aztec/wallet/config';
import s from './mobile.module.css';

type L = { label: string; href: string; external?: boolean };
const COLUMNS: { title: string; links: L[] }[] = [
  { title: 'Product', links: [
    { label: 'Ledger Chat', href: '/chat' },
    { label: 'How it works', href: '/docs/guide' },
    { label: 'Private payments', href: '/#aztec' },
    { label: 'Get started', href: '/#start' },
    { label: 'Network status', href: '/docs/status' },
    { label: 'Protocol metrics', href: '/protocol' },
    { label: 'HLC test token', href: '/#payments' },
  ] },
  { title: 'Developers', links: [
    { label: 'Documentation', href: '/docs/overview' },
    { label: 'Architecture', href: '/docs/architecture' },
    { label: 'Whitepaper', href: '/docs/whitepaper' },
    { label: 'Developers', href: '/docs/developers' },
    { label: 'Source code', href: EXTERNAL_LINKS.github.repo, external: true },
  ] },
  { title: 'Company', links: [
    { label: 'About', href: '/docs/about' },
    { label: 'Blog', href: '/docs/blog' },
    { label: 'Brand and press kit', href: '/docs/brand' },
    { label: 'Changelog', href: '/docs/changelog' },
    { label: 'Contact', href: '/docs/contact' },
  ] },
  { title: 'Trust', links: [
    { label: 'Security reviews', href: '/docs/audits' },
    { label: 'Report a vulnerability', href: '/docs/bug-bounty' },
    { label: 'Risk disclosure', href: '/docs/disclaimer' },
    { label: 'Content policy', href: '/docs/content-policy' },
  ] },
  { title: 'Community', links: [
    { label: 'X', href: EXTERNAL_LINKS.x, external: true },
    { label: 'GitHub', href: EXTERNAL_LINKS.github.org, external: true },
    { label: 'LinkedIn', href: EXTERNAL_LINKS.linkedin, external: true },
    { label: 'Built on Aztec', href: EXTERNAL_LINKS.aztec, external: true },
    { label: 'XMTP', href: EXTERNAL_LINKS.xmtp, external: true },
  ] },
];
const LEGAL: L[] = [
  { label: 'Legal notice', href: '/docs/legal-notice' },
  { label: 'Privacy', href: '/docs/privacy' },
  { label: 'Terms', href: '/docs/terms' },
  { label: 'Cookies', href: '/docs/cookies' },
];
const MAKER = LEGAL_ENTITY.kind === 'company' ? LEGAL_ENTITY.name : LEGAL_ENTITY.tradingName;
const ALPHA_LIVE = AZTEC_WALLET_CONFIG.network === 'mainnet' && AZTEC_WALLET_CONFIG.alphaEnabled;

const Item = ({ l }: { l: L }) => (
  <a href={l.href} {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{l.label}</a>
);

export function MobileFooter() {
  return (
    <footer className={s.foot}>
      {COLUMNS.map((c) => (
        <details key={c.title} className={s.footCol}>
          <summary>{c.title}<span aria-hidden="true" className={s.plus} /></summary>
          <nav aria-label={c.title}>{c.links.map((l) => <Item key={l.label} l={l} />)}</nav>
        </details>
      ))}
      <p className={s.small}>
        Ledger Chat, made by {MAKER}. Built on{' '}
        <a href={EXTERNAL_LINKS.aztec} target="_blank" rel="noopener noreferrer">Aztec Network</a>.
      </p>
      <nav aria-label="Legal" className={s.links}>{LEGAL.map((l) => <Item key={l.label} l={l} />)}</nav>
      <p className={s.small}>© 2026 {LEGAL_ENTITY.tradingName}</p>
      <p className={s.small}>
        Ledger Chat is in early access. Our contracts have had an internal security review, not an external audit, and private payments run
        {ALPHA_LIVE
          ? ' on Aztec Alpha with real funds and a cap per payment. '
          : ' only on the Aztec test network with tokens that have no value. '}
        Please do not rely on the service to protect information or funds you cannot afford to lose.
      </p>
      <p className={s.small}>
        {LEGAL_ENTITY.name}, trading as {LEGAL_ENTITY.tradingName}. Not a bank, broker, exchange or financial
        institution, and nothing on this site is financial advice. Not affiliated with Humanity Protocol, Ledger SAS
        or the Aztec Foundation.
      </p>
    </footer>
  );
}
