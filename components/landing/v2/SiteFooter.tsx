import React from "react";
import Link from "next/link";
import { Github, Linkedin } from "lucide-react";
import { HLLogo } from "@/components/shared/HLLogo";
import { EXTERNAL_LINKS } from "@/lib/constants/links";
import s from "./SiteFooter.module.css";

/**
 * SiteFooter — the footer for every public page.
 *
 * Headings are plain sentence case. The fine print at the bottom states the
 * product's real stage, because the footer is where careful readers look for
 * exactly that.
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
      { label: "Download", href: "/#download" },
      { label: "Network status", href: "/status" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Documentation", href: "/docs/overview" },
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
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/docs/privacy" },
      { label: "Terms of Service", href: "/docs/terms" },
      { label: "Security audits", href: "/docs/audits" },
      { label: "Report a vulnerability", href: "/docs/bug-bounty" },
    ],
  },
];

function FooterLinkItem({ link }: { link: FooterLink }) {
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer">
        {link.label}
      </a>
    );
  }
  return <Link href={link.href}>{link.label}</Link>;
}

export function SiteFooter() {
  return (
    <footer className={s.footer}>
      <div className={s.wrap}>
        <div className={s.top}>
          <div className={s.brand}>
            <Link href="/" aria-label="Humanity Ledger home" style={{ width: "fit-content" }}>
              <HLLogo size={32} />
            </Link>
            <p className={s.tagline}>
              Private messaging and payments, tied to the wallet you already hold. Ledger Chat is our first application.
            </p>
            <div className={s.social}>
              <a href={EXTERNAL_LINKS.github.repo} target="_blank" rel="noopener noreferrer" aria-label="Humanity Ledger on GitHub">
                <Github size={17} strokeWidth={1.75} />
              </a>
              <a href={EXTERNAL_LINKS.linkedin} target="_blank" rel="noopener noreferrer" aria-label="Humanity Ledger on LinkedIn">
                <Linkedin size={17} strokeWidth={1.75} />
              </a>
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

        <div className={s.bottom}>
          <p className={s.fine}>
            Ledger Chat is in early access. Our contracts have not been independently audited and the Aztec network is in
            its Alpha stage, so please do not rely on it to protect information or funds you cannot afford to lose.
          </p>
          <p className={s.fine}>
            © 2026 Humanity Ledger. Not a bank, broker or financial institution, and nothing on this site is financial
            advice. Not affiliated with Humanity Protocol.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
