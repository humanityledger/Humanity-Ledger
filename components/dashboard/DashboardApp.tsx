'use client';

/**
 * components/dashboard/DashboardApp.tsx — ledgerchat.org/dashboard (25 November 2026).
 *
 * Everything Ledger Chat knows about you, on one page, computed on this device. The sources are the
 * private wallet you open here (its PXE decrypts your notes and keeps your activity record), the
 * verified peer bindings and contacts this browser keeps, and, when you ask, your messaging
 * database. The page itself sends nothing anywhere: the only network traffic is the wallet talking
 * to the Aztec node and, if you open it, the messaging client talking to XMTP, exactly as in the
 * chat. Inventory, sources and limits: docs/DASHBOARD.md.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAccount, useSignMessage } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, Check, Copy, Eye, EyeOff, Layers, Moon, RefreshCw, ShieldCheck, Sun, X,
} from 'lucide-react';
import s from './dashboard.module.css';
import { useT } from '@/lib/i18n/client';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import { useAztecWallet } from '@/lib/aztec/wallet/useAztecWallet';
import { getPrivateWallet } from '@/lib/aztec/wallet/client';
import { AZTEC_WALLET_CONFIG, explorerTxUrl } from '@/lib/aztec/wallet/config';
import { formatUnits } from '@/lib/aztec/wallet/amounts';
import { loadLimits } from '@/lib/payments/personal-limits';
import { getLocalContacts } from '@/lib/wallet/localAddressBook';
import { activityCsv } from '@/lib/payments/activity-report';
import {
  DAYS, NO_FILTER, computeAlerts, filterEvents, readBindings,
  type DashEvent, type DashInputs, type DashModel, type EventFilter, type Provenance,
} from '@/lib/dashboard/model';
import { useDashboardModel } from '@/lib/dashboard/useDashboardModel';
import { readMessagingStats, type MessagingStats } from '@/lib/dashboard/messaging';
import { EXAMPLE_PEOPLE, EXAMPLE_TOKENS, exampleActivity } from '@/lib/dashboard/example';

type Tab = 'overview' | 'activity' | 'people' | 'network' | 'messaging' | 'data';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'activity', label: 'Activity' },
  { id: 'people', label: 'People' },
  { id: 'network', label: 'Network' },
  { id: 'messaging', label: 'Messaging' },
  { id: 'data', label: 'Your data' },
];

const KIND: Record<string, string> = {
  send: 'Sent', receive: 'Received', shield: 'Made private', unshield: 'Made public',
  faucet: 'Test tokens', issue: 'Issued', deploy: 'Account created', operator: 'Operator',
};
const STATUS: Record<string, string> = { settled: 'Settled', pending: 'Pending', proving: 'Proving', failed: 'Failed' };
const PHASE_STEPS = ['signing', 'starting', 'deploying', 'ready'] as const;
const THEME_KEY = 'hl.dashboard.theme';
const EXAMPLE_NAMES = ['Amara', 'Jonas', 'Lucía', 'Mei', 'Oskar', 'Priya', 'Tomás', 'Yuki', 'Nadia', 'Felix', 'Inés', 'Ravi'];
const HIDE_KEY = 'hl.wallet.hide_amounts';
const REFRESH_MS = 30_000;

/* ------------------------------------------------------------------ helpers */

function short(v?: string, n = 6) {
  if (!v) return '';
  return v.length > 2 * n + 3 ? `${v.slice(0, n + 2)}…${v.slice(-n)}` : v;
}

function useTheme(): ['light' | 'dark', () => void] {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    try {
      if (localStorage.getItem(THEME_KEY) === 'dark') setTheme('dark');
    } catch {
      /* light */
    }
  }, []);
  const toggle = () =>
    setTheme((v) => {
      const n = v === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_KEY, n);
      } catch {
        /* kept for this visit */
      }
      return n;
    });
  return [theme, toggle];
}

function useHidden(): [boolean, () => void] {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(HIDE_KEY) === '1');
    } catch {
      /* visible */
    }
  }, []);
  return [
    hidden,
    () =>
      setHidden((h) => {
        try {
          localStorage.setItem(HIDE_KEY, h ? '0' : '1');
        } catch {
          /* this visit only */
        }
        return !h;
      }),
  ];
}

/** True while the tab is visible: polling stops when the phone locks or the tab is in the background. */
function useVisible(): boolean {
  const [v, setV] = useState(true);
  useEffect(() => {
    const on = () => setV(document.visibilityState === 'visible');
    on();
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return v;
}

/** Another dashboard open in this browser: the wallet hands itself over between tabs, so say so. */
function useOtherDashboardTab(): boolean {
  const [other, setOther] = useState(false);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel('hl-dashboard-v1');
    const me = Math.random().toString(36).slice(2);
    ch.onmessage = (e) => {
      if (e.data?.from === me) return;
      if (e.data?.type === 'hello') ch.postMessage({ type: 'here', from: me });
      if (e.data?.type === 'hello' || e.data?.type === 'here') setOther(true);
      if (e.data?.type === 'bye') setOther(false);
    };
    ch.postMessage({ type: 'hello', from: me });
    const bye = () => ch.postMessage({ type: 'bye', from: me });
    window.addEventListener('pagehide', bye);
    return () => {
      bye();
      window.removeEventListener('pagehide', bye);
      ch.close();
    };
  }, []);
  return other;
}

/* --------------------------------------------------------------- small bits */

function Prov({ p }: { p: Provenance }) {
  const t = useT();
  const label = p === 'local' ? t('Local') : p === 'proof' ? t('Device proof') : t('Public');
  return (
    <span className={s.prov} data-p={p}>
      {label}
    </span>
  );
}

