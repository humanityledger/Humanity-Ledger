import { DocsLayout } from "@/components/docs/v2/DocsLayout";
import { metadataFor } from "@/components/docs/v2/route";
import { developers } from "@/lib/docs/pages/developers";

export const metadata = metadataFor(developers);

export default function DevelopersPage() {
  return <DocsLayout current={developers.href} page={developers} />;
}
