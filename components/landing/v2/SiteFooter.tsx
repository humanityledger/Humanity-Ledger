import React from "react";
import Link from "next/link";
import { HLLogo } from "@/components/shared/HLLogo";
import { EXTERNAL_LINKS } from "@/lib/constants/links";
import { LEGAL_ENTITY } from "@/lib/constants/legalEntity";
import { AZTEC_WALLET_CONFIG } from "@/lib/aztec/wallet/config";
import s from "./SiteFooter.module.css";

/**
 * SiteFooter — the footer for every public page.
 *
 * Built like an editorial colophon: a display line and the two actions that
 * matter, five columns of links, "Ledger Chat" set very large over the
 * living background, the credit line, and a bottom bar with the legal links.
 * The fine print about the product's real stage stays, because the footer is
 * where careful readers look for exactly that.
 *
 * The credit says who makes Ledger Chat and what it is built on, and nothing
 * more: Humanity Ledger makes it (as "Corp." only once a company exists, see
 * lib/constants/legalEntity.ts), and it runs on Aztec Network, which does not
 * make, endorse or operate it. "Aztec Network" is a text link to
 * aztec.network; the Aztec logo is not drawn here.
 */

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Ledger Chat", href: "/chat" },
      { label: "How it works", href: "/docs/guide" },
      { label: "Private payments", href: "/#aztec" },
      { label: "Get started", href: "/#start" },
      { label: "Network status", href: "/docs/status" },
      { label: "Protocol metrics", href: "/protocol" },
      { label: "HLC token", href: "/#hlc" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Documentation", href: "/docs/overview" },
      { label: "Architecture", href: "/docs/architecture" },
      { label: "Whitepaper", href: "/docs/whitepaper" },
      { label: "Developers", href: "/docs/developers" },
      { label: "Source code", href: EXTERNAL_LINKS.github.repo, external: true },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/docs/about" },
      { label: "Blog", href: "/docs/blog" },
      { label: "Brand and press kit", href: "/docs/brand" },
      { label: "Changelog", href: "/docs/changelog" },
      { label: "Contact", href: "/docs/contact" },
    ],
  },
  {
    title: "Trust",
    links: [
      { label: "Security audits", href: "/docs/audits" },
      { label: "Report a vulnerability", href: "/docs/bug-bounty" },
      { label: "Risk disclosure", href: "/docs/disclaimer" },
      { label: "Content policy", href: "/docs/content-policy" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "X", href: EXTERNAL_LINKS.x, external: true },
      { label: "GitHub", href: EXTERNAL_LINKS.github.org, external: true },
      { label: "LinkedIn", href: EXTERNAL_LINKS.linkedin, external: true },
      { label: "Built on Aztec", href: EXTERNAL_LINKS.aztec, external: true },
      { label: "XMTP", href: EXTERNAL_LINKS.xmtp, external: true },
    ],
  },
];

const LEGAL: FooterLink[] = [
  { label: "Legal notice", href: "/docs/legal-notice" },
  { label: "Privacy", href: "/docs/privacy" },
  { label: "Terms", href: "/docs/terms" },
  { label: "Cookies", href: "/docs/cookies" },
];

function FooterLinkItem({ link, className }: { link: FooterLink; className?: string }) {
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
        {link.label}
      </a>
    );
  }
  return (
    <Link href={link.href} className={className}>
      {link.label}
    </Link>
  );
}

/** Who makes Ledger Chat: the company once one is incorporated, the trading name until then. */
const MAKER = LEGAL_ENTITY.kind === "company" ? LEGAL_ENTITY.name : LEGAL_ENTITY.tradingName;
const ALPHA_LIVE = AZTEC_WALLET_CONFIG.network === "mainnet" && AZTEC_WALLET_CONFIG.alphaEnabled;

/** `lead`: the closing line and its two buttons. Off where the page above already ends with them. */
export function SiteFooter({ lead = true }: { lead?: boolean }) {
  return (
    <footer className={s.footer}>
      <div className={s.wrap}>
        <div className={`${s.top} ${lead ? "" : s.topSolo}`}>
          {lead && <div className={s.lead}>
            <p className={`${s.display} hl-display`}>
              Talk freely.
              <br />
              <em>Pay privately.</em>
            </p>
            <div className={s.ctas}>
              <Link href="/chat" className={`${s.btn} ${s.btnPrimary}`}>
                Open Ledger Chat
              </Link>
              <Link href="/docs/overview" className={`${s.btn} ${s.btnGhost}`}>
                Read the documentation
              </Link>
            </div>
          </div>}

          <div className={s.cols}>
            {COLUMNS.map((col) => (
              <nav key={col.title} className={s.col} aria-label={col.title}>
                <h2>{col.title}</h2>
                <ul>
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <FooterLinkItem link={l} />
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
      </div>

      {/* The wordmark, set across the full width over the living field. */}
      <div className={s.mark} aria-hidden="true">
        <div className={s.markGlow} />
        <span className={`${s.markWord} hl-display`}>
          Ledger <em>Chat</em>
        </span>
      </div>

      <div className={s.wrap}>
        <div className={s.bottom}>
          <p className={s.credit}>
            <span>Ledger Chat</span>, made by {MAKER}. Built on{" "}
            <a href={EXTERNAL_LINKS.aztec} target="_blank" rel="noopener noreferrer">
              Aztec Network
            </a>
            .
          </p>
          <div className={s.bottomRow}>
            <span className={s.copy}>
              <HLLogo size={20} variant="mark" />© 2026 {LEGAL_ENTITY.tradingName}
            </span>
            <nav className={s.legal} aria-label="Legal">
              {LEGAL.map((l) => (
                <FooterLinkItem key={l.label} link={l} />
              ))}
            </nav>
          </div>
          <p className={s.fine}>
            Ledger Chat is in early access. Our contracts have not been independently audited, and private payments run
            {ALPHA_LIVE
              ? " on Aztec Alpha with real funds and a cap per payment. "
              : " only on the Aztec test network with tokens that have no value. "}
            Please do not rely on the service to protect information or funds you cannot afford to lose.
          </p>
          <p className={s.fine}>
            {LEGAL_ENTITY.name}, trading as {LEGAL_ENTITY.tradingName}. Not a bank, broker, exchange or financial
            institution, and nothing on this site is financial advice. Not affiliated with Humanity Protocol, Ledger SAS
            or the Aztec Foundation.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
