'use client';

/**
 * ZkWalletPanel: the private payments wallet in Ledger Chat.
 *
 * Every number on this panel is read from Aztec through the PXE running in the
 * browser (lib/aztec/wallet/client.ts), and every button sends a real
 * transaction proven on this device. There is no demo mode and no balance kept
 * anywhere else.
 *
 * Layout, top to bottom:
 *   1. The network and Close.
 *   2. The private balance, large, with Hide amounts and Sync; the public
 *      remainder and, on Aztec Alpha, the Fee Juice that pays the next fee.
 *   3. The action dock: Send, Receive, Add funds (Alpha), Shield, Unshield.
 *   4. Three views: Overview (fees, Ethereum, account, what the network sees),
 *      Activity (grouped by day, filterable, notes), Protocol.
 * Each action opens a bottom sheet (components/zk/wallet/WalletSheets.tsx).
 *
 * Shield and Unshield move tokens between the public and the private balance on
 * Aztec. Fee Juice is public; the note is not. Nothing here claims an audit: the
 * Alpha box says the protocol is not externally audited.
 *
 * The parent's onShield / onUnshield / onSend callbacks are accepted for
 * compatibility and ignored: the panel always uses its own flows, so a parent
 * can no longer route a button to an older simulated modal.
 */

import Link from 'next/link';
import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowDownLeft, ArrowUpRight, Droplets, Eye, EyeOff, Fuel, Lock, Plus, RefreshCw, LockOpen, X,
} from 'lucide-react';
import { FEE_PRIVACY } from '@/lib/landing/content';
import { PasskeyCard, PasskeyOpen } from './wallet/PasskeyCard';
import { ReceiversCard } from './wallet/ReceiversCard';
import { SecurityCenter } from './wallet/SecurityCenter';
import { useAztecWallet } from '@/lib/aztec/wallet/useAztecWallet';
import { humanError, type TokenBalance } from '@/lib/aztec/wallet/client';
import {
  AZTEC_WALLET_CONFIG, FAUCET_AMOUNT, NO_PRIVATE_TOKENS_MESSAGE, hasPrivateTokens, isWalletConfigured, networkLabel, type TokenKey,
} from '@/lib/aztec/wallet/config';
import { formatUnits } from '@/lib/aztec/wallet/amounts';
import { AlphaInfoBox } from '@/components/zk/AlphaNetworkBanner';
import { WalletCreation } from '@/components/zk/WalletCreation';
import {
  Card, CardHead, CopyKV, Figure, FOCUS, IconButton, INK, INK_2, INK_3, KV, NetworkChip, Notice,
  PrimaryButton, Segmented, Sheet as SheetFrame, Spinner, TextButton, TokenMark, cleanAmount, shortHex, useHiddenAmounts,
} from '@/components/zk/wallet/WalletUI';
import { ActivityList, NotesCard, isInFlight } from '@/components/zk/wallet/WalletActivity';
import { feeRunway } from '@/components/zk/wallet/walletLogic';
import { useT } from '@/lib/i18n/client';

export { feeRunway };
import { ReceiveView, SendFlow, ShieldFlow, symbolOf } from '@/components/zk/wallet/WalletSheets';
import { HLC_TOKEN_META, isTestToken, TEST_TOKEN_NOTE } from '@/lib/payments/assets';
import { distributionDecision, type ClosedAlphaEntry } from '@/lib/alpha/gate';
import mainnetRecord from '../../deployments/aztec-mainnet.json';

// Fee Juice (Aztec Alpha only): wagmi-heavy, so loaded on demand.
const FeeJuiceStation = dynamic(() => import('@/components/zk/ZkBridgePortal').then((m) => m.FeeJuiceStation), { ssr: false });
const EthereumHoldings = dynamic(() => import('@/components/zk/ZkBridgePortal').then((m) => m.EthereumHoldings), { ssr: false });
const FeeRequestBox = dynamic(() => import('@/components/zk/FeeSponsor').then((m) => m.FeeRequestBox), { ssr: false });

// The Protocol tab is loaded only when opened (React.lazy): the wallet tab never pays for it.
const ProtocolSummary = lazy(() => import('@/components/protocol/ProtocolSummary'));

interface ZkWalletPanelProps {
  address: string;
  onClose: () => void;
  onShield?: () => void;
  onUnshield?: () => void;
  onSend?: () => void;
  className?: string;
  /** Opens the send sheet straight away, for "pay this person" from a chat. */
  initialSheet?: Sheet;
  /** Called after a private payment is confirmed, with its transaction hash. */
  onPaymentSent?: (info: { txHash: string; token: TokenKey }) => void;
}

type Sheet = 'shield' | 'unshield' | 'send' | 'receive' | 'fees' | null;
type View = 'overview' | 'activity' | 'security' | 'protocol';

