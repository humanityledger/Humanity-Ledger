import { AztecDocPage } from '@/components/landing/AztecDocPage';
import { SECURITY_SECTIONS } from '@/lib/content/footerPagesAztec';

export default function AuditsPage() {
  return (
    <AztecDocPage
      eyebrow="Cryptography · Security Audits"
      title="Protocol Security & Audits"
      subtitle="A comprehensive record of the cryptographic security audits, formal verification reports, and penetration tests conducted on the Humanity Ledger protocol. We adhere to the highest standards of mathematical soundness and open-source transparency."
      sections={SECURITY_SECTIONS}
    />
  );
}
