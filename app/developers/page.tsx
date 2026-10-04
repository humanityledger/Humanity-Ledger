import { AztecDocPage } from '@/components/landing/AztecDocPage';
import { DEVELOPER_SECTIONS } from '@/lib/content/footerPagesAztec';

export default function DevelopersPage() {
  return (
    <AztecDocPage
      eyebrow="Developers & Protocol Engineering"
      title="Developer Documentation"
      subtitle="The complete technical reference for building on the Humanity Ledger protocol. From Zero Knowledge circuit design in Noir to XMTP relay integration and smart contract deployment on Aztec, everything you need to build sovereign cryptographic applications. Now featuring over 60 complete integration modules."
      sections={DEVELOPER_SECTIONS}
    />
  );
}