const ALPHA = AZTEC_WALLET_CONFIG.network === 'mainnet';
/** Shield, Unshield and Send need a configured token; Receive only shows the address. */
const sheetAvailable = (s: Exclude<Sheet, null>) => s === 'receive' || (s === 'fees' ? ALPHA : hasPrivateTokens());

const SHEET_TITLE: Record<Exclude<Sheet, null>, string> = {
  shield: 'Shield',
  unshield: 'Unshield',
  send: 'Send privately',
  receive: 'Receive',
  fees: 'Network fees',
};

const SHEET_SUBTITLE: Record<Exclude<Sheet, null>, string> = {
  shield: 'Public balance to private notes',
  unshield: 'Private notes to public balance',
  send: 'Proven on this device',
  receive: 'Your Aztec address and a payment request',
  fees: 'Fee Juice pays every Aztec transaction',
};

/** How the next transaction pays (same words as the Fee Juice screen). */
function planLabel(plan: string): string {
  if (plan === 'claim') return 'Arrived deposit';
  if (plan === 'balance') return 'Your Fee Juice';
  if (plan === 'wait-claim') return 'Waiting for deposit';
  if (plan === 'top-up') return 'Add more Fee Juice';
  if (plan === 'sponsored') return 'Sponsored';
  return 'Add Fee Juice';
}

/* -------------------------------------------------------------------------- */

