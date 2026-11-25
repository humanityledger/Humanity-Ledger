'use client';

/**
 * A private payment in a Ledger Chat conversation (lib/payments/payment-message.ts).
 *
 * The card trusts only this device's wallet. The payer sees the status of their own transaction
 * (sending, sent, confirmed, failed) and the amount from their own history. The receiver sees
 * "Received" with the amount only once their own wallet has found a transfer with this transaction
 * hash; until then the card says it is waiting for the wallet, whatever the message claims.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { getPrivateWallet, type WalletSnapshot } from '@/lib/aztec/wallet/client';
import { formatUnits } from '@/lib/aztec/wallet/amounts';
import { AZTEC_WALLET_CONFIG, explorerTxUrl, networkLabel } from '@/lib/aztec/wallet/config';
import { parsePaymentMessage, paymentCardState, type PaymentCardState } from '@/lib/payments/payment-message';
import { rememberPaidRequest } from '@/lib/payments/paid-requests';
import { DisclosurePanel } from '@/components/privacy/DisclosurePanel';
import { CardAmount, PaymentCardFrame, SpecRow } from './paymentCardUi';
import { paymentReceipt } from '@/lib/payments/activity-report';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/client';

const BTN = 'h-9 px-3.5 rounded-[10px] text-[13px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-[#15171c] text-white hover:bg-[#2b2f38]';
const shortTx = (h: string) => (h.length > 18 ? `${h.slice(0, 8)}…${h.slice(-6)}` : h);

function useWallet(): WalletSnapshot | null {
  const [s, setS] = useState<WalletSnapshot | null>(() => (typeof window === 'undefined' ? null : getPrivateWallet().state));
  useEffect(() => getPrivateWallet().subscribe(setS), []);
  return s;
}

const decimalsOf = (address: string) => AZTEC_WALLET_CONFIG.tokens.find((t) => t.address.toLowerCase() === address.toLowerCase())?.decimals;

/** The words on the card for each state; `pill` is the short status shown top right. */
export function paymentCardWords(state: PaymentCardState, isMe: boolean): { title: string; detail: string; tone: 'ok' | 'wait' | 'bad'; pill: string } {
  switch (state.kind) {
    case 'sending': return { title: 'Sending privately', detail: 'Your wallet is proving the payment on this device.', tone: 'wait', pill: 'Proving' };
    case 'sent': return { title: 'Payment sent', detail: 'Waiting for the network to include it.', tone: 'wait', pill: 'Sent' };
    case 'confirmed': return { title: 'Payment confirmed', detail: 'Included by the network. The amount stays private.', tone: 'ok', pill: 'Confirmed' };
    case 'failed': return { title: 'Payment failed', detail: 'Nothing moved. You can try again.', tone: 'bad', pill: 'Failed' };
    case 'received': return { title: 'Payment received', detail: 'Your wallet found it. The amount stays private.', tone: 'ok', pill: 'Received' };
    case 'awaiting':
      return state.walletOpen
        ? { title: 'Private payment', detail: 'Your wallet has not found it yet. It appears after a sync.', tone: 'wait', pill: 'Waiting' }
        : { title: 'Private payment', detail: 'Open your private wallet to confirm it arrived.', tone: 'wait', pill: 'Unconfirmed' };
    case 'wrongNetwork': return { title: 'Private payment', detail: `Sent on another network than ${networkLabel()}.`, tone: 'bad', pill: 'Other network' };
  }
  return { title: isMe ? 'Payment sent' : 'Private payment', detail: '', tone: 'wait', pill: 'Pending' };
}

export const PaymentCard = React.memo(function PaymentCard({ raw, isMe }: { raw: string; isMe: boolean }) {
  const tr = useT();
  const msg = useMemo(() => parsePaymentMessage(raw), [raw]);
  const wallet = useWallet();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (msg?.requestId) rememberPaidRequest(msg.requestId, msg.txHash, undefined, isMe ? 'me' : 'peer');
  }, [msg?.requestId, msg?.txHash, isMe]);

  if (!msg) return null;
  const walletOpen = wallet?.phase === 'ready';
  const state = paymentCardState(msg, { isMe, network: AZTEC_WALLET_CONFIG.network, walletOpen, activity: wallet?.activity ?? [] });
  const words = paymentCardWords(state, isMe);
  const amount = 'amount' in state && state.amount ? state.amount : undefined;
  const decimals = decimalsOf(msg.token.address);
  const shownValue = amount && decimals !== undefined ? formatUnits(BigInt(amount), decimals) : undefined;
  const link = explorerTxUrl(msg.txHash);
  // A receipt only for a payment this wallet itself recorded as settled (R10).
  const receiptEntry = (state.kind === 'confirmed' || state.kind === 'received') ? (wallet?.activity ?? []).find((a) => a.txHash === msg.txHash && a.status === 'settled') : undefined;

  const check = async () => {
    setChecking(true);
    try {
      await getPrivateWallet().refresh();
    } catch {
      /* the card keeps saying it is waiting */
    } finally {
      setChecking(false);
    }
  };

  return (
    <PaymentCardFrame eyebrow={`${isMe ? 'Your payment' : 'Private payment'} · ${msg.token.symbol}`} status={{ tone: words.tone, label: words.pill }} testId="payment-card" state={state.kind}>
      <CardAmount value={shownValue} symbol={msg.token.symbol} />
      <p className="mt-2 text-[13px] font-semibold text-[#15171c]">{tr(words.title)}</p>
      <p className="mt-0.5 text-[12.5px] leading-snug text-[#3d424b]">{tr(words.detail)}</p>
      <dl className="mt-3 border-t border-[#eef0f3] pt-1.5">
        <SpecRow label={tr("Network")}>{tr(networkLabel())}</SpecRow>
        {msg.txHash && (
          <SpecRow label={tr("Transaction")}>
            {link ? (
              <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[12px] text-[#2754d6] hover:underline">
                {shortTx(msg.txHash)} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </a>
            ) : (
              <span className="font-mono text-[12px]">{shortTx(msg.txHash)}</span>
            )}
          </SpecRow>
        )}
      </dl>
      {receiptEntry && (
        <button
          type="button"
          className="mt-3 text-[12.5px] font-semibold text-[#2754d6] hover:underline"
          onClick={() => {
            const meta = AZTEC_WALLET_CONFIG.tokens.find((t) => t.address.toLowerCase() === msg.token.address.toLowerCase());
            void navigator.clipboard?.writeText(paymentReceipt(receiptEntry, meta, networkLabel(), link || undefined)).then(() => toast.success(tr("Receipt copied")), () => toast.error(tr("Could not copy")));
          }}
        >
          {tr("Copy receipt")}
        </button>
      )}
      {!isMe && state.kind === 'awaiting' && state.walletOpen && (
        <button type="button" className={`${BTN} mt-3`} disabled={checking} onClick={check}>
          {checking ? tr("Checking…") : tr("Check now")}
        </button>
      )}
      <DisclosurePanel action={isMe ? 'send' : 'receive'} compact />
    </PaymentCardFrame>
  );
});
