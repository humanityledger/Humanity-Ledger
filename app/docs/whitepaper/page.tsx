import { docMetadata, renderDoc } from "@/components/docs/v2/route";

export const metadata = docMetadata("whitepaper");

export default function WhitepaperPage() {
  return renderDoc("whitepaper");
}
