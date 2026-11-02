import { DocsLayout } from "@/components/docs/v2/DocsLayout";
import { StatusPanel } from "@/components/docs/v2/StatusPanel";
import { metadataFor } from "@/components/docs/v2/route";
import { status } from "@/lib/docs/pages/company";

export const metadata = metadataFor(status);

export default function StatusPage() {
  return <DocsLayout current={status.href} page={status} before={<StatusPanel />} />;
}
