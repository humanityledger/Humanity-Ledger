'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { STATUS_LABEL, type MetricStatus } from '@/lib/protocol/metrics';
import { useProtocolReport } from './useProtocolReport';
import { useT } from '@/lib/i18n/client';

/**
 * Compact protocol summary for the private wallet's "Protocol" tab: five key figures from the same
 * endpoint as /protocol (GET /api/protocol/metrics). No iframe, no figure of its own.
 */
const KEY_METRICS = [
  { id: 'aztec-node', label: 'Aztec Alpha node' },
  { id: 'hlc-supply', label: 'HLC total supply' },
  { id: 'escrows', label: 'Escrow agreements' },
  { id: 'protocol-fees', label: 'Protocol fees collected' },
  { id: 'shielded-volume', label: 'Total shielded volume' },
] as const;

const DOT: Record<MetricStatus, string> = {
  live: 'bg-[#166534]',
  mismatch: 'bg-[#B42318]',
  unavailable: 'bg-[#B42318]',
  'not-deployed': 'bg-[#A3A9B4]',
  'not-measurable': 'bg-[#475467]',
};

export default function ProtocolSummary() {
  const t = useT();
  const { state } = useProtocolReport();

  return (
    <section className="bg-white rounded-2xl border border-[#E4E7EC]" aria-busy={state.kind === 'loading'}>
      <header className="px-4 py-3 border-b border-[#E4E7EC] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-[#15171C]">{t("Protocol")}</h2>
          <p className="text-[12px] text-[#727A88] tabular-nums truncate">
            {state.kind === 'ready'
              ? state.report.anchorBlock !== null
                ? t("Aztec Alpha · L2 block {anchorBlock}", { anchorBlock: state.report.anchorBlock.toLocaleString('en-US') })
                : t("Aztec Alpha · node not read")
              : state.kind === 'error'
                ? t("Not read: the server did not answer")
                : t("Reading…")}
          </p>
        </div>
        <Link
          href="/protocol"
          className="h-11 px-3 shrink-0 inline-flex items-center gap-1 rounded-xl border border-[#E4E7EC] text-[13px] font-medium text-[#15171C] hover:bg-[#F7F8FA] transition-colors duration-150 ease-out"
        >
          {t("All metrics")}{" "}<ArrowUpRight size={14} strokeWidth={1.5} />
        </Link>
      </header>
      <ul className="divide-y divide-[#E4E7EC]">
        {KEY_METRICS.map(({ id, label }) => {
          const m = state.kind === 'ready' ? state.report.metrics.find((x) => x.id === id) : undefined;
          return (
            <li key={id} className="px-4 py-3 min-h-[56px] flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[#15171C] truncate">{m?.label ?? t(label)}</p>
                {m ? (
                  <p className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] text-[#475467]">
                    <span className={`w-1.5 h-1.5 rounded-full ${DOT[m.status]}`} aria-hidden />
                    {t(STATUS_LABEL[m.status])}
                  </p>
                ) : state.kind === 'loading' ? (
                  <div className="mt-1 h-2.5 w-20 rounded bg-[#EFF1F4]" aria-hidden />
                ) : (
                  <p className="mt-0.5 text-[12px] text-[#B42318]">{t("Not read")}</p>
                )}
              </div>
              {state.kind === 'loading' ? (
                <div className="h-4 w-16 rounded bg-[#EFF1F4]" aria-hidden />
              ) : (
                <span className="text-[15px] font-semibold text-[#15171C] tabular-nums text-right">{m?.value ?? '—'}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
