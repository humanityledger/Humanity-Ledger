'use client';

import React from 'react';
import Link from 'next/link';
import { Download, RefreshCw } from 'lucide-react';
import { HLLogo } from '@/components/shared/HLLogo';
import { STATUS_LABEL, type Metric, type MetricStatus } from '@/lib/protocol/metrics';
import { useProtocolReport } from './useProtocolReport';

const GROUPS: ReadonlyArray<{ id: Metric['group']; title: string; note: string }> = [
  { id: 'network', title: 'Network', note: 'The Aztec node, the Ethereum pins and what is deployed.' },
  { id: 'value', title: 'Value through the protocol', note: 'Agreements, private volume and protocol revenue.' },
  { id: 'token', title: 'HLC', note: 'The protocol token, read from public storage on Aztec Alpha.' },
  { id: 'onboarding', title: 'Onboarding sponsorship', note: 'Network fees paid for new accounts.' },
];

const DOT: Record<MetricStatus, string> = {
  live: 'bg-[#166534]',
  mismatch: 'bg-[#C0362C]',
  unavailable: 'bg-[#8F5B00]',
  'not-deployed': 'bg-[#A3A9B4]',
  'not-measurable': 'bg-[#475467]',
};

function StatusTag({ status }: { status: MetricStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#475467] whitespace-nowrap">
      <span className={`w-1.5 h-1.5 rounded-full ${DOT[status]}`} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

function MetricRow({ m }: { m: Metric }) {
  return (
    <li className="px-5 py-4 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-[14px] font-medium text-[#15171C]">{m.label}</h3>
          <StatusTag status={m.status} />
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-[#475467] max-w-prose break-words">{m.detail}</p>
        <p className="mt-1 text-[12px] text-[#727A88] break-words">Source: {m.source}</p>
      </div>
      <div className="sm:text-right sm:pt-0.5">
        <span className="text-[20px] font-semibold text-[#15171C] tabular-nums tracking-tight">{m.value ?? '—'}</span>
      </div>
    </li>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Reading the network">
      {GROUPS.map((g) => (
        <div key={g.id} className="bg-white rounded-2xl border border-[#E4E7EC]">
          <div className="px-5 py-4 border-b border-[#E4E7EC]">
            <div className="h-4 w-40 bg-[#EFF1F4] rounded" />
          </div>
          {[0, 1].map((i) => (
            <div key={i} className="px-5 py-4 flex justify-between gap-6">
              <div className="space-y-2 flex-1">
                <div className="h-3.5 w-48 bg-[#EFF1F4] rounded" />
                <div className="h-3 w-full max-w-md bg-[#EFF1F4] rounded" />
              </div>
              <div className="h-6 w-24 bg-[#EFF1F4] rounded" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC`;
}

export function ProtocolDashboard() {
  const { state, reading, reload: load } = useProtocolReport();
  const report = state.kind === 'ready' ? state.report : null;

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#15171C]">
      <nav className="bg-white border-b border-[#E4E7EC]">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HLLogo size={24} theme="dark" />
            <span className="font-semibold text-[15px] tracking-tight">Ledger Chat</span>
            <span className="text-[15px] text-[#A3A9B4]">/</span>
            <span className="text-[15px] text-[#475467]">Protocol</span>
          </Link>
          <Link
            href="/chat"
            className="h-11 px-4 inline-flex items-center bg-[#15171C] hover:bg-[#2B2F38] text-white rounded-xl text-[13px] font-medium transition-colors duration-150 ease-out"
          >
            Open Ledger Chat
          </Link>
        </div>
      </nav>

      <header className="bg-white border-b border-[#E4E7EC]">
        <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="text-[28px] font-semibold tracking-tight">Protocol metrics</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-[#475467]">
              Aggregate figures for Ledger Chat on Aztec Alpha, the Aztec network that settles on Ethereum mainnet. Each
              figure is read from its source when this page loads, or marked as not read, not deployed, or not measurable
              because the data is private by design. Nothing is estimated.
            </p>
            <p className="mt-3 text-[12px] text-[#727A88] tabular-nums">
              {report
                ? `${report.network.name} · L1 chain ${report.network.l1ChainId} · ${
                    report.anchorBlock !== null ? `L2 block ${report.anchorBlock.toLocaleString('en-US')}` : 'node not read'
                  } · ${formatTime(report.generatedAt)}`
                : 'Reading…'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => void load()}
              disabled={reading}
              className="h-11 px-4 inline-flex items-center gap-1.5 bg-white border border-[#E4E7EC] rounded-xl text-[13px] font-medium hover:bg-[#F2F4F7] disabled:text-[#A3A9B4] transition-colors duration-150 ease-out"
            >
              <RefreshCw size={14} strokeWidth={1.5} />
              {reading ? 'Reading…' : 'Read again'}
            </button>
            <a
              href="/api/protocol/metrics?download=1"
              aria-disabled={!report}
              className={`h-11 px-4 inline-flex items-center gap-1.5 rounded-xl text-[13px] font-medium transition-colors duration-150 ease-out ${
                report ? 'bg-[#15171C] hover:bg-[#2B2F38] text-white' : 'bg-[#EFF1F4] text-[#A3A9B4] pointer-events-none'
              }`}
            >
              <Download size={14} strokeWidth={1.5} />
              Verification report
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-4">
        {state.kind === 'loading' ? (
          <Skeleton />
        ) : state.kind === 'error' ? (
          <section role="alert" className="rounded-2xl border border-[#FFD6D6] bg-[#FFF4F4] p-5">
            <h2 className="text-[14px] font-semibold text-[#B42318]">Metrics could not be read</h2>
            <p className="mt-1 text-[13px] text-[#B42318]">
              The server did not answer within 10 seconds. Every figure shows as — rather than a value that may be stale.
              It is read again every 30 seconds.
            </p>
          </section>
        ) : (
          <>
            {GROUPS.map((g) => {
              const items = state.report.metrics.filter((m) => m.group === g.id);
              if (!items.length) return null;
              return (
                <section key={g.id} className="bg-white rounded-2xl border border-[#E4E7EC]">
                  <header className="px-5 py-4 border-b border-[#E4E7EC]">
                    <h2 className="text-[14px] font-semibold">{g.title}</h2>
                    <p className="text-[13px] text-[#727A88] mt-0.5">{g.note}</p>
                  </header>
                  <ul className="divide-y divide-[#E4E7EC]">
                    {items.map((m) => (
                      <MetricRow key={m.id} m={m} />
                    ))}
                  </ul>
                </section>
              );
            })}

            <section className="rounded-2xl border border-[#E4E7EC] bg-white px-5 py-4">
              <h2 className="text-[14px] font-semibold">Why some figures cannot be shown</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-[#475467] max-w-prose">
                Private transfers on Aztec hide amounts, senders and recipients from everyone, including Humanity Ledger. A
                total of private volume can only exist if it is published as an aggregate; the protocol publishes none
                today, so this page shows none.
              </p>
              <p className="mt-3 text-[12px] text-[#727A88] break-all">
                Report digest (SHA-256): <span className="font-mono">{state.report.digest}</span>
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
