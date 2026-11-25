/**
 * The search index for the documentation site.
 *
 * Imported lazily by the search dialog the first time it opens, so the text
 * of every page is only downloaded by readers who actually search.
 */

import { buildSearchIndex } from "./registry";
import { BLOG_POSTS } from "./pages/company";
import { RELEASES } from "./pages/changelog";

const blogEntries = BLOG_POSTS.map((p) => ({ page: p.page, group: "Blog" }));

import type { DocPage } from "./types";

/** The index as a reader in another language sees it: `view` translates a page, `label` a text. */
export function buildIndex(view?: (p: DocPage) => DocPage, label: (s: string) => string = (s) => s) {
  return [
    ...buildSearchIndex(blogEntries, view, label),
    ...RELEASES.map((r) => ({
      href: `/docs/changelog#${r.id}`,
      page: label("Changelog"),
      group: label("Company"),
      section: label(r.title),
      summary: "",
      keywords: "",
      text: r.changes.map((c) => label(c.text)).join(" "),
    })),
  ];
}

export const SEARCH_INDEX = buildIndex();
