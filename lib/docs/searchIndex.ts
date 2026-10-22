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

export const SEARCH_INDEX = [
  ...buildSearchIndex(blogEntries),
  ...RELEASES.map((r) => ({
    href: `/changelog#${r.id}`,
    page: "Changelog",
    group: "Company",
    section: r.title,
    summary: "",
    keywords: "",
    text: r.changes.map((c) => c.text).join(" "),
  })),
];
