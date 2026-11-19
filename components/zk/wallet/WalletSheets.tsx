'use client';

/**
 * components/zk/wallet/WalletSheets.tsx — Send, Receive, Shield and Unshield.
 *
 * Every sheet calls the wallet in lib/aztec/wallet/client.ts and nothing else:
 *   Send      wallet.send(token, amount, to)        a private transfer, proven on this device
 *   Shield    wallet.shield(token, amount)           public Aztec balance → private notes
 *   Unshield  wallet.unshield(token, amount)         private notes → public Aztec balance
 *   Receive   encodePaymentRequest(...) in a QR code; wallet.addSender(...) for a new sender
 *
 * Send has two steps: the details, then a review that says exactly what is
 * public (the Fee Juice fee your account pays) and what is not (amount, sender,
 * recipient). The payment itself then runs in PaymentProgress, whose stages come
 * from the wallet's own activity record. A payment cannot be reversed; the review
 * says so before the button.
 */

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { BrandedQr } from '@/components/chat/profile/BrandedQr';
import { toast } from 'sonner';
import { ArrowDown, ClipboardPaste, Lock, ScanLine, Share2, LockOpen, UserPlus } from 'lucide-react';
import { useAztecWallet } from '@/lib/aztec/wallet/useAztecWallet';
import { decodePaymentRequest, encodePaymentRequest, humanError, isAztecAddress } from '@/lib/aztec/wallet/client';
import { AZTEC_WALLET_CONFIG, explorerTxUrl, networkLabel, type TokenKey } from '@/lib/aztec/wallet/config';
import { formatUnits } from '@/lib/aztec/wallet/amounts';
import { amountProblem, recipientProblem } from './walletLogic';

export { amountProblem, recipientProblem };
import { PaymentProgress, type PaymentStage } from '@/components/zk/PaymentProgress';
import { usePaymentProofActivity } from '@/lib/activities/hooks';
import {
  AddressBox, AmountInput, Card, FOCUS, INK, INK_2, INK_3, KV, Notice, PrimaryButton, SecondaryButton, StepDots, TextButton, TokenChips, groupHex, shortHex,
} from './WalletUI';
import { isTestToken, TEST_TOKEN_NOTE } from '@/lib/payments/assets';

const QrScanner = dynamic(() => import('@/components/terminal/QrScanner').then((m) => m.QrScanner), { ssr: false });

const ALPHA = AZTEC_WALLET_CONFIG.network === 'mainnet';
export const FIRST_TOKEN: TokenKey = AZTEC_WALLET_CONFIG.tokens[0]?.key ?? 'USDC';
export const symbolOf = (key: TokenKey) => AZTEC_WALLET_CONFIG.tokens.find((t) => t.key === key)?.symbol ?? key;
const TOKENS = AZTEC_WALLET_CONFIG.tokens.map((t) => ({ key: t.key, symbol: t.symbol }));

async function readClipboard(): Promise<string | null> {
  try {
    return (await navigator.clipboard.readText()).trim();
  } catch {
    return null;
  }
}

/* ─── Send ─────────────────────────────────────────────────────────────────── */

