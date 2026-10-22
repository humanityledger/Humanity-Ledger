import React from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { DocPage } from "@/lib/docs/types";
import { LEGACY_SLUGS, findDocBySlug } from "@/lib/docs/registry";
import { DocsLayout } from "./DocsLayout";

/** Shared helpers for the routes that render documentation pages. */

export function metadataFor(page: DocPage): Metadata {
  // The root layout adds the site name through its title template.
  const title = page.title ?? page.label;
  return {
    title,
    description: page.summary,
    openGraph: { title, description: page.summary, type: "article" },
  };
}

export function docMetadata(slug: string): Metadata {
  const entry = findDocBySlug(slug);
  return entry ? metadataFor(entry.page) : { title: "Not found" };
}

export function renderDoc(slug: string) {
  const legacy = LEGACY_SLUGS[slug];
  if (legacy) redirect(legacy);
  const entry = findDocBySlug(slug);
  if (!entry) notFound();
  return <DocsLayout current={entry.page.href} page={entry.page} />;
}
