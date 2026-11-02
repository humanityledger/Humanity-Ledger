import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DocsLayout, formatDate } from "@/components/docs/v2/DocsLayout";
import { metadataFor } from "@/components/docs/v2/route";
import { BLOG_POSTS } from "@/lib/docs/pages/company";

/** Posts that were removed because they described the product inaccurately. */
const RETIRED = new Set(["end-of-surveillance-capitalism", "cryptographic-sovereignty", "decentralized-routing-2027"]);

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  return post ? metadataFor(post.page) : { title: "Blog" };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (RETIRED.has(slug)) redirect("/blog");
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) notFound();

  return (
    <DocsLayout
      current="/blog"
      group="Blog"
      page={post.page}
      meta={
        <p style={{ margin: "14px 0 0", fontSize: 14, color: "var(--hl-ink-3)" }}>
          Published {formatDate(post.date)} by the Humanity Ledger team
        </p>
      }
    />
  );
}
