'use client';

/**
 * "Request a payment": ask the person in this conversation for a private payment
 * (lib/payments/payment-message.ts, hl.payment_request). The request names a token, an amount, an
 * optional note and an expiry; it carries no address. Whoever pays, pays the address pinned for
 * this conversation, through the same checks as any private payment.
 */

import React, { useMemo, useState } from 'react';
import { parseUnits } from '@/lib/aztec/wallet/amounts';
import { AZTEC_WALLET_CONFIG, networkLabel, type TokenKey } from '@/lib/aztec/wallet/config';
import { MAX_MEMO, buildPaymentRequest } from '@/lib/payments/payment-message';
import { REQUEST_VALIDITY, requestDraftProblem } from '@/lib/payments/request-draft';

const field = 'w-full h-11 rounded-xl border border-[#e4e7ec] px-3 text-[16px] text-[#15171c] bg-white';

export function PaymentRequestComposer({ peerName, onClose, onSend }: { peerName?: string; onClose: () => void; onSend: (message: string) => void }) {
  const tokens = AZTEC_WALLET_CONFIG.tokens;
  const alpha = AZTEC_WALLET_CONFIG.network === 'mainnet';
  const [key, setKey] = useState<TokenKey | ''>(tokens[0]?.key ?? '');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [validity, setValidity] = useState<number>(REQUEST_VALIDITY[1].ms);
  const token = tokens.find((t) => t.key === key);

  const units = useMemo(() => {
    if (!token || !amount.trim()) return null;
    try {
      return parseUnits(amount, token.decimals);
    } catch {
      return null;
    }
  }, [amount, token]);
  const cap = token ? AZTEC_WALLET_CONFIG.agreementCaps[token.address.toLowerCase()] : undefined;
  const problem = token ? requestDraftProblem({ units, cap, alpha }) : 'No private token is available in your wallet yet.';

  const send = () => {
    if (problem || !token || units === null) return;
    onSend(buildPaymentRequest({ network: AZTEC_WALLET_CONFIG.network, token: { symbol: token.symbol, address: token.address }, amount: units, memo, validForMs: validity }));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-stretch justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-[420px] overflow-y-auto bg-white p-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4"
        role="dialog"
        aria-label="Request a payment"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-semibold text-[#15171c]">Request a payment</h2>
        <p className="text-[13px] text-[#727a88] leading-snug">
          {peerName || 'This person'} can pay it privately on {networkLabel()}. The payment goes to the address verified in this chat.
        </p>
        <label className="block text-[13px] text-[#4a505c]">
          Token
          <select className={`${field} mt-1`} value={key} onChange={(e) => setKey(e.target.value as TokenKey)} disabled={!tokens.length}>
            {tokens.map((t) => <option key={t.key} value={t.key}>{alpha ? t.symbol : `${t.symbol} (test)`}</option>)}
          </select>
        </label>
        <label className="block text-[13px] text-[#4a505c]">
          Amount
          <input className={`${field} mt-1`} inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(',', '.'))} />
        </label>
        <label className="block text-[13px] text-[#4a505c]">
          Note (optional)
          <input className={`${field} mt-1`} maxLength={MAX_MEMO} autoComplete="off" value={memo} onChange={(e) => setMemo(e.target.value)} />
        </label>
        <label className="block text-[13px] text-[#4a505c]">
          Valid for
          <select className={`${field} mt-1`} value={validity} onChange={(e) => setValidity(Number(e.target.value))}>
            {REQUEST_VALIDITY.map((v) => <option key={v.ms} value={v.ms}>{v.label}</option>)}
          </select>
        </label>
        {amount.trim() && problem && <p role="status" className="text-[13px] text-[#7a2d24]">{problem}</p>}
        <button type="button" className="w-full min-h-[44px] rounded-full bg-[#15171c] text-white text-[14.5px] font-semibold disabled:opacity-50" disabled={!!problem} onClick={send}>
          Send request
        </button>
        <button type="button" className="w-full min-h-[44px] text-[13.5px] text-[#4a505c]" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

export default PaymentRequestComposer;
