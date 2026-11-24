'use client';

/**
 * A payment request in a Ledger Chat conversation (lib/payments/payment-message.ts, hl.payment_request).
 *
 * The person asked sees the amount, the token, the note and the expiry, and a "Pay" button that
 * opens the private payment form with the token and amount fixed. The payee is never taken from the
 * request: the form pays the address pinned and verified for this conversation (G7), with the same
 * cap, risk acknowledgement, exits-only and beta checks as any payment. A request is shown paid once
 * this device paid it (unless that payment failed in this wallet: then it can be paid again), or,
 * for the person who asked, once their own wallet found a settled receive of at least the amount
 * in that token (lib/payments/paid-requests.ts). A chat message alone never marks it paid.
 * Expired requests cannot be paid.
 * A request in cUSDC that this person cannot pay yet (not in the closed beta) links to /beta.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatUnits } from '@/lib/aztec/wallet/amounts';
import { AZTEC_WALLET_CONFIG, BETA_TOKENS, networkLabel } from '@/lib/aztec/wallet/config';
import { getPrivateWallet, type WalletSnapshot } from '@/lib/aztec/wallet/client';
import { betaApplies } from '@/lib/beta/cusdc-beta-client';
import { parsePaymentRequest, requestCardState } from '@/lib/payments/payment-message';
import { onPaidRequestsChange, requestSettlement } from '@/lib/payments/paid-requests';
import { PAY_REQUEST_EVENT, plainUnits, type PayPrefill } from '@/lib/payments/request-draft';
import { DisclosurePanel } from '@/components/privacy/DisclosurePanel';
import { loadLimits } from '@/lib/payments/personal-limits';
import { CardAmount, PaymentCardFrame, SpecRow, type CardTone } from './paymentCardUi';
import { useT } from '@/lib/i18n/client';

const BTN = 'h-10 w-full rounded-[10px] text-[13.5px] font-semibold transition-colors bg-[#15171c] text-white hover:bg-[#2b2f38] disabled:opacity-50';

/** The wallet's activity, and a re-render whenever a payment is recorded on this device. */
function useSettlementInputs(): { activity: WalletSnapshot['activity']; tick: number } {
  const [tick, setTick] = useState(0);
  const [activity, setActivity] = useState<WalletSnapshot['activity']>(() => (typeof window === 'undefined' ? [] : getPrivateWallet().state.activity));
  useEffect(() => onPaidRequestsChange(() => setTick((n) => n + 1)), []);
  useEffect(() => getPrivateWallet().subscribe((s) => setActivity(s.activity)), []);
  return { activity, tick };
}

export const PaymentRequestCard = React.memo(function PaymentRequestCard({ raw, isMe }: { raw: string; isMe: boolean }) {
  const tr = useT();
  const req = useMemo(() => parsePaymentRequest(raw), [raw]);
  const { activity } = useSettlementInputs();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!req) return null;
  const token = AZTEC_WALLET_CONFIG.tokens.find((t) => t.address.toLowerCase() === req.token.address);
  const settlement = requestSettlement({ id: req.id, amount: req.amount, tokenKey: token?.key ?? null }, activity);
  const state = requestCardState(req, { network: AZTEC_WALLET_CONFIG.network, now, paidRequestIds: settlement === 'paid' ? new Set([req.id]) : new Set<string>() });
  const amountValue = token ? formatUnits(BigInt(req.amount), token.decimals, token.decimals) : undefined;
  const expires = new Date(req.expiresAt);
  const status =
    state.kind === 'paid' ? 'Paid'
      : state.kind === 'expired' ? 'Expired'
        : state.kind === 'wrongNetwork' ? `Asked on another network than ${networkLabel()}`
          : settlement === 'failed' ? 'The payment failed. Nothing was paid; you can pay again.'
            : settlement === 'announced' && isMe ? 'A payment was announced. It shows as paid once your wallet finds it.'
              : isMe ? 'Waiting for payment.' : 'You pay from your private balance. The amount is set by the request.';

  const pill: { tone: CardTone; label: string } =
    state.kind === 'paid' ? { tone: 'ok', label: tr("Paid") }
      : state.kind === 'expired' ? { tone: 'bad', label: tr("Expired") }
        : state.kind === 'wrongNetwork' ? { tone: 'bad', label: tr("Other network") }
          : settlement === 'failed' ? { tone: 'bad', label: tr("Failed") }
            : settlement === 'announced' && isMe ? { tone: 'wait', label: tr("Announced") }
              : { tone: 'neutral', label: tr("Open") };

  const pay = () => {
    if (!token) return;
    const detail: PayPrefill = { requestId: req.id, token: token.key, amount: plainUnits(BigInt(req.amount), token.decimals) };
    window.dispatchEvent(new CustomEvent(PAY_REQUEST_EVENT, { detail }));
  };

  return (
    <PaymentCardFrame eyebrow={`${isMe ? 'You asked' : 'Payment request'} · ${req.token.symbol}`} status={pill} testId="payment-request-card" state={state.kind}>
      <CardAmount value={amountValue} symbol={req.token.symbol} />
      {req.memo && <p className="mt-2 break-words text-[13.5px] leading-snug text-[#15171c]">{req.memo}</p>}
      <p className={`mt-1.5 text-[12.5px] leading-snug ${state.kind === 'paid' ? 'text-[#0a7a55]' : state.kind === 'open' ? 'text-[#3d424b]' : 'text-[#b42318]'}`}>{status}</p>
      <dl className="mt-3 border-t border-[#eef0f3] pt-1.5">
        <SpecRow label={tr("Network")}>{tr(networkLabel())}</SpecRow>
        <SpecRow label={tr("Open until")}>{expires.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</SpecRow>
      </dl>
      {!isMe && state.kind === 'open' && (
        token && loadLimits().receiveOnly
          ? <p className="mt-3 text-[12.5px] text-[#3d424b]">{tr("This device is set to receive only. Change it in Settings, Payments.")}</p>
          : token
          ? <button type="button" className={`${BTN} mt-3`} onClick={pay}>{tr("Pay privately")}</button>
          : betaApplies() && BETA_TOKENS.some((t) => t.address.toLowerCase() === req.token.address)
            ? <p className="mt-3 text-[12.5px] text-[#3d424b]">{tr("cUSDC payments are in a closed beta. {0}", { 0: <Link href="/beta" className="font-semibold text-[#2754d6] hover:underline">{tr("Join with an invitation")}</Link> })}</p>
            : <p className="mt-3 text-[12.5px] text-[#3d424b]">{tr("This token is not available in your private wallet.")}</p>
      )}
      <DisclosurePanel action="request" compact />
    </PaymentCardFrame>
  );
});
