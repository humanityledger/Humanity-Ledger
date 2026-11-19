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
  ArrowDownLeft, ArrowUpRight, Droplets, Fuel, Lock, Plus, RefreshCw, ShieldCheck, LockOpen, X,
} from 'lucide-react';
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
  ActionTile, BigAmount, Card, CardHead, CopyKV, Figure, FOCUS, HideAmountsButton, IconButton, INK, INK_2, INK_3, KV, NetworkChip, Notice,
  PrimaryButton, Segmented, Sheet as SheetFrame, Spinner, TextButton, cleanAmount, shortHex, useHiddenAmounts,
} from '@/components/zk/wallet/WalletUI';
import { ActivityList, NotesCard, isInFlight } from '@/components/zk/wallet/WalletActivity';
import { feeRunway } from '@/components/zk/wallet/walletLogic';

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
      toast.success('Private wallet open');
    } catch (err) {
      toast.error(humanError(err));
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
      toast.error(humanError(err));
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
      aria-label="Private wallet"
    >
      {/* 1. The network and Close */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-5 pt-[max(20px,env(safe-area-inset-top))] pb-3">
        <div className="min-w-0 flex flex-col gap-1.5">
          <h1 className="text-[20px] font-semibold tracking-[-0.02em] leading-none" style={{ color: INK }}>
            Private wallet
          </h1>
          <NetworkChip label={ALPHA ? 'Aztec Alpha · Ethereum mainnet' : networkLabel()} live={ready} />
        </div>
        <IconButton label="Close" onClick={onClose}>
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
            {/* Send and Receive first and wide; then the three ways money moves between balances. */}
            <div className="mt-4 space-y-2" role="group" aria-label="Wallet actions">
              <div className="grid grid-cols-2 gap-2">
                {hasPrivateTokens() && <WideAction primary label="Send" icon={<ArrowUpRight size={19} strokeWidth={2.2} />} onClick={() => setSheet('send')} />}
                <WideAction primary={!hasPrivateTokens()} label="Receive" icon={<ArrowDownLeft size={19} strokeWidth={2.2} />} onClick={() => setSheet('receive')} />
              </div>
              {(ALPHA || hasPrivateTokens()) && (
                <div className={`grid gap-2 ${ALPHA && hasPrivateTokens() ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {ALPHA && <ActionTile label="Add funds" icon={<Plus size={18} strokeWidth={2.2} />} onClick={() => setSheet('fees')} />}
                  {hasPrivateTokens() && <ActionTile label="Shield" icon={<Lock size={17} strokeWidth={2.1} />} onClick={() => setSheet('shield')} />}
                  {hasPrivateTokens() && <ActionTile label="Unshield" icon={<LockOpen size={17} strokeWidth={2.1} />} onClick={() => setSheet('unshield')} />}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. Views */}
        <div className="sticky top-0 z-[5] bg-white/95 backdrop-blur-sm px-5 py-2 border-b border-[#eef0f3]">
          <Segmented<View>
            label="Private wallet sections"
            value={view}
            onChange={setView}
            options={[
              { value: 'overview', label: 'Overview' },
              { value: 'activity', label: 'Activity', badge: inFlight || undefined },
              { value: 'security', label: 'Security' },
              { value: 'protocol', label: 'Protocol' },
            ]}
          />
        </div>

        <div className="px-4 sm:px-5 py-4 space-y-4 bg-[#fafbfc] min-h-[60%] pb-[max(24px,env(safe-area-inset-bottom))]">
          {view === 'protocol' ? (
            <Suspense fallback={<div className="h-[340px] rounded-[20px] bg-white border border-[#e4e7ec]" aria-busy="true" />}>
              <ProtocolSummary />
            </Suspense>
          ) : (
            <>
              {/* Alpha info box — only shown on Aztec Alpha, reminds users of unaudited status */}
              {view === 'overview' && <AlphaInfoBox />}
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
                            <TextButton onClick={() => navigator.clipboard?.writeText(state.error || '').catch(() => {})}>Copy details</TextButton>
                            <TextButton onClick={() => open().catch(() => {})}>Try again</TextButton>
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
                      () => toast.success('Details copied. Paste them to support.'),
                      () => toast.error('Could not copy. Select the text in the console instead.'),
                    );
                  }}
                />
                {(state.phase === 'idle' || state.phase === 'error') && (
                  <PasskeyOpen address={address} onOpen={openWithPasskey} disabled={!isWalletConfigured()} />
                )}
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
                    <Section title="Network fees" action={{ label: 'Add', onClick: () => setSheet('fees') }}>
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
                    <Section title="On Ethereum">
                      <EthereumHoldings userAddress={address} />
                    </Section>
                  )}

                  <Section title="Account">
                    <CopyKV k="Aztec address" v={state.aztecAddress ?? ''} />
                    <CopyKV k="Ethereum address" v={address} />
                    <KV k="Network" v={ALPHA ? 'Aztec Alpha, settles on Ethereum' : networkLabel()} />
                    <KV k="Proofs" v="Made on this device" />
                    {linkedComputer && <KV k="Signing" v="Approved on your phone" />}
                    <KV k="Security" hint="Passkeys, address checks, audit status" v={<TextButton onClick={() => setView('security')}>Review</TextButton>} />
                  </Section>

                  <ReceiversCard address={address} ready={ready} />

                  {AZTEC_WALLET_CONFIG.faucet && <Faucet disabled={state.busy} />}
                  {ALPHA && ready && typeof window !== 'undefined' && window.location.hash === '#r1' && <FirstPayment disabled={state.busy} />}
                  {ALPHA && ready && typeof window !== 'undefined' && window.location.hash === '#hlc-deploy' && <DeployHlcTestToken disabled={state.busy} />}
                  {ALPHA && state.phase === 'ready' && <IssueTokens disabled={state.busy} />}

                  <p className="px-2 pb-2 text-center text-[13px] leading-relaxed" style={{ color: INK_3 }}>
                    Proofs are made on this device and sent to {ALPHA ? networkLabel() : 'the Aztec test network'}. Our server never sees your keys, your
                    balances or who you pay.{' '}
                    <Link href="/docs/zero-knowledge" className="underline underline-offset-2 font-medium" style={{ color: INK }}>
                      How it works
                    </Link>
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {sheet && ready && sheetAvailable(sheet) && (
          <SheetFrame key={sheet} title={SHEET_TITLE[sheet]} subtitle={SHEET_SUBTITLE[sheet]} onClose={closeSheet} onBack={sheetBack}>
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

/** Send and Receive: wide, icon and word side by side. */
function WideAction({ label, icon, onClick, primary }: { label: string; icon: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-[60px] rounded-2xl flex items-center justify-center gap-2.5 text-[16px] font-semibold tracking-[-0.01em] transition-[background-color,transform] duration-150 active:scale-[0.98] ${FOCUS} ${
        primary ? 'bg-[#15171c] text-white hover:bg-[#262932]' : 'bg-white text-[#15171c] border-2 border-[#15171c] hover:bg-[#f7f8fa]'
      }`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </button>
  );
}

/** A titled card. The action, when there is one, sits on the right of the title. */
function Section({ title, action, children }: { title: string; action?: { label: string; onClick: () => void }; children: React.ReactNode }) {
  return (
    <Card label={title}>
      <CardHead title={title} action={action ? <TextButton onClick={action.onClick}>{action.label}</TextButton> : undefined} />
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
  const main = balances[0];
  const runway = feeJuice ? feeRunway(feeJuice.balance, feeJuice.minForTx) : null;
  return (
    <div className="relative rounded-[28px] border border-[#e4e7ec] bg-white px-5 pt-4 pb-5 overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.10)]">
      {/* A fine engraved grid, the only ornament: ink at 4 %. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.6]"
        style={{
          backgroundImage: 'linear-gradient(to right, rgba(21,23,28,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(21,23,28,0.04) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(120% 90% at 100% 0%, black, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(120% 90% at 100% 0%, black, transparent 70%)',
        }}
        aria-hidden="true"
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: INK_2 }}>
            <ShieldCheck size={15} strokeWidth={2} aria-hidden="true" />
            Private balance
          </span>
          <span className="flex items-center -mr-2">
            <HideAmountsButton hidden={hidden} onToggle={onToggleHidden} />
            <IconButton label={refreshing ? 'Syncing' : 'Sync'} onClick={onRefresh} disabled={refreshing} size={40}>
              {refreshing ? <Spinner size={16} /> : <RefreshCw size={17} strokeWidth={2} />}
            </IconButton>
          </span>
        </div>

        <div className="mt-2" data-testid="wallet-balance">
          {!main ? (
            <BigAmount text="0" symbol="" muted hidden={hidden} />
          ) : (
            <BigAmount text={formatUnits(main.privateUnits, main.decimals)} symbol={main.symbol} hidden={hidden} />
          )}
        </div>
        {main && isTestToken(main.symbol) && (
          <p className="mt-1 text-[12.5px] font-semibold" style={{ color: INK_3 }} data-testid="test-token-note">
            {TEST_TOKEN_NOTE}
          </p>
        )}

        <p className="mt-2 text-[13px] tabular-nums" style={{ color: INK_3 }} role="status" aria-live="polite">
          {refreshing ? 'Syncing with Aztec…' : syncedAt ? `Synced at ${new Date(syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not synced yet'}
        </p>

        {main && main.publicUnits > 0n && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[#f7f8fa] border border-[#eceef2] pl-4 pr-3 py-2">
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold tabular-nums" style={{ color: INK }}>
                <Figure text={formatUnits(main.publicUnits, main.decimals)} hidden={hidden} strong /> {main.symbol} public
              </span>
              <span className="block text-[12.5px]" style={{ color: INK_3 }}>
                Not yet shielded, visible on the network
              </span>
            </span>
            {onShield && <TextButton onClick={onShield}>Shield</TextButton>}
          </div>
        )}

        {balances.length > 1 && (
          <ul className="mt-3 divide-y divide-[#eef0f3] border-t border-[#eef0f3]">
            {balances.slice(1).map((b) => (
              <li key={b.key} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-[14px] font-semibold" style={{ color: INK }}>
                  {b.symbol}
                  {isTestToken(b.symbol) && (
                    <span className="block text-[12px] font-medium" style={{ color: INK_3 }}>{TEST_TOKEN_NOTE}</span>
                  )}
                </span>
                <span className="text-right">
                  <Figure text={formatUnits(b.privateUnits, b.decimals)} hidden={hidden} strong className="block text-[16px]" />
                  {b.publicUnits > 0n && (
                    <span className="block text-[12.5px] tabular-nums" style={{ color: INK_3 }}>
                      {hidden ? '••••' : formatUnits(b.publicUnits, b.decimals)} public, not yet shielded
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {feeJuice && (
          <div className="mt-3 flex items-center gap-3 pt-3 border-t border-[#eef0f3]">
            <span className="w-8 h-8 rounded-full bg-[#f2f4f7] flex items-center justify-center shrink-0" aria-hidden="true">
              <Fuel size={15} strokeWidth={2} style={{ color: INK }} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-semibold" style={{ color: INK }}>
                <Figure text={formatUnits(feeJuice.balance, 18, 4)} hidden={hidden} strong /> Fee Juice
              </span>
              <span className="block text-[12.5px]" style={{ color: INK_3 }}>
                {runway === null ? 'Pays the network fee, publicly' : runway === 0 ? 'Not enough for the next transaction' : `Enough for at least ${runway} transaction${runway === 1 ? '' : 's'}`}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** What stays private and what the network can see, side by side. */
function WhatIsSeen() {
  return (
    <Card label="What the network sees">
      <CardHead title="What the network sees" />
      <div className="px-5 pb-5 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[#e4e7ec] bg-[#f7f8fa] p-4">
          <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: INK }}>
            <Lock size={15} strokeWidth={2} aria-hidden="true" /> Private
          </span>
          <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: INK_2 }}>
            The amount, the sender and the recipient of a private payment, and your private balance.
          </p>
        </div>
        <div className="rounded-2xl border border-[#e4e7ec] bg-white p-4">
          <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: INK }}>
            <LockOpen size={15} strokeWidth={2} aria-hidden="true" /> Public
          </span>
          <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: INK_2 }}>
            {ALPHA
              ? 'That your account paid a network fee in Fee Juice, a Fee Juice deposit from Ethereum, and any amount you shield or unshield.'
              : 'That a transaction happened, and any amount you shield or unshield.'}
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
    const id = toast.loading(`Issuing ${amount} ${sym} to your private balance. The proof is made on this device.`);
    try {
      await wallet.issue(key, amount);
      toast.success(`${amount} ${sym} issued to your private balance.`, { id });
    } catch (err) {
      toast.error(humanError(err), { id });
    } finally {
      setBusy(false);
    }
  };
  return (
    <ToolCard title={`Issue ${sym}`}>
      <p className="mt-1 text-[14px] leading-relaxed" style={{ color: INK_2 }}>
        This account is the issuer of {sym} on Aztec Alpha. Issued tokens go to your private balance. At most 1,000 {sym} per issue; the fee is paid in Fee Juice.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(cleanAmount(e.target.value, decimals))}
          className="min-h-[48px] flex-1 min-w-0 rounded-2xl border-2 border-[#e4e7ec] px-4 text-[16px] tabular-nums outline-none focus:border-[#15171c]"
          aria-label={`Amount of ${sym} to issue`}
          style={{ color: INK }}
        />
        <button
          type="button"
          disabled={disabled || busy || !amount || !!blocked}
          onClick={run}
          className={`min-h-[48px] px-5 rounded-2xl bg-[#15171c] text-white text-[15px] font-semibold disabled:bg-[#e4e7ec] disabled:text-[#5b606b] ${FOCUS}`}
        >
          {busy ? 'Issuing…' : 'Issue'}
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
      toast.success(r.resumed ? 'Already deployed from this device: nothing was sent.' : 'HLC Test Token deployed. Give the hash to the preflight.');
    } catch (e) {
      setErr(humanError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <ToolCard title="Deploy HLC Test Token (operator)">
      <p className="mt-1 text-[14px] leading-relaxed" style={{ color: INK_2 }}>
        Deploys a standard Token named {HLC_TOKEN_META.name}, symbol {HLC_TOKEN_META.symbol}, {HLC_TOKEN_META.decimals} decimals, with this account as admin. One transaction,
        paid in Fee Juice. It issues nothing. Then copy the hash for the read-only preflight.
      </p>
      <div className="mt-2">
        <PrimaryButton disabled={disabled} busy={busy} onClick={run}>
          {busy ? 'Deploying…' : `Deploy ${HLC_TOKEN_META.name}`}
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
      toast.success('First private payment settled on Aztec Alpha.');
    } catch (e) {
      setErr(humanError(e));
    } finally {
      setBusy(false);
    }
  };
  const done = log.filter((l) => l.txHash);
  const token = log.find((l) => l.token)?.token;
  return (
    <ToolCard title="First private payment (operator)">
      <p className="mt-1 text-[14px] leading-relaxed" style={{ color: INK_2 }}>
        Creates HLC with this account as issuer, issues 1 HLC to your private balance and pays 0.10 HLC privately to the address below. Three transactions, each paid in Fee
        Juice. Keep this tab open until all three settle.
      </p>
      <input
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="Recipient Aztec address (0x… 64 characters)"
        className="mt-3 min-h-[48px] w-full rounded-2xl border-2 border-[#e4e7ec] px-4 text-[13.5px] font-mono outline-none focus:border-[#15171c]"
        aria-label="Recipient Aztec address"
        style={{ color: INK }}
      />
      <div className="mt-2">
        <PrimaryButton disabled={disabled || to.trim().length !== 66} busy={busy} onClick={run}>
          {busy ? `Working: ${log[log.length - 1]?.step ?? 'starting'}…` : 'Create HLC and pay 0.10'}
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
  const { wallet } = useAztecWallet('');
  const [busy, setBusy] = useState<TokenKey | null>(null);
  const run = async (key: TokenKey) => {
    if (!wallet) return;
    setBusy(key);
    const id = toast.loading(`Minting ${FAUCET_AMOUNT[key]} test ${key}. The proof is made on this device.`);
    try {
      await wallet.faucet(key);
      toast.success(`${FAUCET_AMOUNT[key]} test ${key} added to your public balance. Shield it to make it private.`, { id });
    } catch (err) {
      toast.error(humanError(err), { id });
    } finally {
      setBusy(null);
    }
  };
  return (
    <ToolCard title="Get test tokens">
      <p className="mt-1 text-[14px] leading-relaxed flex gap-2" style={{ color: INK_2 }}>
        <Droplets size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        Free test tokens for the Aztec test network. They have no value and cannot be exchanged.
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
            {busy === t.key ? 'Adding…' : `+${FAUCET_AMOUNT[t.key]} ${t.symbol}`}
          </button>
        ))}
      </div>
    </ToolCard>
  );
}

/** Kept for callers that show an address inline. */
export const shortAddress = (s?: string) => shortHex(s);
