import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Humanity Ledger',
  description:
    'Privacy Policy for Humanity Ledger and Ledger Chat. We do not sell your data. All messages are end-to-end encrypted on your device.',
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-black font-sans px-6 py-16 max-w-3xl mx-auto">
      <header className="border-b border-black/10 pb-10 mb-12">
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-black/40 mb-4">Legal</p>
        <h1 className="text-4xl font-black tracking-tight leading-tight mb-4">Privacy Policy</h1>
        <p className="text-black/50 text-sm">Last updated: September 2026 · Humanity Ledger · humanidfi.com</p>
      </header>

      <section className="space-y-10 text-[15px] leading-relaxed text-black/80">

        <div>
          <h2 className="text-xl font-bold mb-3 text-black">Overview</h2>
          <p>
            Humanity Ledger ("we", "the app", "the service") is built with privacy as a core principle. We collect the
            minimum information necessary to operate the service. We do not sell, share, or rent your personal data to
            any third party. This policy describes what information we handle, why, and how you can control it.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3 text-black">What We Do Not Collect</h2>
          <ul className="space-y-2 list-disc list-inside">
            <li>We do not read or store the content of your messages. All messages are encrypted on your device before being sent.</li>
            <li>We do not collect your name, email address, or phone number unless you voluntarily provide them for account recovery.</li>
            <li>We do not track your location unless you explicitly choose to share it in a conversation.</li>
            <li>We do not sell your data to advertisers. There are no ads in Humanity Ledger.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3 text-black">What We Do Collect</h2>
          <ul className="space-y-2 list-disc list-inside">
            <li><strong>Wallet address:</strong> Used as your account identifier. This is a public blockchain address, not personally identifiable on its own.</li>
            <li><strong>Message delivery metadata:</strong> Timestamps and encrypted delivery status, stored transiently and not linked to your identity.</li>
            <li><strong>Anonymous usage analytics:</strong> Aggregate, non-identifiable data to understand how features are used (e.g., how many users open the chat tab). No user-level tracking.</li>
            <li><strong>Technical logs:</strong> Server-side error logs for debugging, automatically deleted after 14 days.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3 text-black">Message Encryption</h2>
          <p>
            All messages sent through Ledger Chat are encrypted end-to-end using the XMTP protocol. This means only
            you and the person you are communicating with can read the message content. Humanity Ledger does not have
            the ability to read your messages, and neither can any third party without access to your private key.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3 text-black">Data Storage</h2>
          <p>
            Your profile information (display name, avatar) is stored in our database only if you choose to set it.
            Your messages are stored in a distributed, encrypted relay network. Your private key never leaves your device.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3 text-black">Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="space-y-2 list-disc list-inside mt-2">
            <li>Delete your account and all associated data at any time from the app settings.</li>
            <li>Request a copy of any data we hold about you by contacting us at legal@humanidfi.com.</li>
            <li>Opt out of anonymous analytics in the app settings under Data &amp; Storage.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3 text-black">Children</h2>
          <p>
            Humanity Ledger is not intended for users under the age of 13. We do not knowingly collect data from
            children. If you believe a child has created an account, please contact us at legal@humanidfi.com and we
            will delete the account promptly.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3 text-black">Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. We will notify you of significant changes through the app.
            Continued use of the service after changes constitutes acceptance of the updated policy.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3 text-black">Contact</h2>
          <p>
            For any privacy-related questions, contact us at:{' '}
            <a href="mailto:legal@humanidfi.com" className="underline hover:no-underline">
              legal@humanidfi.com
            </a>
          </p>
        </div>

        <div className="border-t border-black/10 pt-8">
          <p className="text-xs font-mono text-black/30">
            Humanity Ledger · humanidfi.com · Owner: Stefan Antonio Cirisanu · Copyright 2024-2026. All Rights Reserved.
          </p>
        </div>
      </section>
    </main>
  );
}