export function SendFlow({
  onDone,
  onPaymentSent,
  onStepChange,
}: {
  onDone: () => void;
  onPaymentSent?: (info: { txHash: string; token: TokenKey }) => void;
  /** Lets the sheet show a Back arrow on the review step. */
  onStepChange?: (step: 'details' | 'review' | 'running', back?: () => void) => void;
}) {
  const { state, wallet } = useAztecWallet('');
  const [token, setToken] = useState<TokenKey>(FIRST_TOKEN);
  const [amount, setAmount] = useState('');
  const [to, setTo] = useState('');
  const [scanning, setScanning] = useState(false);
  const [step, setStepState] = useState<'details' | 'review'>('details');
  const [busy, setBusy] = useState(false);
  // The payment in flight: its stage is read from the wallet's own activity record.
  const [run, setRun] = useState<{ startedAt: number; amount: string; symbol: string; to: string; error?: string; txHash?: string } | null>(null);

  const bal = state.balances.find((b) => b.key === token);
  const decimals = bal?.decimals ?? AZTEC_WALLET_CONFIG.tokens.find((t) => t.key === token)?.decimals ?? 18;
  const symbol = bal?.symbol ?? symbolOf(token);
  const max = bal?.privateUnits ?? 0n;
  const amountErr = amountProblem(amount, decimals, max);
  const toErr = recipientProblem(to, state.aztecAddress);
  const canReview = !!amount && !!to && !amountErr && !toErr && max > 0n;

  const setStep = (s: 'details' | 'review') => {
    setStepState(s);
    onStepChange?.(s, s === 'review' ? () => setStep('details') : undefined);
  };

  const entry = useMemo(() => {
    if (!run) return undefined;
    return state.activity
      .filter((a) => a.kind === 'send' && a.createdAt >= run.startedAt - 2000 && (!a.counterparty || a.counterparty.toLowerCase() === run.to.toLowerCase()))
      .sort((a, b) => b.createdAt - a.createdAt)[0];
  }, [run, state.activity]);
  const stage: PaymentStage = run?.error
    ? 'failed'
    : entry?.status === 'settled'
      ? 'settled'
      : entry?.status === 'failed'
        ? 'failed'
        : entry?.status === 'pending'
          ? 'sending'
          : entry?.status === 'proving'
            ? 'proving'
            : 'preparing';
  const txHash = entry?.txHash ?? run?.txHash;
  // The same stage in the island, so the payment can be followed after this sheet is closed or
  // while a call is on screen. Recipient as a short address and the amount only.
  usePaymentProofActivity({
    key: run ? String(run.startedAt) : null,
    step: stage,
    toName: run ? `${run.to.slice(0, 6)}…${run.to.slice(-4)}` : '',
    amount: run?.amount ?? '',
    symbol: run?.symbol ?? '',
  });

  const applyRequest = (text: string): boolean => {
    const req = decodePaymentRequest(text);
    if (!req) return false;
    setTo(req.address);
    if (req.token && AZTEC_WALLET_CONFIG.tokens.some((t) => t.key === req.token)) setToken(req.token);
    if (req.amount) setAmount(req.amount);
    setScanning(false);
    return true;
  };

  const paste = async () => {
    const text = await readClipboard();
    if (!text) {
      toast.error('This browser did not allow reading the clipboard. Paste into the field instead.');
      return;
    }
    if (!applyRequest(text)) setTo(text);
  };

  const submit = async () => {
    if (!wallet || !canReview) return;
    setBusy(true);
    setRun({ startedAt: Date.now(), amount, symbol, to });
    onStepChange?.('running');
    try {
      const receipt: any = await wallet.send(token, amount, to);
      const hash = String(receipt?.txHash ?? '');
      setRun((r) => (r ? { ...r, txHash: hash || r.txHash } : r));
      onPaymentSent?.({ txHash: hash, token });
    } catch (err) {
      setRun((r) => (r ? { ...r, error: humanError(err) } : r));
    } finally {
      setBusy(false);
    }
  };

  if (run) {
    return (
      <PaymentProgress
        stage={stage}
        amount={run.amount}
        symbol={run.symbol}
        recipient={run.to}
        network={networkLabel()}
        startedAt={run.startedAt}
        txHash={txHash}
        blockNumber={entry?.blockNumber}
        error={run.error ?? entry?.error}
        explorerUrl={txHash ? explorerTxUrl(txHash) : undefined}
        onDone={() => {
          setRun(null);
          if (stage === 'settled') onDone();
          else setStep('review');
        }}
        onRetry={() => {
          setRun(null);
          setStep('review');
        }}
      />
    );
  }

  if (step === 'review') {
    return (
      <div className="space-y-4" data-testid="send-review">
        <StepDots steps={['Details', 'Review']} at={1} />
        <div className="text-center pt-1 pb-2">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em]" style={{ color: INK_3 }}>
            You send privately
          </p>
          <p className="mt-1 text-[40px] font-semibold tracking-[-0.035em] tabular-nums leading-tight" style={{ color: INK }}>
            {amount} <span className="text-[20px]" style={{ color: INK_2 }}>{symbol}</span>
          </p>
        </div>
        <Card as="div" className="px-5 py-1">
          <KV k="To" v={shortHex(to, 8)} mono />
          <KV k="From" v="Your private balance" />
          <KV k="Network" v={networkLabel()} />
          {isTestToken(symbol) && <KV k="Asset" v={`${symbol}, ${TEST_TOKEN_NOTE.toLowerCase()}`} />}
          <KV k="Network fee" v="Fee Juice" hint="Paid by your account. The fee is public; the amount, you and the recipient are not." />
        </Card>
        <p className="font-mono text-[12.5px] leading-[1.6] break-all rounded-2xl bg-[#f7f8fa] border border-[#e4e7ec] px-4 py-3" style={{ color: INK_2 }} aria-label="Full recipient address">
          {groupHex(to)}
        </p>
        <Notice tone="warn">Check the address. A payment cannot be reversed.</Notice>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <SecondaryButton onClick={() => setStep('details')}>Edit</SecondaryButton>
          <PrimaryButton onClick={submit} busy={busy}>
            Send privately
          </PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canReview) setStep('review');
      }}
      className="space-y-4"
    >
      <StepDots steps={['Details', 'Review']} at={0} />
      <TokenChips tokens={TOKENS} value={token} onChange={setToken} />
      <AmountInput
        value={amount}
        onChange={setAmount}
        symbol={symbol}
        decimals={decimals}
        available={formatUnits(max, decimals)}
        availableLabel="Private balance"
        onMax={() => setAmount(formatUnits(max, decimals, decimals).replace(/,/g, ''))}
        invalid={amountErr}
        autoFocus
      />

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="wallet-send-to" className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: INK_3 }}>
            Recipient's Aztec address
          </label>
          <div className="flex items-center gap-1">
            <TextButton onClick={paste} label="Paste the address">
              <span className="inline-flex items-center gap-1.5">
                <ClipboardPaste size={15} strokeWidth={1.9} aria-hidden="true" /> Paste
              </span>
            </TextButton>
            <TextButton onClick={() => setScanning((v) => !v)} label={scanning ? 'Stop scanning' : 'Scan a QR code'}>
              <span className="inline-flex items-center gap-1.5">
                <ScanLine size={15} strokeWidth={1.9} aria-hidden="true" /> {scanning ? 'Stop' : 'Scan'}
              </span>
            </TextButton>
          </div>
        </div>
        <textarea
          id="wallet-send-to"
          rows={2}
          value={to}
          onChange={(e) => setTo(e.target.value.replace(/\s+/g, ''))}
          onBlur={() => {
            if (to.startsWith('aztec:')) applyRequest(to);
          }}
          placeholder="0x… (64 characters)"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-invalid={toErr ? true : undefined}
          className={`mt-1.5 w-full rounded-2xl border-2 px-4 py-3 font-mono text-[14px] leading-[1.5] resize-none outline-none break-all ${
            toErr ? 'border-[#b42318]' : 'border-[#e4e7ec] focus:border-[#15171c]'
          }`}
          style={{ color: INK }}
        />
        {toErr && (
          <p className="mt-1.5 text-[13px]" style={{ color: '#b42318' }} role="alert">
            {toErr}
          </p>
        )}
      </div>

      {scanning && (
        <div className="overflow-hidden rounded-2xl border border-[#e4e7ec]">
          <QrScanner
            onScanSuccess={(text: string) => {
              if (!applyRequest(text)) toast.error('That QR code is not an Aztec payment request.');
            }}
          />
        </div>
      )}

      {max === 0n && (
        <Notice tone="info">
          Your private balance is empty. {ALPHA ? 'Shield tokens first, or ask someone to pay you.' : 'Get test tokens and shield them first.'}
        </Notice>
      )}

      <PrimaryButton type="submit" disabled={!canReview}>
        Review
      </PrimaryButton>
      <p className="text-[13px] leading-relaxed text-center" style={{ color: INK_3 }}>
        Paid from your private balance. The network sees that a transaction happened, not the amount, you or the recipient.
      </p>
    </form>
  );
}

