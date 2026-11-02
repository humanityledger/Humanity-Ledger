import { docMetadata, renderDoc } from "@/components/docs/v2/route";

export const metadata = docMetadata("audits");

export default function AuditsPage() {
  return renderDoc("audits");
}
