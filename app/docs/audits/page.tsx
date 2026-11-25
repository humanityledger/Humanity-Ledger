import { docMetadata, renderDoc } from "@/components/docs/v2/route";

export function generateMetadata() {
  return docMetadata("audits");
}

export default function AuditsPage() {
  return renderDoc("audits");
}
