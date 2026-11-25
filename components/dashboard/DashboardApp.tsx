'use client';

/**
 * components/dashboard/DashboardApp.tsx — ledgerchat.org/dashboard.
 *
 * Everything Ledger Chat knows about this account, on one page, computed on this device.
 *
 * Where the data comes from (lib/dashboard/sources.ts decides, and nothing else):
 *   - the private wallet in this tab (lib/aztec/wallet/client.ts): its PXE runs in this browser,
 *     decrypts this account's notes, and keeps the activity record;
 *   - verified peer bindings and contacts this browser keeps for the signed-in account;
 *   - when the person asks, the messaging database on this device (lib/dashboard/messaging.ts).
 *
 * How it stays live (lib/dashboard/live.ts, one LiveSource each, all client-side):
 *   - node:    wallet.networkStatus()   → the Aztec node: latest and proven block, every 15 s;
 *   - notes:   wallet.refresh()         → the PXE in this browser syncs notes, balances, activity, every 60 s;
 *   - fee:     wallet.refreshFeeJuice() → public Fee Juice state on Aztec Alpha, every 60 s.
 * Reads pause while the tab is hidden or offline and run at once when it is back; a failed read
 * retries with a growing delay and keeps the last value with its age; no read runs while a
 * transaction is being proven. The page has no network call of its own: these are calls into the
 * wallet that already runs in this tab, which talks to the Aztec node exactly as the chat does
 * (test/unit/dashboard/privacy.test.ts).
 *
 * The way in (components/dashboard/Gate.tsx): sign in → the wallet of that account → open the
 * private wallet. Only the wallet of the signed-in Ledger Chat account gets through, and a wallet
 * opened earlier in this tab for another account is never shown (sources.walletIsFor).
 *
 * /dashboard?example=1 draws a made-up account, labelled on every view. Inventory, sources and
 * limits: docs/DASHBOARD.md.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import s from './dashboard.module.css';
import { useT } from '@/lib/i18n/client';
import { useSystemAccount } from '@/hooks/useSystemAccount';
import { useAztecWallet } from '@/lib/aztec/wallet/useAztecWallet';
import { humanError } from '@/lib/aztec/wallet/client';
import { AZTEC_WALLET_CONFIG } from '@/lib/aztec/wallet/config';
import { loadLimits } from '@/lib/payments/personal-limits';
import { getLocalContacts } from '@/lib/wallet/localAddressBook';
import { computeAlerts, type DashInputs } from '@/lib/dashboard/model';
import { useDashboardModel } from '@/lib/dashboard/useDashboardModel';
import { ageText, type LiveState } from '@/lib/dashboard/live';
import { useLive } from '@/lib/dashboard/useLive';
import { accountFor, dataMode, modelInputs, walletIsFor, walletView, type DataMode } from '@/lib/dashboard/sources';
import { GateChecking, GateError, GateOpen, GateOpening, GateSignIn, GateWallet } from './Gate';
import { ActivityView, DataView, MessagingView, NetworkView, Overview, PeopleView, type NetStatus } from './Views';
import { Empty, State, short, useAfter, useNow } from './parts';

type Tab = 'overview' | 'activity' | 'people' | 'network' | 'messaging' | 'data';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'activity', label: 'Activity' },
  { id: 'people', label: 'People' },
  { id: 'network', label: 'Network' },
  { id: 'messaging', label: 'Messaging' },
  { id: 'data', label: 'Your data' },
];

const HIDE_KEY = 'hl.wallet.hide_amounts';
/** Left by the first version of this page (it had a dark mode); removed with the wallet data. */
const LEGACY_THEME_KEY = 'hl.dashboard.theme';
const OPENING = new Set(['signing', 'starting', 'deploying']);

/* ------------------------------------------------------------------ hooks */

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

/* -------------------------------------------------------------- live line */

