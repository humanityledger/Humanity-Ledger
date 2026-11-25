import React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, SquarePen } from "lucide-react";
import type { DocPage } from "@/lib/docs/types";
import { findByHref, neighbours, tocFor, type TocItem } from "@/lib/docs/registry";
import { EXTERNAL_LINKS } from "@/lib/constants/links";
import { LEGAL_ENTITY } from "@/lib/constants/legalEntity";
import { DocsHeader } from "./DocsHeader";
import { DocsNav } from "./DocsNav";
import { Toc } from "./Toc";
import { Blocks } from "./Blocks";
import { ImmersiveField } from "@/components/immersive/ImmersiveField";
import { SiteFooter } from "@/components/landing/v2/SiteFooter";
import { getServerLocale, getT } from "@/lib/i18n/server";
import { translatePage } from "@/lib/docs/i18n";
import { docsTranslator } from "@/lib/docs/i18n-server";
import { HTML_LANG, type Locale } from "@/lib/i18n/locales";
import s from "./Docs.module.css";

/**
 * DocsLayout — the frame every documentation, company and legal page uses.
 *
 * Header with search, navigation on the left, the page in the middle, and
 * "On this page" on the right. Below 1280px the right column folds away,
 * below 1024px the navigation moves into a drawer.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function formatDate(iso: string, locale: Locale = "en") {
  const [y, m, d] = iso.split("-").map(Number);
  if (locale === "en") return `${d} ${MONTHS[m - 1]} ${y}`;
  try {
    return new Intl.DateTimeFormat(HTML_LANG[locale], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(y, m - 1, d)),
    );
  } catch {
    return `${d} ${MONTHS[m - 1]} ${y}`;
  }
}

/** Which source file holds a page, for the "Suggest an edit" link. */
const SOURCE: Record<string, string> = {
  "Getting started": "lib/docs/pages/getting-started.ts",
  "Ledger Chat": "lib/docs/pages/ledger-chat.ts",
  Protocol: "lib/docs/pages/protocol.ts",
  Security: "lib/docs/pages/security.ts",
  Developers: "lib/docs/pages/developers.ts",
  Company: "lib/docs/pages/company.ts",
  Legal: "lib/docs/pages/legal.ts",
  Blog: "lib/docs/pages/company.ts",
};

export interface DocsLayoutProps {
  /** The sidebar entry to highlight. */
  current: string;
  page: DocPage;
  /** Overrides the group shown above the title. */
  group?: string;
  /** Extra content rendered before the page blocks, for interactive pages. */
  before?: React.ReactNode;
  /** Extra content rendered after the page blocks. */
  after?: React.ReactNode;
  /** Extra headings to include in "On this page". */
  extraToc?: TocItem[];
  /** Line under the summary, such as a byline. */
  meta?: React.ReactNode;
}

export async function DocsLayout({ current, page: original, group, before, after, extraToc, meta }: DocsLayoutProps) {
  const t = await getT();
  const locale = await getServerLocale();
  // The page in the reader's language (lib/docs/i18n.ts); interface texts fall back to t().
  const tr = await docsTranslator();
  const page = translatePage(original, tr);
  const label = (text: string) => (tr && tr(text) !== text ? tr(text) : t(text));
  const entry = findByHref(current);
  const groupName = group ?? entry?.group ?? "Documentation";
  const { prev, next } = neighbours(current);
  const toc = [...(extraToc ?? []), ...tocFor(page.blocks)];
  const source = SOURCE[groupName];

  return (
    <div className={s.root} data-docs-root>
      <ImmersiveField variant="quiet" />
      <DocsHeader current={current} />

      <div className={s.body}>
        <aside className={s.sidebar}>
          <DocsNav current={current} />
        </aside>

        <main className={s.main} id="docs-content">
          <article className={s.content}>
            <p className={s.crumbs}>{label(groupName)}</p>
            <h1 className={s.title}>{label(original.title ?? original.label)}</h1>
            <p className={s.summary}>{label(original.summary)}</p>
            {meta}

            <div className={s.prose}>
              {before}
              <Blocks blocks={page.blocks} tr={tr} />
              {after}
            </div>

            <footer className={s.pageFoot}>
              <div className={s.footMeta}>
                <span>{t("Last updated {date}", { date: formatDate(page.updated, locale) })}</span>
                {source && (
                  <a href={`${EXTERNAL_LINKS.github.repo}/blob/main/${source}`} target="_blank" rel="noopener noreferrer">
                    <SquarePen size={14} strokeWidth={1.9} aria-hidden="true" />
                    {t("Suggest an edit")}
                  </a>
                )}
              </div>

              {(prev || next) && (
                <nav className={s.pager} aria-label={t("Previous and next pages")}>
                  {prev && (
                    <Link href={prev.href} className={s.pagerLink}>
                      <ChevronLeft size={18} strokeWidth={1.9} aria-hidden="true" />
                      <span className={s.pagerText}>
                        <span className={s.pagerLabel}>{t("Previous")}</span>
                        <span className={s.pagerTitle}>{label(prev.label)}</span>
                      </span>
                    </Link>
                  )}
                  {next && (
                    <Link href={next.href} className={`${s.pagerLink} ${s.pagerNext}`}>
                      <span className={s.pagerText}>
                        <span className={s.pagerLabel}>{t("Next")}</span>
                        <span className={s.pagerTitle}>{label(next.label)}</span>
                      </span>
                      <ChevronRight size={18} strokeWidth={1.9} aria-hidden="true" />
                    </Link>
                  )}
                </nav>
              )}

              <div className={s.siteFoot}>
                {t("© 2026 {name}, trading as {tradingName}. Ledger Chat is in early access. {notice}, {terms} and {privacy}.", {
                  name: LEGAL_ENTITY.name,
                  tradingName: LEGAL_ENTITY.tradingName,
                  notice: (
                    <Link key="n" href="/docs/legal-notice" className={s.link}>
                      {t("Legal notice")}
                    </Link>
                  ),
                  terms: (
                    <Link key="t" href="/docs/terms" className={s.link}>
                      {t("Terms")}
                    </Link>
                  ),
                  privacy: (
                    <Link key="p" href="/docs/privacy" className={s.link}>
                      {t("Privacy")}
                    </Link>
                  ),
                })}
              </div>
            </footer>
          </article>
        </main>

        <Toc items={toc} />
      </div>
      <SiteFooter />
    </div>
  );
}
