import { describe, expect, it } from 'vitest';
import { formatFeeJuice, paymentDisclosure } from '@/lib/payments/disclosure';

const AZ = 10n ** 18n;

describe('payment disclosure', () => {
  it('rounds Fee Juice up, never down', () => {
    expect(formatFeeJuice(0n)).toBe('0');
    expect(formatFeeJuice(AZ)).toBe('1');
    expect(formatFeeJuice(AZ + 1n)).toBe('1.0001');
    expect(formatFeeJuice((AZ * 25n) / 10n)).toBe('2.5');
  });

  it('test network: the sponsor pays, the amount and recipient stay private', () => {
    const d = paymentDisclosure({ network: 'testnet', peerName: 'Ana' });
    expect(d.private).toContain('The amount');
    expect(d.private.join(' ')).toContain('Ana');
    expect(d.fee).toMatch(/sponsored fee contract/);
    expect(d.feeProblem).toBeUndefined();
  });

  it('Alpha: the fee payer is public and the maximum fee is named', () => {
    const d = paymentDisclosure({ network: 'mainnet', peerName: 'Ana', fee: { balance: 3n * AZ, minForTx: 2n * AZ, plan: 'balance' } });
    expect(d.public.join(' ')).toMatch(/fee your account pays/);
    expect(d.fee).toContain('at most 2 Fee Juice');
    expect(d.fee).toContain('you hold 3');
    expect(d.feeProblem).toBeUndefined();
  });

  it('Alpha: a balance below the maximum fee blocks before proving', () => {
    expect(paymentDisclosure({ network: 'mainnet', peerName: '', fee: { balance: AZ, minForTx: 2n * AZ, plan: 'top-up' } }).feeProblem).toMatch(/does not cover/);
    expect(paymentDisclosure({ network: 'mainnet', peerName: '', fee: { balance: 0n, minForTx: 0n, plan: 'bridge' } }).feeProblem).toMatch(/no Fee Juice/);
    expect(paymentDisclosure({ network: 'mainnet', peerName: '', fee: { balance: 0n, minForTx: 2n * AZ, plan: 'wait-claim' } }).feeProblem).toMatch(/not reached Aztec/);
  });

  it('Alpha: a deposit claimed by this payment pays the fee', () => {
    const d = paymentDisclosure({ network: 'mainnet', peerName: '', fee: { balance: 0n, minForTx: 2n * AZ, plan: 'claim' } });
    expect(d.feeProblem).toBeUndefined();
    expect(d.fee).toMatch(/claims/);
  });

  it('never claims the fee payer is private on Alpha', () => {
    const d = paymentDisclosure({ network: 'mainnet', peerName: '', fee: { balance: 3n * AZ, minForTx: AZ, plan: 'balance' } });
    expect(d.private.join(' ')).not.toMatch(/fee/i);
  });
});
