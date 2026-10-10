import { AztecDocPage } from '@/components/landing/AztecDocPage';
import { MASSIVE_DEVELOPERS } from '@/lib/content/massiveDocs';

export default function DevelopersPage() {
  return (
    <AztecDocPage
      eyebrow="Developers and Protocol Engineering"
      title="Developer Documentation"
      subtitle="Technical reference for integrating with the Humanity Ledger platform. Learn how to authenticate users with their wallets, send messages via the XMTP layer, and build on top of our community and identity infrastructure."
      sections={MASSIVE_DEVELOPERS}
    />
  );
}