function Provs({ list }: { list: Provenance[] }) {
  return (
    <span className={s.provs}>
      {list.map((p) => (
        <Prov key={p} p={p} />
      ))}
    </span>
  );
}

function Card({ title, prov, children, className = '', action }: { title: string; prov?: Provenance[]; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={`${s.card} ${className}`} aria-label={title}>
      <div className={s.cardHead}>
        <h3 className={s.cardTitle}>{title}</h3>
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          {prov ? <Provs list={prov} /> : null}
          {action}
        </span>
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, sub, prov, className = s.c3 }: { label: string; value: React.ReactNode; sub?: React.ReactNode; prov: Provenance[]; className?: string }) {
  return (
    <section className={`${s.card} ${className}`} aria-label={label}>
      <div className={s.kpi}>
        <span className={s.kpiLabel}>
          {label}
          <Provs list={prov} />
        </span>
        <span className={s.kpiValue}>{value}</span>
        {sub ? <span className={s.kpiSub}>{sub}</span> : null}
      </div>
    </section>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`${s.btn} ${s.btnQuiet} ${s.btnSm}`}
      aria-label={label}
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        });
      }}
    >
      {done ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {done ? t('Copied') : t('Copy')}
    </button>
  );
}

function amountText(e: Pick<DashEvent, 'amount' | 'decimals' | 'symbol'>, hidden: boolean): string {
  if (e.amount === undefined || e.decimals === undefined) return '';
  return hidden ? `•••• ${e.symbol ?? ''}` : `${formatUnits(e.amount, e.decimals)} ${e.symbol ?? ''}`;
}

/* --------------------------------------------------------------- the states */

function StateView({ title, text, children, busy }: { title: string; text?: React.ReactNode; children?: React.ReactNode; busy?: boolean }) {
  return (
    <div className={s.state} role={busy ? 'status' : undefined} aria-live={busy ? 'polite' : undefined}>
      {busy ? <span className={s.spinner} aria-hidden="true" /> : null}
      <h2 className={s.stateTitle}>{title}</h2>
      {text ? <p className={s.stateText}>{text}</p> : null}
      {children ? <div className={s.stateActions}>{children}</div> : null}
    </div>
  );
}

function Opening({ phase, step }: { phase: string; step?: string }) {
  const t = useT();
  const at = PHASE_STEPS.indexOf(phase as (typeof PHASE_STEPS)[number]);
  const labels: Record<string, string> = {
    signing: 'Your wallet signs the message that derives your private keys',
    starting: 'The private node starts in this browser and syncs your notes',
    deploying: 'Your Aztec account is being set up',
    ready: 'Ready',
  };
  return (
    <StateView title={t('Opening your private wallet')} busy text={step ? t(step) : t('This happens on this device. Nothing private leaves it.')}>
      <ol className={s.steps}>
        {PHASE_STEPS.map((p, i) => (
          <li key={p} data-on={i === at}>
            {i < at ? '✓ ' : i === at ? '→ ' : '· '}
            {t(labels[p])}
          </li>
        ))}
      </ol>
    </StateView>
  );
}

/* ----------------------------------------------------------------- overview */

function Bars({ model }: { model: DashModel }) {
  const t = useT();
  const max = Math.max(1, ...model.days.map((d) => d.in + d.out + d.other + d.failed));
  const total = model.days.reduce((n, d) => n + d.in + d.out + d.other + d.failed, 0);
  return (
    <>
      <div className={s.bars} role="img" aria-label={t('{count} events in the last {days} days', { count: total, days: DAYS })}>
        {model.days.map((d) => {
          const h = (n: number) => `${(n / max) * 100}%`;
          return (
            <div key={d.day} className={s.bar} title={`${new Date(d.day).toLocaleDateString()} · ${d.in + d.out + d.other + d.failed}`}>
              <span className={s.barIn} style={{ height: h(d.in) }} />
              <span className={s.barOut} style={{ height: h(d.out) }} />
              <span className={s.barOther} style={{ height: h(d.other) }} />
              <span className={s.barFailed} style={{ height: h(d.failed) }} />
            </div>
          );
        })}
      </div>
      <div className={s.barsAxis}>
        <span>{new Date(model.days[0].day).toLocaleDateString()}</span>
        <span>{t('Today')}</span>
      </div>
      <div className={s.keys}>
        <span className={s.key} style={{ ['--k' as any]: 'var(--ok)' }}>{t('Money in')}</span>
        <span className={s.key} style={{ ['--k' as any]: 'var(--ink)' }}>{t('Money out')}</span>
        <span className={s.key} style={{ ['--k' as any]: 'var(--ink-3)' }}>{t('Other')}</span>
        <span className={s.key} style={{ ['--k' as any]: 'var(--bad)' }}>{t('Failed')}</span>
      </div>
    </>
  );
}

function AlertsList({ alerts }: { alerts: ReturnType<typeof computeAlerts> }) {
  const t = useT();
  if (!alerts.length) return <p className={s.muted}>{t('Nothing needs your attention.')}</p>;
  return (
    <div className={s.alerts} role="list">
      {alerts.map((a) => (
        <div key={a.id} className={s.alert} data-l={a.level} role="listitem">
          {a.level === 'info' ? <ShieldCheck size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />}
          <span>{t(a.text, a.vars)}</span>
        </div>
      ))}
    </div>
  );
}

