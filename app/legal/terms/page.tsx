import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | Humanity Ledger',
  description:
    'Terms of Service for Humanity Ledger. By using this app you agree to these terms.',
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white text-black font-sans px-6 py-16 max-w-3xl mx-auto">
      <header className="border-b border-black/10 pb-10 mb-12">
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-black/40 mb-4">Legal</p>
        <h1 className="text-4xl font-black tracking-tight leading-tight mb-4">Terms of Service</h1>
        <p className="text-black/50 text-sm">Last updated: September 2026 · Humanity Ledger · humanidfi.com</p>
      </header>

      <section className="space-y-10 text-[15px] leading-relaxed text-black/80">

        <div>
          <h2 className="text-xl font-bold mb-3 text-black">1. Acceptance of Terms</h2>
          <p>
            By downloading, installing, or using Humanity Ledger or Ledger Chat (collectively, "the Service"),
            you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3 text-black">2. Eligibility</h2>
          <p>
            You must be at least 13 years old to use this Service. By using the Service, you represent that you
            meet this age requirement. If you are under 18, you must have permission from a parent or legal guardian.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3 text-black">3. Your Account</h2>
          <p>
            Your account is identified by your wallet address. You are responsible for maintaining the security of
            your private key. Humanity Ledger cannot recover a lost private key and will never ask for it. You are
            responsible for all activity that occurs under your account.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3 text-black">4. Acceptable Use</h2>
          <p>You agree not to use the Service to:</p>
          <ul className="space-y-2 list-disc list-inside mt-2">
            <li>Transmit any content that is illegal, harmful, threatening, abusive, or harassing.</li>
            <li>Distribute spam, malware, or any unsolicited commercial messages.</li>
            <li>Violate the rights of any third party, including intellectual property rights.</li>
            <li>Attempt to gain unauthorized access to any part of the Service or its infrastructure.</li>
            <li>Use the Service for any fraudulent or deceptive purpose.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3 text-black">5. Content</h2>
          <p>
            You retain ownership of any content you send through the Service. Because your messages are
            end-to-end encrypted, Humanity Ledger cannot access, moderate, or remove message content. You are
            solely responsible for the content you transmit.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3 text-black">6. Digital Assets</h2>
          <p>
            Humanity Ledger may offer features relating to digital assets and tokens (including Quantum Dots).
            These features are provided for informational and utility purposes only and do not constitute financial
            advice. Digital assets are highly volatile. You use these features at your own risk.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3 text-black">7. Service Availability</h2>
          <p>
            We aim to keep the Service available at all times, but we do not guarantee uninterrupted availability.
            We may perform maintenance, updates, or changes to the Service at any time. We are not liable for any
            disruption to the Service.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3 text-black">8. Intellectual Property</h2>
          <p>
            The Service, including all source code, design, trademarks, and brand assets, is the intellectual
            property of Stefan Antonio Cirisanu and Humanity Ledger. You may not copy, reproduce, or distribute
            any part of the Service without express written permission.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3 text-black">9. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, Humanity Ledger and its owners shall not be liable for any
            indirect, incidental, special, or consequential damages arising from your use of the Service. Your sole
            remedy for dissatisfaction with the Service is to stop using it.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3 text-black">10. Termination</h2>
          <p>
            We reserve the right to suspend or terminate your access to the Service at any time if we believe you
            have violated these Terms. You may also stop using the Service and delete your account at any time.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3 text-black">11. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. Continued use of the Service after changes constitutes
            acceptance of the updated Terms. We will notify you of significant changes in the app.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3 text-black">12. Contact</h2>
          <p>
            For any questions about these Terms, contact us at:{' '}
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
