import React from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { HLLogo } from "@/components/shared/HLLogo";
import { EXTERNAL_LINKS } from "@/lib/constants/links";
import { LEGAL_ENTITY } from "@/lib/constants/legalEntity";
import s from "./SiteFooter.module.css";

/**
 * SiteFooter — the footer for every public page.
 *
 * Built like an editorial colophon: a display line and the two actions that
 * matter, five columns of links, the Humanity Ledger wordmark set very large
 * over the living background, and a bottom bar with the legal links. The
 * fine print about the product's real stage stays, because the footer is
 * where careful readers look for exactly that.
 *
 * "Built on Aztec" is a text link to aztec.network. The Aztec logo is not
 * drawn here: it belongs to the Aztec Foundation and is used only from their
 * official brand files, under their brand terms (aztec.network/brand).
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
      { label: "How it works", href: "/#how-it-works" },
      { label: "Private payments", href: "/#payments" },
      { label: "Download", href: "/#download" },
      { label: "Network status", href: "/status" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Documentation", href: "/docs/overview" },
      { label: "Architecture", href: "/docs/architecture" },
      { label: "Whitepaper", href: "/docs/whitepaper" },
      { label: "Developer hub", href: "/developers" },
      { label: "Source code", href: EXTERNAL_LINKS.github.repo, external: true },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/company" },
      { label: "Blog", href: "/blog" },
      { label: "Changelog", href: "/changelog" },
      { label: "Contact", href: "/contact" },
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
      { label: "Messaging by XMTP", href: EXTERNAL_LINKS.xmtp, external: true },
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
        <ArrowUpRight size={12} strokeWidth={2} aria-hidden="true" className={s.ext} />
      </a>
    );
  }
  return (
    <Link href={link.href} className={className}>
      {link.label}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className={s.footer}>
      <div className={s.wrap}>
        <div className={s.top}>
          <div className={s.lead}>
            <p className={`${s.display} hl-display`}>
              Talk freely.
              <br />
              <em>Pay privately.</em>
            </p>
            <div className={s.ctas}>
              <Link href="/chat" className={`${s.btn} ${s.btnPrimary}`}>
                Open Ledger Chat
                <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
              </Link>
              <Link href="/docs/overview" className={`${s.btn} ${s.btnGhost}`}>
                Read the documentation
              </Link>
            </div>
          </div>

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
          Humanity <em>Ledger</em>
        </span>
      </div>

      <div className={s.wrap}>
        <div className={s.bottom}>
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
            only on the Aztec test network with tokens that have no value. Please do not rely on the service to protect
            information or funds you cannot afford to lose.
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
