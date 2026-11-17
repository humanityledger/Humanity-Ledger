'use client';

/**
 * components/zk/wallet/WalletActivity.tsx — what this wallet has done, newest first.
 *
 * The list is the wallet's own record (lib/aztec/wallet/history.ts): payments
 * proven on this device and notes found by its sync. It is grouped by day and can
 * be filtered to money in, money out, or what is still on its way. A failed or
 * pending entry keeps the reason the wallet gave. A transaction hash links to the
 * explorer; nothing else leaves this device.
 */

import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, ChevronDown, Clock, ExternalLink, Layers, Lock, LockOpen } from 'lucide-react';
import type { Activity } from '@/lib/aztec/wallet/history';
import { explorerTxUrl } from '@/lib/aztec/wallet/config';
import { activityAmount, filterActivity, groupByDay, isInbound, isInFlight, type ActivityFilter } from './walletLogic';
import { Card, FOCUS, INK, INK_2, INK_3, MASK, OK, BAD, Pill, shortHex, type PillTone } from './WalletUI';

export { activityAmount, filterActivity, groupByDay, isInbound, isInFlight };
export type { ActivityFilter };

export const KIND_LABEL: Record<Activity['kind'], string> = {
  shield: 'Shielded',
  unshield: 'Unshielded',
  send: 'Sent',
  receive: 'Received',
  faucet: 'Test tokens',
  issue: 'Issued',
  deploy: 'Private account created',
  operator: 'Operator transaction',
};

export const STATUS_LABEL: Record<Activity['status'], string> = {
  proving: 'Proving on this device',
  pending: 'Waiting for the network',
  settled: 'Settled',
  failed: 'Failed',
};

const STATUS_TONE: Record<Activity['status'], PillTone> = {
  proving: 'wait',
  pending: 'wait',
  settled: 'ok',
  failed: 'bad',
};

const FILTERS: Array<{ value: ActivityFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'in', label: 'In' },
  { value: 'out', label: 'Out' },
  { value: 'pending', label: 'In progress' },
];