/* ─── Receive ──────────────────────────────────────────────────────────────── */

export function ReceiveView({ aztecAddress }: { aztecAddress: string }) {
  const { wallet } = useAztecWallet('');
  const [token, setToken] = useState<TokenKey>(FIRST_TOKEN);
  const [amount, setAmount] = useState('');
  const [sender, setSender] = useState('');
  const [adding, setAdding] = useState(false);
  const decimals = AZTEC_WALLET_CONFIG.tokens.find((t) => t.key === token)?.decimals ?? 18;
  const amountOk = /^\d+(\.\d+)?$/.test(amount) && amountProblem(amount, decimals, 2n ** 127n) === null;
  const request = encodePaymentRequest(aztecAddress, token, amountOk ? amount : undefined);
  const canShare = typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function';
  const senderErr = sender && !isAztecAddress(sender) ? 'An Aztec address is 0x and 64 characters' : null;

  const addSender = async () => {
    if (!wallet || senderErr) return;
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
      <div className="rounded-[24px] border border-[#e4e7ec] bg-[#f7f8fa] p-5 flex flex-col items-center gap-3">
        <div className="rounded-[20px] bg-white p-1.5 border border-[#e4e7ec] shadow-[0_1px_2px_rgba(16,24,40,0.05)] overflow-hidden" data-testid="receive-qr">
          <BrandedQr value={request} title="Payment request QR code" style={{ width: 224 }} />
        </div>
        <p className="text-center text-[14px] leading-snug max-w-[280px]" style={{ color: INK_2 }}>
          Show this code to the person paying you. It contains your Aztec address{amountOk ? `, ${symbolOf(token)} and ${amount}` : ''}.
        </p>
        {canShare && (
          <button
            type="button"
            onClick={() => (navigator as any).share({ text: request }).catch(() => {})}
            className={`min-h-[44px] px-4 rounded-full text-[14px] font-semibold bg-white border border-[#d4d8de] hover:bg-[#f2f4f7] inline-flex items-center gap-2 ${FOCUS}`}
            style={{ color: INK }}
          >
            <Share2 size={16} strokeWidth={1.9} aria-hidden="true" /> Share request
          </button>
        )}
      </div>

      <AddressBox label="Your Aztec address" value={aztecAddress} />

      <TokenChips tokens={TOKENS} value={token} onChange={setToken} />
      <label className="block">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: INK_3 }}>
          Amount to request (optional)
        </span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/,/g, '.').replace(/[^\d.]/g, ''))}
          placeholder="Any amount"
          className="mt-1.5 w-full min-h-[52px] rounded-2xl border-2 border-[#e4e7ec] px-4 text-[17px] tabular-nums outline-none focus:border-[#15171c] placeholder:text-[#8a909c]"
          style={{ color: INK }}
        />
      </label>

      <Card as="div" className="p-5">
        <div className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: INK }}>
          <UserPlus size={17} strokeWidth={1.9} aria-hidden="true" /> Not seeing a payment?
        </div>
        <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: INK_2 }}>
          Aztec wallets find incoming payments through tags shared with the sender. If a payment from someone new does not appear after a sync,
          add their Aztec address here.
        </p>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            value={sender}
            onChange={(e) => setSender(e.target.value.trim())}
            placeholder="Sender's Aztec address"
            spellCheck={false}
            aria-invalid={senderErr ? true : undefined}
            aria-label="Sender's Aztec address"
            className="min-w-0 flex-1 min-h-[48px] rounded-2xl border-2 border-[#e4e7ec] px-4 font-mono text-[13.5px] outline-none focus:border-[#15171c] placeholder:text-[#8a909c]"
            style={{ color: INK }}
          />
          <button
            type="button"
            onClick={addSender}
            disabled={!sender || !!senderErr || adding}
            className={`min-h-[48px] px-5 rounded-2xl text-white text-[15px] font-semibold bg-[#15171c] hover:bg-[#262932] disabled:bg-[#e4e7ec] disabled:text-[#5b606b] ${FOCUS}`}
          >
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
        {senderErr && (
          <p className="mt-1.5 text-[13px]" style={{ color: '#b42318' }} role="alert">
            {senderErr}
          </p>
        )}
      </Card>
    </div>
  );
}

