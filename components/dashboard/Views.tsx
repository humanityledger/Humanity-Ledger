'use client';

/**
 * components/dashboard/Views.tsx — the six sections of the dashboard. Each one draws only what the
 * page hands it (the private wallet's state, the model computed on this device, the live reads);
 * none of them reads storage or the network on its own, except Messaging, which opens this
 * device's XMTP database when the person asks (lib/dashboard/messaging.ts).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAccount, useSignMessage } from 'wagmi';
import s from './dashboard.module.css';
import { useT } from '@/lib/i18n/client';
import type { WalletSnapshot } from '@/lib/aztec/wallet/client';
import { AZTEC_WALLET_CONFIG, explorerTxUrl } from '@/lib/aztec/wallet/config';
import { formatUnits } from '@/lib/aztec/wallet/amounts';
import { activityCsv } from '@/lib/payments/activity-report';
import { DAYS, NO_FILTER, filterEvents, type DashAlert, type DashEvent, type DashInputs, type DashModel, type EventFilter, type Provenance } from '@/lib/dashboard/model';
import { readMessagingStats, type MessagingStats } from '@/lib/dashboard/messaging';
import { ageText, type LiveState } from '@/lib/dashboard/live';
import { CopyButton, Empty, H2, KIND, SOURCE, STATUS, amountText, short } from './parts';

export interface NetStatus {
  nodeVersion?: string;
  l1ChainId?: number;
  rollupVersion?: number;
  blockNumber?: number;
  provenBlockNumber?: number;
  readAt: number;
}

type Translate = ReturnType<typeof useT>;

function age(t: Translate, okAt: number | undefined, now: number): string {
  const a = ageText(okAt, now);
  return t(a.key, a.vars);
}

function when(at: number, now: number): string {
  const d = new Date(at);
  const today = new Date(now);
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.getFullYear() === today.getFullYear()) return d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString();
}

const FJ = (v: bigint | undefined, hidden: boolean) => (v === undefined ? '—' : hidden ? '•••• FJ' : `${formatUnits(v, 18)} FJ`);

function planText(t: Translate, plan: string): string {
  switch (plan) {
    case 'balance':
      return t('Its Fee Juice balance');
    case 'claim':
      return t('A deposit from Ethereum, claimed in the same transaction');
    case 'wait-claim':
      return t('Nothing yet: a deposit is on its way from Ethereum');
    case 'top-up':
      return t('Nothing yet: the balance is below what one transaction needs');
    case 'bridge':
      return t('Nothing yet: bridge Fee Juice from Ethereum');
    case 'sponsored':
      return t('Sponsored');
    default:
      return plan;
  }
}

/* ------------------------------------------------------------------- rows */

export function EventRow({ e, hidden, now, selected, onSelect }: { e: DashEvent; hidden: boolean; now: number; selected?: boolean; onSelect: (e: DashEvent) => void }) {
  const t = useT();
  const who = e.counterpartyLabel || (e.counterparty ? short(e.counterparty) : '');
  return (
    <button type="button" className={s.row} aria-pressed={selected} onClick={() => onSelect(e)}>
      <span className={s.rowWhen}>{e.at ? when(e.at, now) : t('Date unknown')}</span>
      <span className={s.rowWhat}>
        {who && e.kind === 'send' ? t('Sent to {who}', { who }) : who && e.kind === 'receive' ? t('Received from {who}', { who }) : t(KIND[e.kind] ?? e.kind)}
        {e.verified ? <span className={s.muted}>· {t('verified')}</span> : null}
      </span>
      <span className={s.num}>{amountText(e, hidden)}</span>
      <span className={s.rowStatus} data-s={e.status}>
        {t(STATUS[e.status] ?? e.status)}
      </span>
    </button>
  );
}

/* --------------------------------------------------------------- overview */

function Chart({ model }: { model: DashModel }) {
  const t = useT();
  const max = Math.max(1, ...model.days.map((d) => Math.max(d.in, d.out)));
  const sum = (k: 'in' | 'out' | 'other' | 'failed') => model.days.reduce((n, d) => n + d[k], 0);
  const totalIn = sum('in');
  const totalOut = sum('out');
  if (totalIn + totalOut + sum('other') + sum('failed') === 0) return <Empty>{t('Nothing in the last {days} days.', { days: DAYS })}</Empty>;
  const h = (n: number) => (n ? `max(2px, ${(n / max) * 100}%)` : '0');
  return (
    <>
      <div className={s.chart} role="img" aria-label={t('Last {days} days: {in} payments in, {out} payments out.', { days: DAYS, in: totalIn, out: totalOut })}>
        {model.days.map((d) => (
          <div key={d.day} className={s.day} title={`${new Date(d.day).toLocaleDateString()} · ${t('{in} in, {out} out', { in: d.in, out: d.out })}`}>
            <span className={s.dayIn} style={{ height: h(d.in) }} />
            <span className={s.dayAxis} />
            <span className={s.dayOut} style={{ height: h(d.out) }} />
          </div>
        ))}
      </div>
      <div className={s.chartAxis}>
        <span>{new Date(model.days[0].day).toLocaleDateString()}</span>
        <span>{t('In above the line, out below')}</span>
        <span>{t('Today')}</span>
      </div>
    </>
  );
}

