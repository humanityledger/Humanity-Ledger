'use client';

/**
 * ZkWalletPanel: the private payments wallet in Ledger Chat.
 *
 * Every number on this panel is read from the Aztec test network through the
 * PXE running in the browser (lib/aztec/wallet/client.ts), and every button
 * sends a real transaction proven on this device. There is no demo mode and
 * no balance kept anywhere else.
 *
 * Shield and Unshield move tokens between the public and the private balance
 * on Aztec. There is no bridge from Ethereum yet, so the labels say "Public"
 * and "Private", not "L1" and "ZK".
 *
 * The parent's onShield / onUnshield / onSend callbacks are accepted for
 * compatibility and ignored: the panel always uses its own flows, so a parent
 * can no longer route a button to an older simulated modal.
 */

import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import {
  ArrowDownToLine, ArrowUpFromLine, Send, X, ExternalLink, Copy, Check,
  Droplets, Loader2, AlertTriangle, ScanLine, UserPlus, ChevronDown, ChevronUp, Layers, Clock,
} from 'lucide-react';
import { useAztecWallet } from '@/lib/aztec/wallet/useAztecWallet';
import { decodePaymentRequest, encodePaymentRequest, humanError, type TokenBalance } from '@/lib/aztec/wallet/client';
import {
  AZTEC_WALLET_CONFIG, FAUCET_AMOUNT, NO_PRIVATE_TOKENS_MESSAGE, explorerTxUrl, hasPrivateTokens, isWalletConfigured, networkLabel, type TokenKey,
} from '@/lib/aztec/wallet/config';
import { formatUnits } from '@/lib/aztec/wallet/amounts';
import type { Activity } from '@/lib/aztec/wallet/history';
import { AlphaInfoBox } from '@/components/zk/AlphaNetworkBanner';

// Fee Juice (Aztec Alpha only): wagmi-heavy, so loaded on demand.
const FeeJuiceStation = dynamic(() => import('@/components/zk/ZkBridgePortal').then((m) => m.FeeJuiceStation), { ssr: false });
const EthereumHoldings = dynamic(() => import('@/components/zk/ZkBridgePortal').then((m) => m.EthereumHoldings), { ssr: false });
const FeeRequestBox = dynamic(() => import('@/components/zk/FeeSponsor').then((m) => m.FeeRequestBox), { ssr: false });

const QrScanner = dynamic(() => import('@/components/terminal/QrScanner').then((m) => m.QrScanner), { ssr: false });

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

const INK = '#15171c';
const ALPHA = AZTEC_WALLET_CONFIG.network === 'mainnet';
/** Shield, Unshield and Send need a configured token; Receive only shows the address. */
const sheetAvailable = (s: Exclude<Sheet, null>) => s === 'receive' || (s === 'fees' ? ALPHA : hasPrivateTokens());
/** First configured wallet slot (on Alpha the operator's token may sit in any slot). */
const FIRST_TOKEN: TokenKey = AZTEC_WALLET_CONFIG.tokens[0]?.key ?? 'USDC';
/** What the user sees for a slot: the configured symbol (e.g. HLC), never the internal key. */
const symbolOf = (key: TokenKey) => AZTEC_WALLET_CONFIG.tokens.find((t) => t.key === key)?.symbol ?? key;
const short = (s?: string, n = 6) => (s ? `${s.slice(0, n + 2)}…${s.slice(-n)}` : '');

/* -------------------------------------------------------------------------- */

