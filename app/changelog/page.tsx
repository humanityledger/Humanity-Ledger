import { DocsLayout } from "@/components/docs/v2/DocsLayout";
import { CHANGELOG_TOC, ChangelogList } from "@/components/docs/v2/Extras";
import { metadataFor } from "@/components/docs/v2/route";
import { changelog } from "@/lib/docs/pages/changelog";

export const metadata = metadataFor(changelog);

export default function ChangelogPage() {
  return <DocsLayout current={changelog.href} page={changelog} after={<ChangelogList />} extraToc={CHANGELOG_TOC} />;
}
