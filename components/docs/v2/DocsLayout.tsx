import React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, SquarePen } from "lucide-react";
import type { DocPage } from "@/lib/docs/types";
import { findByHref, neighbours, tocFor, type TocItem } from "@/lib/docs/registry";
import { EXTERNAL_LINKS } from "@/lib/constants/links";
import { DocsHeader } from "./DocsHeader";
import { DocsNav } from "./DocsNav";
import { Toc } from "./Toc";
import { Blocks } from "./Blocks";
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

export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
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

export function DocsLayout({ current, page, group, before, after, extraToc, meta }: DocsLayoutProps) {
  const entry = findByHref(current);
  const groupName = group ?? entry?.group ?? "Documentation";
  const { prev, next } = neighbours(current);
  const toc = [...(extraToc ?? []), ...tocFor(page.blocks)];
  const source = SOURCE[groupName];

  return (
    <div className={s.root} data-docs-root>
      <DocsHeader current={current} />

      <div className={s.body}>
        <aside className={s.sidebar}>
          <DocsNav current={current} />
        </aside>

        <main className={s.main} id="docs-content">
          <article className={s.content}>
            <p className={s.crumbs}>{groupName}</p>
            <h1 className={s.title}>{page.title ?? page.label}</h1>
            <p className={s.summary}>{page.summary}</p>
            {meta}

            <div className={s.prose}>
              {before}
              <Blocks blocks={page.blocks} />
              {after}
            </div>

            <footer className={s.pageFoot}>
              <div className={s.footMeta}>
                <span>Last updated {formatDate(page.updated)}</span>
                {source && (
                  <a href={`${EXTERNAL_LINKS.github.repo}/blob/main/${source}`} target="_blank" rel="noopener noreferrer">
                    <SquarePen size={14} strokeWidth={1.9} aria-hidden="true" />
                    Suggest an edit
                  </a>
                )}
              </div>

              {(prev || next) && (
                <nav className={s.pager} aria-label="Previous and next pages">
                  {prev && (
                    <Link href={prev.href} className={s.pagerLink}>
                      <ChevronLeft size={18} strokeWidth={1.9} aria-hidden="true" />
                      <span className={s.pagerText}>
                        <span className={s.pagerLabel}>Previous</span>
                        <span className={s.pagerTitle}>{prev.label}</span>
                      </span>
                    </Link>
                  )}
                  {next && (
                    <Link href={next.href} className={`${s.pagerLink} ${s.pagerNext}`}>
                      <span className={s.pagerText}>
                        <span className={s.pagerLabel}>Next</span>
                        <span className={s.pagerTitle}>{next.label}</span>
                      </span>
                      <ChevronRight size={18} strokeWidth={1.9} aria-hidden="true" />
                    </Link>
                  )}
                </nav>
              )}

              <div className={s.siteFoot}>
                © 2026 Humanity Ledger S.L. Ledger Chat is in early access.{" "}
                <Link href="/docs/terms" className={s.link}>
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/docs/privacy" className={s.link}>
                  Privacy
                </Link>
                .
              </div>
            </footer>
          </article>
        </main>

        <Toc items={toc} />
      </div>
    </div>
  );
}
