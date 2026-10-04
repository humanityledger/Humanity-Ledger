import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Legal Ownership & Copyright | Humanity Ledger — Stefan Antonio Cirisanu',
  description:
    'Official legal ownership declaration for Humanity Ledger. The platform, source code, brand, and all intellectual property are exclusively owned by Stefan Antonio Cirisanu.',
  authors: [{ name: 'Stefan Antonio Cirisanu', url: 'https://humanidfi.com' }],
  creator: 'Stefan Antonio Cirisanu',
  openGraph: {
    title: 'Legal Ownership — Humanity Ledger by Stefan Antonio Cirisanu',
    description: 'Official copyright and ownership declaration. Unauthorized clones and commercial copies are prohibited by law.',
    url: 'https://humanidfi.com/legal/ownership',
    siteName: 'Humanity Ledger',
    type: 'website',
  },
};

export default function OwnershipPage() {
  return (
    <main className="min-h-screen bg-white text-black font-sans px-6 py-16 max-w-4xl mx-auto">
      <header className="border-b border-black/10 pb-10 mb-12">
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-black/40 mb-4">
          Legal — Intellectual Property
        </p>
        <h1 className="text-4xl font-black tracking-tight leading-tight mb-4">
          Official Ownership Declaration
        </h1>
        <p className="text-lg text-black/60">Humanity Ledger — All Rights Reserved</p>
      </header>

      <section className="space-y-12">
        <div>
          <h2 className="text-xl font-bold mb-4">Sole Owner &amp; Founder</h2>
          <div className="bg-black text-white p-8 rounded-2xl">
            <p className="text-3xl font-black tracking-tight mb-2">Stefan Antonio Cirisanu</p>
            <p className="text-white/60 font-mono text-sm">Founder, Creator &amp; Intellectual Property Owner</p>
            <p className="text-white/60 font-mono text-sm mt-1">legal@humanidfi.com · https://humanidfi.com</p>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4">Copyright Statement</h2>
          <p className="text-black/70 leading-relaxed">
            Humanity Ledger, including all source code, user interfaces, smart contracts, Noir ZK circuits,
            brand assets, documentation, and the LedgerChat protocol, is the exclusive intellectual property
            of <strong>Stefan Antonio Cirisanu</strong>, protected under international copyright law
            including the Berne Convention.
          </p>
          <p className="text-black/70 leading-relaxed mt-4">
            Copyright &copy; 2024–2026 Stefan Antonio Cirisanu. All Rights Reserved.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4">Protected Intellectual Property</h2>
          <ul className="space-y-2">
            {[
              'The name "Humanity Ledger" and all associated trademarks',
              'The name "LedgerChat" and the encrypted messaging interface',
              'The QD Token economic model and sovereign identity architecture',
              'All Noir ZK circuit designs and Aztec Network integration',
              'The Studio Provenance protocol for artists and creators',
              'All original documentation, whitepapers, and design systems',
              'The source code at github.com/humanityledger/Humanity-Ledger',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-black/70">
                <span className="mt-1 w-2 h-2 rounded-full bg-black flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4">Notice to Unauthorized Cloners</h2>
          <div className="border-l-4 border-red-500 pl-6 py-2">
            <p className="text-black/70 leading-relaxed">
              Unauthorized forks, clones, and derivative works deployed as competing commercial products
              without express written consent of Stefan Antonio Cirisanu violate international copyright
              law. Infringers will face DMCA takedown requests and civil legal action.
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4">Report a Clone</h2>
          <p className="text-black/70 leading-relaxed mb-4">
            If you have discovered an unauthorized clone or commercial copy of Humanity Ledger,
            report it immediately:
          </p>
          <a
            href="mailto:legal@humanidfi.com"
            className="inline-block bg-black text-white px-6 py-3 font-bold tracking-tight hover:bg-black/80 transition-colors"
          >
            Report Infringement → legal@humanidfi.com
          </a>
        </div>

        <div className="border-t border-black/10 pt-8">
          <p className="text-xs font-mono text-black/30 leading-relaxed">
            First committed: 2024 · Repository: github.com/humanityledger/Humanity-Ledger ·
            Canonical URL: https://humanidfi.com · Owner: Stefan Antonio Cirisanu ·
            Contact: legal@humanidfi.com
          </p>
        </div>
      </section>
    </main>
  );
}
