import type { Metadata } from "next";
import { DOCS_SLUGS } from "@/lib/docs/registry";
import { docMetadata, renderDoc } from "@/components/docs/v2/route";

/**
 * Every page under /docs. Content lives in lib/docs/pages; the order and
 * grouping live in lib/docs/registry.ts.
 */

export const dynamicParams = true;

/** These two have their own route folders, which take precedence. */
const OWN_ROUTES = new Set(["whitepaper", "audits"]);

export function generateStaticParams() {
  return DOCS_SLUGS.filter((slug) => !OWN_ROUTES.has(slug)).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return docMetadata(slug);
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderDoc(slug);
}
