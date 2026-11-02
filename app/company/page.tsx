import { DocsLayout } from "@/components/docs/v2/DocsLayout";
import { metadataFor } from "@/components/docs/v2/route";
import { about } from "@/lib/docs/pages/company";

export const metadata = metadataFor(about);

export default function CompanyPage() {
  return <DocsLayout current={about.href} page={about} />;
}
