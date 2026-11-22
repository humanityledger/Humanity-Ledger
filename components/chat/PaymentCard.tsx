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
import { ShieldCheck, Clock, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { getPrivateWallet, type WalletSnapshot } from '@/lib/aztec/wallet/client';
import { formatUnits } from '@/lib/aztec/wallet/amounts';
import { AZTEC_WALLET_CONFIG, explorerTxUrl, networkLabel } from '@/lib/aztec/wallet/config';
import { parsePaymentMessage, paymentCardState, type PaymentCardState } from '@/lib/payments/payment-message';
import { rememberPaidRequest } from '@/lib/payments/paid-requests';

const CARD = 'rounded-2xl bg-white border border-[#e6e8ec] shadow-[0_1px_2px_rgba(16,24,40,0.04)]';
const BTN = 'h-9 px-3.5 rounded-full text-[13.5px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-[#eff1f4] text-[#15171c] hover:bg-[#e4e7ec]';

function useWallet(): WalletSnapshot | null {
  const [s, setS] = useState<WalletSnapshot | null>(() => (typeof window === 'undefined' ? null : getPrivateWallet().state));
  useEffect(() => getPrivateWallet().subscribe(setS), []);
  return s;
}

const decimalsOf = (address: string) => AZTEC_WALLET_CONFIG.tokens.find((t) => t.address.toLowerCase() === address.toLowerCase())?.decimals;

export function paymentCardWords(state: PaymentCardState, isMe: boolean): { title: string; detail: string; tone: 'ok' | 'wait' | 'bad' } {
  switch (state.kind) {
    case 'sending': return { title: 'Sending privately', detail: 'Your wallet is proving the payment on this device.', tone: 'wait' };
    case 'sent': return { title: 'Payment sent', detail: 'Waiting for the network to include it.', tone: 'wait' };
    case 'confirmed': return { title: 'Payment confirmed', detail: 'Included by the network. The amount stays private.', tone: 'ok' };
    case 'failed': return { title: 'Payment failed', detail: 'Nothing moved. You can try again.', tone: 'bad' };
    case 'received': return { title: 'Payment received', detail: 'Your wallet found it. The amount stays private.', tone: 'ok' };
    case 'awaiting':
      return state.walletOpen
        ? { title: 'Private payment', detail: 'Your wallet has not found it yet. It appears after a sync.', tone: 'wait' }
        : { title: 'Private payment', detail: 'Open your private wallet to confirm it arrived.', tone: 'wait' };
    case 'wrongNetwork': return { title: 'Private payment', detail: `Sent on another network than ${networkLabel()}.`, tone: 'bad' };
  }
  return { title: isMe ? 'Payment sent' : 'Private payment', detail: '', tone: 'wait' };
}

export const PaymentCard = React.memo(function PaymentCard({ raw, isMe }: { raw: string; isMe: boolean }) {
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
  const shownAmount = amount && decimals !== undefined ? `${formatUnits(BigInt(amount), decimals)} ${msg.token.symbol}` : msg.token.symbol;
  const link = explorerTxUrl(msg.txHash);
  const Icon = words.tone === 'ok' ? ShieldCheck : words.tone === 'bad' ? AlertTriangle : Clock;
  const color = words.tone === 'ok' ? 'text-[#10B981]' : words.tone === 'bad' ? 'text-[#FF3B30]' : 'text-[#5200FF]';

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
    <div className={`${CARD} w-[280px] max-w-full p-3.5`} data-testid="payment-card" data-state={state.kind}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} aria-hidden />
        <span className="text-[14px] font-semibold text-[#15171c]">{words.title}</span>
      </div>
      <div className="mt-1.5 text-[20px] font-semibold text-[#15171c] tracking-tight">{shownAmount}</div>
      <p className="mt-1 text-[12.5px] text-[#4a505c] leading-snug">{words.detail}</p>
      <div className="mt-3 flex items-center gap-2">
        {!isMe && state.kind === 'awaiting' && state.walletOpen && (
          <button type="button" className={BTN} disabled={checking} onClick={check}>
            {checking ? 'Checking…' : 'Check now'}
          </button>
        )}
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#5200FF]">
            Transaction <ArrowUpRight className="w-3.5 h-3.5" aria-hidden />
          </a>
        )}
      </div>
    </div>
  );
});
