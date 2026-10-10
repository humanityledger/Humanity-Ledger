import { AztecDocPage } from '@/components/landing/AztecDocPage';

export default function SecurityAuditsPage() {
  return (
    <AztecDocPage
      eyebrow="Cryptography — Security Audits"
      title="Security Reviews"
      subtitle="We take security seriously at every layer of the platform. This page documents our approach to threat modeling, code review, and responsible disclosure."
      sections={[
        {
          id: 'approach',
          title: 'Our Security Philosophy',
          paragraphs: [
            'Ledger Chat handles encrypted personal communications and facilitates direct crypto payments between users. Both of these involve sensitive data and real financial risk. We apply a defense-in-depth approach where no single point of failure can compromise a user.',
            'Our core principle is that even if our servers were completely compromised, an attacker should gain nothing useful. Message content is encrypted before leaving the user device. Crypto payments bypass our infrastructure entirely. We design for the assumption that our systems will eventually face a serious attack.',
          ],
        },
        {
          id: 'message-security',
          title: 'End to End Encryption',
          paragraphs: [
            'All one-on-one and group messages are encrypted using the XMTP protocol, which implements the Double Ratchet Algorithm, the same cryptographic protocol used by Signal. The encryption keys are derived from user wallet signatures and never leave the user device.',
            'We have reviewed the XMTP encryption implementation for correctness and have verified that the key derivation process produces unique, non-repeating session keys for each conversation.',
          ],
          bullets: [
            'Algorithm: Double Ratchet over X3DH key agreement.',
            'Key storage: Browser local storage and IndexedDB, never transmitted to our servers.',
            'Forward secrecy: Compromise of one session key cannot expose past or future messages.',
          ],
        },
        {
          id: 'payment-security',
          title: 'Crypto Payment Security',
          paragraphs: [
            'Crypto payments in Ledger Chat are constructed and signed entirely in the user browser using the Wagmi library. The transaction is broadcast directly to the Ethereum network. Humanity Ledger infrastructure is not in the payment path at any point.',
            'We verify the recipient address on-screen before the user signs the transaction. An irreversibility warning is shown on every payment screen. The user must confirm in their wallet before any value moves.',
          ],
          bullets: [
            'No platform custody: We never hold, escrow, or proxy user funds.',
            'Standard ERC-20 and ETH transfers: No custom smart contracts involved in payments.',
            'Recipient verification: Address is displayed in full before signing.',
            'Transaction receipt: Both parties see the confirmed transaction hash in chat.',
          ],
        },
        {
          id: 'infrastructure',
          title: 'Infrastructure Security',
          paragraphs: [
            'Our backend runs on Railway, a managed cloud platform. All traffic is encrypted in transit using TLS 1.3. Database access is restricted to the application server via private networking. No database port is exposed to the public internet.',
            'We do not store message content in our database. The community and account database contains metadata only: community names, member lists, channel structures, and timestamps. No message text, no media, no payment details.',
          ],
        },
        {
          id: 'disclosure',
          title: 'Responsible Disclosure',
          paragraphs: [
            'If you discover a security vulnerability in the Ledger Chat platform, please report it to us privately before making any public disclosure. We commit to acknowledging your report within 48 hours and providing a timeline for the fix.',
            'We recognize and reward responsible disclosure. Security researchers who report valid vulnerabilities will be credited publicly if they wish.',
          ],
          callout: {
            title: 'Report a Vulnerability',
            body: 'Send security reports to security@humanityledger.com. Use PGP encryption if the vulnerability is critical. We will not take legal action against researchers who follow responsible disclosure guidelines.',
          },
        },
      ]}
    />
  );
}
