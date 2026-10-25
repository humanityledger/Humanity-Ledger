import type { MetadataRoute } from "next";
import { NAV } from "@/lib/docs/registry";
import { BLOG_POSTS } from "@/lib/docs/pages/company";

/**
 * The sitemap lists only pages that exist and that describe the product as it
 * is today: the landing page, the sign in page and every page in the
 * documentation registry. It is generated from lib/docs/registry.ts so a page
 * added there appears here without anyone having to remember.
 *
 * The previous version listed routes that never existed (/qd-token,
 * /sovereign-identity, /aztec-sequencer) and superseded legal pages.
 */

const BASE = "https://humanidfi.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const docs = NAV.flatMap((group) =>
    group.pages.map((page) => ({
      url: `${BASE}${page.href}`,
      lastModified: page.updated,
      changeFrequency: "monthly" as const,
      priority: group.title === "Legal" ? 0.5 : 0.7,
    })),
  );

  const posts = BLOG_POSTS.map((post) => ({
    url: `${BASE}/blog/${post.slug}`,
    lastModified: post.date,
    changeFrequency: "yearly" as const,
    priority: 0.5,
  }));

  return [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/connect`, changeFrequency: "monthly", priority: 0.8 },
    ...docs,
    ...posts,
  ];
}
