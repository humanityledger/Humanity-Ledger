/**
 * lib/docs/registry.ts
 *
 * The table of contents for the documentation site: every page, the group it
 * belongs to, and the order in which the sidebar and the previous and next
 * links show them.
 *
 * Adding a page: write it in lib/docs/pages, add it to a group below, and
 * if it lives under /docs it is routed automatically by app/docs/[slug].
 */

import type { Block, DocPage, NavGroup } from "./types";
import { overview, quickstart, identity, pin } from "./pages/getting-started";
import { messaging, routing, communities, calls, payments, devices } from "./pages/ledger-chat";
import { architecture, cryptography, zeroKnowledge, quantumDots, whitepaper } from "./pages/protocol";
import { securityModel, audits, bugBounty } from "./pages/security";
import { developers } from "./pages/developers";
import { about, blog, contact, status } from "./pages/company";
import { changelog } from "./pages/changelog";
import { terms, privacy, cookies, disclaimer } from "./pages/legal";

export const NAV: NavGroup[] = [
  { title: "Getting started", pages: [overview, quickstart, identity, pin] },
  { title: "Ledger Chat", pages: [messaging, routing, communities, calls, payments, devices] },
  { title: "Protocol", pages: [architecture, cryptography, zeroKnowledge, quantumDots, whitepaper] },
  { title: "Security", pages: [securityModel, audits, bugBounty] },
  { title: "Developers", pages: [developers] },
  { title: "Company", pages: [about, blog, changelog, status, contact] },
  { title: "Legal", pages: [terms, privacy, cookies, disclaimer] },
];

const ALL: { page: DocPage; group: string }[] = NAV.flatMap((g) => g.pages.map((page) => ({ page, group: g.title })));

/** Pages served by app/docs/[slug]. */
export const DOCS_SLUGS = ALL.filter((e) => e.page.href === `/docs/${e.page.slug}`).map((e) => e.page.slug);

/**
 * Slugs that used to exist. Old links keep working: each one redirects to
 * the page that now covers the same ground.
 */
export const LEGACY_SLUGS: Record<string, string> = {
  "app-hub": "/docs/overview",
  transparency: "/docs/security-model",
  "aml-kyc": "/docs/terms",
  changelog: "/changelog",
};

export function findByHref(href: string) {
  return ALL.find((e) => e.page.href === href) ?? null;
}

export function findDocBySlug(slug: string) {
  return ALL.find((e) => e.page.slug === slug && e.page.href === `/docs/${slug}`) ?? null;
}

export function neighbours(href: string) {
  const i = ALL.findIndex((e) => e.page.href === href);
  if (i < 0) return { prev: null, next: null };
  return {
    prev: i > 0 ? ALL[i - 1].page : null,
    next: i < ALL.length - 1 ? ALL[i + 1].page : null,
  };
}

/** Same rule the renderer uses, so the table of contents and the anchors agree. */
export function headingId(text: string, explicit?: string) {
  if (explicit) return explicit;
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 64);
}

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export function tocFor(blocks: Block[]): TocItem[] {
  return blocks.flatMap((b): TocItem[] => {
    if (b.t === "h2") return [{ id: headingId(b.text, b.id), text: b.text, level: 2 }];
    if (b.t === "h3") return [{ id: headingId(b.text, b.id), text: b.text, level: 3 }];
    return [];
  });
}

/** Removes the inline markup so search matches what the reader sees. */
export function plain(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

export function blockText(b: Block): string {
  switch (b.t) {
    case "p":
    case "hint":
      return plain(("title" in b && b.title ? b.title + ". " : "") + b.text);
    case "ul":
    case "ol":
      return b.items.map(plain).join(" ");
    case "steps":
      return b.items.map((i) => `${i.title}. ${plain(i.text)}`).join(" ");
    case "table":
      return [b.head.join(" "), ...b.rows.map((r) => r.map(plain).join(" "))].join(" ");
    case "defs":
      return b.items.map((i) => `${i.term}. ${plain(i.text)}`).join(" ");
    case "cards":
      return b.items.map((i) => `${i.title}. ${i.text}`).join(" ");
    case "status":
      return b.items.map((i) => `${i.label}. ${plain(i.text)}`).join(" ");
    case "code":
      return b.code;
    case "figure":
      return b.caption;
    case "person":
      return `${b.name}. ${b.role}`;
    default:
      return "";
  }
}

export interface SearchEntry {
  href: string;
  page: string;
  group: string;
  section?: string;
  summary: string;
  keywords: string;
  text: string;
}

/**
 * One entry per page and one per section, so a result can take the reader
 * straight to the heading that answers the question.
 */
export function buildSearchIndex(extra: { page: DocPage; group: string }[] = []): SearchEntry[] {
  const out: SearchEntry[] = [];
  for (const { page, group } of [...ALL, ...extra]) {
    const title = page.title ?? page.label;
    let section: { id: string; text: string } | null = null;
    let buffer: string[] = [];
    const lead: string[] = [];
    const sections: SearchEntry[] = [];

    const flush = () => {
      if (!section) return;
      sections.push({
        href: `${page.href}#${section.id}`,
        page: title,
        group,
        section: section.text,
        summary: "",
        keywords: "",
        text: buffer.join(" "),
      });
    };

    for (const b of page.blocks) {
      if (b.t === "h2" || b.t === "h3") {
        flush();
        section = { id: headingId(b.text, b.id), text: b.text };
        buffer = [];
        continue;
      }
      (section ? buffer : lead).push(blockText(b));
    }
    flush();

    out.push(
      {
        href: page.href,
        page: title,
        group,
        summary: page.summary,
        keywords: (page.keywords ?? []).join(" "),
        text: lead.join(" "),
      },
      ...sections,
    );
  }
  return out;
}
