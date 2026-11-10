import { describe, it, expect } from 'vitest';
import { checkEvmSend, checkPrivateRail, gasReserve, invoicePayee, parseAmount } from '@/lib/payments/rails';

const ME = '0x' + '11'.repeat(20);
const YOU = '0x' + '22'.repeat(20);
const base = { gasLimit: 21_000n, maxFeePerGas: 10n ** 10n, walletChainId: 1, targetChainId: 1, recipient: YOU, sender: ME };

describe('public rail (Ethereum)', () => {
  it('reserves 1.25x gas, rounding up', () => {
    expect(gasReserve(21_000n, 10n ** 10n)).toBe(262_500_000_000_000n);
    expect(gasReserve(3n, 1n)).toBe(4n); // 3.75 -> 4
  });

  it('never lets a native send leave less than the gas reserve', () => {
    const eth = 10n ** 18n;
    const r = checkEvmSend({ ...base, kind: 'native', amount: eth, ethBalance: eth });
    expect(r.ok).toBe(false);
    expect(r.maxNative).toBe(eth - gasReserve(21_000n, 10n ** 10n));
    expect(checkEvmSend({ ...base, kind: 'native', amount: r.maxNative!, ethBalance: eth }).ok).toBe(true);
  });

  it('needs the token balance and ETH for gas on token sends', () => {
    expect(checkEvmSend({ ...base, kind: 'erc20', amount: 5n, tokenBalance: 4n, ethBalance: 10n ** 18n }).ok).toBe(false);
    expect(checkEvmSend({ ...base, kind: 'erc20', amount: 5n, tokenBalance: 5n, ethBalance: 1n })).toMatchObject({ ok: false });
    expect(checkEvmSend({ ...base, kind: 'erc20', amount: 5n, tokenBalance: 5n, ethBalance: 10n ** 18n }).ok).toBe(true);
  });

  it('refuses the wrong chain, a bad or zero address, and sending to yourself', () => {
    expect(checkEvmSend({ ...base, kind: 'native', amount: 1n, ethBalance: 10n ** 18n, walletChainId: 8453 })).toMatchObject({ ok: false });
    expect(checkEvmSend({ ...base, kind: 'native', amount: 1n, ethBalance: 10n ** 18n, recipient: '0x' + '0'.repeat(40) })).toMatchObject({ ok: false });
    expect(checkEvmSend({ ...base, kind: 'native', amount: 1n, ethBalance: 10n ** 18n, recipient: ME })).toMatchObject({ ok: false });
  });

  it('parses amounts without floats, exponents or signs', () => {
    expect(parseAmount('1.5', 6)).toBe(1_500_000n);
    expect(parseAmount('0.1', 18)).toBe(10n ** 17n);
    expect(parseAmount('1.', 6)).toBe(1_000_000n);
    for (const bad of ['1e3', '-1', '', '.', '1.2345678', 'abc']) expect(parseAmount(bad, 6)).toBeNull();
  });
});

describe('private rail (Aztec)', () => {
  const ok = { walletPhase: 'ready', payeeAztec: '0x' + 'ab'.repeat(32), payeeVerified: true, tokenConfigured: true, network: 'mainnet' as const, feePlan: 'balance' };

  it('requires a verified payee on Alpha, but not on the test network', () => {
    expect(checkPrivateRail(ok).ok).toBe(true);
    expect(checkPrivateRail({ ...ok, payeeVerified: false }).ok).toBe(false);
    expect(checkPrivateRail({ ...ok, payeeVerified: false, network: 'testnet' }).ok).toBe(false);
  });

  it('refuses when the wallet is closed, no address was shared, or fees cannot be paid', () => {
    expect(checkPrivateRail({ ...ok, walletPhase: 'needs-fee-juice' }).ok).toBe(false);
    expect(checkPrivateRail({ ...ok, payeeAztec: undefined }).ok).toBe(false);
    expect(checkPrivateRail({ ...ok, feePlan: 'bridge' }).ok).toBe(false);
    expect(checkPrivateRail({ ...ok, feePlan: 'wait-claim' }).ok).toBe(false);
    expect(checkPrivateRail({ ...ok, tokenConfigured: false }).ok).toBe(false);
    expect(checkPrivateRail({ ...ok, selfAztec: ok.payeeAztec }).ok).toBe(false);
  });

  it('pays the invoice issuer, never the payer', () => {
    expect(invoicePayee({ senderAddress: YOU }, ME)).toEqual({ ok: true, payee: YOU });
    expect(invoicePayee({ senderAddress: ME }, ME).ok).toBe(false);
    expect(invoicePayee({ senderAddress: 'zk:alice' }, ME).ok).toBe(false);
  });
});
