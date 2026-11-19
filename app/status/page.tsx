'use client';
/**
 * /status — measured data only (package 6). It shows what /api/status/alpha measured in the last
 * 24 hours and nothing else: no uptime percentage, no target presented as a result.
 */
import { useEffect, useState } from 'react';

type Status = {
  measuredAt: string;
  payments: Record<string, number> & { failedByReason: Record<string, number> };
  delivery: Record<string, number>;
  node: { blockNumber: number | null; secondsSinceNewBlock: number | null };
  alerts: { key: string; detail: string }[];
};

const row = 'flex justify-between gap-4 py-2 border-b border-[#E4E7EC] text-[14px]';

export default function StatusPage() {
  const [s, setS] = useState<Status | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch('/api/status/alpha', { cache: 'no-store' }).then((r) => r.json()).then(setS).catch(() => setFailed(true));
  }, []);
  return (
    <main className="min-h-screen bg-[#F7F8FA] text-[#15171C] px-5 py-12">
      <div className="max-w-xl mx-auto">
        <h1 className="text-[28px] font-semibold">Status</h1>
        <p className="text-[14px] text-[#5b6270] mt-2">
          Measured in the last 24 hours on Aztec Alpha. Counts come from the reports that open Ledger Chat pages send: at most one report of each kind per minute per page, so they show trends, not every message.
        </p>
        {failed && <p className="mt-6 text-[#FF3B30]">The status could not be read.</p>}
        {s && (
          <>
            <section className="mt-8">
              <h2 className="text-[16px] font-semibold mb-2">Alerts</h2>
              {s.alerts.length === 0 ? (
                <p className="text-[14px] text-[#10B981]">None raised by the measured data.</p>
              ) : (
                <ul>{s.alerts.map((a) => <li key={a.key} className="text-[14px] text-[#FF3B30]">{a.detail}</li>)}</ul>
              )}
            </section>
            <section className="mt-8">
              <h2 className="text-[16px] font-semibold mb-2">Private payments</h2>
              {(['attempted', 'sent', 'mined', 'unconfirmed', 'failed'] as const).map((k) => (
                <div key={k} className={row}><span>{k}</span><span className="font-mono">{s.payments[k] ?? 0}</span></div>
              ))}
            </section>
            <section className="mt-8">
              <h2 className="text-[16px] font-semibold mb-2">Message delivery reports</h2>
              {Object.entries(s.delivery).map(([k, v]) => (
                <div key={k} className={row}><span>{k.replace(/_/g, ' ')}</span><span className="font-mono">{v}</span></div>
              ))}
            </section>
            <section className="mt-8">
              <h2 className="text-[16px] font-semibold mb-2">Aztec Alpha node</h2>
              <div className={row}><span>Latest block</span><span className="font-mono">{s.node.blockNumber ?? 'no answer'}</span></div>
              <div className={row}><span>Seconds since a new block was seen</span><span className="font-mono">{s.node.secondsSinceNewBlock ?? '-'}</span></div>
            </section>
            <p className="text-[12px] text-[#5b6270] mt-8">Measured at {new Date(s.measuredAt).toUTCString()}.</p>
          </>
        )}
      </div>
    </main>
  );
}
