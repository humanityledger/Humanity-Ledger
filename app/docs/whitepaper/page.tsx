import { AztecDocPage } from '@/components/landing/AztecDocPage';
import { WHITEPAPER_SECTIONS } from '@/lib/content/footerPagesAztec';

export default function WhitepaperPage() {
  return (
    <AztecDocPage
      eyebrow="Cryptography · Technical Whitepaper"
      title="The Humanity Ledger Yellow Paper"
      subtitle="A formal specification of the Humanity Ledger cryptographic protocol. This document presents the complete system architecture, cryptographic primitives, economic model, and security assumptions underlying the Humanity Ledger — a privacy-preserving protocol built natively on the Aztec Network."
      sections={WHITEPAPER_SECTIONS}
    />
  );
}
