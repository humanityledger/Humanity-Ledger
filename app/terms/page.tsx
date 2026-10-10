import { AztecDocPage } from '@/components/landing/AztecDocPage';

export default function TermsPage() {
  return (
    <AztecDocPage
      eyebrow="Compliance — Terms of Operation"
      title="Terms of Use"
      subtitle="The rules for using the Ledger Chat platform. By connecting your wallet and using Ledger Chat, you agree to these terms. Last updated October 2026."
      sections={[
        {
          id: 'who-we-are',
          title: '1. Who We Are',
          paragraphs: [
            'Humanity Ledger is the company operating the Ledger Chat platform, accessible at humanidfi.com. We provide a privacy-first messaging service that allows users to communicate via end-to-end encrypted messages, participate in group communities, make video and voice calls, and send crypto assets directly to other users.',
            'Humanity Ledger is not a financial institution, a bank, a broker, or a custodial wallet provider. We do not hold, manage, or facilitate the movement of your funds. Crypto payments made through Ledger Chat go directly from your wallet to the recipient wallet on the Ethereum blockchain.',
          ],
        },
        {
          id: 'eligibility',
          title: '2. Who Can Use the Platform',
          paragraphs: [
            'To use Ledger Chat you must be at least 18 years old and legally permitted to access and use the platform in your jurisdiction. By connecting your wallet, you confirm that you meet these requirements.',
            'If you are using the platform on behalf of a company or organization, you represent that you have authority to bind that organization to these terms.',
          ],
        },
        {
          id: 'account',
          title: '3. Your Account and Wallet',
          paragraphs: [
            'Your Ledger Chat identity is your Ethereum wallet address. You are responsible for maintaining the security of your wallet private keys and seed phrase. Humanity Ledger cannot recover your account if you lose access to your wallet.',
            'We strongly recommend using a hardware wallet or a wallet with hardware-backed key storage such as Apple Secure Enclave or Android StrongBox for any wallet you use to hold significant assets.',
          ],
          bullets: [
            'Keep your seed phrase offline in a secure location.',
            'Never share your private key with anyone, including Humanity Ledger.',
            'We cannot recover funds sent to an incorrect address.',
            'We cannot recover access to an account whose wallet is lost or compromised.',
          ],
        },
        {
          id: 'what-you-can-do',
          title: '4. Permitted Uses',
          paragraphs: [
            'You may use Ledger Chat for any lawful personal or business communication purpose, including sending private messages, participating in communities, making and receiving crypto payments, and sharing files and media.',
          ],
        },
        {
          id: 'prohibited',
          title: '5. Prohibited Uses',
          paragraphs: [
            'You may not use the platform for the following purposes. This list is not exhaustive.',
          ],
          bullets: [
            'Transmitting content that is unlawful, defamatory, harassing, or infringing on the intellectual property of others.',
            'Using the platform to facilitate money laundering, fraud, terrorist financing, or any transaction prohibited by applicable law.',
            'Attempting to reverse-engineer, exploit, or disrupt the platform infrastructure.',
            'Creating accounts to impersonate other people or organizations.',
            'Operating automated bots or scrapers without our written permission.',
          ],
          callout: {
            title: 'We Cannot Monitor Message Content',
            body: 'Because messages are end-to-end encrypted, we are technically unable to read the content of direct conversations. We can and will act on reports of abuse in public community spaces, and we will cooperate with law enforcement requests that meet the legal threshold in our jurisdiction.',
          },
        },
        {
          id: 'crypto',
          title: '6. Crypto Payments',
          paragraphs: [
            'Ledger Chat provides tooling that allows users to send cryptocurrency to each other. These transactions are standard Ethereum blockchain transactions. They are irreversible once confirmed on the network.',
            'Humanity Ledger does not take a fee on crypto payments, does not hold funds in escrow, and is not a party to any transaction between users. We provide the interface only. You are entirely responsible for verifying the recipient address before signing any transaction.',
          ],
          bullets: [
            'Transactions are irreversible. There is no chargeback or undo function.',
            'Always verify the full recipient address, not just the first and last characters.',
            'We are not liable for funds sent to incorrect addresses or lost due to wallet compromise.',
            'Crypto assets are volatile. We make no representations about the value of any asset.',
          ],
        },
        {
          id: 'communities',
          title: '7. Community Spaces',
          paragraphs: [
            'Communities on Ledger Chat are created and managed by their administrators. Humanity Ledger provides the infrastructure and tooling. Community administrators are responsible for setting and enforcing the rules of their own spaces.',
            'We reserve the right to remove public communities that violate these Terms or applicable law. We will provide notice to community administrators where legally possible before taking action.',
          ],
        },
        {
          id: 'liability',
          title: '8. Limitation of Liability',
          paragraphs: [
            'To the maximum extent permitted by applicable law, Humanity Ledger is not liable for indirect, incidental, or consequential damages arising from your use of the platform, including loss of funds due to wallet compromise, failed or incorrect crypto transactions, or data loss resulting from device failure.',
            'Our aggregate liability to you for any claim shall not exceed EUR 100 or the equivalent in your local currency.',
          ],
        },
        {
          id: 'governing-law',
          title: '9. Governing Law',
          paragraphs: [
            'These Terms are governed by the laws of Romania. Disputes arising from these Terms shall be resolved in the courts of Romania, without prejudice to mandatory consumer rights applicable in your country of residence if you are an EU consumer.',
            'For all legal and compliance inquiries, contact us at humanityledger@icloud.com.',
          ],
          callout: {
            title: 'Legal Contact',
            body: 'For formal legal correspondence and regulatory inquiries, contact our team by email. We commit to acknowledging formal notices within 72 hours.',
            href: 'mailto:humanityledger@icloud.com',
            hrefLabel: 'Contact Legal Team',
          },
        },
      ]}
    />
  );
}