export function ActivityList({ items, hidden, emptyHint }: { items: Activity[]; hidden?: boolean; emptyHint: string }) {
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [limit, setLimit] = useState(30);
  const shown = useMemo(() => filterActivity(items, filter), [items, filter]);
  const groups = useMemo(() => groupByDay(shown.slice(0, limit)), [shown, limit]);
  const inFlight = items.filter(isInFlight).length;

  return (
    <Card label="Recent transactions" className="overflow-hidden">
      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-3">
        <h3 className="text-[17px] font-semibold tracking-[-0.01em]" style={{ color: INK }}>
          Recent transactions
        </h3>
        {inFlight > 0 && <Pill tone="wait">{inFlight} in progress</Pill>}
      </div>

      {items.length > 0 && (
        <div className="px-5 pb-3 flex gap-2 overflow-x-auto scrollbar-none" role="radiogroup" aria-label="Show">
          {FILTERS.map((f) => {
            const on = filter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setFilter(f.value)}
                className={`min-h-[36px] px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap border transition-colors ${FOCUS} ${
                  on ? 'bg-[#15171c] border-[#15171c] text-white' : 'bg-white border-[#d4d8de] text-[#15171c] hover:bg-[#f7f8fa]'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {items.length === 0 ? (
        <div className="px-6 pt-4 pb-9 flex flex-col items-center text-center gap-2">
          <span className="w-12 h-12 rounded-full bg-[#f2f4f7] flex items-center justify-center" aria-hidden="true">
            <Clock size={20} strokeWidth={1.8} style={{ color: INK_2 }} />
          </span>
          <span className="text-[15px] font-semibold" style={{ color: INK }}>
            No transactions yet
          </span>
          <span className="text-[14px] max-w-[260px] leading-snug" style={{ color: INK_3 }}>
            {emptyHint}
          </span>
        </div>
      ) : shown.length === 0 ? (
        <p className="px-5 pb-6 text-[14px]" style={{ color: INK_3 }}>
          Nothing here for this filter.
        </p>
      ) : (
        <div className="pb-2">
          {groups.map((g) => (
            <div key={g.day}>
              <div className="sticky top-0 z-[1] bg-white/95 backdrop-blur-sm px-5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: INK_3 }}>
                {g.day}
              </div>
              <ul>
                {g.items.map((a) => (
                  <ActivityRow key={a.id} a={a} hidden={hidden} />
                ))}
              </ul>
            </div>
          ))}
          {shown.length > limit && (
            <div className="px-5 pt-1 pb-3">
              <button
                type="button"
                onClick={() => setLimit((l) => l + 30)}
                className={`w-full min-h-[44px] rounded-xl text-[14px] font-semibold bg-[#f7f8fa] hover:bg-[#eef0f3] ${FOCUS}`}
                style={{ color: INK }}
              >
                Show {Math.min(30, shown.length - limit)} more
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function KindIcon({ a }: { a: Activity }) {
  const common = { size: 17, strokeWidth: 2 } as const;
  if (isInFlight(a)) return <Clock {...common} aria-label="In progress" />;
  if (a.status === 'failed') return <AlertTriangle {...common} style={{ color: BAD }} aria-label="Failed" />;
  if (a.kind === 'shield') return <Lock {...common} aria-hidden="true" />;
  if (a.kind === 'unshield') return <LockOpen {...common} aria-hidden="true" />;
  if (isInbound(a)) return <ArrowDownLeft {...common} aria-hidden="true" />;
  return <ArrowUpRight {...common} aria-hidden="true" />;
}

function ActivityRow({ a, hidden }: { a: Activity; hidden?: boolean }) {
  const amount = activityAmount(a);
  const plus = isInbound(a);
  const time = new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const reason = (a.status === 'failed' || a.status === 'pending') && a.error ? a.error : null;
  return (
    <li className="px-5 py-3 flex items-start gap-3 border-t border-[#f2f4f7] first:border-t-0">
      <span
        className={`mt-0.5 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${plus && a.status === 'settled' ? 'bg-[#e8f6f0]' : 'bg-[#f2f4f7]'}`}
        style={{ color: plus && a.status === 'settled' ? OK : INK }}
      >
        <KindIcon a={a} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold truncate" style={{ color: INK }}>
          {KIND_LABEL[a.kind]}
        </span>
        {a.status !== 'settled' && (
          <span className="block mt-1">
            <Pill tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Pill>
          </span>
        )}
        <span className="block text-[13px] leading-snug mt-0.5 truncate" style={{ color: INK_3 }}>
          {a.counterparty && (a.kind === 'send' || a.kind === 'receive' || a.kind === 'unshield') ? `${a.kind === 'receive' ? 'From' : 'To'} ${shortHex(a.counterparty)} · ` : ''}
          {time}
          {a.blockNumber ? ` · block ${a.blockNumber.toLocaleString()}` : ''}
        </span>
        {reason && (
          <span className="block text-[13px] leading-snug mt-1 break-words" style={{ color: a.status === 'failed' ? BAD : INK_2 }}>
            {reason}
          </span>
        )}
      </span>
      <span className="flex flex-col items-end gap-1 shrink-0 pt-0.5">
        {amount && (
          <span className="text-[15px] font-semibold tabular-nums" style={{ color: plus && a.status === 'settled' ? OK : INK }}>
            {hidden ? MASK : `${plus || a.kind === 'shield' ? '+' : '−'}${amount}`}
          </span>
        )}
        {a.txHash && (
          <a
            href={explorerTxUrl(a.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 min-h-[36px] text-[12.5px] font-medium underline-offset-2 hover:underline rounded ${FOCUS}`}
            style={{ color: INK_2 }}
            aria-label={`Open ${KIND_LABEL[a.kind].toLowerCase()} transaction in the explorer`}
          >
            Explorer <ExternalLink size={11} aria-hidden="true" />
          </a>
        )}
      </span>
    </li>
  );
}

/**
 * Notes this wallet has received or created by shielding. Collapsed by default:
 * the balance is the total, the notes are how it is made up.
 */
export function NotesCard({ items, hidden }: { items: Activity[]; hidden?: boolean }) {
  const [open, setOpen] = useState(false);
  const notes = useMemo(() => items.filter((a) => (a.kind === 'receive' || a.kind === 'shield') && a.status === 'settled'), [items]);
  return (
    <Card label="Shielded notes" className="overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`w-full min-h-[56px] flex items-center gap-3 px-5 py-3 text-left hover:bg-[#fafbfc] ${FOCUS}`}
      >
        <span className="w-10 h-10 rounded-full bg-[#f2f4f7] flex items-center justify-center shrink-0" aria-hidden="true">
          <Layers size={17} strokeWidth={2} style={{ color: INK }} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold" style={{ color: INK }}>
            Shielded notes ({notes.length})
          </span>
          <span className="block text-[13px]" style={{ color: INK_3 }}>
            Only this browser can read them
          </span>
        </span>
        <ChevronDown size={18} className={`transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: INK_3 }} aria-hidden="true" />
      </button>
      {open && (
        <div className="border-t border-[#eef0f3]">
          <p className="px-5 pt-3 text-[13px] leading-relaxed" style={{ color: INK_2 }}>
            Private notes this wallet has received or created by shielding. Notes you have since spent still appear here; your balance is always
            the current total.
          </p>
          {notes.length === 0 ? (
            <p className="px-5 py-4 text-[14px]" style={{ color: INK_3 }}>
              No notes yet.
            </p>
          ) : (
            <ul className="py-1">
              {notes.map((n) => (
                <li key={n.id} className="flex items-center gap-3 px-5 py-2.5 text-[14px] tabular-nums">
                  <span className="font-semibold" style={{ color: INK }}>
                    {hidden ? MASK : activityAmount(n)}
                  </span>
                  <span className="truncate" style={{ color: INK_3 }}>
                    {n.kind === 'shield' ? 'from shielding' : `from ${shortHex(n.counterparty)}`}
                  </span>
                  {n.blockNumber && (
                    <span className="ml-auto shrink-0" style={{ color: INK_3 }}>
                      block {n.blockNumber.toLocaleString()}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