export function ZkWalletPanel({ address, onClose, className, initialSheet = null, onPaymentSent }: ZkWalletPanelProps) {
  const tr = useT();
  const { state, wallet, open, openWithPasskey, enrollPasskey, walletConnected, sameAccount, linkedComputer } = useAztecWallet(address);
  const [sheet, setSheet] = useState<Sheet>(initialSheet);
  const [sheetBack, setSheetBack] = useState<(() => void) | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [view, setView] = useState<View>('overview');
  const [hidden, toggleHidden] = useHiddenAmounts();
  const ready = state.phase === 'ready';

  const handleOpen = async () => {
    try {
      await open();
      toast.success(tr("Private wallet open"));
    } catch (err) {
      toast.error(tr(humanError(err)));
    }
  };

  const handleRefresh = async () => {
    if (!wallet || !ready) return;
    setRefreshing(true);
    try {
      await wallet.refresh();
      if (ALPHA) await wallet.refreshFeeJuice();
      setSyncedAt(Date.now());
    } catch (err) {
      toast.error(tr(humanError(err)));
    } finally {
      setRefreshing(false);
    }
  };

  // Refresh every 30 seconds while open, to pick up incoming payments.
  useEffect(() => {
    if (!ready || !wallet) return;
    // Alpha: the Fee Juice balance is shown with the balances, so read it on open and with every refresh.
    if (ALPHA) wallet.refreshFeeJuice().catch(() => {});
    setSyncedAt(Date.now());
    const t = setInterval(() => {
      if (!wallet.state.busy) {
        wallet.refresh().then(() => setSyncedAt(Date.now()), () => {});
        if (ALPHA) wallet.refreshFeeJuice().catch(() => {});
      }
    }, 30_000);
    return () => clearInterval(t);
  }, [ready, wallet]);

  const inFlight = useMemo(() => state.activity.filter(isInFlight).length, [state.activity]);
  const main = state.balances[0];
  const closeSheet = () => {
    setSheet(null);
    setSheetBack(undefined);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={`relative flex flex-col h-full bg-white text-[#15171c] ${className ?? ''}`}
      aria-label={tr("Private wallet")}
    >
      {/* 1. The network and Close */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-5 pt-[max(20px,env(safe-area-inset-top))] pb-3">
        <div className="min-w-0 flex flex-col gap-1.5">
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] leading-none" style={{ color: INK }}>
            {tr("Private wallet")}
          </h1>
          <NetworkChip label={ALPHA ? tr("Aztec Alpha · Ethereum mainnet") : tr(networkLabel())} live={ready} />
        </div>
        <IconButton label={tr("Close")} onClick={onClose}>
          <X size={20} strokeWidth={2} />
        </IconButton>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {/* 2. Balance and 3. actions */}
        {ready && state.aztecAddress && (
          <div className="px-5 pt-3 pb-5">
            <BalanceHero
              balances={state.balances}
              hidden={hidden}
              onToggleHidden={toggleHidden}
              refreshing={refreshing || state.busy}
              onRefresh={handleRefresh}
              syncedAt={syncedAt}
              feeJuice={ALPHA ? state.feeJuice : undefined}
              onShield={hasPrivateTokens() && main && main.publicUnits > 0n ? () => setSheet('shield') : undefined}
            />
            {/* One row of round keys under the balance, all alike: the ways money moves. */}
            <ActionDock
              actions={[
                ...(hasPrivateTokens() ? [{ id: 'send', label: tr("Send"), primary: true, icon: <ArrowUpRight size={21} strokeWidth={1.8} />, onClick: () => setSheet('send') }] : []),
                { id: 'receive', label: tr("Receive"), primary: !hasPrivateTokens(), icon: <ArrowDownLeft size={21} strokeWidth={1.8} />, onClick: () => setSheet('receive') },
                ...(ALPHA ? [{ id: 'fees', label: tr("Add funds"), icon: <Plus size={21} strokeWidth={1.8} />, onClick: () => setSheet('fees') }] : []),
                ...(hasPrivateTokens() ? [
                  { id: 'shield', label: tr("Shield"), icon: <Lock size={19} strokeWidth={1.8} />, onClick: () => setSheet('shield') },
                  { id: 'unshield', label: tr("Unshield"), icon: <LockOpen size={19} strokeWidth={1.8} />, onClick: () => setSheet('unshield') },
                ] : []),
              ]}
            />
          </div>
        )}

        {/* 4. Views */}
        <div className="sticky top-0 z-[5] bg-white px-5 py-2">
          <Segmented<View>
            label={tr("Private wallet sections")}
            value={view}
            onChange={setView}
            options={[
              { value: 'overview', label: tr("Overview") },
              { value: 'activity', label: tr("Activity"), badge: inFlight || undefined },
              { value: 'security', label: tr("Security") },
              { value: 'protocol', label: tr("Protocol") },
            ]}
          />
        </div>

        <div className="px-4 sm:px-5 py-5 space-y-4 bg-white min-h-[60%] pb-[max(24px,env(safe-area-inset-bottom))]">
          {view === 'protocol' ? (
            <Suspense fallback={<div className="h-[340px] rounded-[20px] bg-white border border-[#e4e7ec]" aria-busy="true" />}>
              <ProtocolSummary />
            </Suspense>
          ) : (
            <>
              {/* How it works on Aztec Alpha: above the balances once open, under the open card before. */}
              {view === 'overview' && ready && <AlphaInfoBox />}
              {!ready && state.phase === 'needs-fee-juice' ? (
                // Same card and status rows as opening the wallet (WalletCreation), at the Fee Juice step.
                <WalletCreation
                  phase={state.phase}
                  step={state.step}
                  blocked={null}
                  alpha={ALPHA}
                  networkName={networkLabel()}
                  linkedComputer={linkedComputer}
                  onOpen={handleOpen}
                >
                  {state.error && (
                    <div className="mt-3">
                      <Notice
                        tone="bad"
                        action={
                          <>
                            <TextButton onClick={() => navigator.clipboard?.writeText(state.error || '').catch(() => {})}>{tr("Copy details")}</TextButton>
                            <TextButton onClick={() => open().catch(() => {})}>{tr("Try again")}</TextButton>
                          </>
                        }
                      >
                        {state.error}
                      </Notice>
                    </div>
                  )}
                  <div className="-mx-5 mt-3">
                    <FeeJuiceStation userAddress={address} />
                    <FeeRequestBox />
                  </div>
                </WalletCreation>
              ) : !ready ? (
                <>
                <WalletCreation
                  phase={state.phase}
                  step={state.step}
                  error={state.error}
                  errorDetail={state.errorDetail}
                  blocked={openBlocked({ configured: isWalletConfigured(), hasAddress: /^0x[0-9a-fA-F]{40}$/.test(address), walletConnected, sameAccount })}
                  alpha={ALPHA}
                  networkName={networkLabel()}
                  linkedComputer={linkedComputer}
                  onOpen={handleOpen}
                  onCopyDetails={(detail) => {
                    // The exact reason, for support: step and raw error, never keys.
                    navigator.clipboard?.writeText(detail).then(
                      () => toast.success(tr("Details copied. Paste them to support.")),
                      () => toast.error(tr("Could not copy. Select the text in the console instead.")),
                    );
                  }}
                />
                {(state.phase === 'idle' || state.phase === 'error') && (
                  <PasskeyOpen address={address} onOpen={openWithPasskey} disabled={!isWalletConfigured()} />
                )}
                {view === 'overview' && <AlphaInfoBox />}
                </>
              ) : view === 'security' ? (
                <>
                  <SecurityCenter address={address} alpha={ALPHA} linkedComputer={linkedComputer} />
                  <PasskeyCard address={address} onEnroll={enrollPasskey} disabled={state.busy} />
                  <WhatIsSeen />
                </>
              ) : view === 'activity' ? (
                <>
                  <ActivityList
                    items={state.activity}
                    hidden={hidden}
                    emptyHint={ALPHA ? 'Shield tokens, then send a private payment.' : 'Get test tokens, shield them, then send a private payment.'}
                  />
                  <NotesCard items={state.activity} hidden={hidden} />
                </>
              ) : (
                <>
                  {state.error && <Notice tone="warn">{state.error}</Notice>}
                  {!hasPrivateTokens() && <Notice>{NO_PRIVATE_TOKENS_MESSAGE}</Notice>}

                  {ALPHA && (
                    <Section title={tr("Network fees")} action={{ label: tr("Add"), onClick: () => setSheet('fees') }}>
                      <KV k="Fee Juice" v={state.feeJuice ? <Figure text={formatUnits(state.feeJuice.balance, 18, 4)} hidden={hidden} strong /> : '…'} />
                      {state.feeJuice && state.feeJuice.claims.length > 0 && (
                        <KV
                          k="Deposits on the way"
                          v={`${state.feeJuice.claims.length} (${state.feeJuice.claims.filter((c) => c.ready).length} ready)`}
                        />
                      )}
                      {state.feeJuice && state.feeJuice.minForTx > 0n && (
                        <KV k="Needed per transaction" v={`${formatUnits(state.feeJuice.minForTx, 18, 2)} at most`} />
                      )}
                      <KV k="Next fee paid from" v={state.feeJuice ? planLabel(state.feeJuice.plan) : '…'} />
                    </Section>
                  )}

                  {ALPHA && (
                    <Section title={tr("On Ethereum")}>
                      <EthereumHoldings userAddress={address} />
                    </Section>
                  )}

                  <Section title={tr("Account")}>
                    <CopyKV k="Aztec address" v={state.aztecAddress ?? ''} />
                    <CopyKV k="Ethereum address" v={address} />
                    <KV k="Network" v={ALPHA ? 'Aztec Alpha, settles on Ethereum' : networkLabel()} />
                    <KV k="Proofs" v="Made on this device" />
                    {linkedComputer && <KV k="Signing" v="Approved on your phone" />}
                    <KV k="Security" hint={tr("Passkeys, address checks, audit status")} v={<TextButton onClick={() => setView('security')}>{tr("Review")}</TextButton>} />
                  </Section>

                  <ReceiversCard address={address} ready={ready} />

                  {AZTEC_WALLET_CONFIG.faucet && <Faucet disabled={state.busy} />}
                  {ALPHA && ready && typeof window !== 'undefined' && window.location.hash === '#r1' && <FirstPayment disabled={state.busy} />}
                  {ALPHA && ready && typeof window !== 'undefined' && window.location.hash === '#hlc-deploy' && <DeployHlcTestToken disabled={state.busy} />}
                  {ALPHA && state.phase === 'ready' && <IssueTokens disabled={state.busy} />}

                  <p className="px-2 pb-2 text-center text-[13px] leading-relaxed" style={{ color: INK_3 }}>{tr("Proofs are made on this device and sent to {value}. Our server never sees your keys, your balances or who you pay.{value2}{0}", { value: ALPHA ? tr(networkLabel()) : tr("the Aztec test network"), value2: ' ', 0: <Link href="/docs/zero-knowledge" className="underline underline-offset-2 font-medium" style={{ color: INK }}>
                      {tr("How it works")}
                    </Link> })}
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {sheet && ready && sheetAvailable(sheet) && (
          <SheetFrame key={sheet} title={tr(SHEET_TITLE[sheet])} subtitle={tr(SHEET_SUBTITLE[sheet])} onClose={closeSheet} onBack={sheetBack}>
            {sheet === 'shield' && <ShieldFlow mode="shield" onDone={closeSheet} />}
            {sheet === 'unshield' && <ShieldFlow mode="unshield" onDone={closeSheet} />}
            {sheet === 'send' && (
              <SendFlow
                onDone={closeSheet}
                onPaymentSent={onPaymentSent}
                onStepChange={(_, back) => setSheetBack(() => back)}
              />
            )}
            {sheet === 'receive' && <ReceiveView aztecAddress={state.aztecAddress!} />}
            {sheet === 'fees' && <FeeJuiceStation userAddress={address} />}
          </SheetFrame>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default ZkWalletPanel;

/* --------------------------------------------------------------- pieces */

/** The actions under the balance: round grey keys with a word under each, all alike. */
function ActionDock({ actions }: { actions: { id: string; label: string; icon: React.ReactNode; onClick: () => void; primary?: boolean }[] }) {
  const tr = useT();
  return (
    <div className="mt-7 grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(actions.length, 1)}, minmax(0, 1fr))` }} role="group" aria-label={tr("Wallet actions")}>
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={a.onClick}
          className={`group flex flex-col items-center gap-2 py-1 rounded-2xl ${FOCUS}`}
        >
          <span
            className="w-[56px] h-[56px] rounded-full flex items-center justify-center bg-[#f4f5f7] text-[#0d0f14] transition-[background-color,transform] duration-150 group-hover:bg-[#eceef1] group-active:scale-95 motion-reduce:transition-none"
            aria-hidden="true"
          >
            {a.icon}
          </span>
          <span className="text-[13px] font-medium tracking-[-0.005em]" style={{ color: INK_2 }}>{tr(a.label)}</span>
        </button>
      ))}
    </div>
  );
}

/** A small round key beside the balance (hide amounts, sync). */
function CardKey({ label, onClick, disabled, pressed, children }: { label: string; onClick: () => void; disabled?: boolean; pressed?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      className={`w-9 h-9 rounded-full flex items-center justify-center text-[#5b606b] hover:text-[#0d0f14] hover:bg-[#f4f5f7] disabled:opacity-50 transition-colors ${FOCUS}`}
    >
      {children}
    </button>
  );
}

/** A titled card. The action, when there is one, sits on the right of the title. */
function Section({ title, action, children }: { title: string; action?: { label: string; onClick: () => void }; children: React.ReactNode }) {
  const tr = useT();
  return (
    <Card label={title}>
      <CardHead title={title} action={action ? <TextButton onClick={action.onClick}>{tr(action.label)}</TextButton> : undefined} />
      <div className="px-5 pb-2">{children}</div>
    </Card>
  );
}

function BalanceHero({
  balances,
  hidden,
  onToggleHidden,
  refreshing,
  onRefresh,
  syncedAt,
  feeJuice,
  onShield,
}: {
  balances: TokenBalance[];
  hidden: boolean;
  onToggleHidden: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  syncedAt: number | null;
  feeJuice?: { balance: bigint; minForTx: bigint };
  onShield?: () => void;
}) {
  const tr = useT();
  const main = balances[0];
  const runway = feeJuice ? feeRunway(feeJuice.balance, feeJuice.minForTx) : null;
  const [whole, frac] = main ? splitAmountText(formatUnits(main.privateUnits, main.decimals)) : ['0', ''];
  // How much of this token is private, for the line under the public part. Hidden amounts hide it too.
  const total = main ? main.privateUnits + main.publicUnits : 0n;
  const privatePct = main && total > 0n ? Number((main.privateUnits * 1000n) / total) / 10 : 100;
  return (
    <section aria-label={tr("Private balance")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[15px] font-medium" style={{ color: INK_3 }}>
          {tr("Private balance")}
        </span>
        <span className="flex items-center -mr-2">
          <CardKey label={hidden ? tr("Show amounts") : tr("Hide amounts")} onClick={onToggleHidden} pressed={hidden}>
            {hidden ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
          </CardKey>
          <CardKey label={refreshing ? tr("Syncing") : tr("Sync")} onClick={onRefresh} disabled={refreshing}>
            {refreshing ? <Spinner size={15} /> : <RefreshCw size={17} strokeWidth={1.8} />}
          </CardKey>
        </span>
      </div>

      <div className="mt-1 flex items-baseline gap-2 min-w-0" data-testid="wallet-balance" aria-label={hidden ? tr("Balance hidden") : `${whole}${frac} ${main?.symbol ?? ''}`}>
        <motion.span
          key={hidden ? 'hidden' : `${whole}${frac}`}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="font-semibold tracking-[-0.05em] tabular-nums leading-[1.05] text-[52px] sm:text-[60px] truncate"
          style={{ color: INK }}
          aria-hidden="true"
        >
          {hidden ? '••••' : whole}
          {!hidden && frac ? <span style={{ color: '#a3a9b4' }}>{frac}</span> : null}
        </motion.span>
        {main ? <span className="text-[20px] font-semibold tracking-[-0.02em] shrink-0" style={{ color: '#a3a9b4' }} aria-hidden="true">{main.symbol}</span> : null}
      </div>
      {main && isTestToken(main.symbol) && (
        <p className="mt-1 text-[13px] font-medium" style={{ color: INK_3 }} data-testid="test-token-note">
          {TEST_TOKEN_NOTE}
        </p>
      )}

      <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] tabular-nums" style={{ color: INK_3 }} role="status" aria-live="polite">
        <span className={`w-1.5 h-1.5 rounded-full ${refreshing ? 'bg-[#a3a9b4] animate-pulse motion-reduce:animate-none' : syncedAt ? 'bg-[#10b981]' : 'bg-[#d4d8de]'}`} aria-hidden="true" />
        {refreshing ? tr("Syncing with Aztec…") : syncedAt ? tr("Synced at {toLocaleTimeString}", { toLocaleTimeString: new Date(syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }) : tr("Not synced yet")}
      </p>

      {main && main.publicUnits > 0n && (
        <div className="mt-5 rounded-[20px] bg-[#f7f8fa] px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold tabular-nums" style={{ color: INK }}>
                {tr("{value} {symbol} public", { value: hidden ? '••••' : formatUnits(main.publicUnits, main.decimals), symbol: main.symbol })}
              </span>
              <span className="block text-[13px]" style={{ color: INK_3 }}>
                {tr("Not yet shielded, visible on the network")}
              </span>
            </span>
            {onShield && (
              <button type="button" onClick={onShield} className={`h-9 px-4 rounded-full bg-[#0d0f14] text-white text-[13.5px] font-semibold hover:bg-[#2a2d34] shrink-0 ${FOCUS}`}>
                {tr("Shield")}
              </button>
            )}
          </div>
          {/* Private and public parts of this token: one hairline, ink for private. */}
          <div className="mt-3 h-1 rounded-full overflow-hidden bg-[#e6e8ec]" role="img" aria-label={hidden ? tr("Share of this balance that is private, hidden") : tr("{pct}% of your {symbol} is private", { pct: privatePct, symbol: main.symbol })}>
            <span className="block h-full rounded-full bg-[#0d0f14]" style={{ width: `${hidden ? 0 : privatePct}%` }} />
          </div>
        </div>
      )}

      {balances.length > 1 && (
        <ul className="mt-5 divide-y divide-[#f0f1f4]">
          {balances.slice(1).map((b) => (
            <li key={b.key} className="flex items-center justify-between gap-3 py-3">
              <span className="flex items-center gap-3 min-w-0">
                <TokenMark symbol={b.symbol} size={32} />
                <span className="text-[15px] font-semibold min-w-0" style={{ color: INK }}>
                  {b.symbol}
                  {isTestToken(b.symbol) && (
                    <span className="block text-[12.5px] font-medium" style={{ color: INK_3 }}>{TEST_TOKEN_NOTE}</span>
                  )}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-[16px] font-semibold tabular-nums" style={{ color: INK }}>{hidden ? '••••' : formatUnits(b.privateUnits, b.decimals)}</span>
                {b.publicUnits > 0n && (
                  <span className="block text-[12.5px] tabular-nums" style={{ color: INK_3 }}>
                    {tr("{value} public, not yet shielded", { value: hidden ? '••••' : formatUnits(b.publicUnits, b.decimals) })}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {feeJuice && (
        <div className="mt-5 flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-[#f4f5f7] flex items-center justify-center shrink-0" style={{ color: INK_2 }} aria-hidden="true">
            <Fuel size={16} strokeWidth={1.8} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-semibold tabular-nums" style={{ color: INK }}>
              {tr("{value} Fee Juice", { value: hidden ? '••••' : formatUnits(feeJuice.balance, 18, 4) })}</span>
            <span className="block text-[13px]" style={{ color: INK_3 }}>
              {runway === null ? tr("Pays the network fee, publicly") : runway === 0 ? tr("Not enough for the next transaction") : tr("Enough for at least {runway} transaction{value}", { runway, value: runway === 1 ? '' : 's' })}
            </span>
          </span>
          {runway !== null && (
            // One bar per transaction the Fee Juice covers, up to five.
            <span className="flex items-end gap-[3px] h-4 shrink-0" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="w-[3px] rounded-full" style={{ height: 6 + i * 2.5, background: i < Math.min(runway, 5) ? (runway <= 1 ? '#d97706' : '#0d0f14') : '#e6e8ec' }} />
              ))}
            </span>
          )}
        </div>
      )}

      <p className="mt-5 text-[12.5px] leading-snug" style={{ color: INK_3 }}>
        {tr(FEE_PRIVACY.short)}
      </p>
    </section>
  );
}

/** "1,234.56" into "1,234" and ".56", for a smaller fraction. */
function splitAmountText(text: string): [string, string] {
  const i = text.lastIndexOf('.');
  return i > 0 ? [text.slice(0, i), text.slice(i)] : [text, ''];
}

/** What stays private and what the network can see, side by side. */
function WhatIsSeen() {
  const tr = useT();
  return (
    <Card label={tr("What the network sees")}>
      <CardHead title={tr("What the network sees")} />
      <div className="px-5 pb-5 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[#e4e7ec] bg-[#f7f8fa] p-4">
          <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: INK }}>
            <Lock size={15} strokeWidth={2} aria-hidden="true" />{" "}{tr("Private")}
          </span>
          <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: INK_2 }}>
            {tr("The amount, the sender and the recipient of a private payment, and your private balance.")}
          </p>
        </div>
        <div className="rounded-2xl border border-[#e4e7ec] bg-white p-4">
          <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: INK }}>
            <LockOpen size={15} strokeWidth={2} aria-hidden="true" />{" "}{tr("Public")}
          </span>
          <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: INK_2 }}>
            {ALPHA
              ? tr("That your account paid a network fee in Fee Juice, a Fee Juice deposit from Ethereum, and any amount you shield or unshield.")
              : tr("That a transaction happened, and any amount you shield or unshield.")}
          </p>
        </div>
      </div>
    </Card>
  );
}

/** Why the wallet cannot be opened from this screen, in one sentence, or null. */
export function openBlocked(p: { configured: boolean; hasAddress: boolean; walletConnected: boolean; sameAccount: boolean }): string | null {
  if (!p.configured) return 'The private wallet has not been set up on this server yet.';
  if (!p.hasAddress) return 'The private wallet needs the Ethereum wallet you sign in with. Sign in with your wallet to use it.';
  if (!p.walletConnected) return 'Connect the wallet you signed in with. Its signature creates the keys of your private wallet.';
  if (!p.sameAccount) return 'The connected wallet is a different account from the one you signed in with. Switch accounts in your wallet.';
  return null;
}

/* --------------------------------------------------------------- operator and test tools */

function ToolCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card label={title} className="p-5">
      <h3 className="text-[15px] font-semibold" style={{ color: INK }}>
        {title}
      </h3>
      {children}
    </Card>
  );
}

function IssueTokens({ disabled }: { disabled: boolean }) {
  const tr = useT();
  const { wallet } = useAztecWallet('');
  const keys = wallet?.issuableTokens() ?? [];
  const [amount, setAmount] = useState('1');
  const [busy, setBusy] = useState(false);
  if (!wallet || keys.length === 0) return null;
  const key = keys[0];
  const sym = symbolOf(key);
  // Package 3: on Alpha, nothing is issued for testers while no distributor of HLC is recorded.
  const distribution = ALPHA ? distributionDecision((mainnetRecord as { closedAlpha?: ClosedAlphaEntry }).closedAlpha) : { ok: true as const };
  const blocked = distribution.ok ? '' : distribution.reasons[0];
  const decimals = AZTEC_WALLET_CONFIG.tokens.find((t) => t.key === key)?.decimals ?? 18;
  const run = async () => {
    setBusy(true);
    const id = toast.loading(tr("Issuing {amount} {sym} to your private balance. The proof is made on this device.", { amount, sym }));
    try {
      await wallet.issue(key, amount);
      toast.success(tr("{amount} {sym} issued to your private balance.", { amount, sym }), { id });
    } catch (err) {
      toast.error(tr(humanError(err)), { id });
    } finally {
      setBusy(false);
    }
  };
  return (
    <ToolCard title={tr("Issue {sym}", { sym })}>
      <p className="mt-1 text-[14px] leading-relaxed" style={{ color: INK_2 }}>{tr("This account is the issuer of {sym} on Aztec Alpha. Issued tokens go to your private balance. At most 1,000 {sym2} per issue; the fee is paid in Fee Juice.", { sym, sym2: sym })}</p>
      <div className="mt-3 flex gap-2">
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(cleanAmount(e.target.value, decimals))}
          className="min-h-[48px] flex-1 min-w-0 rounded-2xl border-2 border-[#e4e7ec] px-4 text-[16px] tabular-nums outline-none focus:border-[#15171c]"
          aria-label={tr("Amount of {sym} to issue", { sym })}
          style={{ color: INK }}
        />
        <button
          type="button"
          disabled={disabled || busy || !amount || !!blocked}
          onClick={run}
          className={`min-h-[48px] px-5 rounded-2xl bg-[#15171c] text-white text-[15px] font-semibold disabled:bg-[#e4e7ec] disabled:text-[#5b606b] ${FOCUS}`}
        >
          {busy ? tr("Issuing…") : tr("Issue")}
        </button>
      </div>
      {blocked && (
        <div className="mt-2">
          <Notice tone="bad">{blocked}</Notice>
        </div>
      )}
    </ToolCard>
  );
}