/* ─── Shield and Unshield ──────────────────────────────────────────────────── */

export function ShieldFlow({ mode, onDone }: { mode: 'shield' | 'unshield'; onDone: () => void }) {
  const { state, wallet } = useAztecWallet('');
  const [token, setToken] = useState<TokenKey>(FIRST_TOKEN);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bal = state.balances.find((b) => b.key === token);
  const decimals = bal?.decimals ?? 18;
  const symbol = bal?.symbol ?? symbolOf(token);
  const publicUnits = bal?.publicUnits ?? 0n;
  const privateUnits = bal?.privateUnits ?? 0n;
  const max = mode === 'shield' ? publicUnits : privateUnits;
  const amountErr = amountProblem(amount, decimals, max);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet || amountErr || !amount) return;
    setBusy(true);
    setError(null);
    const id = toast.loading('Making the proof on this device. This can take up to a minute.');
    try {
      if (mode === 'shield') await wallet.shield(token, amount);
      else await wallet.unshield(token, amount);
      toast.success(mode === 'shield' ? 'Shielded. The amount is now private.' : 'Unshielded to your public balance.', { id });
      onDone();
    } catch (err) {
      const m = humanError(err);
      setError(m);
      toast.error(m, { id });
    } finally {
      setBusy(false);
    }
  };

  const from = mode === 'shield' ? { label: 'Public balance', units: publicUnits, icon: <LockOpen size={16} strokeWidth={2} aria-hidden="true" /> } : { label: 'Private balance', units: privateUnits, icon: <Lock size={16} strokeWidth={2} aria-hidden="true" /> };
  const to = mode === 'shield' ? { label: 'Private balance', units: privateUnits, icon: <Lock size={16} strokeWidth={2} aria-hidden="true" /> } : { label: 'Public balance', units: publicUnits, icon: <LockOpen size={16} strokeWidth={2} aria-hidden="true" /> };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-[14px] leading-relaxed" style={{ color: INK_2 }}>
        {mode === 'shield'
          ? 'Moves tokens from your public Aztec balance into private notes. The amount you shield is visible on the network; what you do with it afterwards is not.'
          : 'Moves tokens from your private notes to your public Aztec balance. The amount becomes visible on the network.'}
      </p>

      <div className="relative" aria-label={`${from.label} to ${to.label}`}>
        <BalanceLeg title="From" {...from} decimals={decimals} symbol={symbol} />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white border border-[#e4e7ec] flex items-center justify-center z-[1]" aria-hidden="true">
          <ArrowDown size={16} strokeWidth={2.2} style={{ color: INK }} />
        </span>
        <div className="h-2" />
        <BalanceLeg title="To" {...to} decimals={decimals} symbol={symbol} />
      </div>

      <TokenChips tokens={TOKENS} value={token} onChange={setToken} />
      <AmountInput
        value={amount}
        onChange={setAmount}
        symbol={symbol}
        decimals={decimals}
        available={formatUnits(max, decimals)}
        onMax={() => setAmount(formatUnits(max, decimals, decimals).replace(/,/g, ''))}
        invalid={amountErr}
        autoFocus
      />
      {error && <Notice tone="bad">{error}</Notice>}
      <PrimaryButton type="submit" busy={busy} disabled={!amount || !!amountErr || max === 0n}>
        {mode === 'shield' ? 'Shield' : 'Unshield'}
      </PrimaryButton>
      {max === 0n && (
        <p className="text-[13px] text-center" style={{ color: INK_3 }}>
          {mode === 'shield' ? 'There is nothing in your public balance to shield.' : 'There is nothing in your private balance to unshield.'}
        </p>
      )}
    </form>
  );
}

function BalanceLeg({ title, label, units, icon, decimals, symbol }: { title: string; label: string; units: bigint; icon: React.ReactNode; decimals: number; symbol: string }) {
  return (
    <div className="rounded-2xl border border-[#e4e7ec] bg-[#f7f8fa] px-4 py-3 flex items-center gap-3">
      <span className="w-9 h-9 rounded-full bg-white border border-[#e4e7ec] flex items-center justify-center shrink-0" style={{ color: INK }}>
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: INK_3 }}>
          {title}
        </span>
        <span className="block text-[15px] font-semibold" style={{ color: INK }}>
          {label}
        </span>
      </span>
      <span className="text-[15px] font-semibold tabular-nums shrink-0" style={{ color: INK }}>
        {formatUnits(units, decimals)} <span style={{ color: INK_2 }}>{symbol}</span>
      </span>
    </div>
  );
}
