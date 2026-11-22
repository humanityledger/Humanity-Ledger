/** Structured payment messages: strict parsing, no amount in a payment, and cards that trust only the wallet. */
import fs from 'node:fs';
import {
  MAX_MEMO, buildPaymentMessage, buildPaymentRequest, newMessageId, parsePaymentMessage, parsePaymentRequest, paymentCardState, requestCardState,
} from '@/lib/payments/payment-message';
import { paidRequestIds, rememberPaidRequest } from '@/lib/payments/paid-requests';
import { agreementMessageKind, agreementPreview, isAgreementMessage } from '@/lib/aztec/agreement-message';

const TOKEN = { symbol: 'cUSDC', address: '0x30112E52178143B74CF6037D047BBBA924F4B0DB8AAB587A340AACFC6ECB4F38' };
const TX = '0x' + 'ab'.repeat(32);
const ME = '0x' + 'cd'.repeat(32);

describe('payment message', () => {
  it('builds and parses, lower-casing addresses, and never carries an amount', () => {
    const text = buildPaymentMessage({ network: 'mainnet', token: TOKEN, txHash: TX.toUpperCase().replace('0X', '0x'), sender: ME, requestId: 'req_12345678', id: 'pay_12345678' });
    expect(text.startsWith('{"type":"hl.payment"')).toBe(true);
    const m = parsePaymentMessage(text)!;
    expect(m).toEqual({ type: 'hl.payment', version: 1, id: 'pay_12345678', network: 'mainnet', token: { symbol: 'cUSDC', address: TOKEN.address.toLowerCase() }, txHash: TX, sender: ME, requestId: 'req_12345678' });
    expect(text).not.toMatch(/amount/);
  });
  it('refuses anything malformed', () => {
    const ok = JSON.parse(buildPaymentMessage({ network: 'testnet', token: TOKEN, txHash: TX, id: 'pay_12345678' }));
    const bad = (patch: Record<string, unknown>) => parsePaymentMessage(JSON.stringify({ ...ok, ...patch }));
    expect(bad({ version: 2 })).toBeNull();
    expect(bad({ network: 'other' })).toBeNull();
    expect(bad({ txHash: '0x12' })).toBeNull();
    expect(bad({ id: 'x' })).toBeNull();
    expect(bad({ token: { symbol: 'cUSDC', address: '0x1' } })).toBeNull();
    expect(bad({ token: { symbol: '<script>', address: TOKEN.address } })).toBeNull();
    expect(parsePaymentMessage('I sent you a payment')).toBeNull();
    expect(parsePaymentMessage('{"type":"hl.payment"' + ' '.repeat(3000) + '}')).toBeNull();
    expect(bad({ sender: 'nope' })?.sender).toBeUndefined();
  });
  it('ids are random hex', () => {
    expect(newMessageId()).toMatch(/^[0-9a-f]{24}$/);
    expect(newMessageId()).not.toBe(newMessageId());
  });
});

describe('payment request', () => {
  it('builds with an expiry between one minute and 30 days and a short memo', () => {
    const now = Date.parse('2026-12-01T00:00:00Z');
    const r = parsePaymentRequest(buildPaymentRequest({ network: 'mainnet', token: TOKEN, amount: 2_500_000n, memo: '  dinner  ', validForMs: 86400_000, now, id: 'req_12345678' }))!;
    expect(r.amount).toBe('2500000');
    expect(r.memo).toBe('dinner');
    expect(r.expiresAt).toBe('2026-12-02T00:00:00.000Z');
    const long = parsePaymentRequest(buildPaymentRequest({ network: 'mainnet', token: TOKEN, amount: 1n, memo: 'x'.repeat(500), validForMs: 1e12, now }))!;
    expect(long.memo).toHaveLength(MAX_MEMO);
    expect(Date.parse(long.expiresAt) - now).toBe(30 * 86400_000);
    expect(() => buildPaymentRequest({ network: 'mainnet', token: TOKEN, amount: 0n, validForMs: 1, now })).toThrow(/above zero/);
  });
  it('refuses a zero, negative or non-decimal amount', () => {
    const ok = JSON.parse(buildPaymentRequest({ network: 'mainnet', token: TOKEN, amount: 5n, validForMs: 86400_000, id: 'req_12345678' }));
    for (const amount of ['0', '-1', '1e6', '0x10', 5]) expect(parsePaymentRequest(JSON.stringify({ ...ok, amount }))).toBeNull();
  });
  it('is open, paid, expired or on another network', () => {
    const req = parsePaymentRequest(buildPaymentRequest({ network: 'mainnet', token: TOKEN, amount: 5n, validForMs: 60_000, now: 0, id: 'req_12345678' }))!;
    expect(requestCardState(req, { network: 'mainnet', now: 1000, paidRequestIds: new Set() })).toEqual({ kind: 'open' });
    expect(requestCardState(req, { network: 'mainnet', now: 1000, paidRequestIds: new Set(['req_12345678']) })).toEqual({ kind: 'paid' });
    expect(requestCardState(req, { network: 'mainnet', now: 60_000, paidRequestIds: new Set() })).toEqual({ kind: 'expired' });
    expect(requestCardState(req, { network: 'testnet', now: 1000, paidRequestIds: new Set() })).toEqual({ kind: 'wrongNetwork' });
  });
});

