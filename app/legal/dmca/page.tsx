import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DMCA Policy | Humanity Ledger — Stefan Antonio Cirisanu',
  description:
    'DMCA policy and copyright infringement reporting for Humanity Ledger. All IP owned by Stefan Antonio Cirisanu.',
  robots: { index: true, follow: true },
};

export default function DMCAPage() {
  return (
    <main className="min-h-screen bg-white text-black font-sans px-6 py-16 max-w-4xl mx-auto">
      <header className="border-b border-black/10 pb-10 mb-12">
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-black/40 mb-4">
          Legal — DMCA Policy
        </p>
        <h1 className="text-4xl font-black tracking-tight mb-4">DMCA Copyright Policy</h1>
        <p className="text-black/60">Effective: 2024 · Owner: Stefan Antonio Cirisanu</p>
      </header>

      <section className="space-y-10">
        <div>
          <h2 className="text-xl font-bold mb-3">Copyright Owner</h2>
          <p className="text-black/70">
            All intellectual property within Humanity Ledger is owned exclusively by{' '}
            <strong>Stefan Antonio Cirisanu</strong>. Unauthorized reproduction or commercial
            exploitation is a violation of the Digital Millennium Copyright Act (DMCA) and
            international copyright treaties.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">Reporting Infringement</h2>
          <p className="text-black/70 mb-4">
            To report a DMCA violation, send a takedown notice to:
          </p>
          <div className="bg-black/5 border border-black/10 p-6 font-mono text-sm">
            <p><strong>DMCA Agent:</strong> Stefan Antonio Cirisanu</p>
            <p><strong>Email:</strong> legal@humanidfi.com</p>
            <p><strong>Website:</strong> https://humanidfi.com</p>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">Required Information</h2>
          <ol className="list-decimal list-inside space-y-2 text-black/70">
            <li>Your full legal name and contact information</li>
            <li>URL of the infringing content or repository</li>
            <li>A description of the original copyrighted work</li>
            <li>A statement that you are the copyright owner or authorized to act on their behalf</li>
            <li>A statement under penalty of perjury that the information is accurate</li>
          </ol>
        </div>

        <div className="border-t border-black/10 pt-8">
          <p className="text-xs font-mono text-black/30">
            Copyright (c) 2024-2026 Stefan Antonio Cirisanu. All Rights Reserved.
            Humanity Ledger · humanidfi.com · legal@humanidfi.com
          </p>
        </div>
      </section>
    </main>
  );
}
