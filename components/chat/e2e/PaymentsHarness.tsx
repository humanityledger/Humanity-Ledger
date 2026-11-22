'use client';
/**
 * Test-only: the payment flow between two sessions, with the real chat components and a simulated
 * wallet and network. Reachable only in builds with NEXT_PUBLIC_E2E_HARNESS=1, at
 * /chat?e2e=payments&as=alice (or &as=bob). scripts/ui/payments-e2e.mjs opens one page per person in
 * separate browser contexts and carries each posted message from one to the other.
 *
 * Real: PaymentRequestComposer, AgreementCard with PaymentCard and PaymentRequestCard, the
 * PAY_REQUEST_EVENT path, buildPaymentMessage with the request id, the paid-request record and
 * IncomingPaymentNotifier. Simulated: XMTP (the script moves messages), and the private wallet (its
 * snapshot is set here; proving and the Aztec network are covered by the G6 two-account session on a
 * real network, docs/chat/G6_SESSION_CHECKLIST.md).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Toaster } from 'sonner';
import { AgreementCard } from '@/components/chat/AgreementCard';
import { PaymentRequestComposer } from '@/components/chat/PaymentRequestComposer';
import { IncomingPaymentNotifier } from '@/components/chat/IncomingPaymentNotifier';
import { getPrivateWallet } from '@/lib/aztec/wallet/client';
import type { Activity } from '@/lib/aztec/wallet/history';
import { parseUnits } from '@/lib/aztec/wallet/amounts';
import { AZTEC_WALLET_CONFIG, tokenConfig } from '@/lib/aztec/wallet/config';
import { buildPaymentMessage } from '@/lib/payments/payment-message';
import { rememberPaidRequest } from '@/lib/payments/paid-requests';
import { PAY_REQUEST_EVENT, isPayPrefill } from '@/lib/payments/request-draft';

type Person = 'alice' | 'bob';
type Msg = { id: string; content: string; fromMe: boolean };

const AZTEC: Record<Person, string> = { alice: '0x' + 'a1'.repeat(32), bob: '0x' + 'b0'.repeat(32) };

export interface PaymentsHarnessApi {
  takeOutbox(): string[];
  deliver(content: string): void;
  addActivity(a: Activity): void;
}

declare global {
  interface Window {
    __paymentsHarness?: PaymentsHarnessApi;
  }
}

const hex32 = () => '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');

export default function PaymentsHarness() {
  const [as] = useState<Person>(() => (new URLSearchParams(window.location.search).get('as') === 'bob' ? 'bob' : 'alice'));
  const [messages, setMessages] = useState<Msg[]>([]);
  const [composer, setComposer] = useState(false);
  const outbox = useRef<string[]>([]);

  // The wallet's private setter: test-only, the same snapshot the real wallet publishes.
  const wallet = getPrivateWallet() as unknown as { set(p: object): void; state: { activity: Activity[] } };

  const post = useCallback((content: string) => {
    outbox.current.push(content);
    setMessages((m) => [...m, { id: crypto.randomUUID(), content, fromMe: true }]);
  }, []);

  useEffect(() => {
    wallet.set({ phase: 'ready', aztecAddress: AZTEC[as], activity: [], balances: [], busy: false });
    window.__paymentsHarness = {
      takeOutbox: () => outbox.current.splice(0),
      deliver: (content) => setMessages((m) => [...m, { id: crypto.randomUUID(), content, fromMe: false }]),
      addActivity: (a) => wallet.set({ activity: [...wallet.state.activity.filter((x) => x.id !== a.id), a] }),
    };
    // What ZkMoneyModal does after the wallet accepted the transaction, with a simulated send.
    const onPay = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!isPayPrefill(d)) return;
      const t = tokenConfig(d.token);
      const txHash = hex32();
      window.__paymentsHarness!.addActivity({ id: `send-${txHash}`, kind: 'send', token: d.token, amount: parseUnits(d.amount, t.decimals).toString(), txHash, status: 'pending', createdAt: Date.now() });
      post(buildPaymentMessage({ network: AZTEC_WALLET_CONFIG.network, token: { symbol: t.symbol, address: t.address }, txHash, sender: AZTEC[as], requestId: d.requestId }));
      rememberPaidRequest(d.requestId);
    };
    window.addEventListener(PAY_REQUEST_EVENT, onPay);
    return () => window.removeEventListener(PAY_REQUEST_EVENT, onPay);
  }, [as, post]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div data-testid="payments-harness" data-as={as} className="min-h-screen bg-[#F7F8FA] p-4 space-y-3">
      <Toaster />
      <IncomingPaymentNotifier />
      <div className="flex items-center justify-between">
        <h1 className="text-[17px] font-semibold text-[#15171C]">{as === 'alice' ? 'Alice' : 'Bob'}</h1>
        <button type="button" data-testid="request-payment" className="h-9 px-4 rounded-full bg-[#15171C] text-white text-[13.5px] font-semibold" onClick={() => setComposer(true)}>
          Request a payment
        </button>
      </div>
      {messages.map((m) => (
        <div key={m.id} data-testid="message" data-from-me={m.fromMe ? 'true' : 'false'} className={m.fromMe ? 'flex justify-end' : 'flex justify-start'}>
          <AgreementCard raw={m.content} isMe={m.fromMe} />
        </div>
      ))}
      {composer && <PaymentRequestComposer peerName={as === 'alice' ? 'Bob' : 'Alice'} onClose={() => setComposer(false)} onSend={post} />}
    </div>
  );
}