export function ZkWalletPanel({ address, onClose, className, initialSheet = null, onPaymentSent }: ZkWalletPanelProps) {
  const { state, wallet, open, walletConnected, sameAccount, linkedComputer } = useAztecWallet(address);
  const [sheet, setSheet] = useState<Sheet>(initialSheet);
  const [refreshing, setRefreshing] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
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
    const t = setInterval(() => {
      if (!wallet.state.busy) {
        wallet.refresh().catch(() => {});
        if (ALPHA) wallet.refreshFeeJuice().catch(() => {});
      }
    }, 30_000);
    return () => clearInterval(t);
  }, [ready, wallet]);

  const notes = useMemo(
    () => state.activity.filter((a) => (a.kind === 'receive' || a.kind === 'shield') && a.status === 'settled'),
    [state.activity],
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className={`relative flex flex-col h-full bg-[#F4F5F7] text-[#15171c] ${className ?? ''}`}
    >
      {/* Header: the network in plain words, then the balance as the one thing to read */}
      <div className="flex-shrink-0 bg-white px-6 pt-6 pb-5 border-b border-[#eceef2]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[17px] font-semibold tracking-[-0.015em]">Private wallet</div>
            <div className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] text-[#5b6170]">
              <span className={`w-1.5 h-1.5 rounded-full ${ready ? 'bg-[#1f9d55]' : 'bg-[#c3c8d0]'}`} aria-hidden="true" />
              {ALPHA ? 'Aztec Alpha on Ethereum mainnet' : networkLabel()}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 shrink-0 rounded-full text-[13px] font-medium text-[#5b6170] hover:bg-[#f2f4f7] hover:text-[#0b0c0e] transition-colors"
          >
            Close
          </button>
        </div>

        {ready && state.aztecAddress && (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-[#8a909c]">Private balance</span>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing || state.busy}
                className="text-[12.5px] font-medium text-[#5b6170] hover:text-[#0b0c0e] disabled:opacity-50 transition-colors"
              >
                {refreshing ? 'Syncing…' : 'Sync'}
              </button>
            </div>
            {state.balances.length === 0 ? (
              <div className="mt-1 text-[34px] font-semibold tracking-[-0.03em] tabular-nums text-[#c3c8d0]">0</div>
            ) : (
              <>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-[38px] leading-none font-semibold tracking-[-0.035em] tabular-nums">
                    {formatUnits(state.balances[0].privateUnits, state.balances[0].decimals)}
                  </span>
                  <span className="text-[15px] font-medium text-[#5b6170]">{state.balances[0].symbol}</span>
                </div>
                {state.balances[0].publicUnits > 0n && (
                  <p className="mt-1.5 text-[12.5px] text-[#727a88] tabular-nums">
                    {formatUnits(state.balances[0].publicUnits, state.balances[0].decimals)} public, not yet shielded
                  </p>
                )}
                {state.balances.length > 1 && (
                  <div className="mt-4 space-y-2">
                    {state.balances.slice(1).map((b) => <BalanceRow key={b.key} b={b} />)}
                  </div>
                )}
              </>
            )}

            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {hasPrivateTokens() && <TextAction primary label="Send" onClick={() => setSheet('send')} />}
              <TextAction primary={!hasPrivateTokens()} label="Receive" onClick={() => setSheet('receive')} />
              {ALPHA && <TextAction label="Add funds" onClick={() => setSheet('fees')} />}
              {hasPrivateTokens() && <TextAction label="Shield" onClick={() => setSheet('shield')} />}
              {hasPrivateTokens() && <TextAction label="Unshield" onClick={() => setSheet('unshield')} />}
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
        {/* Alpha info box — only shown on Aztec Alpha, reminds users of unaudited status */}
        <AlphaInfoBox />
        {!ready && state.phase === 'needs-fee-juice' ? (
          <div className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden">
            <div className="px-5 pt-5 text-[14px] font-semibold">Add Fee Juice to create your private account</div>
            <p className="px-5 mt-1.5 text-[12.5px] leading-relaxed text-black/55">
              On {networkLabel()} every transaction, including the one that creates your account, pays its network fee in Fee Juice.
              Bridge AZTEC from your Ethereum wallet here; your account is created automatically when it arrives.
            </p>
            {state.error && (
              <div className="mx-5 mt-3 rounded-xl bg-[#fff4f4] border border-[#ffd6d6] px-3 py-2 text-[12.5px] text-[#b42318] break-words">
                {state.error}
                <button type="button" onClick={() => navigator.clipboard?.writeText(state.error || '').catch(() => {})} className="ml-2 underline">Copy details</button>
                <button type="button" onClick={() => open().catch(() => {})} className="ml-2 underline">Try again</button>
              </div>
            )}
            <FeeJuiceStation userAddress={address} />
            <FeeRequestBox />
          </div>
        ) : !ready ? (
          <Gate
            phase={state.phase}
            step={state.step}
            error={state.error}
            errorDetail={state.errorDetail}
            configured={isWalletConfigured()}
            walletConnected={walletConnected}
            sameAccount={sameAccount}
            linkedComputer={linkedComputer}
            hasAddress={/^0x[0-9a-fA-F]{40}$/.test(address)}
            onOpen={handleOpen}
          />
        ) : (
          <>
            {state.error && (
              <div role="status" className="flex gap-2 rounded-xl bg-[#fff7e6] border border-[#f5dfb0] px-3 py-2.5 text-[12.5px] leading-snug text-[#7a5200]">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>{state.error}</span>
              </div>
            )}
            {!hasPrivateTokens() && (
              <p role="status" className="rounded-2xl bg-white border border-[#eceef2] px-4 py-3 text-[13px] leading-relaxed text-[#5b6170]">
                {NO_PRIVATE_TOKENS_MESSAGE}
              </p>
            )}

            {ALPHA && (
              <Section title="Network fees" action={{ label: 'Add', onClick: () => setSheet('fees') }}>
                <Row k="Fee Juice" v={state.feeJuice ? formatUnits(state.feeJuice.balance, 18, 4) : '…'} />
                {state.feeJuice && state.feeJuice.claims.length > 0 && (
                  <Row
                    k="Deposits on the way"
                    v={`${state.feeJuice.claims.length} (${state.feeJuice.claims.filter((c) => c.ready).length} ready)`}
                  />
                )}
                {state.feeJuice && state.feeJuice.minForTx > 0n && (
                  <Row k="Needed per transaction" v={`${formatUnits(state.feeJuice.minForTx, 18, 2)} at most`} />
                )}
                <Row k="Next fee paid from" v={state.feeJuice ? planLabel(state.feeJuice.plan) : '…'} />
              </Section>
            )}

            {ALPHA && (
              <Section title="On Ethereum">
                <EthereumHoldings userAddress={address} />
              </Section>
            )}

            <Section title="Account">
              <CopyRow k="Aztec address" v={state.aztecAddress ?? ''} />
              <CopyRow k="Ethereum address" v={address} />
              <Row k="Network" v={ALPHA ? 'Aztec Alpha, settles on Ethereum' : networkLabel()} />
              <Row k="Proofs" v="Made on this device" />
              {linkedComputer && <Row k="Signing" v="Approved on your phone" />}
            </Section>

            {AZTEC_WALLET_CONFIG.faucet && <Faucet disabled={state.busy} />}

            <ActivityList items={state.activity} />

            <div className="bg-white rounded-2xl border border-black/[0.05] overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
                onClick={() => setShowNotes((v) => !v)}
              >
                <Layers size={16} className="text-black/60" strokeWidth={2.2} />
                <span className="font-semibold text-[14px] flex-1">Shielded notes ({notes.length})</span>
                {showNotes ? <ChevronUp size={16} className="text-black/40" /> : <ChevronDown size={16} className="text-black/40" />}
              </button>
              {showNotes && (
                <div className="border-t border-black/[0.05]">
                  <p className="px-4 pt-3 text-[12px] leading-relaxed text-black/50">
                    Private notes this wallet has received or created by shielding. Only your browser can read them. Notes
                    you have since spent still appear here; your balance above is always the current total.
                  </p>
                  {notes.length === 0 ? (
                    <div className="px-4 py-3 text-[12px] text-black/40">No notes yet.</div>
                  ) : (
                    <ul className="divide-y divide-black/[0.04]">
                      {notes.map((n) => (
                        <li key={n.id} className="flex items-center gap-3 px-4 py-2.5 text-[12.5px] tabular-nums">
                          <span className="font-semibold">{fmt(n)}</span>
                          <span className="text-black/45">{n.kind === 'shield' ? 'from shielding' : `from ${short(n.counterparty)}`}</span>
                          {n.blockNumber && <span className="ml-auto text-black/35">block {n.blockNumber}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <p className="px-1 pb-2 text-center text-[11.5px] leading-relaxed text-black/40">
              Proofs are made on this device and sent to {ALPHA ? networkLabel() : 'the Aztec test network'}. Our server never sees your keys, your
              balances or who you pay.{' '}
              <Link href="/docs/zero-knowledge" className="underline underline-offset-2">
                How it works
              </Link>
            </p>
          </>
        )}
      </div>

      <AnimatePresence>
        {sheet && ready && sheetAvailable(sheet) && (
          <SheetFrame key={sheet} title={SHEET_TITLE[sheet]} onClose={() => setSheet(null)}>
            {sheet === 'shield' && <ShieldForm mode="shield" onDone={() => setSheet(null)} />}
            {sheet === 'unshield' && <ShieldForm mode="unshield" onDone={() => setSheet(null)} />}
            {sheet === 'send' && <SendForm onDone={() => setSheet(null)} onPaymentSent={onPaymentSent} />}
            {sheet === 'receive' && <ReceiveView aztecAddress={state.aztecAddress!} />}
            {sheet === 'fees' && <FeeJuiceStation userAddress={address} />}
          </SheetFrame>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default ZkWalletPanel;

const SHEET_TITLE: Record<Exclude<Sheet, null>, string> = {
  shield: 'Shield',
  unshield: 'Unshield',
  send: 'Send privately',
  receive: 'Receive',
  fees: 'Network fees',
};

function fmt(a: Activity) {
  if (!a.amount || !a.token) return '';
  const t = AZTEC_WALLET_CONFIG.tokens.find((x) => x.key === a.token);
  return `${formatUnits(BigInt(a.amount), t?.decimals ?? 18)} ${t?.symbol ?? a.token}`;
}

/* --------------------------------------------------------------- pieces */

/** How the next transaction pays (same words as the Fee Juice screen). */
function planLabel(plan: string): string {
  if (plan === 'claim') return 'Arrived deposit';
  if (plan === 'balance') return 'Your Fee Juice';
  if (plan === 'wait-claim') return 'Waiting for deposit';
  if (plan === 'top-up') return 'Add more Fee Juice';
  if (plan === 'sponsored') return 'Sponsored';
  return 'Add Fee Juice';
}

function TextAction({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 rounded-full text-[14px] font-semibold tracking-[-0.01em] transition-[background-color,transform] active:scale-[0.98] ${
        primary ? 'bg-[#0b0c0e] text-white hover:bg-[#23262d]' : 'bg-[#f2f4f7] text-[#0b0c0e] hover:bg-[#e8ebef]'
      }`}
    >
      {label}
    </button>
  );
}

function Section({ title, action, children }: { title: string; action?: { label: string; onClick: () => void }; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-[#eceef2] px-4 pt-3.5 pb-1">
      <div className="flex items-center justify-between pb-1">
        <h3 className="text-[12.5px] font-medium text-[#8a909c]">{title}</h3>
        {action && (
          <button type="button" onClick={action.onClick} className="text-[13px] font-semibold text-[#0b0c0e] hover:opacity-70">
            {action.label}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3 border-t border-[#eef0f3] first-of-type:border-t-0">
      <span className="text-[14px] text-[#5b6170] shrink-0">{k}</span>
      <span className="text-[14px] font-medium text-right tabular-nums text-[#0b0c0e] min-w-0 truncate">{v}</span>
    </div>
  );
}

function CopyRow({ k, v }: { k: string; v: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard?.writeText(v).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1600); }}
      className="w-full flex items-baseline justify-between gap-4 py-3 border-t border-[#eef0f3] first-of-type:border-t-0 text-left"
    >
      <span className="text-[14px] text-[#5b6170] shrink-0">{k}</span>
      <span className="text-[13px] font-mono text-[#0b0c0e] truncate">{copied ? 'Copied' : short(v, 6)}</span>
    </button>
  );
}

function BalanceRow({ b }: { b: TokenBalance }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] font-semibold text-black/70">{b.symbol}</span>
      <span className="text-right">
        <span className="block text-[18px] font-semibold tabular-nums tracking-tight">{formatUnits(b.privateUnits, b.decimals)}</span>
        {b.publicUnits > 0n && (
          <span className="block text-[11.5px] tabular-nums text-black/45">
            {formatUnits(b.publicUnits, b.decimals)} public, not yet shielded
          </span>
        )}
      </span>
    </div>
  );
}

function CopyLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="mt-3 w-full flex items-center justify-between gap-2 rounded-xl bg-black/[0.035] px-3 py-2 text-left hover:bg-black/[0.06] transition-colors"
    >
      <span className="min-w-0">
        <span className="block text-[10.5px] font-mono uppercase tracking-[0.12em] text-black/45">{label}</span>
        <span className="block truncate font-mono text-[12px] text-black/75">{value}</span>
      </span>
      {copied ? <Check size={14} /> : <Copy size={14} className="text-black/50" />}
    </button>
  );
}

function Gate(props: {
  phase: string;
  step?: string;
  error?: string;
  errorDetail?: string;
  configured: boolean;
  walletConnected: boolean;
  sameAccount: boolean;
  hasAddress: boolean;
  /** A computer linked to the phone by QR: the phone approves the signature. */
  linkedComputer?: boolean;
  onOpen: () => void;
}) {
  const working = props.phase === 'signing' || props.phase === 'starting' || props.phase === 'deploying';
  let body: React.ReactNode;
  if (!props.configured) {
    body = <p>The private wallet has not been set up on this server yet.</p>;
  } else if (!props.hasAddress) {
    body = <p>The private wallet needs the Ethereum wallet you sign in with. Sign in with your wallet to use it.</p>;
  } else if (!props.walletConnected) {
    body = <p>Connect the wallet you signed in with. Its signature creates the keys of your private wallet.</p>;
  } else if (!props.sameAccount) {
    body = <p>The connected wallet is a different account from the one you signed in with. Switch accounts in your wallet.</p>;
  } else if (props.linkedComputer) {
    body = (
      <>
        <p>
          This computer is linked to your phone, and your phone holds the wallet. When you tap Open, your phone receives a
          request: open Ledger Chat on your phone and tap <strong>Approve</strong>. It signs a message, free and with no
          transaction, and the keys of your private wallet are then created in this browser.
        </p>
        <p className="mt-2">Keep Ledger Chat open on your phone until this computer shows your wallet.</p>
      </>
    );
  } else {
    body = (
      <>
        <p>
          Your wallet will ask you to sign a message. It is free and sends no transaction. The signature creates the keys
          of your private wallet in this browser; we never receive them.
        </p>
        <p className="mt-2">
          Some wallets show &ldquo;simulation failed&rdquo; for this message. That is expected: it is a signature, not a
          transaction, so there is nothing to simulate. Check that the site is ledgerchat.org and the message names Humanity Ledger.
        </p>
        <p className="mt-2">
          {ALPHA
            ? `The first time, your private account is also created on ${networkLabel()}, paid with Fee Juice you bridge from your Ethereum wallet. That takes about a minute once the Fee Juice arrives.`
            : 'The first time, your private account is also created on the Aztec test network. That takes about a minute.'}
        </p>
      </>
    );
  }
  const canOpen = props.configured && props.hasAddress && props.walletConnected && props.sameAccount;
  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] p-5">
      <div className="text-[14px] font-semibold">Open your private wallet</div>
      <div className="mt-2 text-[13px] leading-relaxed text-black/60">{body}</div>
      {props.error && props.phase === 'error' && (
        <div className="mt-3 flex gap-2 rounded-xl bg-[#fdeeec] px-3 py-2.5 text-[12.5px] text-[#c0362c]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span className="min-w-0">
            {props.error}
            {props.errorDetail && (
              <button
                type="button"
                className="block mt-1.5 underline font-medium"
                onClick={() => {
                  // The exact reason, for support: step and raw error, never keys.
                  navigator.clipboard?.writeText(props.errorDetail!).then(
                    () => toast.success('Details copied. Paste them to support.'),
                    () => toast.error('Could not copy. Select the text in the console instead.'),
                  );
                }}
              >
                Copy details
              </button>
            )}
          </span>
        </div>
      )}
      {working ? (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-black/[0.04] px-3 py-3 text-[12.5px] text-black/70" aria-live="polite">
          <Loader2 size={15} className="animate-spin shrink-0" />
          <span>{props.step}</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={props.onOpen}
          disabled={!canOpen}
          className="mt-4 w-full h-11 rounded-xl text-white text-[14px] font-semibold disabled:opacity-40 transition-colors"
          style={{ background: INK }}
        >
          {props.phase === 'error' ? 'Try again' : 'Open private wallet'}
        </button>
      )}
    </div>
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
    <div className="bg-white rounded-2xl border border-black/[0.05] p-4">
      <div className="flex items-center gap-2 text-[13px] font-semibold">
        <Droplets size={15} className="text-black/60" /> Get test tokens
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-black/50">
        Free test tokens for the Aztec test network. They have no value and cannot be exchanged.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {AZTEC_WALLET_CONFIG.tokens.map((t) => (
          <button
            key={t.key}
            type="button"
            disabled={disabled || !!busy}
            onClick={() => run(t.key)}
            className="h-9 rounded-xl border border-black/10 text-[12px] font-semibold hover:bg-black/[0.04] disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {busy === t.key && <Loader2 size={12} className="animate-spin" />}+{FAUCET_AMOUNT[t.key]} {t.symbol}
          </button>
        ))}
      </div>
    </div>
  );
}

const KIND_LABEL: Record<Activity['kind'], string> = {
  shield: 'Shielded',
  unshield: 'Unshielded',
  send: 'Sent',
  receive: 'Received',
  faucet: 'Test tokens',
  deploy: 'Private account created',
};

const STATUS_LABEL: Record<Activity['status'], string> = {
  proving: 'Proving on this device',
  pending: 'Waiting for the network',
  settled: 'Settled',
  failed: 'Failed',
};

function ActivityList({ items }: { items: Activity[] }) {
  return (
    <div className="bg-white rounded-2xl border border-black/[0.05] overflow-hidden">
      <div className="px-4 py-3.5 border-b border-black/[0.05] flex items-center justify-between">
        <span className="font-semibold text-[14px]">Recent transactions</span>
        <span className="text-[12px] text-black/40">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="py-8 flex flex-col items-center gap-2 text-black/45">
          <Clock size={20} />
          <span className="text-[13px] font-semibold text-black/70">No transactions yet</span>
          <span className="text-[12px] text-center max-w-[220px]">
            {ALPHA ? 'Shield tokens, then send a private payment.' : 'Get test tokens, shield them, then send a private payment.'}
          </span>
        </div>
      ) : (
        <ul className="divide-y divide-black/[0.04]">
          {items.slice(0, 40).map((a) => {
            const inbound = a.kind === 'receive' || a.kind === 'faucet';
            return (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center shrink-0">
                  {a.status === 'proving' || a.status === 'pending' ? (
                    <Loader2 size={14} className="animate-spin text-black/60" />
                  ) : a.status === 'failed' ? (
                    <AlertTriangle size={14} className="text-[#c0362c]" />
                  ) : inbound ? (
                    <ArrowDownToLine size={14} className="text-black/70" />
                  ) : (
                    <ArrowUpFromLine size={14} className="text-black/70" />
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold truncate">
                    {KIND_LABEL[a.kind]}
                    {a.counterparty && (a.kind === 'send' || a.kind === 'receive' || a.kind === 'unshield') && (
                      <span className="font-normal text-black/50"> {a.kind === 'receive' ? 'from' : 'to'} {short(a.counterparty)}</span>
                    )}
                  </span>
                  <span className={`block text-[11.5px] ${a.status === 'failed' ? 'text-[#c0362c]' : 'text-black/45'}`}>
                    {(a.status === 'failed' || a.status === 'pending') && a.error ? a.error : STATUS_LABEL[a.status]}
                    {a.blockNumber ? ` · block ${a.blockNumber}` : ''}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-0.5 shrink-0">
                  {a.amount && (
                    <span className="text-[13px] font-semibold tabular-nums">
                      {inbound || a.kind === 'shield' ? '+' : '−'}
                      {fmt(a)}
                    </span>
                  )}
                  {a.txHash && (
                    <a
                      href={explorerTxUrl(a.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-black/45 hover:text-black flex items-center gap-0.5"
                    >
                      <ExternalLink size={9} /> Explorer
                    </a>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- sheets */

function SheetFrame({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div className="absolute inset-0 z-10 flex flex-col justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-label={title}
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        exit={{ y: 40 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="relative max-h-[88%] overflow-y-auto rounded-t-3xl bg-white px-5 pt-4 pb-6"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/10" />
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[16px] font-semibold">{title}</span>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center">
            <X size={15} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function TokenPicker({ value, onChange }: { value: TokenKey; onChange: (k: TokenKey) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {AZTEC_WALLET_CONFIG.tokens.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`h-9 rounded-xl border text-[12.5px] font-semibold transition-colors ${
            value === t.key ? 'border-[#15171c] bg-[#15171c] text-white' : 'border-black/10 hover:bg-black/[0.04]'
          }`}
        >
          {t.symbol}
        </button>
      ))}
    </div>
  );
}

function AmountField({ value, onChange, max, decimals, symbol }: { value: string; onChange: (v: string) => void; max: bigint; decimals: number; symbol: string }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[12px] text-black/50">
        <span>Amount</span>
        <button type="button" onClick={() => onChange(formatUnits(max, decimals, decimals).replace(/,/g, ''))} className="font-semibold text-black/70 hover:text-black">
          Available {formatUnits(max, decimals)} {symbol}
        </button>
      </span>
      <input
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
        className="mt-1.5 w-full h-12 rounded-xl border border-black/10 px-3.5 text-[18px] font-semibold tabular-nums outline-none focus:border-[#15171c]"
      />
    </label>
  );
}

function SubmitButton({ busy, children, disabled }: { busy: boolean; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      className="w-full h-12 rounded-xl text-white text-[14.5px] font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
      style={{ background: INK }}
    >
      {busy && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

function ShieldForm({ mode, onDone }: { mode: 'shield' | 'unshield'; onDone: () => void }) {
  const { state, wallet } = useAztecWallet('');
  const [token, setToken] = useState<TokenKey>(FIRST_TOKEN);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const bal = state.balances.find((b) => b.key === token);
  const max = mode === 'shield' ? bal?.publicUnits ?? 0n : bal?.privateUnits ?? 0n;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;
    setBusy(true);
    const id = toast.loading('Making the proof on this device. This can take up to a minute.');
    try {
      if (mode === 'shield') await wallet.shield(token, amount);
      else await wallet.unshield(token, amount);
      toast.success(mode === 'shield' ? 'Shielded. The amount is now private.' : 'Unshielded to your public balance.', { id });
      onDone();
    } catch (err) {
      toast.error(humanError(err), { id });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-[12.5px] leading-relaxed text-black/55">
        {mode === 'shield'
          ? 'Moves tokens from your public Aztec balance into private notes. The amount you shield is visible on the network; what you do with it afterwards is not.'
          : 'Moves tokens from your private notes to your public Aztec balance. The amount becomes visible on the network.'}
      </p>
      <TokenPicker value={token} onChange={setToken} />
      <AmountField value={amount} onChange={setAmount} max={max} decimals={bal?.decimals ?? 18} symbol={bal?.symbol ?? symbolOf(token)} />
      <SubmitButton busy={busy} disabled={!amount || max === 0n}>
        {mode === 'shield' ? 'Shield' : 'Unshield'}
      </SubmitButton>
    </form>
  );
}

function SendForm({ onDone, onPaymentSent }: { onDone: () => void; onPaymentSent?: (info: { txHash: string; token: TokenKey }) => void }) {
  const { state, wallet } = useAztecWallet('');
  const [token, setToken] = useState<TokenKey>(FIRST_TOKEN);
  const [amount, setAmount] = useState('');
  const [to, setTo] = useState('');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const bal = state.balances.find((b) => b.key === token);

  const applyScan = (text: string) => {
    const req = decodePaymentRequest(text);
    if (!req) {
      toast.error('That QR code is not an Aztec payment request.');
      return;
    }
    setTo(req.address);
    if (req.token) setToken(req.token);
    if (req.amount) setAmount(req.amount);
    setScanning(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;
    setBusy(true);
    const id = toast.loading('Making the proof on this device. This can take up to a minute.');
    try {
      const receipt: any = await wallet.send(token, amount, to);
      toast.success('Payment sent. Only the recipient can see the amount and who sent it.', { id });
      onPaymentSent?.({ txHash: String(receipt?.txHash ?? ''), token });
      onDone();
    } catch (err) {
      toast.error(humanError(err), { id });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-[12px] text-black/50">Recipient's Aztec address</span>
        <div className="mt-1.5 flex gap-2">
          <input
            value={to}
            onChange={(e) => setTo(e.target.value.trim())}
            onBlur={() => {
              const req = decodePaymentRequest(to);
              if (req) applyScan(to);
            }}
            placeholder="0x… (64 characters)"
            spellCheck={false}
            className="min-w-0 flex-1 h-11 rounded-xl border border-black/10 px-3 font-mono text-[12px] outline-none focus:border-[#15171c]"
          />
          <button
            type="button"
            onClick={() => setScanning((v) => !v)}
            aria-label="Scan a QR code"
            className="h-11 w-11 shrink-0 rounded-xl border border-black/10 flex items-center justify-center hover:bg-black/[0.04]"
          >
            <ScanLine size={17} />
          </button>
        </div>
      </label>
      {scanning && (
        <div className="overflow-hidden rounded-2xl border border-black/10">
          <QrScanner onScanSuccess={applyScan} />
        </div>
      )}
      <TokenPicker value={token} onChange={setToken} />
      <AmountField value={amount} onChange={setAmount} max={bal?.privateUnits ?? 0n} decimals={bal?.decimals ?? 18} symbol={bal?.symbol ?? symbolOf(token)} />
      <p className="text-[12px] leading-relaxed text-black/50">
        Paid from your private balance. The network sees that a transaction happened, not the amount, you or the recipient.
        Check the address: a payment cannot be reversed.
      </p>
      <SubmitButton busy={busy} disabled={!amount || !to}>
        Send privately
      </SubmitButton>
    </form>
  );
}

function ReceiveView({ aztecAddress }: { aztecAddress: string }) {
  const { wallet } = useAztecWallet('');
  const [token, setToken] = useState<TokenKey>(FIRST_TOKEN);
  const [amount, setAmount] = useState('');
  const [sender, setSender] = useState('');
  const [adding, setAdding] = useState(false);
  const request = encodePaymentRequest(aztecAddress, token, /^\d+(\.\d+)?$/.test(amount) ? amount : undefined);

  const addSender = async () => {
    if (!wallet) return;
    setAdding(true);
    try {
      await wallet.addSender(sender);
      toast.success('Sender added. Payments from this address will now appear.');
      setSender('');
    } catch (err) {
      toast.error(humanError(err));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-[#F4F5F7] p-5">
        <div className="rounded-2xl bg-white p-3 border border-black/[0.06]">
          <QRCodeSVG value={request} size={176} level="M" includeMargin={false} />
        </div>
        <span className="text-center text-[12px] text-black/55 max-w-[260px]">
          Show this code to the person paying you. It contains your Aztec address{amount ? ', the token and the amount' : ''}.
        </span>
      </div>
      <TokenPicker value={token} onChange={setToken} />
      <label className="block">
        <span className="text-[12px] text-black/50">Amount to request (optional)</span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
          placeholder="Any amount"
          className="mt-1.5 w-full h-11 rounded-xl border border-black/10 px-3 text-[15px] tabular-nums outline-none focus:border-[#15171c]"
        />
      </label>
      <CopyLine label="Your Aztec address" value={aztecAddress} />

      <div className="rounded-2xl border border-black/[0.08] p-4">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <UserPlus size={15} className="text-black/60" /> Not seeing a payment?
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-black/50">
          Aztec wallets find incoming payments through tags shared with the sender. If a payment from someone new does not
          appear after a sync, add their Aztec address here.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={sender}
            onChange={(e) => setSender(e.target.value.trim())}
            placeholder="Sender's Aztec address"
            spellCheck={false}
            className="min-w-0 flex-1 h-10 rounded-xl border border-black/10 px-3 font-mono text-[12px] outline-none focus:border-[#15171c]"
          />
          <button
            type="button"
            onClick={addSender}
            disabled={!sender || adding}
            className="h-10 px-3.5 rounded-xl text-white text-[12.5px] font-semibold disabled:opacity-40"
            style={{ background: INK }}
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