function EventRow({ e, hidden, selected, onSelect, style }: { e: DashEvent; hidden: boolean; selected?: boolean; onSelect: (e: DashEvent) => void; style?: React.CSSProperties }) {
  const t = useT();
  const who = e.counterpartyLabel || (e.counterparty ? short(e.counterparty) : '');
  return (
    <button type="button" className={s.row} style={style} aria-pressed={selected} onClick={() => onSelect(e)}>
      <span className={s.dot} data-d={e.status === 'failed' ? 'bad' : e.direction === 1 ? 'in' : undefined} aria-hidden="true">
        {e.direction === 1 ? <ArrowDownLeft size={14} /> : e.direction === -1 ? <ArrowUpRight size={14} /> : <Layers size={14} />}
      </span>
      <span className={s.rowMain}>
        <span className={s.rowTitle}>
          {t(KIND[e.kind] ?? e.kind)}
          {who ? <span className={s.muted}> · {who}</span> : null}
          {e.verified ? <span className={s.muted}> · {t('verified')}</span> : null}
        </span>
        <span className={s.rowSub}>
          {e.at ? new Date(e.at).toLocaleString() : t('Date unknown')}
          {e.block ? ` · ${t('block {n}', { n: e.block })}` : ''}
        </span>
      </span>
      <span className={s.num}>{amountText(e, hidden)}</span>
      <span className={s.hideSm}>
        <span className={s.status} data-s={e.status}>{t(STATUS[e.status] ?? e.status)}</span>
      </span>
      <span className={`${s.num} ${s.hideSm}`}>
        <Provs list={e.provenance} />
      </span>
    </button>
  );
}

/* ----------------------------------------------------------------- activity */

