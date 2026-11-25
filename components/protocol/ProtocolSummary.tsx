'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, Copy, RotateCw } from 'lucide-react';
import { STATUS_LABEL, type Metric, type MetricStatus } from '@/lib/protocol/metrics';
import { AZTEC_WALLET_CONFIG } from '@/lib/aztec/wallet/config';
import { useProtocolReport } from './useProtocolReport';
import { useT } from '@/lib/i18n/client';

/**
 * The private wallet's "Protocol" tab: what the wallet runs on, read live from the same endpoint as
 * /protocol (GET /api/protocol/metrics, every 30 s while visible). No figure of its own: every row
 * is a metric from that report, and a row the report does not carry says "Not read".
 *
 * Four short groups, in the order a person asks: is the network up, what am I paying in, what has
 * been checked, what stays private. The payment token is cUSDC (human.tech); HLC, a test token that
 * is no longer listed in the wallet on Alpha, stays on /protocol only.
 */
const GROUPS: { title: string; rows: { id: string; label: string }[] }[] = [
  {
    title: 'Network',
    rows: [
      { id: 'aztec-node', label: 'Aztec Alpha node' },
      { id: 'l1-pins', label: 'Ethereum mainnet (L1)' },
      { id: 'fee-payer', label: 'Network fees' },
    ],
  },
  {
    title: 'Payments',
    rows: [
      { id: 'cusdc', label: 'Payment token' },
      { id: 'cusdc-beta', label: 'Closed beta' },
      { id: 'escrows', label: 'Escrow agreements' },
    ],
  },
  {
    title: 'Assurance',
    rows: [
      { id: 'audit', label: 'External security audit' },
      { id: 'contracts', label: 'Contracts recorded on Aztec Alpha' },
    ],
  },
  {
    title: 'Privacy',
    rows: [{ id: 'shielded-volume', label: 'Total shielded volume' }],
  },
];

const DOT: Record<MetricStatus, string> = {
  live: 'bg-[#16a34a]',
  mismatch: 'bg-[#dc2626]',
  unavailable: 'bg-[#dc2626]',
  'not-deployed': 'bg-[#c4c9d2]',
  'not-measurable': 'bg-[#64748b]',
};

const short = (hex: string) => (hex.length > 14 ? `${hex.slice(0, 6)}…${hex.slice(-4)}` : hex);

function useSecondsSince(iso: string | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const at = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(at) ? Math.max(0, Math.round((now - at) / 1000)) : null;
}

function CopyAddress({ value }: { value: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }, () => {});
      }}
      className="inline-flex items-center gap-1 font-mono text-[12px] text-[#5b606b] hover:text-[#15171c] transition-colors"
      aria-label={t('Copy address')}
    >
      {short(value)}
      {done ? <Check size={12} strokeWidth={2} /> : <Copy size={12} strokeWidth={1.8} />}
    </button>
  );
}

function Row({ label, metric, loading }: { label: string; metric: Metric | undefined; loading: boolean }) {
  const t = useT();
  const explorer = AZTEC_WALLET_CONFIG.explorer;
  const address = metric?.id === 'cusdc' && metric.raw && /^0x[0-9a-f]{64}$/i.test(metric.raw) ? metric.raw : null;
  return (
    <li className="flex items-center justify-between gap-4 py-3.5 min-h-[60px]">
      <div className="min-w-0">
        <p className="text-[14px] text-[#15171c] leading-snug">{t(metric?.label ?? label)}</p>
        {loading ? (
          <div className="mt-1.5 h-2.5 w-20 rounded-full bg-[#f1f3f5]" aria-hidden />
        ) : metric ? (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-[#727a88]">
            <span className="inline-flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${DOT[metric.status]}`} aria-hidden />
              {t(STATUS_LABEL[metric.status])}
            </span>
            {address && <CopyAddress value={address} />}
          </p>
        ) : (
          <p className="mt-1 text-[12.5px] text-[#dc2626]">{t('Not read')}</p>
        )}
      </div>
      {loading ? (
        <div className="h-4 w-14 rounded-full bg-[#f1f3f5]" aria-hidden />
      ) : address && explorer ? (
        <a
          href={`${explorer}/contracts/instances/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 text-[15px] font-medium text-[#15171c] tabular-nums hover:underline underline-offset-4"
        >
          {metric?.value}
          <ArrowUpRight size={14} strokeWidth={1.6} aria-hidden />
        </a>
      ) : (
        <span className="shrink-0 text-[15px] font-medium text-[#15171c] tabular-nums text-right">{metric?.value ? t(metric.value) : '—'}</span>
      )}
    </li>
  );
}

export default function ProtocolSummary() {
  const t = useT();
  const { state, reading, reload } = useProtocolReport();
  const report = state.kind === 'ready' ? state.report : null;
  const loading = state.kind === 'loading';
  const age = useSecondsSince(report?.generatedAt);
  const node = report?.metrics.find((m) => m.id === 'aztec-node');
  const up = node?.status === 'live';

  return (
    <section className="space-y-4" aria-busy={loading || reading}>
      {/* The network, live */}
      <div className="rounded-[24px] border border-[#eef0f3] bg-white px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-[13px] text-[#727a88]">
              <span
                className={`w-2 h-2 rounded-full ${loading ? 'bg-[#c4c9d2]' : up ? 'bg-[#16a34a]' : 'bg-[#dc2626]'}`}
                aria-hidden
              />
              {loading ? t('Reading…') : state.kind === 'error' ? t('Not read: the server did not answer') : up ? t('Aztec Alpha is live') : t('Node unreachable')}
            </p>
            <p className="mt-2 text-[30px] font-semibold tracking-[-0.03em] leading-none text-[#15171c] tabular-nums">
              {report?.anchorBlock != null ? report.anchorBlock.toLocaleString('en-US') : '—'}
            </p>
            <p className="mt-1.5 text-[13px] text-[#727a88]">
              {report?.anchorBlock != null ? t('Latest L2 block') : t('Block not read')}
              {age !== null && ` · ${t('read {s} s ago', { s: age })}`}
            </p>
          </div>
          <button
            type="button"
            onClick={reload}
            disabled={reading}
            aria-label={t('Read the figures again')}
            className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full border border-[#eef0f3] text-[#15171c] hover:bg-[#f7f8fa] disabled:opacity-50 transition-colors"
          >
            <RotateCw size={16} strokeWidth={1.8} className={reading ? 'animate-spin motion-reduce:animate-none' : ''} />
          </button>
        </div>
      </div>

      {GROUPS.map((g) => (
        <div key={g.title} className="rounded-[24px] border border-[#eef0f3] bg-white px-5 pt-4 pb-1">
          <h3 className="text-[12px] font-medium text-[#727a88]">{t(g.title)}</h3>
          <ul className="divide-y divide-[#f1f3f5]">
            {g.rows.map((r) => (
              <Row key={r.id} label={r.label} loading={loading} metric={report?.metrics.find((m) => m.id === r.id)} />
            ))}
          </ul>
        </div>
      ))}

      {/* Where the figures come from */}
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="min-w-0 text-[12px] text-[#a3a9b4] truncate">
          {report ? t('Report digest {digest}', { digest: short(report.digest) }) : t('Read from the Aztec node. Nothing is sent.')}
        </p>
        <Link
          href="/protocol"
          className="shrink-0 inline-flex items-center gap-1 h-9 px-3 rounded-full border border-[#eef0f3] text-[13px] font-medium text-[#15171c] hover:bg-[#f7f8fa] transition-colors"
        >
          {t('All metrics')}
          <ArrowUpRight size={14} strokeWidth={1.6} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
