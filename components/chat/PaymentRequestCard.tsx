'use client';

/**
 * A payment request in a Ledger Chat conversation (lib/payments/payment-message.ts, hl.payment_request).
 *
 * The person asked sees the amount, the token, the note and the expiry, and a "Pay" button that
 * opens the private payment form with the token and amount fixed. The payee is never taken from the
 * request: the form pays the address pinned and verified for this conversation (G7), with the same
 * cap, risk acknowledgement, exits-only and beta checks as any payment. A request is shown paid once
 * this device has seen a payment that names it (lib/payments/paid-requests.ts), unless that payment
 * failed in this device's own wallet: then it can be paid again. Expired requests cannot be paid.
 * A request in cUSDC that this person cannot pay yet (not in the closed beta) links to /beta.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { formatUnits } from '@/lib/aztec/wallet/amounts';
import { AZTEC_WALLET_CONFIG, BETA_TOKENS, networkLabel } from '@/lib/aztec/wallet/config';
import { getPrivateWallet, type WalletSnapshot } from '@/lib/aztec/wallet/client';
import { betaApplies } from '@/lib/beta/cusdc-beta-client';
import { parsePaymentRequest, requestCardState } from '@/lib/payments/payment-message';
import { failedRequestIds, onPaidRequestsChange, paidRequestIds } from '@/lib/payments/paid-requests';
import { PAY_REQUEST_EVENT, plainUnits, type PayPrefill } from '@/lib/payments/request-draft';

const CARD = 'rounded-2xl bg-white border border-[#e6e8ec] shadow-[0_1px_2px_rgba(16,24,40,0.04)]';
const BTN = 'h-9 px-4 rounded-full text-[13.5px] font-semibold transition-colors bg-[#15171c] text-white hover:bg-[#2a2d35] disabled:opacity-50';

function usePaidIds(): { paid: ReadonlySet<string>; failed: ReadonlySet<string> } {
  const [tick, setTick] = useState(0);
  const [activity, setActivity] = useState<WalletSnapshot['activity']>(() => (typeof window === 'undefined' ? [] : getPrivateWallet().state.activity));
  useEffect(() => onPaidRequestsChange(() => setTick((n) => n + 1)), []);
  useEffect(() => getPrivateWallet().subscribe((s) => setActivity(s.activity)), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => ({ paid: paidRequestIds(undefined, activity), failed: failedRequestIds(activity) }), [activity, tick]);
}

export const PaymentRequestCard = React.memo(function PaymentRequestCard({ raw, isMe }: { raw: string; isMe: boolean }) {
  const req = useMemo(() => parsePaymentRequest(raw), [raw]);
  const { paid, failed } = usePaidIds();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!req) return null;
  const token = AZTEC_WALLET_CONFIG.tokens.find((t) => t.address.toLowerCase() === req.token.address);
  const state = requestCardState(req, { network: AZTEC_WALLET_CONFIG.network, now, paidRequestIds: paid });
  const amountText = token ? `${formatUnits(BigInt(req.amount), token.decimals, token.decimals)} ${req.token.symbol}` : req.token.symbol;
  const expires = new Date(req.expiresAt);
  const status =
    state.kind === 'paid' ? 'Paid'
      : state.kind === 'expired' ? 'Expired'
        : state.kind === 'wrongNetwork' ? `Asked on another network than ${networkLabel()}`
          : failed.has(req.id) ? 'The payment failed. Nothing was paid; you can pay again.'
            : isMe ? 'Waiting for payment' : `Open until ${expires.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;

  const pay = () => {
    if (!token) return;
    const detail: PayPrefill = { requestId: req.id, token: token.key, amount: plainUnits(BigInt(req.amount), token.decimals) };
    window.dispatchEvent(new CustomEvent(PAY_REQUEST_EVENT, { detail }));
  };

  return (
    <div className={`${CARD} w-[280px] max-w-full p-3.5`} data-testid="payment-request-card" data-state={state.kind}>
      <div className="flex items-center gap-2">
        <Receipt className="w-4 h-4 text-[#5200FF]" aria-hidden />
        <span className="text-[14px] font-semibold text-[#15171c]">{isMe ? 'You asked for a payment' : 'Payment request'}</span>
      </div>
      <div className="mt-1.5 text-[20px] font-semibold text-[#15171c] tracking-tight">{amountText}</div>
      {req.memo && <p className="mt-1 text-[13px] text-[#15171c] break-words">{req.memo}</p>}
      <p className={`mt-1 text-[12.5px] ${state.kind === 'paid' ? 'text-[#10B981]' : state.kind === 'open' ? 'text-[#4a505c]' : 'text-[#FF3B30]'}`}>{status}</p>
      {!isMe && state.kind === 'open' && (
        token
          ? <button type="button" className={`${BTN} mt-3`} onClick={pay}>Pay privately</button>
          : betaApplies() && BETA_TOKENS.some((t) => t.address.toLowerCase() === req.token.address)
            ? <p className="mt-2 text-[12.5px] text-[#4a505c]">cUSDC payments are in a closed beta. <Link href="/beta" className="font-semibold text-[#5200FF] hover:underline">Join with an invitation</Link></p>
            : <p className="mt-2 text-[12.5px] text-[#4a505c]">This token is not available in your private wallet.</p>
      )}
    </div>
  );
});