function LiveLine({ mode, node, notes, fee, mainnet, busy }: { mode: DataMode; node: LiveState<NetStatus>; notes: LiveState<number>; fee: LiveState<unknown>; mainnet: boolean; busy: boolean }) {
  const t = useT();
  const retrying = [node, notes, fee].some((x) => x.status === 'retrying');
  const now = useNow(retrying ? 1000 : 5000);
  // The example reads nothing: its notice above says so, and there is no live state to show.
  if (mode === 'example') return null;

  const age = (at?: number) => {
    const a = ageText(at, now);
    return t(a.key, a.vars);
  };
  /** One source in plain words: its value and age, or why it has none and when it tries again. */
  const say = (st: LiveState<unknown>, failed: string, ok: () => string): string => {
    if (st.status === 'offline') return st.okAt ? `${t('offline')}, ${t('last read {age}', { age: age(st.okAt) })}` : t('offline');
    if (st.status === 'retrying') {
      const parts = [failed];
      if (st.nextAt) parts.push(t('next try in {n} s', { n: Math.max(0, Math.ceil((st.nextAt - now) / 1000)) }));
      if (st.okAt) parts.push(t('last read {age}', { age: age(st.okAt) }));
      return parts.join(', ');
    }
    if (st.okAt === undefined) return t('reading');
    return ok();
  };

  const n = node.value;
  return (
    <div className={s.live}>
      <span data-s={node.status} title={node.error}>
        <b>{t('Node')}</b>{' '}
        {say(node, t('not answering'), () =>
          [
            n?.blockNumber !== undefined ? t('block {n}', { n: n.blockNumber.toLocaleString() }) : null,
            n?.provenBlockNumber !== undefined ? t('proven {n}', { n: n.provenBlockNumber.toLocaleString() }) : null,
            t('read {age}', { age: age(node.okAt) }),
          ]
            .filter(Boolean)
            .join(', '),
        )}
      </span>
      <span data-s={notes.status} title={notes.error}>
        <b>{t('Private notes')}</b> {busy ? t('waiting for the transaction to finish') : say(notes, t('sync failed'), () => t('synced {age}', { age: age(notes.okAt) }))}
      </span>
      {mainnet ? (
        <span data-s={fee.status} title={fee.error}>
          <b>{t('Fee Juice')}</b> {busy && fee.okAt === undefined ? t('waiting for the transaction to finish') : say(fee, t('read failed'), () => t('read {age}', { age: age(fee.okAt) }))}
        </span>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------- app */

export function DashboardApp() {
  const t = useT();
  const [hidden, toggleHidden] = useHidden();
  const otherTab = useOtherDashboardTab();
  const mode = useMemo<DataMode>(() => (typeof window === 'undefined' ? 'live' : dataMode(window.location.search)), []);
  const example = mode === 'example';
  const { address, isChecking } = useSystemAccount();
  const account = accountFor(mode, address as string | null | undefined);
  const hook = useAztecWallet(example ? '' : account);
  const wallet = example ? null : hook.wallet;
  const startedAt = useMemo(() => Date.now(), []);
  const state = useMemo(() => walletView(mode, hook.state, startedAt), [mode, hook.state, startedAt]);
  const { address: connected, status: walletStatus } = useAccount();
  const { open: openAppKit } = useAppKit();
  const mainnet = AZTEC_WALLET_CONFIG.network === 'mainnet';
  const now = useNow(5000);

  const ready = state.phase === 'ready' || state.phase === 'needs-fee-juice';
  const isFor = walletIsFor(mode, wallet?.openedFor, account);
  const showing = example || (ready && isFor && hook.sameAccount);
  const liveOn = !example && showing && !!wallet;

  /* ---------------------------------------------------------- live reads */

  const [node, kickNode] = useLive<NetStatus>(liveOn, {
    everyMs: 15_000,
    read: async () => {
      const n = await wallet!.networkStatus();
      // networkStatus leaves out what the node did not answer; no block at all means no answer.
      if (n.blockNumber === undefined) throw new Error('The Aztec node did not answer.');
      return n;
    },
  });
  const [notes, kickNotes] = useLive<number>(liveOn, {
    everyMs: 60_000,
    read: async () => {
      await wallet!.refresh();
      return Date.now();
    },
    canRead: () => !!wallet && !wallet.transacting,
  });
  const [fee, kickFee] = useLive<unknown>(liveOn && mainnet, {
    everyMs: 60_000,
    firstReadMs: 2_000,
    read: () => wallet!.refreshFeeJuice(),
    canRead: () => !!wallet && !wallet.transacting,
  });
  const refreshAll = () => {
    kickNode();
    kickNotes();
    kickFee();
  };

  /* --------------------------------------------------------------- model */

  const tokens = useMemo(() => state.balances.map((b) => ({ key: b.key, symbol: b.symbol, decimals: b.decimals })), [state.balances]);
  const input = useMemo<DashInputs | null>(() => {
    if (!showing) return null;
    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      storage = undefined;
    }
    return modelInputs(mode, { activity: state.activity, tokens, storage, contacts: example ? [] : getLocalContacts(account), now: Date.now() });
    // notes.okAt: bindings and contacts are read again after every sync.
  }, [showing, mode, example, state.activity, tokens, account, notes.okAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const { model, worker } = useDashboardModel(input);
  const limits = useMemo(() => (typeof window === 'undefined' || example ? null : loadLimits()), [example, notes.okAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const alerts = useMemo(
    () => (model ? computeAlerts({ phase: state.phase, feeJuice: state.feeJuice, needsFeeJuice: mainnet, receiveOnly: !!limits?.receiveOnly, model }) : []),
    [model, state.phase, state.feeJuice, limits, mainnet],
  );

  /* ------------------------------------------------------------- actions */

  const [opening, setOpening] = useState(false);
  const [openErr, setOpenErr] = useState<string | null>(null);
  const doOpen = async () => {
    setOpenErr(null);
    setOpening(true);
    try {
      await hook.open();
    } catch (e) {
      setOpenErr(humanError(e));
    } finally {
      setOpening(false);
    }
  };

  const closeWallet = async () => {
    await wallet?.disconnect();
  };

  const [wiping, setWiping] = useState(false);
  const [wiped, setWiped] = useState(false);
  const [wipeErr, setWipeErr] = useState<string | null>(null);
  const wipe = async () => {
    if (wallet?.transacting) {
      setWipeErr('A transaction is being proven or sent. Removing becomes possible when it finishes.');
      return;
    }
    setWiping(true);
    setWipeErr(null);
    try {
      const me = state.aztecAddress;
      await wallet?.disconnect();
      const { wipeLocalAztecStores } = await import('@/lib/aztec/wallet/wipe');
      await wipeLocalAztecStores();
      try {
        if (me) localStorage.removeItem(`hl_aztec_activity_v1_${me.toLowerCase()}`);
        localStorage.removeItem(LEGACY_THEME_KEY);
      } catch {
        /* nothing else to remove */
      }
      setWiped(true);
    } catch (e) {
      setWipeErr(humanError(e));
    } finally {
      setWiping(false);
    }
  };

  /* ---------------------------------------------------------------- tabs */

  const [tab, setTab] = useState<Tab>('overview');
  const [openEvent, setOpenEvent] = useState<string | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    // Deep links: /dashboard#activity.
    const h = window.location.hash.slice(1) as Tab;
    if (TABS.some((x) => x.id === h)) setTab(h);
  }, []);
  const choose = (id: Tab) => {
    setTab(id);
    try {
      history.replaceState(null, '', `${window.location.search}#${id}`);
    } catch {
      /* fine */
    }
  };
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    choose(TABS[n].id);
    tabRefs.current[TABS[n].id]?.focus();
  };

  const waitingForModel = useAfter(showing && !model);
  useEffect(() => {
    if (ready) setWiped(false);
  }, [ready]);

  /* -------------------------------------------------------------- render */

  let gate: React.ReactNode = null;
  if (!example) {
    if (isChecking) gate = <GateChecking />;
    else if (!account) gate = <GateSignIn />;
    // wagmi reconnects the wallet a moment after load: wait for it rather than flash "connect".
    else if (!hook.sameAccount && (walletStatus === 'reconnecting' || walletStatus === 'connecting')) gate = <GateChecking />;
    else if (!hook.sameAccount) gate = <GateWallet account={account} connected={connected} onConnect={() => void openAppKit()} />;
    else if (state.phase === 'error') gate = <GateError message={state.error} detail={state.errorDetail} onRetry={() => void doOpen()} />;
    else if (OPENING.has(state.phase)) gate = <GateOpening phase={state.phase} step={state.step} />;
    else if (!ready || !isFor) gate = <GateOpen account={account} otherAccountOpen={ready && !isFor} onOpen={() => void doOpen()} opening={opening} error={openErr} />;
  }

  const notices = (
    <>
      {example ? (
        <p className={s.notice} role="note">
          <strong>{t('Example data.')}</strong>{' '}
          {t('A made-up account, so you can see the dashboard with a history. Nothing here is yours, and nothing is read from a network or from your device.')}{' '}
          <a href="/dashboard">{t('Open my dashboard')}</a>
        </p>
      ) : null}
      {otherTab ? (
        <p className={s.notice} role="status">
          {t('The dashboard is open in another tab. The private wallet runs in one tab at a time and moves to the tab that opens it last.')}
        </p>
      ) : null}
      {wiping || wiped ? (
        <p className={s.notice} role="status">
          {wiping ? t('Removing the wallet data from this device.') : t('Wallet data removed from this device. Nothing on chain was lost.')}
        </p>
      ) : null}
      {!example && showing && state.error ? (
        <p className={s.notice} role="status">
          {t(state.error)}
        </p>
      ) : null}
    </>
  );

  if (gate) {
    return (
      <div className={s.dash}>
        <div className={s.wrap}>
          {notices}
          {gate}
        </div>
      </div>
    );
  }

  return (
    <div className={s.dash}>
      <div className={s.wrap}>
        <header className={s.head}>
          <h1 className={s.h1}>{t('Dashboard')}</h1>
          <p className={s.account}>
            {example ? (
              t('Example account with made-up data')
            ) : (
              <>
                {t('Ledger Chat account')} <code>{short(account, 6)}</code> · {mainnet ? t('Aztec Alpha') : t('Aztec test network')}
              </>
            )}
          </p>
          <div className={s.headTools}>
            <button type="button" className={s.textBtn} onClick={toggleHidden} aria-pressed={hidden}>
              {hidden ? t('Show amounts') : t('Hide amounts')}
            </button>
            {!example ? (
              <>
                <button type="button" className={s.textBtn} onClick={refreshAll}>
                  {t('Refresh')}
                </button>
                <button type="button" className={s.textBtn} onClick={() => void closeWallet()}>
                  {t('Close wallet')}
                </button>
              </>
            ) : null}
          </div>
        </header>
        <LiveLine mode={mode} node={node} notes={notes} fee={fee} mainnet={mainnet} busy={state.busy} />
        {notices}

        {!model ? (
          waitingForModel ? <State title={t('Reading your records')} text={t('Computed on this device.')} live /> : <div className={s.state} aria-hidden="true" />
        ) : (
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
                  onClick={() => {
                    setOpenEvent(null);
                    choose(x.id);
                  }}
                  onKeyDown={(e) => onTabKey(e, i)}
                >
                  {t(x.label)}
                  {x.id === 'activity' ? <span className={s.count}>{model.events.length}</span> : null}
                  {x.id === 'people' ? <span className={s.count}>{model.counterparties.length}</span> : null}
                </button>
              ))}
            </div>
            <div className={s.panel} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
              {tab === 'overview' ? (
                <Overview
                  model={model}
                  state={state}
                  alerts={alerts}
                  hidden={hidden}
                  worker={worker}
                  now={now}
                  mainnet={mainnet}
                  onAll={() => choose('activity')}
                  onOpen={(e) => {
                    setOpenEvent(e.id);
                    choose('activity');
                  }}
                />
              ) : tab === 'activity' ? (
                <ActivityView model={model} hidden={hidden} tokens={tokens} address={account} now={now} initial={openEvent} />
              ) : tab === 'people' ? (
                <PeopleView model={model} hidden={hidden} />
              ) : tab === 'network' ? (
                <NetworkView state={state} node={node} notes={notes} fee={fee} now={now} hidden={hidden} mainnet={mainnet} onRefresh={kickNode} example={example} />
              ) : tab === 'messaging' ? (
                example ? <Empty title={t('Not in the example')}>{t('Your messaging database is read only from your own account.')}</Empty> : <MessagingView address={account} />
              ) : (
                <DataView address={account} onClose={() => void closeWallet()} onWipe={() => void wipe()} wiping={wiping} busy={state.busy} example={example} wipeError={wipeErr} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
