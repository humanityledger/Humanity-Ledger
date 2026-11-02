import { DocsLayout } from "@/components/docs/v2/DocsLayout";
import { metadataFor } from "@/components/docs/v2/route";
import { contact } from "@/lib/docs/pages/company";

export const metadata = metadataFor(contact);

export default function ContactPage() {
  return <DocsLayout current={contact.href} page={contact} />;
}