/** Operator only (#hlc-deploy): deploys the HLC Test Token and nothing else. Runbook: docs/alpha/HLC_REDEPLOY_RUNBOOK.md. */
function DeployHlcTestToken({ disabled }: { disabled: boolean }) {
  const tr = useT();
  const { wallet } = useAztecWallet('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ token: string; txHash?: string; resumed?: boolean } | null>(null);
  const [err, setErr] = useState('');
  if (!wallet) return null;
  const run = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await wallet.deployHlcTestToken(HLC_TOKEN_META, (info) => setRes((x) => ({ ...x, ...info })));
      setRes({ token: r.token, txHash: r.deployTx, resumed: r.resumed });
      toast.success(r.resumed ? tr("Already deployed from this device: nothing was sent.") : tr("HLC Test Token deployed. Give the hash to the preflight."));
    } catch (e) {
      setErr(humanError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <ToolCard title={tr("Deploy HLC Test Token (operator)")}>
      <p className="mt-1 text-[14px] leading-relaxed" style={{ color: INK_2 }}>{tr("Deploys a standard Token named {name}, symbol {symbol}, {decimals} decimals, with this account as admin. One transaction, paid in Fee Juice. It issues nothing. Then copy the hash for the read-only preflight.", { name: tr(HLC_TOKEN_META.name), symbol: tr(HLC_TOKEN_META.symbol), decimals: tr(HLC_TOKEN_META.decimals) })}</p>
      <div className="mt-2">
        <PrimaryButton disabled={disabled} busy={busy} onClick={run}>
          {busy ? tr("Deploying…") : tr("Deploy {name}", { name: HLC_TOKEN_META.name })}
        </PrimaryButton>
      </div>
      {res?.token && <CopyKV k="Token" v={res.token} />}
      {res?.txHash && <CopyKV k="Deploy hash" v={res.txHash} />}
      {err && (
        <div className="mt-2">
          <Notice tone="bad">{err}</Notice>
        </div>
      )}
    </ToolCard>
  );
}

function FirstPayment({ disabled }: { disabled: boolean }) {
  const tr = useT();
  const { wallet } = useAztecWallet('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ step: string; token?: string; txHash?: string }[]>([]);
  const [err, setErr] = useState('');
  if (!wallet) return null;
  const run = async () => {
    setBusy(true);
    setErr('');
    setLog([]);
    try {
      await wallet.firstPaymentWithNewToken(
        { ...HLC_TOKEN_META, mint: '1', pay: '0.10', to: to.trim() },
        (step, info) => setLog((l) => [...l, { step, ...info }]),
      );
      toast.success(tr("First private payment settled on Aztec Alpha."));
    } catch (e) {
      setErr(humanError(e));
    } finally {
      setBusy(false);
    }
  };
  const done = log.filter((l) => l.txHash);
  const token = log.find((l) => l.token)?.token;
  return (
    <ToolCard title={tr("First private payment (operator)")}>
      <p className="mt-1 text-[14px] leading-relaxed" style={{ color: INK_2 }}>
        {tr("Creates HLC with this account as issuer, issues 1 HLC to your private balance and pays 0.10 HLC privately to the address below. Three transactions, each paid in Fee Juice. Keep this tab open until all three settle.")}
      </p>
      <input
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder={tr("Recipient Aztec address (0x… 64 characters)")}
        className="mt-3 min-h-[48px] w-full rounded-2xl border-2 border-[#e4e7ec] px-4 text-[13.5px] font-mono outline-none focus:border-[#15171c]"
        aria-label={tr("Recipient Aztec address")}
        style={{ color: INK }}
      />
      <div className="mt-2">
        <PrimaryButton disabled={disabled || to.trim().length !== 66} busy={busy} onClick={run}>
          {busy ? tr("Working: {value}…", { value: log[log.length - 1]?.step ?? 'starting' }) : tr("Create HLC and pay 0.10")}
        </PrimaryButton>
      </div>
      {token && <CopyKV k="Token" v={token} />}
      {done.map((l) => (
        <CopyKV key={l.step + l.txHash} k={l.step === 'deploy' ? 'Hash 0 (token)' : l.step === 'mint' ? 'Hash 1 (issue)' : 'Hash 2 (payment)'} v={l.txHash!} />
      ))}
      {err && (
        <div className="mt-2">
          <Notice tone="bad">{err}</Notice>
        </div>
      )}
    </ToolCard>
  );
}

function Faucet({ disabled }: { disabled: boolean }) {
  const tr = useT();
  const { wallet } = useAztecWallet('');
  const [busy, setBusy] = useState<TokenKey | null>(null);
  const run = async (key: TokenKey) => {
    if (!wallet) return;
    setBusy(key);
    const id = toast.loading(tr("Minting {value} test {key}. The proof is made on this device.", { value: FAUCET_AMOUNT[key], key }));
    try {
      await wallet.faucet(key);
      toast.success(tr("{value} test {key} added to your public balance. Shield it to make it private.", { value: FAUCET_AMOUNT[key], key }), { id });
    } catch (err) {
      toast.error(tr(humanError(err)), { id });
    } finally {
      setBusy(null);
    }
  };
  return (
    <ToolCard title={tr("Get test tokens")}>
      <p className="mt-1 text-[14px] leading-relaxed flex gap-2" style={{ color: INK_2 }}>
        <Droplets size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        {tr("Free test tokens for the Aztec test network. They have no value and cannot be exchanged.")}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {AZTEC_WALLET_CONFIG.tokens.map((t) => (
          <button
            key={t.key}
            type="button"
            disabled={disabled || !!busy}
            onClick={() => run(t.key)}
            className={`min-h-[48px] rounded-2xl border border-[#d4d8de] text-[14px] font-semibold hover:bg-[#f7f8fa] disabled:opacity-40 ${FOCUS}`}
            style={{ color: INK }}
          >
            {busy === t.key ? tr("Adding…") : `+${FAUCET_AMOUNT[t.key]} ${t.symbol}`}
          </button>
        ))}
      </div>
    </ToolCard>
  );
}

/** Kept for callers that show an address inline. */
export const shortAddress = (s?: string) => shortHex(s);
