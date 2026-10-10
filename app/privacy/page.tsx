import { AztecDocPage } from '@/components/landing/AztecDocPage';

export default function PrivacyPage() {
  return (
    <AztecDocPage
      eyebrow="Compliance — Privacy Policy"
      title="Privacy Policy"
      subtitle="What we collect, what we do not collect, and how we protect your information. Last updated October 2026."
      sections={[
        {
          id: 'principles',
          title: '1. Core Privacy Principles',
          paragraphs: [
            'Humanity Ledger is built around a simple idea: we should not know anything about you that we do not need to know. Your name, your location, your payment history, and the contents of your messages are none of our business. We have designed the platform from the ground up to reflect this.',
            'We collect only what is strictly necessary to operate the service. We do not sell data. We do not share data with advertisers. We do not build behavioral profiles.',
          ],
          bullets: [
            'No analytics tracking: We do not use Google Analytics, Meta Pixel, or any behavioral tracking tools.',
            'No message storage: Message content is encrypted on your device and never stored on our servers.',
            'No personal data required: You do not need to provide a name, email address, or phone number to use Ledger Chat.',
            'No payment data retained: Crypto payments settle on the blockchain. We do not see or store payment amounts or transaction history.',
          ],
        },
        {
          id: 'what-we-collect',
          title: '2. What We Collect',
          paragraphs: [
            'We collect and store only the following data.',
          ],
          bullets: [
            'Wallet address: Your Ethereum wallet address is your unique identifier. It is stored in our database as your account.',
            'Session data: A secure, encrypted session cookie is stored in your browser when you log in. It expires after 30 days or when you log out.',
            'Community metadata: If you create or join a community, we store your membership, your role, and your activity within that community (such as which channels you have joined).',
            'IP address (temporary): Standard server logs include your IP address for security and abuse prevention. These logs are retained for 30 days and then deleted.',
            'Optional profile data: If you choose to set a display name or avatar, that data is stored.',
          ],
          callout: {
            title: 'What We Do Not Store',
            body: 'Message content, media, voice and video call data, crypto payment amounts and transaction details, and any form of government identification or biometric data. We do not have it and we do not want it.',
          },
        },
        {
          id: 'messages',
          title: '3. How Messages Are Protected',
          paragraphs: [
            'All messages in Ledger Chat are end-to-end encrypted using the XMTP protocol before they leave your device. This means that the encrypted data that travels across our infrastructure cannot be read by us or anyone else without the private keys held only on your device.',
            'We relay encrypted message packets between users and then discard them. We do not persist message content in our databases. The authoritative copy of your message history lives on your device in your browser local storage.',
          ],
        },
        {
          id: 'payments',
          title: '4. Crypto Payments and Financial Data',
          paragraphs: [
            'When you send crypto to another user, the transaction is processed entirely between your wallet and the Ethereum blockchain. Humanity Ledger does not touch your funds at any point. We do not see the transaction before it happens, we do not hold the funds, and we do not take a fee.',
            'After a transaction is confirmed, a receipt is sent through the encrypted XMTP channel and stored on your device. We do not keep a record of your payment history.',
          ],
        },
        {
          id: 'gdpr',
          title: '5. Your Rights Under GDPR',
          paragraphs: [
            'If you are resident in the European Economic Area, you have the following rights under the General Data Protection Regulation.',
          ],
          bullets: [
            'Right of access: You can request a copy of all data we hold about you. Given our minimal data collection, this will typically consist only of your wallet address, optional profile information, and your community memberships.',
            'Right to erasure: You can request deletion of your account and all associated data. We will delete your record from our database within 30 days. Message history, which is stored on your own device, is outside our control.',
            'Right to object: You can object to our processing of your data. Contact us at humanityledger@icloud.com.',
            'Right to lodge a complaint: You can file a complaint with your national data protection authority.',
          ],
        },
        {
          id: 'contact',
          title: '6. Contact',
          paragraphs: [
            'For all privacy inquiries, data subject requests, and complaints, contact us at humanityledger@icloud.com. We will respond within 72 hours.',
            'This Privacy Policy was last reviewed in October 2026.',
          ],
        },
      ]}
    />
  );
}