function ActivityView({ model, hidden, tokens, address }: { model: DashModel; hidden: boolean; tokens: DashInputs['tokens']; address: string }) {
  const t = useT();
  const [f, setF] = useState<EventFilter>(NO_FILTER);
  const [sel, setSel] = useState<DashEvent | null>(null);
  const now = useMemo(() => Date.now(), [model]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = useMemo(() => filterEvents(model.events, f, now), [model, f, now]);
  const parent = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({ count: list.length, getScrollElement: () => parent.current, estimateSize: () => 56, overscan: 12 });

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

  return (
    <div className={s.grid}>
      <div className={sel ? s.c8 : s.c12}>
        <div className={s.filters} role="search">
          <div className={s.seg} role="group" aria-label={t('Direction')}>
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
          <label className={s.srOnly} htmlFor="dash-token">{t('Token')}</label>
          <select id="dash-token" className={s.select} value={f.token} onChange={(e) => setF({ ...f, token: e.target.value })}>
            <option value="all">{t('Any token')}</option>
            {tokens.map((tk) => (
              <option key={tk.key} value={tk.key}>{tk.symbol}</option>
            ))}
          </select>
          <label className={s.srOnly} htmlFor="dash-since">{t('Period')}</label>
          <select id="dash-since" className={s.select} value={f.since} onChange={(e) => setF({ ...f, since: Number(e.target.value) })}>
            <option value={0}>{t('All time')}</option>
            <option value={7}>{t('Last 7 days')}</option>
            <option value={30}>{t('Last 30 days')}</option>
            <option value={90}>{t('Last 90 days')}</option>
          </select>
          <label className={s.srOnly} htmlFor="dash-q">{t('Search')}</label>
          <input id="dash-q" className={s.search} type="search" placeholder={t('Search address, name or transaction')} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          <button type="button" className={`${s.btn} ${s.btnQuiet} ${s.btnSm}`} onClick={exportCsv} disabled={!model.events.length}>
            {t('Export CSV')}
          </button>
        </div>
        <p className={s.muted} aria-live="polite" style={{ margin: '0 0 8px', fontSize: 12.5 }}>
          {t('{shown} of {total} events', { shown: list.length, total: model.events.length })}
        </p>
        {list.length === 0 ? (
          <div className={s.card}>
            <StateView title={model.events.length ? t('Nothing matches these filters') : t('No activity yet')} text={model.events.length ? undefined : t('Payments you send or receive with this wallet appear here, found by your device.')}>
              {model.events.length ? (
                <button type="button" className={`${s.btn} ${s.btnQuiet}`} onClick={() => setF(NO_FILTER)}>
                  {t('Clear filters')}
                </button>
              ) : null}
            </StateView>
          </div>
        ) : (
          <div ref={parent} className={s.viewport} role="list" aria-label={t('Activity')}>
            <div style={{ height: v.getTotalSize(), position: 'relative' }}>
              {v.getVirtualItems().map((it) => (
                <div key={list[it.index].id} role="listitem" style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${it.start}px)` }}>
                  <EventRow e={list[it.index]} hidden={hidden} selected={sel?.id === list[it.index].id} onSelect={setSel} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {sel ? (
        <aside className={`${s.c4} ${s.detail}`}>
          <Card
            title={t(KIND[sel.kind] ?? sel.kind)}
            prov={sel.provenance}
            action={
              <button type="button" className={`${s.btn} ${s.btnQuiet} ${s.btnSm}`} onClick={() => setSel(null)} aria-label={t('Close details')}>
                <X size={14} aria-hidden="true" />
              </button>
            }
          >
            <dl className={s.kv}>
              <dt>{t('Status')}</dt>
              <dd><span className={s.status} data-s={sel.status}>{t(STATUS[sel.status] ?? sel.status)}</span></dd>
              {sel.amount !== undefined ? (<><dt>{t('Amount')}</dt><dd className={s.num} style={{ textAlign: 'left' }}>{amountText(sel, hidden)}</dd></>) : null}
              <dt>{t('When')}</dt>
              <dd>{sel.at ? new Date(sel.at).toLocaleString() : t('Date unknown')}</dd>
              {sel.counterparty ? (<><dt>{t('Counterparty')}</dt><dd className={s.mono}>{sel.counterpartyLabel ? `${sel.counterpartyLabel} · ` : ''}{sel.counterparty}{sel.verified ? ` · ${t('verified')}` : ''}</dd></>) : null}
              {sel.txHash ? (<><dt>{t('Transaction')}</dt><dd className={s.mono}>{sel.txHash}</dd></>) : null}
              {sel.block ? (<><dt>{t('Block')}</dt><dd>{sel.block}</dd></>) : null}
              {sel.error ? (<><dt>{t('Reason')}</dt><dd>{t(sel.error)}</dd></>) : null}
            </dl>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {sel.txHash ? <CopyButton value={sel.txHash} label={t('Copy transaction hash')} /> : null}
              {sel.txHash && explorerTxUrl(sel.txHash) ? (
                <a className={`${s.btn} ${s.btnQuiet} ${s.btnSm}`} href={explorerTxUrl(sel.txHash)} target="_blank" rel="noopener noreferrer">
                  {t('Open in the public explorer')}
                </a>
              ) : null}
            </div>
            <p className={s.cardNote}>{t('The amount and the counterparty come from this device. Only the hash, block and fee payer are public.')}</p>
          </Card>
        </aside>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------- people */

function PeopleView({ model, hidden }: { model: DashModel; hidden: boolean }) {
  const t = useT();
  if (!model.counterparties.length)
    return (
      <div className={s.card}>
        <StateView title={t('No counterparties yet')} text={t('People you pay or who pay you, and contacts whose Aztec address was proven in a chat, appear here.')} />
      </div>
    );
  return (
    <Card title={t('People you pay and who pay you')} prov={['local', 'proof']}>
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
              const fmt = (pick: 'sent' | 'received') =>
                hidden ? '••••' : tok.length ? tok.map(([k, v]) => `${formatUnits(v[pick], model.totals.find((x) => x.token === k)?.decimals ?? 18)} ${model.totals.find((x) => x.token === k)?.symbol ?? ''}`).join(' · ') : '—';
              return (
                <tr key={c.address}>
                  <td>
                    <strong>{c.label || t('Unnamed')}</strong>
                    {c.verified ? <div className={s.muted} style={{ fontSize: 12 }}>{t('Address proven in a chat')}</div> : null}
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
      {model.counterparties.length > 500 ? <p className={s.cardNote}>{t('Showing the 500 most active of {n}.', { n: model.counterparties.length })}</p> : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ network */

type NetStatus = Awaited<ReturnType<ReturnType<typeof getPrivateWallet>['networkStatus']>>;

function NetworkView({ state, net, onRefresh, refreshing, hidden }: { state: ReturnType<typeof useAztecWallet>['state']; net: NetStatus | null; onRefresh: () => void; refreshing: boolean; hidden: boolean }) {
  const t = useT();
  const fj = state.feeJuice;
  const fmt = (v?: bigint) => (v === undefined ? '—' : hidden ? '••••' : `${formatUnits(v, 18)} FJ`);
  return (
    <div className={s.grid}>
      <Card title={t('Private node in this browser')} prov={['local']} className={s.c6} action={
        <button type="button" className={`${s.btn} ${s.btnQuiet} ${s.btnSm}`} onClick={onRefresh} disabled={refreshing || state.busy}>
          <RefreshCw size={14} aria-hidden="true" /> {refreshing ? t('Refreshing') : t('Refresh')}
        </button>
      }>
        <dl className={s.kv}>
          <dt>{t('State')}</dt><dd>{t(state.phase === 'ready' ? 'Ready' : state.phase === 'needs-fee-juice' ? 'Needs Fee Juice' : state.phase === 'error' ? 'Error' : 'Starting')}</dd>
          <dt>{t('Doing now')}</dt><dd>{state.busy ? t(state.step ?? 'Working') : t('Idle')}</dd>
          <dt>{t('Aztec address')}</dt><dd className={s.mono}>{state.aztecAddress ?? '—'}</dd>
          <dt>{t('Network')}</dt><dd>{AZTEC_WALLET_CONFIG.network === 'mainnet' ? t('Aztec Alpha') : t('Aztec test network')}</dd>
        </dl>
        <p className={s.cardNote}>{t('Your keys, notes and proofs stay in this browser’s encrypted storage.')}</p>
      </Card>
      <Card title={t('Network, read from the node')} prov={['public']} className={s.c6}>
        <dl className={s.kv}>
          <dt>{t('Latest block')}</dt><dd>{net?.blockNumber ?? '—'}</dd>
          <dt>{t('Proven block')}</dt><dd>{net?.provenBlockNumber ?? '—'}</dd>
          <dt>{t('Node version')}</dt><dd className={s.mono}>{net?.nodeVersion || '—'}</dd>
          <dt>{t('Settles on')}</dt><dd>{net?.l1ChainId === 1 ? 'Ethereum' : net?.l1ChainId === 11155111 ? 'Sepolia' : net?.l1ChainId ?? '—'}</dd>
          <dt>{t('Rollup version')}</dt><dd className={s.mono}>{net?.rollupVersion ?? '—'}</dd>
          <dt>{t('Read at')}</dt><dd>{net ? new Date(net.readAt).toLocaleTimeString() : '—'}</dd>
        </dl>
        <p className={s.cardNote}>{t('Read every 30 seconds while this page is visible.')}</p>
      </Card>
      <Card title={t('Fee Juice')} prov={['public']} className={s.c12}>
        {fj ? (
          <>
            <dl className={s.kv}>
              <dt>{t('Balance')}</dt><dd>{fmt(fj.balance)}</dd>
              <dt>{t('Needed per transaction')}</dt><dd>{fj.minForTx > 0n ? fmt(fj.minForTx) : t('Unknown')}</dd>
              <dt>{t('Next transaction pays with')}</dt><dd>{t(fj.plan === 'balance' ? 'Fee Juice balance' : fj.plan === 'claim' ? 'A pending deposit (claimed and paid together)' : 'Sponsored')}</dd>
              <dt>{t('Deposits from Ethereum')}</dt><dd>{fj.claims.length ? t('{ready} of {all} ready to claim', { ready: fj.claims.filter((c) => c.ready).length, all: fj.claims.length }) : t('None')}</dd>
              {fj.privateBalance !== undefined ? (<><dt>{t('Private fee balance')}</dt><dd>{fmt(fj.privateBalance)}</dd></>) : null}
            </dl>
            <p className={s.cardNote}>{t('The account that pays the network fee is public: its transactions can be linked to each other.')}</p>
          </>
        ) : (
          <p className={s.muted}>{t('On the test network, fees are sponsored. Fee Juice applies on Aztec Alpha.')}</p>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- messaging */

function MessagingView({ address }: { address: string }) {
  const t = useT();
  const { address: connected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [stats, setStats] = useState<MessagingStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const can = !!connected && connected.toLowerCase() === address.toLowerCase();

  const read = async () => {
    setBusy(true);
    setErr(null);
    try {
      setStats(
        await readMessagingStats({
          getAddress: async () => address,
          getChainId: () => chainId,
          signMessage: async (m: string | Uint8Array) => signMessageAsync({ message: typeof m === 'string' ? m : { raw: m } }),
        } as any),
      );
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.grid}>
      <Card title={t('Your messaging database')} prov={['local']} className={s.c7}>
        {stats ? (
          <dl className={s.kv}>
            <dt>{t('Inbox')}</dt><dd className={s.mono}>{short(stats.inboxId, 10)}</dd>
            <dt>{t('This device')}</dt><dd className={s.mono}>{stats.installationId ? short(stats.installationId, 8) : '—'}</dd>
            <dt>{t('Devices on this inbox')}</dt><dd>{stats.installations ?? '—'}</dd>
            <dt>{t('Direct chats')}</dt><dd>{stats.dms}</dd>
            <dt>{t('Groups')}</dt><dd>{stats.groups}</dd>
            <dt>{t('Accepted')}</dt><dd>{stats.allowed}</dd>
            <dt>{t('Requests')}</dt><dd>{stats.requests}</dd>
            <dt>{t('Blocked')}</dt><dd>{stats.denied}</dd>
            <dt>{t('Read at')}</dt><dd>{new Date(stats.readAt).toLocaleTimeString()}</dd>
          </dl>
        ) : (
          <p className={s.stateText} style={{ margin: 0 }}>
            {t('Counts and identifiers from the encrypted messaging database on this device. No message text and no names are read.')}
          </p>
        )}
        {err ? (
          <div className={s.alert} data-l="warn" role="alert" style={{ marginTop: 12 }}>
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{t('The messaging database could not be opened here. If the chat is open in another tab, close it and try again.')}</span>
          </div>
        ) : null}
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className={s.btn} onClick={read} disabled={!can || busy}>
            {busy ? t('Reading') : stats ? t('Read again') : t('Read my messaging database')}
          </button>
          {!can ? <span className={s.muted} style={{ alignSelf: 'center' }}>{t('Connect the wallet you sign in with to read it here.')}</span> : null}
        </div>
      </Card>
      <Card title={t('What the XMTP network sees')} prov={['public']} className={s.c5}>
        <p className={s.stateText} style={{ margin: 0 }}>
          {t('Messages travel as MLS ciphertext. The network sees inbox ids and timing, not content.')}
        </p>
        <p className={s.cardNote}>
          <Link href="/docs/overview">{t('How messaging is protected')}</Link>
        </p>
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------- your data */

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

const NOT_SHOWN: { what: string; why: string }[] = [
  { what: 'Agreements (escrows and streams)', why: 'Their invitations live inside the conversation; they are shown and acted on in the chat.' },
  { what: 'Message text and the names of people you talk to', why: 'The dashboard reads counts only, so nothing personal is copied out of the chat.' },
  { what: 'Activity from another device before this one synced', why: 'Received payments are rebuilt from your notes; shields and unshields sent elsewhere are not.' },
  { what: 'Proving times', why: 'The wallet does not record them yet.' },
];

function DataView({ address, onDisconnect, onWipe, wiping, example }: { address: string; onDisconnect: () => void; onWipe: () => void; wiping: boolean; example?: boolean }) {
  const t = useT();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className={s.grid}>
      <Card title={t('What this page shows, and where each piece comes from')} className={s.c12}>
        <div className={s.scrollX}>
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
                  <td><strong>{t(r.what)}</strong></td>
                  <td>{t(r.from)}</td>
                  <td>{t(r.where)}</td>
                  <td><Prov p={r.prov} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={s.cardNote}>{t('This page sends none of it to our server. The wallet talks to the Aztec node, and the messaging client to XMTP, only as they do in the chat.')}</p>
      </Card>
      <Card title={t('Not on this page, and why')} className={s.c6}>
        <dl className={s.kv}>
          {NOT_SHOWN.map((r) => (
            <React.Fragment key={r.what}>
              <dt>{t(r.what)}</dt>
              <dd>{t(r.why)}</dd>
            </React.Fragment>
          ))}
        </dl>
      </Card>
      <Card title={t('This device')} className={s.c6}>
        <p className={s.stateText} style={{ margin: '0 0 12px' }}>
          {t('Close the private wallet here, or remove everything it keeps on this device. Removing is safe: nothing on chain is lost, and your notes sync again the next time you open it.')}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} aria-disabled={example || undefined}>
          <button type="button" className={`${s.btn} ${s.btnQuiet}`} onClick={onDisconnect} disabled={example}>{t('Close the private wallet')}</button>
          {confirm ? (
            <>
              <button type="button" className={`${s.btn} ${s.btnDanger}`} onClick={onWipe} disabled={wiping}>
                {wiping ? t('Removing') : t('Yes, remove it from this device')}
              </button>
              <button type="button" className={`${s.btn} ${s.btnQuiet}`} onClick={() => setConfirm(false)}>{t('Cancel')}</button>
            </>
          ) : (
            <button type="button" className={`${s.btn} ${s.btnDanger}`} onClick={() => setConfirm(true)} disabled={example}>{t('Remove wallet data from this device')}</button>
          )}
        </div>
        <p className={s.cardNote}>{t('Account: {address}', { address: short(address, 6) })}</p>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------- app */

export function DashboardApp() {
  const t = useT();
  const [theme, toggleTheme] = useTheme();
  const [hidden, toggleHidden] = useHidden();
  const visible = useVisible();
  const otherTab = useOtherDashboardTab();
  const { address, isChecking: checking } = useSystemAccount();
  // /dashboard?example=1: a made-up account (lib/dashboard/example.ts), labelled on every screen.
  const example = useMemo(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('example') === '1', []);
  const session = example ? '0x0000000000000000000000000000000000e4a3c1' : ((address ?? '') as string);
  const isChecking = example ? false : checking;
  const live = useAztecWallet(example ? '' : session);
  const exampleState = useMemo(
    () =>
      example
        ? {
            ...live.state,
            phase: 'ready' as const,
            busy: false,
            aztecAddress: '0x' + 'e4a3c1'.repeat(10) + '0000',
            balances: EXAMPLE_TOKENS,
            activity: exampleActivity(Date.now()),
            feeJuice: { balance: 4_200_000_000_000_000_000n, minForTx: 1_000_000_000_000_000_000n, claims: [], plan: 'balance' as const },
          }
        : null,
    [example], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const state = exampleState ?? live.state;
  const { open, sameAccount } = live;
  const { address: connectedAddress } = useAccount();
  const { open: openAppKit } = useAppKit();
  // The one wallet of this tab (lib/aztec/wallet/client.ts); only touched in the browser.
  const wallet = useMemo(() => (typeof window === 'undefined' || example ? null : getPrivateWallet()), [example]);
  const [tab, setTab] = useState<Tab>('overview');
  const [net, setNet] = useState<NetStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [stamp, setStamp] = useState(0);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Deep links: /dashboard#activity.
  useEffect(() => {
    const h = window.location.hash.slice(1) as Tab;
    if (TABS.some((x) => x.id === h)) setTab(h);
  }, []);
  const choose = (id: Tab) => {
    setTab(id);
    try {
      history.replaceState(null, '', `#${id}`);
    } catch {
      /* fine */
    }
  };

  const ready = state.phase === 'ready' || state.phase === 'needs-fee-juice';
  const tokens = useMemo(() => state.balances.map((b) => ({ key: b.key, symbol: b.symbol, decimals: b.decimals })), [state.balances]);

  const input = useMemo<DashInputs | null>(() => {
    if (!ready) return null;
    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      storage = undefined;
    }
    return {
      activity: state.activity,
      tokens,
      bindings: example ? EXAMPLE_PEOPLE.slice(0, 11).map((a, i) => ({ inboxId: `example-${i}`, aztecAddress: a })) : readBindings(storage),
      contacts: example
        ? EXAMPLE_PEOPLE.map((a, i) => ({ address: a, name: EXAMPLE_NAMES[i % EXAMPLE_NAMES.length] }))
        : getLocalContacts(session).map((c) => ({ address: c.peerAddress, name: c.name })),
      now: Date.now(),
    };
  }, [ready, state.activity, tokens, session, stamp]); // eslint-disable-line react-hooks/exhaustive-deps
  const { model, worker } = useDashboardModel(input);

  const readNet = useCallback(async () => {
    try {
      if (wallet) setNet(await wallet.networkStatus());
    } catch {
      /* the next read tries again */
    }
  }, [wallet]);

  // Public reads only, and only while the page is visible (battery, and Safari suspends hidden tabs).
  useEffect(() => {
    if (!ready || !visible) return;
    void readNet();
    const id = setInterval(() => void readNet(), REFRESH_MS);
    return () => clearInterval(id);
  }, [ready, visible, readNet]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await wallet?.refresh();
      await readNet();
      setStamp((n) => n + 1);
    } finally {
      setRefreshing(false);
    }
  };

  const disconnect = async () => {
    await wallet?.disconnect();
    setNet(null);
  };

  const wipe = async () => {
    setWiping(true);
    try {
      const me = state.aztecAddress;
      await wallet?.disconnect();
      const { wipeLocalAztecStores } = await import('@/lib/aztec/wallet/wipe');
      await wipeLocalAztecStores();
      try {
        if (me) localStorage.removeItem(`hl_aztec_activity_v1_${me.toLowerCase()}`);
        localStorage.removeItem(THEME_KEY);
      } catch {
        /* nothing else to remove */
      }
      setNet(null);
    } finally {
      setWiping(false);
    }
  };

  const limits = useMemo(() => (typeof window === 'undefined' ? null : loadLimits()), [stamp]); // eslint-disable-line react-hooks/exhaustive-deps
  const alerts = useMemo(
    () =>
      model
        ? computeAlerts({
            phase: state.phase,
            feeJuice: state.feeJuice,
            needsFeeJuice: AZTEC_WALLET_CONFIG.network === 'mainnet',
            receiveOnly: !!limits?.receiveOnly,
            model,
          })
        : [],
    [model, state.phase, state.feeJuice, limits],
  );

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    choose(TABS[n].id);
    tabRefs.current[TABS[n].id]?.focus();
  };

  /* -------------------------------------------------------------- render */

  let body: React.ReactNode;
  if (isChecking) {
    body = <StateView title={t('Checking your session')} busy />;
  } else if (!session) {
    body = (
      <StateView title={t('Sign in to see your dashboard')} text={t('Your dashboard is built on this device from your own wallet. Sign in with the wallet you use for Ledger Chat.')}>
        <Link className={s.btn} href="/connect?redirect=/dashboard">{t('Sign in')}</Link>
        <a className={`${s.btn} ${s.btnQuiet}`} href="/dashboard?example=1">{t('See an example')}</a>
      </StateView>
    );
  } else if (!example && !sameAccount) {
    // The dashboard opens only with the wallet that owns this Ledger Chat account: the private
    // keys are derived from its signature, so any other wallet would show another account.
    body = (
      <StateView
        title={t('Connect the wallet of your Ledger Chat account')}
        text={
          connectedAddress
            ? t('The connected wallet is {connected}. Your Ledger Chat account is {account}. Switch to that wallet to continue.', { connected: short(connectedAddress, 4), account: short(session, 4) })
            : t('Your Ledger Chat account is {account}. Connect that wallet to open your dashboard.', { account: short(session, 4) })
        }
      >
        <button type="button" className={s.btn} onClick={() => void openAppKit()}>{connectedAddress ? t('Switch wallet') : t('Connect wallet')}</button>
        <a className={`${s.btn} ${s.btnQuiet}`} href="/dashboard?example=1">{t('See an example')}</a>
      </StateView>
    );
  } else if (state.phase === 'idle') {
    body = (
      <StateView title={t('Open your private wallet')} text={t('Your wallet signs one message. The keys it derives, your notes and your activity stay in this browser.')}>
        <button type="button" className={s.btn} onClick={() => void open()}>{t('Open private wallet')}</button>
      </StateView>
    );
  } else if (state.phase === 'error') {
    body = (
      <StateView title={t('The private wallet did not open')} text={state.error ? t(state.error) : t('Something failed while starting the wallet.')}>
        <button type="button" className={s.btn} onClick={() => void open()}>{t('Try again')}</button>
        {state.errorDetail ? <CopyButton value={state.errorDetail} label={t('Copy details')} /> : null}
      </StateView>
    );
  } else if (!ready) {
    body = <Opening phase={state.phase} step={state.step} />;
  } else if (!model) {
    body = <StateView title={t('Reading your records')} busy text={t('Computed on this device.')} />;
  } else {
    const fjLow = alerts.some((a) => a.id === 'fee-juice');
    body = (
      <>
        <div className={s.tabs} role="tablist" aria-label={t('Dashboard sections')}>
          {TABS.map((x, i) => (
            <button
              key={x.id}
              ref={(el) => {
                tabRefs.current[x.id] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${x.id}`}
              aria-selected={tab === x.id}
              aria-controls={`panel-${x.id}`}
              tabIndex={tab === x.id ? 0 : -1}
              className={s.tab}
              onClick={() => choose(x.id)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {t(x.label)}
              {x.id === 'activity' ? <span className={s.tabCount}>{model.events.length}</span> : null}
              {x.id === 'people' ? <span className={s.tabCount}>{model.counterparties.length}</span> : null}
            </button>
          ))}
        </div>
        <div className={s.panel} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'overview' ? (
            <div className={s.grid}>
              {state.balances.length ? (
                state.balances.slice(0, 4).map((b) => (
                  <Kpi
                    key={b.key}
                    label={t('Private {symbol}', { symbol: b.symbol })}
                    value={hidden ? '••••' : formatUnits(b.privateUnits, b.decimals)}
                    sub={b.publicUnits > 0n ? t('{amount} public', { amount: hidden ? '••••' : formatUnits(b.publicUnits, b.decimals) }) : t('Nothing public')}
                    prov={['proof']}
                  />
                ))
              ) : (
                <Kpi label={t('Private balances')} value="—" sub={t('No tokens on this network yet')} prov={['proof']} />
              )}
              <Kpi
                label={t('Fee Juice')}
                value={state.feeJuice ? (hidden ? '••••' : formatUnits(state.feeJuice.balance, 18)) : t('Sponsored')}
                sub={fjLow ? t('Not enough for the next transaction') : state.feeJuice ? t('Enough for the next transaction') : t('Test network')}
                prov={['public']}
              />
              <Kpi label={t('Payments')} value={(model.byKind.send ?? 0) + (model.byKind.receive ?? 0)} sub={t('{sent} sent · {received} received', { sent: model.byKind.send ?? 0, received: model.byKind.receive ?? 0 })} prov={['local', 'proof']} />
              <Kpi label={t('Counterparties')} value={model.counterparties.length} sub={t('{n} with a proven address', { n: model.counterparties.filter((c) => c.verified).length })} prov={['local']} />
              <Kpi label={t('On its way')} value={model.inFlight} sub={model.stuck ? t('{n} for more than ten minutes', { n: model.stuck }) : t('Nothing stuck')} prov={['local']} />

              <Card title={t('Last {days} days', { days: DAYS })} prov={['local']} className={s.c8}>
                <Bars model={model} />
              </Card>
              <Card title={t('Needs your attention')} className={s.c4}>
                <AlertsList alerts={alerts} />
              </Card>

              <Card title={t('Totals per token')} prov={['local', 'proof']} className={s.c7}>
                {model.totals.length ? (
                  <div className={s.scrollX}>
                    <table className={s.table}>
                      <thead>
                        <tr>
                          <th scope="col">{t('Token')}</th>
                          <th scope="col" className={s.num}>{t('Received')}</th>
                          <th scope="col" className={s.num}>{t('Sent')}</th>
                          <th scope="col" className={s.num}>{t('Made private')}</th>
                          <th scope="col" className={s.num}>{t('Made public')}</th>
                          <th scope="col" className={s.num}>{t('Count')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {model.totals.map((x) => (
                          <tr key={x.token}>
                            <td><strong>{x.symbol}</strong></td>
                            {[x.received, x.sent, x.shielded, x.unshielded].map((v, i) => (
                              <td key={i} className={s.num}>{hidden ? '••••' : formatUnits(v, x.decimals)}</td>
                            ))}
                            <td className={s.num}>{x.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className={s.muted}>{t('No settled payments yet.')}</p>
                )}
              </Card>
              <Card title={t('Latest')} prov={['local']} className={s.c5} action={
                <button type="button" className={`${s.btn} ${s.btnQuiet} ${s.btnSm}`} onClick={() => choose('activity')}>{t('All activity')}</button>
              }>
                {model.events.length ? (
                  <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
                    {model.events.slice(0, 6).map((e) => (
                      <EventRow key={e.id} e={e} hidden={hidden} onSelect={() => choose('activity')} />
                    ))}
                  </div>
                ) : (
                  <StateView title={t('No activity yet')} text={t('Your first payment will appear here.')}>
                    <Link className={s.btn} href="/chat">{t('Open Ledger Chat')}</Link>
                  </StateView>
                )}
              </Card>
              <Card title={t('Your history')} prov={['local']} className={s.c12}>
                <dl className={s.kv}>
                  <dt>{t('First event')}</dt><dd>{model.first ? new Date(model.first).toLocaleDateString() : '—'}</dd>
                  <dt>{t('Latest event')}</dt><dd>{model.last ? new Date(model.last).toLocaleString() : '—'}</dd>
                  <dt>{t('Days with activity')}</dt><dd>{model.activeDays}</dd>
                  <dt>{t('By status')}</dt><dd>{Object.entries(model.byStatus).map(([k, n]) => `${t(STATUS[k] ?? k)} ${n}`).join(' · ') || '—'}</dd>
                  <dt>{t('Computed')}</dt><dd>{t('{ms} ms on this device ({where})', { ms: model.computedInMs, where: worker ? t('background worker') : t('main thread') })}</dd>
                </dl>
              </Card>
            </div>
          ) : tab === 'activity' ? (
            <ActivityView model={model} hidden={hidden} tokens={tokens} address={session} />
          ) : tab === 'people' ? (
            <PeopleView model={model} hidden={hidden} />
          ) : tab === 'network' ? (
            <NetworkView state={state} net={net} onRefresh={refresh} refreshing={refreshing} hidden={hidden} />
          ) : tab === 'messaging' ? (
            example ? <div className={s.card}><StateView title={t('Not in the example')} text={t('Your messaging database is read only from your own account.')} /></div> : <MessagingView address={session} />
          ) : (
            <DataView address={session} onDisconnect={disconnect} onWipe={wipe} wiping={wiping} example={example} />
          )}
        </div>
      </>
    );
  }

  return (
    <div className={s.dash} data-theme={theme}>
      <div className={s.wrap}>
        <header className={s.top}>
          <div>
            <p className={s.eyebrow}>{t('Dashboard')}</p>
            <h1 className={s.title}>{t('Everything about your account, on your device')}</h1>
            <p className={s.sub}>{t('Built in this browser from your private wallet and your own records. Nothing private leaves this device.')}</p>
          </div>
          <div className={s.topTools}>
            <button type="button" className={`${s.btn} ${s.btnQuiet} ${s.btnSm}`} onClick={toggleHidden} aria-pressed={hidden}>
              {hidden ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
              {hidden ? t('Show amounts') : t('Hide amounts')}
            </button>
            <button type="button" className={`${s.btn} ${s.btnQuiet} ${s.btnSm}`} onClick={toggleTheme} aria-pressed={theme === 'dark'}>
              {theme === 'dark' ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
              {theme === 'dark' ? t('Light') : t('Dark')}
            </button>
          </div>
        </header>
        <div className={s.legend} role="note">
          <strong>{t('Where each value comes from')}</strong>
          <span><Prov p="local" /> {t('kept only on this device')}</span>
          <span><Prov p="proof" /> {t('found or proven by the private node in this browser')}</span>
          <span><Prov p="public" /> {t('readable by anyone on Aztec or Ethereum')}</span>
        </div>
        {example ? (
          <div className={s.alert} data-l="warn" role="note" style={{ marginBottom: 12 }}>
            <AlertTriangle size={16} aria-hidden="true" />
            <span>
              {t('Example data: a made-up account, so you can see the dashboard with a history. Nothing here is yours.')}{' '}
              <Link href="/dashboard">{t('Open my dashboard')}</Link>
            </span>
          </div>
        ) : null}
        {otherTab ? (
          <div className={s.alert} data-l="warn" role="status" style={{ marginBottom: 12 }}>
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{t('The dashboard is open in another tab. The private wallet runs in one tab at a time and moves to the tab that opens it last.')}</span>
          </div>
        ) : null}
        {body}
      </div>
    </div>
  );
}
