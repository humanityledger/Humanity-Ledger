import { AztecDocPage } from '@/components/landing/AztecDocPage';
import { MASSIVE_WHITEPAPER } from '@/lib/content/massiveDocs';

export default function WhitepaperPage() {
  return (
    <AztecDocPage
      eyebrow="Cryptography — Technical Whitepaper"
      title="The Humanity Ledger Platform Paper"
      subtitle="A technical description of the Humanity Ledger platform architecture, security model, privacy guarantees, and design decisions. Published October 2026."
      sections={MASSIVE_WHITEPAPER}
    />
  );
}
