import { Metadata } from 'next';
import { headers } from 'next/headers';

export const metadata: Metadata = {
  title: 'Clone Registry & Deployment Monitor | Humanity Ledger Admin',
  description: 'Private admin panel — Stefan Antonio Cirisanu — Humanity Ledger clone detection registry.',
  robots: { index: false, follow: false },
};

/**
 * Clone Registry Admin Dashboard
 * ============================================================
 * Copyright (c) 2024-2026 Stefan Antonio Cirisanu. All Rights Reserved.
 * Access: Only with valid HL_ADMIN_KEY query param.
 *
 * Shows all deployments of the Humanity Ledger codebase that have
 * fired the DeploymentBeacon, including unauthorized commercial clones.
 */
async function getCloneData(adminKey: string) {
  try {
    const res = await fetch(
      `https://humanidfi.com/api/internal/beacon?key=${encodeURIComponent(adminKey)}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function CloneRegistryPage({
  searchParams,
}: {
  searchParams: { key?: string };
}) {
  const adminKey = searchParams?.key || '';
  const data     = adminKey ? await getCloneData(adminKey) : null;
  const isAuthed = !!data && !data.error;

  return (
    <main className="min-h-screen bg-black text-white font-mono px-6 py-12 max-w-6xl mx-auto">
      <header className="border-b border-white/10 pb-8 mb-10">
        <p className="text-xs tracking-[0.3em] uppercase text-white/30 mb-3">
          Humanity Ledger — Admin
        </p>
        <h1 className="text-3xl font-black tracking-tight">
          Clone Detection Registry
        </h1>
        <p className="text-white/50 text-sm mt-2">
          Owner: Stefan Antonio Cirisanu · legal@humanidfi.com
        </p>
      </header>

      {!adminKey && (
        <div className="bg-white/5 border border-white/10 p-6 rounded-xl">
          <p className="text-white/60 text-sm mb-4">
            Access requires admin authentication. Add <code className="text-green-400">?key=YOUR_HL_ADMIN_KEY</code> to the URL.
          </p>
          <p className="text-xs text-white/30">
            Set <code>HL_ADMIN_KEY</code> in your Railway environment variables.
          </p>
        </div>
      )}

      {adminKey && !isAuthed && (
        <div className="bg-red-900/30 border border-red-500/30 p-6 rounded-xl">
          <p className="text-red-400 font-bold">⛔ Invalid admin key</p>
        </div>
      )}

      {isAuthed && data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[
              { label: 'Total Deployments', value: data.summary?.total ?? 0, color: 'text-white' },
              { label: '⚠️ CLONES DETECTED', value: data.summary?.clones ?? 0, color: 'text-red-400' },
              { label: 'Canonical Instances', value: data.summary?.canonical ?? 0, color: 'text-green-400' },
              { label: 'Unique Origins', value: data.summary?.uniqueOrigins?.length ?? 0, color: 'text-yellow-400' },
            ].map((card) => (
              <div key={card.label} className="bg-white/5 border border-white/10 rounded-xl p-5">
                <p className={`text-3xl font-black ${card.color}`}>{card.value}</p>
                <p className="text-xs text-white/40 mt-1">{card.label}</p>
              </div>
            ))}
          </div>

          {/* All Unique Origins */}
          {data.summary?.uniqueOrigins?.length > 0 && (
            <section className="mb-10">
              <h2 className="text-lg font-bold mb-4 text-white/80">All Detected Origins</h2>
              <div className="flex flex-wrap gap-2">
                {data.summary.uniqueOrigins.map((origin: string, i: number) => {
                  const isClone = !origin.includes('humanidfi.com') && origin !== 'unknown';
                  return (
                    <span
                      key={i}
                      className={`px-3 py-1 rounded text-xs font-mono ${
                        isClone
                          ? 'bg-red-900/40 border border-red-500/40 text-red-300'
                          : 'bg-green-900/40 border border-green-500/40 text-green-300'
                      }`}
                    >
                      {isClone ? '⚠️ ' : '✅ '}
                      {origin}
                    </span>
                  );
                })}
              </div>
            </section>
          )}

          {/* Clone Detail Table */}
          {data.clones?.length > 0 ? (
            <section className="mb-10">
              <h2 className="text-lg font-bold mb-4 text-red-400">
                ⚠️ Unauthorized Deployments ({data.clones.length})
              </h2>
              <p className="text-xs text-white/40 mb-4">
                These deployments are running Humanity Ledger code on non-canonical origins.
                Use the origin URL and IP to file DMCA takedowns.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-white/40">
                      <th className="text-left py-2 pr-4">Origin (Clone URL)</th>
                      <th className="text-left py-2 pr-4">IP Address</th>
                      <th className="text-left py-2 pr-4">Hits</th>
                      <th className="text-left py-2 pr-4">Monetization</th>
                      <th className="text-left py-2 pr-4">Last Seen</th>
                      <th className="text-left py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.clones.map((clone: any, i: number) => {
                      let commercialObj: any = {};
                      try { commercialObj = JSON.parse(clone.commercialData || '{}'); } catch {}
                      const isMonetized = commercialObj.stripe || commercialObj.paypal || commercialObj.adsense || commercialObj.web3Active;
                      
                      return (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2 pr-4 text-red-300 font-bold">
                          <a
                            href={clone.origin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {clone.origin || clone.host || 'unknown'}
                          </a>
                        </td>
                        <td className="py-2 pr-4 text-white/60">{clone.ip}</td>
                        <td className="py-2 pr-4 text-yellow-400 font-bold">{clone.hitCount ?? 1}</td>
                        <td className="py-2 pr-4">
                          {isMonetized ? (
                            <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] uppercase font-bold animate-pulse">
                              MAKING MONEY
                            </span>
                          ) : (
                            <span className="text-white/30 text-[10px] uppercase">Inactive</span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-white/40">
                          {clone.seenAt
                            ? new Date(clone.seenAt).toLocaleString()
                            : 'unknown'}
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex gap-2">
                            <a
                              href={`https://github.com/contact/dmca`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 bg-red-900/60 text-red-300 rounded text-[10px] hover:bg-red-800/60"
                            >
                              DMCA →
                            </a>
                            <a
                              href={`mailto:legal@humanidfi.com?subject=Clone%20Report%3A%20${encodeURIComponent(clone.origin)}&body=Unauthorized%20deployment%20detected%20at%3A%20${encodeURIComponent(clone.origin)}%0AIP%3A%20${clone.ip}%0AFirst%20seen%3A%20${clone.seenAt}%0AMonetization%20Active%3A%20${isMonetized}`}
                              className="px-2 py-1 bg-white/10 text-white/60 rounded text-[10px] hover:bg-white/20"
                            >
                              Report
                            </a>
                          </div>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <section className="mb-10">
              <div className="bg-green-900/20 border border-green-500/20 p-6 rounded-xl">
                <p className="text-green-400 font-bold">✅ No unauthorized clones detected yet.</p>
                <p className="text-white/40 text-sm mt-1">
                  All beacons are from canonical deployments. The system is monitoring.
                </p>
              </div>
            </section>
          )}

          {/* How to Act on Clones */}
          <section className="border border-white/10 rounded-xl p-6">
            <h2 className="text-base font-bold mb-4 text-white/80">
              🛡️ How to Take Down a Clone
            </h2>
            <ol className="list-decimal list-inside space-y-3 text-white/60 text-sm">
              <li>
                <strong className="text-white">GitHub DMCA:</strong> Go to{' '}
                <a href="https://github.com/contact/dmca" className="text-blue-400 hover:underline" target="_blank" rel="noopener">
                  github.com/contact/dmca
                </a>
                . Cite original repo: <code className="text-green-400">github.com/humanityledger/Humanity-Ledger</code>
              </li>
              <li>
                <strong className="text-white">Railway/Vercel/Netlify:</strong> Use their abuse email with the clone&apos;s origin URL and this beacon log as evidence.
              </li>
              <li>
                <strong className="text-white">Domain Registrar:</strong> If the clone has a custom domain, file an abuse report with their registrar (ICANN Lookup).
              </li>
              <li>
                <strong className="text-white">Legal:</strong> Email <code className="text-green-400">legal@humanidfi.com</code> with the clone details for formal legal action.
              </li>
            </ol>
          </section>
        </>
      )}

      <footer className="mt-12 border-t border-white/10 pt-6">
        <p className="text-xs text-white/20">
          Copyright (c) 2024-2026 Stefan Antonio Cirisanu. All Rights Reserved.
          Humanity Ledger · humanidfi.com · This page is not indexed by search engines.
        </p>
      </footer>
    </main>
  );
}
