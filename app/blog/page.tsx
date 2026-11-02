import { DocsLayout } from "@/components/docs/v2/DocsLayout";
import { BlogIndex } from "@/components/docs/v2/Extras";
import { metadataFor } from "@/components/docs/v2/route";
import { blog } from "@/lib/docs/pages/company";

export const metadata = metadataFor(blog);

export default function BlogPage() {
  return <DocsLayout current={blog.href} page={blog} after={<BlogIndex />} />;
}
