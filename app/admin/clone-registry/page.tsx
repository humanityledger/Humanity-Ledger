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
    <main className="min-h-screen bg-[#F2F2F7] text-[#1C1C1E] font-sans px-6 py-12 max-w-6xl mx-auto">
      <header className="border-b border-black/10 pb-8 mb-10">
        <p className="text-[13px] font-bold tracking-[0.2em] uppercase text-[#6D6D72] mb-3">
          Humanity Ledger — Admin
        </p>
        <h1 className="text-4xl font-black tracking-tight text-black">
          Clone Detection Registry
        </h1>
        <p className="text-[#8E8E93] text-[15px] mt-2">
          Owner: Stefan Antonio Cirisanu · legal@humanidfi.com
        </p>
      </header>

      {!adminKey && (
        <div className="bg-white border border-black/10 p-6 rounded-2xl shadow-sm">
          <p className="text-[#1C1C1E] font-medium mb-4">
            Access requires admin authentication. Add <code className="bg-black/5 text-[#007AFF] px-2 py-1 rounded">?key=humanity2026</code> to the URL.
          </p>
          <p className="text-[13px] text-[#8E8E93]">
            Fallback key "humanity2026" is active. Set <code>HL_ADMIN_KEY</code> in your environment variables for custom security.
          </p>
        </div>
      )}

      {adminKey && !isAuthed && (
        <div className="bg-[#FFF0F0] border border-[#FF3B30]/30 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#FF3B30] rounded-full flex items-center justify-center text-white font-bold">!</div>
            <p className="text-[#FF3B30] font-bold text-lg">Invalid admin key</p>
          </div>
          <p className="text-[#FF3B30]/80 mt-2 text-sm">Please use ?key=humanity2026</p>
        </div>
      )}

      {isAuthed && data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[
              { label: 'Total Deployments', value: data.summary?.total ?? 0, color: 'text-[#1C1C1E]' },
              { label: '⚠️ CLONES DETECTED', value: data.summary?.clones ?? 0, color: 'text-[#FF3B30]' },
              { label: 'Canonical Instances', value: data.summary?.canonical ?? 0, color: 'text-[#34C759]' },
              { label: 'Unique Origins', value: data.summary?.uniqueOrigins?.length ?? 0, color: 'text-[#FF9500]' },
            ].map((card) => (
              <div key={card.label} className="bg-white border border-black/10 rounded-2xl p-5 shadow-sm">
                <p className={`text-3xl font-black ${card.color}`}>{card.value}</p>
                <p className="text-[12px] font-semibold tracking-wide text-[#8E8E93] mt-1">{card.label}</p>
              </div>
            ))}
          </div>

          {/* All Unique Origins */}
          {data.summary?.uniqueOrigins?.length > 0 && (
            <section className="mb-10">
              <h2 className="text-[17px] font-bold mb-4 text-[#1C1C1E]">All Detected Origins</h2>
              <div className="flex flex-wrap gap-2">
                {data.summary.uniqueOrigins.map((origin: string, i: number) => {
                  const isClone = !origin.includes('humanidfi.com') && origin !== 'unknown';
                  return (
                    <span
                      key={i}
                      className={`px-3 py-1.5 rounded-lg text-[13px] font-medium ${
                        isClone
                          ? 'bg-[#FFF0F0] border border-[#FF3B30]/30 text-[#FF3B30]'
                          : 'bg-[#F0FFF4] border border-[#34C759]/30 text-[#34C759]'
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
            <section className="mb-10 bg-white border border-black/10 rounded-2xl p-6 shadow-sm">
              <h2 className="text-[17px] font-bold mb-2 text-[#FF3B30]">
                ⚠️ Unauthorized Deployments ({data.clones.length})
              </h2>
              <p className="text-[13px] text-[#8E8E93] mb-6">
                These deployments are running Humanity Ledger code on non-canonical origins.
                Use the origin URL and IP to file DMCA takedowns.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr className="border-b border-black/10 text-[#8E8E93]">
                      <th className="text-left py-3 pr-4 font-semibold">Origin (Clone URL)</th>
                      <th className="text-left py-3 pr-4 font-semibold">IP Address</th>
                      <th className="text-left py-3 pr-4 font-semibold">Hits</th>
                      <th className="text-left py-3 pr-4 font-semibold">Monetization</th>
                      <th className="text-left py-3 pr-4 font-semibold">Last Seen</th>
                      <th className="text-left py-3 pr-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.clones.map((clone: any, i: number) => {
                      let commercialObj: any = {};
                      try { commercialObj = JSON.parse(clone.commercialData || '{}'); } catch {}
                      const isMonetized = commercialObj.stripe || commercialObj.paypal || commercialObj.adsense || commercialObj.web3Active;
                      
                      return (
                      <tr key={i} className="border-b border-black/5 hover:bg-[#F2F2F7]">
                        <td className="py-3 pr-4 text-[#FF3B30] font-bold">
                          <a
                            href={clone.origin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {clone.origin || clone.host || 'unknown'}
                          </a>
                        </td>
                        <td className="py-3 pr-4 text-[#1C1C1E] font-medium">{clone.ip}</td>
                        <td className="py-3 pr-4 text-[#FF9500] font-bold">{clone.hitCount ?? 1}</td>
                        <td className="py-3 pr-4">
                          {isMonetized ? (
                            <span className="bg-[#FF3B30] text-white px-2 py-1 rounded-md text-[11px] font-bold animate-pulse">
                              MAKING MONEY
                            </span>
                          ) : (
                            <span className="text-[#8E8E93] text-[11px] font-medium uppercase">Inactive</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-[#8E8E93]">
                          {clone.seenAt
                            ? new Date(clone.seenAt).toLocaleString()
                            : 'unknown'}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex gap-2">
                            <a
                              href={`https://github.com/contact/dmca`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-[#FFF0F0] text-[#FF3B30] border border-[#FF3B30]/30 rounded-lg text-[12px] font-semibold hover:bg-[#FFE5E5]"
                            >
                              DMCA →
                            </a>
                            <a
                              href={`mailto:legal@humanidfi.com?subject=Clone%20Report%3A%20${encodeURIComponent(clone.origin)}&body=Unauthorized%20deployment%20detected%20at%3A%20${encodeURIComponent(clone.origin)}%0AIP%3A%20${clone.ip}%0AFirst%20seen%3A%20${clone.seenAt}%0AMonetization%20Active%3A%20${isMonetized}`}
                              className="px-3 py-1.5 bg-[#F2F2F7] text-[#1C1C1E] border border-black/10 rounded-lg text-[12px] font-semibold hover:bg-[#E5E5EA]"
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
              <div className="bg-[#F0FFF4] border border-[#34C759]/30 p-6 rounded-2xl shadow-sm">
                <p className="text-[#34C759] font-bold text-[17px]">✅ No unauthorized clones detected yet.</p>
                <p className="text-[#34C759]/80 text-[14px] mt-1">
                  All beacons are from canonical deployments. The system is monitoring.
                </p>
              </div>
            </section>
          )}

          {/* How to Act on Clones */}
          <section className="bg-white border border-black/10 rounded-2xl p-6 shadow-sm">
            <h2 className="text-[17px] font-bold mb-4 text-[#1C1C1E]">
              🛡️ How to Take Down a Clone
            </h2>
            <ol className="list-decimal list-inside space-y-3 text-[#6D6D72] text-[14px]">
              <li>
                <strong className="text-[#1C1C1E]">GitHub DMCA:</strong> Go to{' '}
                <a href="https://github.com/contact/dmca" className="text-[#007AFF] hover:underline" target="_blank" rel="noopener">
                  github.com/contact/dmca
                </a>
                . Cite original repo: <code className="bg-[#F2F2F7] text-[#1C1C1E] px-1.5 py-0.5 rounded">github.com/humanityledger/Humanity-Ledger</code>
              </li>
              <li>
                <strong className="text-[#1C1C1E]">Railway/Vercel/Netlify:</strong> Use their abuse email with the clone&apos;s origin URL and this beacon log as evidence.
              </li>
              <li>
                <strong className="text-[#1C1C1E]">Domain Registrar:</strong> If the clone has a custom domain, file an abuse report with their registrar (ICANN Lookup).
              </li>
              <li>
                <strong className="text-[#1C1C1E]">Legal:</strong> Email <code className="bg-[#F2F2F7] text-[#1C1C1E] px-1.5 py-0.5 rounded">legal@humanidfi.com</code> with the clone details for formal legal action.
              </li>
            </ol>
          </section>
        </>
      )}

      <footer className="mt-12 border-t border-black/10 pt-6">
        <p className="text-[12px] text-[#8E8E93] text-center">
          Copyright (c) 2024-2026 Stefan Antonio Cirisanu. All Rights Reserved.<br />
          Humanity Ledger · humanidfi.com · This page is not indexed by search engines.
        </p>
      </footer>

    </main>
  );
}
