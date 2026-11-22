/** Payment requests: exact amounts, caps checked before sending, and a pay button that never names a payee. */
import fs from 'node:fs';
import { isPayPrefill, plainUnits, requestDraftProblem, REQUEST_VALIDITY } from '@/lib/payments/request-draft';
import { buildPaymentRequest } from '@/lib/payments/payment-message';
import { agreementMessageKind, agreementPreview, isAgreementMessage } from '@/lib/aztec/agreement-message';
import { parseUnits } from '@/lib/aztec/wallet/amounts';

const TOKEN = { symbol: 'cUSDC', address: '0x30112e52178143b74cf6037d047bbba924f4b0db8aab587a340aacfc6ecb4f38' };

describe('amounts', () => {
  it('prints base units as a plain decimal the payment form parses back exactly', () => {
    for (const [units, s] of [[1n, '0.000001'], [2_500_000n, '2.5'], [1_234_567_890_123n, '1234567.890123'], [5_000_000n, '5']] as const) {
      expect(plainUnits(units, 6)).toBe(s);
      expect(parseUnits(plainUnits(units, 6), 6)).toBe(units);
    }
    expect(plainUnits(10n ** 18n, 18)).toBe('1');
    expect(plainUnits(1_000_000_000_000n, 6)).not.toMatch(/,/);
  });
});

describe('draft', () => {
  it('needs an amount above zero', () => {
    expect(requestDraftProblem({ units: null, cap: 10n, alpha: true })).toMatch(/Enter an amount/);
    expect(requestDraftProblem({ units: 0n, cap: 10n, alpha: true })).toMatch(/above zero/);
  });
  it('on Alpha, never above the cap per payment, and never without one', () => {
    expect(requestDraftProblem({ units: 10n, cap: 10n, alpha: true })).toBeNull();
    expect(requestDraftProblem({ units: 11n, cap: 10n, alpha: true })).toMatch(/above the limit/);
    expect(requestDraftProblem({ units: 1n, cap: undefined, alpha: true })).toMatch(/No limit/);
  });
  it('on the test network there is no cap', () => {
    expect(requestDraftProblem({ units: 10n ** 30n, cap: undefined, alpha: false })).toBeNull();
  });
  it('offers 1, 7 and 30 days', () => {
    expect(REQUEST_VALIDITY.map((v) => v.ms)).toEqual([86400_000, 7 * 86400_000, 30 * 86400_000]);
  });
});

describe('pay button', () => {
  it('carries the request id, a wallet slot and a plain amount, never an address', () => {
    expect(isPayPrefill({ requestId: 'req_12345678', token: 'CUSDC', amount: '2.5' })).toBe(true);
    expect(isPayPrefill({ requestId: 'req_12345678', token: 'CUSDC', amount: '1,000' })).toBe(false);
    expect(isPayPrefill({ requestId: 'x', token: 'CUSDC', amount: '1' })).toBe(false);
    expect(isPayPrefill({ requestId: 'req_12345678', token: 'BTC', amount: '1' })).toBe(false);
    expect(isPayPrefill(null)).toBe(false);
    const card = fs.readFileSync('components/chat/PaymentRequestCard.tsx', 'utf8');
    expect(card).toMatch(/const detail: PayPrefill = \{ requestId: req\.id, token: token\.key, amount: plainUnits\(BigInt\(req\.amount\), token\.decimals\) \};/);
  });
});

describe('in the chat', () => {
  it('requests are opaque messages previewed as words', () => {
    const req = buildPaymentRequest({ network: 'mainnet', token: TOKEN, amount: 5n, validForMs: 60_000 });
    expect(isAgreementMessage(req)).toBe(true);
    expect(agreementMessageKind(req)).toBe('request');
    expect(agreementPreview('request')).toBe('Payment request');
  });
  it('the agreement card hands requests to their own card', () => {
    expect(fs.readFileSync('components/chat/AgreementCard.tsx', 'utf8')).toMatch(/if \(kind === 'request'\) return <PaymentRequestCard raw=\{raw\} isMe=\{isMe\} \/>;/);
  });
  it('paying a request fixes token and amount, names the request, and records it as paid', () => {
    const modal = fs.readFileSync('components/chat/ZkMoneyModal.tsx', 'utf8');
    expect(modal).toMatch(/requestId: prefill\?\.requestId/);
    expect(modal).toMatch(/rememberPaidRequest\(prefill\.requestId\)/);
    expect(modal).toMatch(/disabled=\{busy \|\| !!prefill\}/);
  });
  it('the chat opens the payment form from a request and the composer from the menu', () => {
    const chat = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');
    expect(chat).toMatch(/window\.addEventListener\(PAY_REQUEST_EVENT, onPay\)/);
    expect(chat).toMatch(/isPayPrefill\(detail\)/);
    expect(chat).toMatch(/prefill=\{payPrefill \?\? undefined\}/);
    expect(chat).toMatch(/setShowRequestComposer\(true\)/);
  });
});