describe('card state trusts only this wallet', () => {
  const msg = parsePaymentMessage(buildPaymentMessage({ network: 'mainnet', token: TOKEN, txHash: TX, id: 'pay_12345678' }))!;
  const base = { network: 'mainnet' as const, walletOpen: true };
  it('payer: from the wallet history of this device', () => {
    expect(paymentCardState(msg, { ...base, isMe: true, activity: [] })).toEqual({ kind: 'sent' });
    expect(paymentCardState(msg, { ...base, isMe: true, activity: [{ kind: 'send', txHash: TX, status: 'proving' }] })).toEqual({ kind: 'sending' });
    expect(paymentCardState(msg, { ...base, isMe: true, activity: [{ kind: 'send', txHash: TX, status: 'pending', amount: '5' }] })).toEqual({ kind: 'sent', amount: '5' });
    expect(paymentCardState(msg, { ...base, isMe: true, activity: [{ kind: 'send', txHash: TX.toUpperCase().replace('0X', '0x'), status: 'settled', amount: '5' }] })).toEqual({ kind: 'confirmed', amount: '5' });
    expect(paymentCardState(msg, { ...base, isMe: true, activity: [{ kind: 'send', txHash: TX, status: 'failed', error: 'x' }] })).toEqual({ kind: 'failed', error: 'x' });
  });
  it('receiver: received only once the wallet found the settled transfer', () => {
    expect(paymentCardState(msg, { ...base, isMe: false, activity: [] })).toEqual({ kind: 'awaiting', walletOpen: true });
    expect(paymentCardState(msg, { ...base, walletOpen: false, isMe: false, activity: [] })).toEqual({ kind: 'awaiting', walletOpen: false });
    expect(paymentCardState(msg, { ...base, isMe: false, activity: [{ kind: 'receive', txHash: TX, status: 'pending', amount: '5' }] })).toEqual({ kind: 'awaiting', walletOpen: true });
    expect(paymentCardState(msg, { ...base, isMe: false, activity: [{ kind: 'send', txHash: TX, status: 'settled', amount: '5' }] })).toEqual({ kind: 'awaiting', walletOpen: true });
    expect(paymentCardState(msg, { ...base, isMe: false, activity: [{ kind: 'receive', txHash: TX, status: 'settled', amount: '5' }] })).toEqual({ kind: 'received', amount: '5' });
    expect(paymentCardState(msg, { ...base, isMe: false, activity: [{ kind: 'receive', txHash: '0x' + '00'.repeat(32), status: 'settled', amount: '5' }] })).toEqual({ kind: 'awaiting', walletOpen: true });
  });
  it('another network is never shown as paid', () => {
    expect(paymentCardState(msg, { ...base, network: 'testnet', isMe: false, activity: [{ kind: 'receive', txHash: TX, status: 'settled' }] })).toEqual({ kind: 'wrongNetwork' });
  });
});

describe('in the chat', () => {
  it('payments are opaque messages with their own preview words', () => {
    const pay = buildPaymentMessage({ network: 'mainnet', token: TOKEN, txHash: TX });
    expect(isAgreementMessage(pay)).toBe(true);
    expect(agreementMessageKind(pay)).toBe('payment');
    expect(agreementPreview('payment')).toBe('Private payment');
  });
  it('the agreement card hands payments to their own card', () => {
    const src = fs.readFileSync('components/chat/AgreementCard.tsx', 'utf8');
    expect(src).toMatch(/if \(kind === 'payment'\) return <PaymentCard raw=\{raw\} isMe=\{isMe\} \/>;/);
  });
  it('the payment form posts the structured message', () => {
    const src = fs.readFileSync('components/chat/ZkMoneyModal.tsx', 'utf8');
    expect(src).toMatch(/buildPaymentMessage\(/);
    expect(src).not.toMatch(/onSuccess\(directPaymentMessage\(/);
  });
});

describe('paid requests on this device', () => {
  it('remembers ids only, without duplicates', () => {
    const m = new Map<string, string>();
    const s = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    rememberPaidRequest('req_1', s);
    rememberPaidRequest('req_1', s);
    rememberPaidRequest('req_2', s);
    expect([...paidRequestIds(s)]).toEqual(['req_1', 'req_2']);
    expect(paidRequestIds({ getItem: () => '{bad' }).size).toBe(0);
  });
});
