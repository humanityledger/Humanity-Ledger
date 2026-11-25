import { docMetadata, renderDoc } from "@/components/docs/v2/route";

export function generateMetadata() {
  return docMetadata("whitepaper");
}

export default function WhitepaperPage() {
  return renderDoc("whitepaper");
}
