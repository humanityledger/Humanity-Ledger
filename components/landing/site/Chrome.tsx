/**
 * Header and footer of the public site (landing, /record, /brief's screen view).
 * Server components: no JavaScript. The phone menu is a <details>, so it opens without a script.
 * The footer keeps every link and line of fine print of the previous footers
 * (components/landing/mobile/MobileFooter.tsx), plus the record.
 */
import { LanguagePicker } from '@/components/i18n/LanguagePicker';
import React from 'react';
import Link from 'next/link';
import { HLLogo } from '@/components/shared/HLLogo';
import { EXTERNAL_LINKS } from '@/lib/constants/links';
import { LEGAL_ENTITY } from '@/lib/constants/legalEntity';
import { AZTEC_WALLET_CONFIG } from '@/lib/aztec/wallet/config';
import { NAV } from '@/lib/landing/chapters';
import s from './site.module.css';
import { getT } from '@/lib/i18n/server';

export const Arrow = () => (
  <svg className={s.arrow} width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 8h9.5M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Same-page anchors from another page go back to the landing. */
const navHref = (href: string, home: boolean) => (href.startsWith('#') && !home ? `/${href}` : href);

export async function SiteHeader({ home = true }: { home?: boolean }) {
  const t = await getT();
  return (
    <header className={s.header}>
      <div className={`${s.wrap} ${s.headerInner}`}>
        <Link href="/" className={s.brand} aria-label={t("Ledger Chat home")}>
          <HLLogo variant="mark" size={28} label={t("Ledger Chat")} />
          <span>{t("Ledger Chat")}</span>
        </Link>
        <nav className={s.nav} aria-label={t("Site")}>
          {NAV.map((n) => (
            <a key={n.href} className={s.navLink} href={navHref(n.href, home)}>{t(n.label)}</a>
          ))}
        </nav>
        <div className={s.headerEnd}>
          <LanguagePicker variant="compact" />
          <a className={`${s.btn} ${s.btnPrimary} ${s.btnSmall} ${s.headerCta}`} href="/chat">{t("Open Ledger Chat")}</a>
          <details className={s.menu}>
            <summary aria-label={t("Menu")}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 6h12M3 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </summary>
            <div className={s.menuPanel}>
              {NAV.map((n) => <a key={n.href} href={navHref(n.href, home)}>{t(n.label)}</a>)}
              <a href="/chat"><b>{t("Open Ledger Chat")}</b></a>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

type L = { label: string; href: string; external?: boolean };
const COLUMNS: { title: string; links: L[] }[] = [
  { title: 'Product', links: [
    { label: 'Ledger Chat', href: '/chat' },
    { label: 'How it works', href: '/docs/guide' },
    { label: 'Private payments', href: '/#payment' },
    { label: 'Network status', href: '/docs/status' },
    { label: 'Protocol metrics', href: '/protocol' },
    { label: 'Ledger Record', href: '/record' },
    { label: 'One-page brief', href: '/brief' },
    { label: 'Large files', href: '/#files' },
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
    { label: 'Security', href: '/security' },
    { label: 'Trust centre', href: '/trust' },
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
  <a href={l.href} {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{t(l.label)}</a>
);

export async function SiteFooter() {
  const t = await getT();
  return (
    <footer className={s.footer}>
      <div className={s.wrap}>
        <div className={s.footTop}>
          <div>
            <Link href="/" className={s.brand} aria-label={t("Ledger Chat home")}>
              <HLLogo variant="mark" size={28} label={t("Ledger Chat")} />
              <span>{t("Ledger Chat")}</span>
            </Link>
            <p className={s.small} style={{ marginTop: 14, maxWidth: 280 }}>{t("Ledger Chat, made by {MAKER}. Built on{value}{0}.", { MAKER, value: ' ', 0: <a href={EXTERNAL_LINKS.aztec} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>{t("Aztec Network")}</a> })}</p>
          </div>
          <div className={s.footCols}>
            {COLUMNS.map((c) => (
              <div key={c.title} className={s.footCol}>
                <p className={s.footTitle}>{t(c.title)}</p>
                <nav aria-label={t(c.title)}>{c.links.map((l) => <Item key={l.label} l={l} />)}</nav>
              </div>
            ))}
          </div>
        </div>
        <div className={s.fine}>
          <nav aria-label={t("Legal")} className={s.legal}>{LEGAL.map((l) => <Item key={l.label} l={l} />)}</nav>
          <p>© 2026 {t(LEGAL_ENTITY.tradingName)}</p>
          <p>{t("Ledger Chat is in early access. Our contracts have had an internal security review, not an external audit, and private payments run{value}Please do not rely on the service to protect information or funds you cannot afford to lose.", { value: ALPHA_LIVE
              ? t(" on Aztec Alpha with real funds and a cap per payment. ")
              : t(" only on the Aztec test network with tokens that have no value. ") })}</p>
          <p>
            {t("{name}, trading as {tradingName}. Not a bank, broker, exchange or financial institution, and nothing on this site is financial advice. Not affiliated with Humanity Protocol, Ledger SAS or the Aztec Foundation. XMTP, Aztec and Ethereum are trademarks of their respective owners.", { name: t(LEGAL_ENTITY.name), tradingName: t(LEGAL_ENTITY.tradingName) })}</p>
        </div>
      </div>
    </footer>
  );
}