function Fact({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className={s.fact}>
      <span className={s.factLabel}>{label}</span>
      <span className={s.factValue}>{value}</span>
      {sub ? <span className={s.factSub}>{sub}</span> : null}
    </div>
  );
}

export function Overview({
  model, state, alerts, hidden, worker, now, mainnet, onAll, onOpen,
}: {
  model: DashModel; state: WalletSnapshot; alerts: DashAlert[]; hidden: boolean; worker: boolean; now: number; mainnet: boolean;
  onAll: () => void; onOpen: (e: DashEvent) => void;
}) {
  const t = useT();
  const attention = alerts.filter((a) => a.level !== 'info');
  const info = alerts.filter((a) => a.level === 'info');
  const fj = state.feeJuice;
  const sent = model.byKind.send ?? 0;
  const received = model.byKind.receive ?? 0;
  const verified = model.counterparties.filter((c) => c.verified).length;
  const fjEnough = fj && fj.minForTx > 0n ? fj.balance >= fj.minForTx : undefined;
  const hide = (v: bigint, d: number) => (hidden ? '••••' : formatUnits(v, d));

  return (
    <div className={s.split}>
      <div className={s.stack}>
        {attention.length || (state.phase === 'needs-fee-juice' && state.step) ? (
          <section aria-labelledby="ov-att">
            <H2 id="ov-att">{t('Needs your attention')}</H2>
            <ul className={s.attention}>
              {attention.map((a) => (
                <li key={a.id} data-l={a.level}>
                  {t(a.text, a.vars)}
                </li>
              ))}
              {state.phase === 'needs-fee-juice' && state.step ? <li>{t(state.step)}</li> : null}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="ov-bal">
          <H2 id="ov-bal" src={['proof']}>
            {t('Private balances')}
          </H2>
          {state.balances.length ? (
            <div className={s.balances}>
              {state.balances.map((b) => (
                <div key={b.key} className={s.balance}>
                  <span className={s.balanceToken}>{b.symbol}</span>
                  <span className={s.balanceValue}>{hide(b.privateUnits, b.decimals)}</span>
                  {b.publicUnits > 0n ? <span className={s.balancePublic}>{t('{amount} public, visible to anyone', { amount: hide(b.publicUnits, b.decimals) })}</span> : null}
                </div>
              ))}
            </div>
          ) : (
            <Empty>{t('No token is set up on this network yet.')}</Empty>
          )}
        </section>

        <section aria-labelledby="ov-days">
          <H2 id="ov-days" src={['local']}>
            {t('Last {days} days', { days: DAYS })}
          </H2>
          <Chart model={model} />
        </section>

        <section aria-labelledby="ov-latest">
          <H2
            id="ov-latest"
            src={['local']}
            aside={
              model.events.length ? (
                <button type="button" className={s.textBtn} onClick={onAll}>
                  {t('All activity')}
                </button>
              ) : undefined
            }
          >
            {t('Latest')}
          </H2>
          {model.events.length ? (
            <div>
              {model.events.slice(0, 8).map((e) => (
                <EventRow key={e.id} e={e} hidden={hidden} now={now} onSelect={onOpen} />
              ))}
            </div>
          ) : (
            <Empty title={t('No activity yet')}>
              {t('Payments you send or receive with this wallet appear here as soon as your device finds them.')}{' '}
              <Link href="/chat">{t('Open Ledger Chat')}</Link>
            </Empty>
          )}
        </section>

        {model.totals.length ? (
          <section aria-labelledby="ov-totals">
            <H2 id="ov-totals" src={['local', 'proof']}>
              {t('Totals per token')}
            </H2>
            <div className={s.scrollX}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th scope="col">{t('Token')}</th>
                    <th scope="col" className={s.num}>{t('Received')}</th>
                    <th scope="col" className={s.num}>{t('Sent')}</th>
                    <th scope="col" className={s.num}>{t('Made private')}</th>
                    <th scope="col" className={s.num}>{t('Made public')}</th>
                    <th scope="col" className={s.num}>{t('Records')}</th>
                  </tr>
                </thead>
                <tbody>
                  {model.totals.map((x) => (
                    <tr key={x.token}>
                      <td>{x.symbol}</td>
                      {[x.received, x.sent, x.shielded, x.unshielded].map((v, i) => (
                        <td key={i} className={s.num}>
                          {hide(v, x.decimals)}
                        </td>
                      ))}
                      <td className={s.num}>{x.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>

      <aside aria-label={t('Summary')}>
        <Fact
          label={t('Fee Juice')}
          value={!mainnet ? t('Sponsored') : fj ? FJ(fj.balance, hidden) : '—'}
          sub={
            !mainnet
              ? t('Fees are paid for you on the test network.')
              : !fj
                ? t('Not read yet.')
                : fjEnough === false
                  ? t('Not enough for the next transaction')
                  : fjEnough
                    ? t('Enough for the next transaction')
                    : t('What one transaction needs is not known yet.')
          }
        />
        <Fact label={t('Payments')} value={sent + received} sub={t('{sent} sent, {received} received', { sent, received })} />
        <Fact label={t('On its way')} value={model.inFlight} sub={model.stuck ? t('{n} for more than ten minutes', { n: model.stuck }) : model.inFlight ? t('None for more than ten minutes') : t('Nothing being proven or sent')} />
        <Fact label={t('Counterparties')} value={model.counterparties.length} sub={t('{n} with an address proven in a chat', { n: verified })} />
        <Fact
          label={t('History on this device')}
          value={model.first ? t('Since {date}', { date: new Date(model.first).toLocaleDateString() }) : '—'}
          sub={t('{n} days with activity', { n: model.activeDays })}
        />
        <Fact label={t('Computed')} value={model.computedInMs < 1 ? t('under 1 ms') : t('{ms} ms', { ms: model.computedInMs })} sub={worker ? t('On this device, in a background worker') : t('On this device, in the page')} />
        {info.map((a) => (
          <p key={a.id} className={s.note}>
            {t(a.text, a.vars)}
          </p>
        ))}
      </aside>
    </div>
  );
}

/* --------------------------------------------------------------- activity */

export function ActivityView({
  model, hidden, tokens, address, now, initial,
}: {
  model: DashModel; hidden: boolean; tokens: DashInputs['tokens']; address: string; now: number; initial?: string | null;
}) {
  const t = useT();
  const [f, setF] = useState<EventFilter>(NO_FILTER);
  const [selId, setSelId] = useState<string | null>(initial ?? null);
  const sel = useMemo(() => (selId ? model.events.find((e) => e.id === selId) ?? null : null), [selId, model]);
  const list = useMemo(() => filterEvents(model.events, f, now), [model, f, now]);
  const parent = useRef<HTMLDivElement>(null);
  const detail = useRef<HTMLElement>(null);
  const v = useVirtualizer({ count: list.length, getScrollElement: () => parent.current, estimateSize: () => 48, overscan: 10, getItemKey: (i) => list[i].id });

  useEffect(() => {
    if (initial) setSelId(initial);
  }, [initial]);
  useEffect(() => {
    // On a phone the detail sits under the list: bring it into view, without scrolling animation.
    if (sel && detail.current && window.matchMedia('(max-width: 960px)').matches) detail.current.scrollIntoView({ block: 'start' });
  }, [sel]);

  const exportCsv = () => {
    const csv = activityCsv(
      model.events.map((e) => ({ id: e.id, kind: e.kind, token: e.token as any, amount: e.amount?.toString(), counterparty: e.counterparty, txHash: e.txHash, blockNumber: e.block, status: e.status, createdAt: e.at })),
      tokens,
      AZTEC_WALLET_CONFIG.network,
    );
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-chat-activity-${short(address, 4)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const dir: { id: EventFilter['direction']; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'in', label: 'Money in' },
    { id: 'out', label: 'Money out' },
    { id: 'other', label: 'Other' },
  ];
  const filtered = f.direction !== 'all' || f.status !== 'all' || f.token !== 'all' || f.since !== 0 || f.q.trim() !== '';

  return (
    <div className={sel ? s.withDetail : undefined}>
      <div style={{ minWidth: 0 }}>
        <div className={s.filters} role="search">
          <div className={s.toggle} role="group" aria-label={t('Direction')}>
            {dir.map((d) => (
              <button key={d.id} type="button" aria-pressed={f.direction === d.id} onClick={() => setF({ ...f, direction: d.id })}>
                {t(d.label)}
              </button>
            ))}
          </div>
          <label className={s.srOnly} htmlFor="dash-status">{t('Status')}</label>
          <select id="dash-status" className={s.select} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as EventFilter['status'] })}>
            <option value="all">{t('Any status')}</option>
            {Object.entries(STATUS).map(([k, l]) => (
              <option key={k} value={k}>{t(l)}</option>
            ))}
          </select>
          {tokens.length > 1 ? (
            <>
              <label className={s.srOnly} htmlFor="dash-token">{t('Token')}</label>
              <select id="dash-token" className={s.select} value={f.token} onChange={(e) => setF({ ...f, token: e.target.value })}>
                <option value="all">{t('Any token')}</option>
                {tokens.map((tk) => (
                  <option key={tk.key} value={tk.key}>{tk.symbol}</option>
                ))}
              </select>
            </>
          ) : null}
          <label className={s.srOnly} htmlFor="dash-since">{t('Period')}</label>
          <select id="dash-since" className={s.select} value={f.since} onChange={(e) => setF({ ...f, since: Number(e.target.value) })}>
            <option value={0}>{t('All time')}</option>
            <option value={7}>{t('Last 7 days')}</option>
            <option value={30}>{t('Last 30 days')}</option>
            <option value={90}>{t('Last 90 days')}</option>
          </select>
          <label className={s.srOnly} htmlFor="dash-q">{t('Search')}</label>
          <input id="dash-q" className={s.search} type="search" placeholder={t('Address, name or transaction')} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          <button type="button" className={s.textBtn} onClick={exportCsv} disabled={!model.events.length}>
            {t('Export CSV')}
          </button>
        </div>
        <p className={s.shown} aria-live="polite">
          {t('{shown} of {total} records', { shown: list.length, total: model.events.length })}
          {filtered ? (
            <>
              {' · '}
              <button type="button" className={s.textBtn} onClick={() => setF(NO_FILTER)}>
                {t('Clear filters')}
              </button>
            </>
          ) : null}
        </p>
        {list.length === 0 ? (
          model.events.length ? (
            <Empty title={t('Nothing matches these filters')}>{t('Change or clear the filters to see more.')}</Empty>
          ) : (
            <Empty title={t('No activity yet')}>{t('Payments you send or receive with this wallet appear here as soon as your device finds them.')}</Empty>
          )
        ) : (
          <div ref={parent} className={s.viewport} role="list" aria-label={t('Activity')}>
            <div style={{ height: v.getTotalSize(), position: 'relative' }}>
              {v.getVirtualItems().map((it) => {
                const e = list[it.index];
                return (
                  <div key={it.key} data-index={it.index} ref={v.measureElement} role="listitem" style={{ position: 'absolute', top: it.start, left: 0, right: 0 }}>
                    <EventRow e={e} hidden={hidden} now={now} selected={sel?.id === e.id} onSelect={(x) => setSelId(x.id === selId ? null : x.id)} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {sel ? (
        <aside ref={detail} className={s.detail} aria-labelledby="dash-detail">
          <H2 id="dash-detail" src={sel.provenance as Provenance[]} aside={<button type="button" className={s.textBtn} onClick={() => setSelId(null)}>{t('Close')}</button>}>
            {t(KIND[sel.kind] ?? sel.kind)}
          </H2>
          <dl className={s.kv}>
            <dt>{t('Status')}</dt>
            <dd>{t(STATUS[sel.status] ?? sel.status)}</dd>
            {sel.amount !== undefined ? (
              <>
                <dt>{t('Amount')}</dt>
                <dd>{amountText(sel, hidden)}</dd>
              </>
            ) : null}
            <dt>{t('When')}</dt>
            <dd>{sel.at ? new Date(sel.at).toLocaleString() : t('Date unknown')}</dd>
            {sel.counterparty ? (
              <>
                <dt>{t('Counterparty')}</dt>
                <dd>
                  {sel.counterpartyLabel ? <div>{sel.counterpartyLabel}</div> : null}
                  <span className={s.mono}>{sel.counterparty}</span>
                  {sel.verified ? <div className={s.muted}>{t('Address proven in a chat')}</div> : null}
                </dd>
              </>
            ) : null}
            {sel.txHash ? (
              <>
                <dt>{t('Transaction')}</dt>
                <dd className={s.mono}>{sel.txHash}</dd>
              </>
            ) : null}
            {sel.block ? (
              <>
                <dt>{t('Block')}</dt>
                <dd>{sel.block}</dd>
              </>
            ) : null}
            {sel.error ? (
              <>
                <dt>{t('Reason')}</dt>
                <dd>{t(sel.error)}</dd>
              </>
            ) : null}
          </dl>
          <div className={s.actions}>
            {sel.txHash ? <CopyButton value={sel.txHash} label={t('Copy transaction hash')} text={t('Copy transaction hash')} /> : null}
            {sel.txHash && explorerTxUrl(sel.txHash) ? (
              <a href={explorerTxUrl(sel.txHash)} target="_blank" rel="noopener noreferrer">
                {t('Open in the public explorer')}
              </a>
            ) : null}
          </div>
          <p className={s.note}>{t('The amount and the counterparty come from this device. Only the hash, block and fee payer are public.')}</p>
        </aside>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- people */

export function PeopleView({ model, hidden }: { model: DashModel; hidden: boolean }) {
  const t = useT();
  if (!model.counterparties.length)
    return <Empty title={t('No counterparties yet')}>{t('People you pay or who pay you, and contacts whose Aztec address was proven in a chat, appear here.')}</Empty>;
  const meta = (k: string) => model.totals.find((x) => x.token === k);
  return (
    <section aria-labelledby="pp-h">
      <H2 id="pp-h" src={['local', 'proof']}>
        {t('People you pay and who pay you')}
      </H2>
      <div className={s.scrollX}>
        <table className={s.table}>
          <thead>
            <tr>
              <th scope="col">{t('Counterparty')}</th>
              <th scope="col">{t('Address')}</th>
              <th scope="col" className={s.num}>{t('Payments')}</th>
              <th scope="col" className={s.num}>{t('Sent')}</th>
              <th scope="col" className={s.num}>{t('Received')}</th>
              <th scope="col">{t('Last')}</th>
            </tr>
          </thead>
          <tbody>
            {model.counterparties.slice(0, 500).map((c) => {
              const tok = Object.entries(c.perToken);
              const fmt = (pick: 'sent' | 'received') => {
                const moved = tok.filter(([, v]) => v[pick] > 0n);
                if (!moved.length) return '—';
                return hidden ? '••••' : moved.map(([k, v]) => `${formatUnits(v[pick], meta(k)?.decimals ?? 18)} ${meta(k)?.symbol ?? ''}`.trim()).join(', ');
              };
              return (
                <tr key={c.address}>
                  <td>
                    {c.label || <span className={s.muted}>{t('No name')}</span>}
                    {c.verified ? <div className={s.muted}>{t('Address proven in a chat')}</div> : null}
                  </td>
                  <td className={s.mono}>{short(c.address, 8)}</td>
                  <td className={s.num}>{c.count}</td>
                  <td className={s.num}>{fmt('sent')}</td>
                  <td className={s.num}>{fmt('received')}</td>
                  <td className={s.muted}>{c.last ? new Date(c.last).toLocaleDateString() : t('Never paid')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {model.counterparties.length > 500 ? <p className={s.note}>{t('Showing the 500 most active of {n}.', { n: model.counterparties.length })}</p> : null}
    </section>
  );
}

/* ---------------------------------------------------------------- network */

export function NetworkView({
  state, node, notes, fee, now, hidden, mainnet, onRefresh, example,
}: {
  state: WalletSnapshot; node: LiveState<NetStatus>; notes: LiveState<number>; fee: LiveState<unknown>; now: number; hidden: boolean; mainnet: boolean;
  onRefresh: () => void; example: boolean;
}) {
  const t = useT();
  const net = node.value;
  const fj = state.feeJuice;
  const behind = net?.blockNumber !== undefined && net?.provenBlockNumber !== undefined ? net.blockNumber - net.provenBlockNumber : undefined;
  const retryIn = node.nextAt ? Math.max(0, Math.ceil((node.nextAt - now) / 1000)) : undefined;
  return (
    <div className={s.split}>
      <div className={s.stack}>
        <section aria-labelledby="nw-pxe">
          <H2 id="nw-pxe" src={['local']}>
            {t('Private node in this browser')}
          </H2>
          <dl className={s.kv}>
            <dt>{t('State')}</dt>
            <dd>{state.phase === 'needs-fee-juice' ? t('Open, waiting for Fee Juice to send') : t('Open')}</dd>
            <dt>{t('Doing now')}</dt>
            <dd>{state.busy ? (state.step ? t(state.step) : t('Working')) : t('Nothing')}</dd>
            <dt>{t('Notes synced')}</dt>
            <dd>{example ? t('Example: not synced') : age(t, notes.okAt, now)}</dd>
            <dt>{t('Aztec address')}</dt>
            <dd>
              {state.aztecAddress ? (
                <>
                  <span className={s.mono}>{state.aztecAddress}</span> <CopyButton value={state.aztecAddress} label={t('Copy Aztec address')} />
                </>
              ) : (
                '—'
              )}
            </dd>
            <dt>{t('Network')}</dt>
            <dd>{mainnet ? t('Aztec Alpha') : t('Aztec test network')}</dd>
          </dl>
          <p className={s.note}>{t('Your keys, notes and proofs stay in this browser’s encrypted storage.')}</p>
        </section>

        <section aria-labelledby="nw-node">
          <H2
            id="nw-node"
            src={['public']}
            aside={
              example ? undefined : (
                <button type="button" className={s.textBtn} onClick={onRefresh} disabled={node.status === 'reading'}>
                  {node.status === 'reading' ? t('Reading') : t('Read now')}
                </button>
              )
            }
          >
            {t('Network, read from the node')}
          </H2>
          {example ? (
            <Empty>{t('The example reads nothing from the network.')}</Empty>
          ) : (
            <>
              <dl className={s.kv}>
                <dt>{t('Latest block')}</dt>
                <dd>{net?.blockNumber?.toLocaleString() ?? '—'}</dd>
                <dt>{t('Proven block')}</dt>
                <dd>{net?.provenBlockNumber?.toLocaleString() ?? '—'}</dd>
                <dt>{t('Not yet proven')}</dt>
                <dd>{behind === undefined ? '—' : t('{n} blocks', { n: behind })}</dd>
                <dt>{t('Node version')}</dt>
                <dd className={s.mono}>{net?.nodeVersion || '—'}</dd>
                <dt>{t('Settles on')}</dt>
                <dd>{net?.l1ChainId === 1 ? 'Ethereum' : net?.l1ChainId === 11155111 ? 'Sepolia' : net?.l1ChainId ?? '—'}</dd>
                <dt>{t('Rollup version')}</dt>
                <dd className={s.mono}>{net?.rollupVersion ?? '—'}</dd>
                <dt>{t('Read')}</dt>
                <dd>{age(t, node.okAt, now)}</dd>
              </dl>
              {node.status === 'retrying' ? (
                <p className={s.note} role="status">
                  {net ? t('The node is not answering. These values were read {age}.', { age: age(t, node.okAt, now) }) : t('The node is not answering.')}{' '}
                  {retryIn !== undefined ? t('Next try in {n} s.', { n: retryIn }) : null}
                </p>
              ) : node.status === 'offline' ? (
                <p className={s.note} role="status">{t('This device is offline. Reading starts again when it reconnects.')}</p>
              ) : null}
            </>
          )}
        </section>
      </div>

      <aside aria-labelledby="nw-fee">
        <H2 id="nw-fee" src={['public']}>
          {t('Fee Juice')}
        </H2>
        {!mainnet ? (
          <Empty>{t('Fees are sponsored on the test network. Fee Juice applies on Aztec Alpha.')}</Empty>
        ) : fj ? (
          <>
            <dl className={s.kv}>
              <dt>{t('Balance')}</dt>
              <dd>{FJ(fj.balance, hidden)}</dd>
              <dt>{t('One transaction needs up to')}</dt>
              <dd>{fj.minForTx > 0n ? FJ(fj.minForTx, hidden) : t('Unknown')}</dd>
              <dt>{t('Next transaction pays with')}</dt>
              <dd>{planText(t, fj.plan)}</dd>
              <dt>{t('Deposits from Ethereum')}</dt>
              <dd>{fj.claims.length ? t('{ready} of {all} ready to claim', { ready: fj.claims.filter((c) => c.ready).length, all: fj.claims.length }) : t('None')}</dd>
              {fj.privateBalance !== undefined ? (
                <>
                  <dt>{t('Private fee balance')}</dt>
                  <dd>{FJ(fj.privateBalance, hidden)}</dd>
                </>
              ) : null}
              <dt>{t('Read')}</dt>
              <dd>{example ? t('Example') : age(t, fee.okAt, now)}</dd>
            </dl>
            <p className={s.note}>{t('The account that pays the network fee is public: its transactions can be linked to each other.')}</p>
          </>
        ) : (
          <Empty>{fee.status === 'retrying' ? t('Could not be read yet. Trying again.') : t('Not read yet.')}</Empty>
        )}
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------- messaging */

export function MessagingView({ address }: { address: string }) {
  const t = useT();
  const { address: connected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [stats, setStats] = useState<MessagingStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const can = !!connected && connected.toLowerCase() === address.toLowerCase();

  const read = async () => {
    setBusy(true);
    setErr(false);
    try {
      setStats(
        await readMessagingStats({
          getAddress: async () => address,
          getChainId: () => chainId,
          signMessage: async (m: string | Uint8Array) => signMessageAsync({ message: typeof m === 'string' ? m : { raw: m } }),
        } as any),
      );
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.split}>
      <section aria-labelledby="mg-db">
        <H2 id="mg-db" src={['local']}>
          {t('Your messaging database')}
        </H2>
        {stats ? (
          <dl className={s.kv}>
            <dt>{t('Inbox')}</dt>
            <dd className={s.mono}>{short(stats.inboxId, 10)}</dd>
            <dt>{t('This device')}</dt>
            <dd className={s.mono}>{stats.installationId ? short(stats.installationId, 8) : '—'}</dd>
            <dt>{t('Devices on this inbox')}</dt>
            <dd>{stats.installations ?? '—'}</dd>
            <dt>{t('Direct chats')}</dt>
            <dd>{stats.dms}</dd>
            <dt>{t('Groups')}</dt>
            <dd>{stats.groups}</dd>
            <dt>{t('Accepted')}</dt>
            <dd>{stats.allowed}</dd>
            <dt>{t('Requests')}</dt>
            <dd>{stats.requests}</dd>
            <dt>{t('Blocked')}</dt>
            <dd>{stats.denied}</dd>
            <dt>{t('Read at')}</dt>
            <dd>{new Date(stats.readAt).toLocaleTimeString()}</dd>
          </dl>
        ) : (
          <p className={s.stateText}>{t('Counts and identifiers from the encrypted messaging database on this device. No message text and no names are read.')}</p>
        )}
        {err ? (
          <p className={s.note} role="alert">
            {t('The messaging database could not be opened here. If the chat is open in another tab, close it and try again.')}
          </p>
        ) : null}
        <div className={s.actions}>
          <button type="button" className={`${s.btn} ${s.btnLine}`} onClick={read} disabled={!can || busy}>
            {busy ? t('Reading') : stats ? t('Read again') : t('Read my messaging database')}
          </button>
          {!can ? <span className={s.muted}>{t('Connect the wallet you sign in with to read it here.')}</span> : null}
        </div>
      </section>
      <aside aria-labelledby="mg-net">
        <H2 id="mg-net">
          {t('What the XMTP network sees')}
        </H2>
        <p className={s.stateText}>{t('Messages travel as MLS ciphertext. The network sees inbox ids and timing, not content.')}</p>
        <p className={s.note}>
          <Link href="/docs/overview">{t('How messaging is protected')}</Link>
        </p>
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------- your data */

const INVENTORY: { what: string; from: string; where: string; prov: Provenance }[] = [
  { what: 'Private balances', from: 'Notes decrypted by the PXE in this browser', where: 'Encrypted wallet storage on this device', prov: 'proof' },
  { what: 'Payments sent and received', from: 'Private Transfer events the PXE decrypts, and payments this device proved', where: 'Encrypted wallet storage and the activity record in this browser', prov: 'proof' },
  { what: 'Shield, unshield and test tokens', from: 'Recorded when this device sends them', where: 'Activity record in this browser', prov: 'local' },
  { what: 'Verified counterparties', from: 'Proofs of address control checked in your chats', where: 'This browser', prov: 'local' },
  { what: 'Contact names', from: 'Names you gave on this device', where: 'This browser', prov: 'local' },
  { what: 'Personal limits', from: 'Settings, Payments', where: 'This browser', prov: 'local' },
  { what: 'Messaging counts', from: 'Your XMTP database, when you read it here', where: 'Encrypted messaging database on this device', prov: 'local' },
  { what: 'Fee Juice balance and deposits', from: 'The Aztec node and Ethereum', where: 'Public chain state', prov: 'public' },
  { what: 'Transaction hashes, blocks, fee payer', from: 'The Aztec node', where: 'Public chain state', prov: 'public' },
  { what: 'Latest and proven block', from: 'The Aztec node', where: 'Public chain state', prov: 'public' },
];

const LIVE_READS: { what: string; from: string; where: string }[] = [
  { what: 'Latest and proven block', from: 'The Aztec node', where: 'Every 15 seconds' },
  { what: 'Your notes, balances and activity', from: 'The private node in this browser', where: 'Every minute, and after each payment' },
  { what: 'Fee Juice', from: 'The Aztec node', where: 'Every minute, on Aztec Alpha' },
];

const NOT_SHOWN: { what: string; why: string }[] = [
  { what: 'Agreements (escrows and streams)', why: 'Their invitations live inside the conversation; they are shown and acted on in the chat.' },
  { what: 'Message text and the names of people you talk to', why: 'The dashboard reads counts only, so nothing personal is copied out of the chat.' },
  { what: 'Activity from another device before this one synced', why: 'Received payments are rebuilt from your notes; shields and unshields sent elsewhere are not.' },
  { what: 'Proving times', why: 'The wallet does not record them yet.' },
];

export function DataView({
  address, onClose, onWipe, wiping, busy, example, wipeError,
}: {
  address: string; onClose: () => void; onWipe: () => void; wiping: boolean; busy: boolean; example: boolean; wipeError?: string | null;
}) {
  const t = useT();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className={s.stack}>
      <section aria-labelledby="dt-inv">
        <H2 id="dt-inv">{t('What this page shows, and where each piece comes from')}</H2>
        <dl className={s.kv}>
          <dt>{t(SOURCE.local)}</dt>
          <dd>{t('kept only in this browser')}</dd>
          <dt>{t(SOURCE.proof)}</dt>
          <dd>{t('found or proven by the private node in this browser')}</dd>
          <dt>{t(SOURCE.public)}</dt>
          <dd>{t('readable by anyone on Aztec or Ethereum')}</dd>
        </dl>
        <div className={s.scrollX} style={{ marginTop: 16 }}>
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">{t('Information')}</th>
                <th scope="col">{t('Source')}</th>
                <th scope="col">{t('Where it lives')}</th>
                <th scope="col">{t('Kind')}</th>
              </tr>
            </thead>
            <tbody>
              {INVENTORY.map((r) => (
                <tr key={r.what}>
                  <td>{t(r.what)}</td>
                  <td>{t(r.from)}</td>
                  <td>{t(r.where)}</td>
                  <td className={s.muted}>{t(SOURCE[r.prov])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={s.note}>{t('This page sends none of it to our server. The wallet talks to the Aztec node, and the messaging client to XMTP, only as they do in the chat.')}</p>
      </section>

      <section aria-labelledby="dt-live">
        <H2 id="dt-live">{t('How the page stays current')}</H2>
        <div className={s.scrollX}>
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">{t('Information')}</th>
                <th scope="col">{t('Read from')}</th>
                <th scope="col">{t('How often')}</th>
              </tr>
            </thead>
            <tbody>
              {LIVE_READS.map((r) => (
                <tr key={r.what}>
                  <td>{t(r.what)}</td>
                  <td>{t(r.from)}</td>
                  <td>{t(r.where)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={s.note}>
          {t('Reading stops while this tab is hidden or the device is offline, and starts again the moment it is back. After a failed read the next try waits longer each time, up to five minutes, and the last values stay on screen with their age.')}
        </p>
      </section>

      <section aria-labelledby="dt-not">
        <H2 id="dt-not">{t('Not on this page, and why')}</H2>
        <dl className={s.kv}>
          {NOT_SHOWN.map((r) => (
            <React.Fragment key={r.what}>
              <dt>{t(r.what)}</dt>
              <dd>{t(r.why)}</dd>
            </React.Fragment>
          ))}
        </dl>
      </section>

      <section aria-labelledby="dt-dev">
        <H2 id="dt-dev">{t('This device')}</H2>
        {example ? (
          <Empty>{t('The example keeps nothing on this device.')}</Empty>
        ) : (
          <>
            <p className={s.stateText}>
              {t('Close the private wallet here, or remove everything it keeps on this device. Removing is safe: nothing on chain is lost, and your notes sync again the next time you open it.')}
            </p>
            <div className={s.actions}>
              <button type="button" className={`${s.btn} ${s.btnLine}`} onClick={onClose} disabled={wiping}>
                {t('Close the private wallet')}
              </button>
              {confirm ? (
                <>
                  <button type="button" className={s.btn} onClick={onWipe} disabled={wiping || busy}>
                    {wiping ? t('Removing') : t('Yes, remove it from this device')}
                  </button>
                  <button type="button" className={s.textBtn} onClick={() => setConfirm(false)} disabled={wiping}>
                    {t('Cancel')}
                  </button>
                </>
              ) : (
                <button type="button" className={s.textBtn} onClick={() => setConfirm(true)} disabled={busy}>
                  {t('Remove wallet data from this device')}
                </button>
              )}
            </div>
            {busy ? <p className={s.note}>{t('A transaction is being proven or sent. Removing becomes possible when it finishes.')}</p> : null}
            {wipeError ? (
              <p className={s.note} role="alert">
                {t(wipeError)}
              </p>
            ) : null}
            <p className={s.note}>{t('Account: {address}', { address: short(address, 6) })}</p>
          </>
        )}
      </section>
    </div>
  );
}
