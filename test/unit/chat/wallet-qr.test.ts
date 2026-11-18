import { describe, expect, it } from 'vitest';
import { walletAddressFromQr } from '@/lib/chat/wallet-qr';

const A = '0x812dA45cE9a1f27E1cBb1d8E0fA2b3C4d5E6D1Ea';
const T = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

describe('walletAddressFromQr: codes from other wallets', () => {
  it.each([
    [A, A],
    [`ethereum:${A}`, A],
    [`ethereum:${A}@1`, A],
    [`ethereum:${A}?value=1e16`, A],
    [`ethereum:pay-${A}@137`, A],
    [`ethereum:${T}/transfer?address=${A}&uint256=1000000`, A],
    [`https://etherscan.io/address/${A}`, A],
    [`https://link.trustwallet.com/send?coin=60&address=${A}`, A],
    [`  ${A.toLowerCase()}\n`, A.toLowerCase()],
  ])('%s', (input, expected) => {
    expect(walletAddressFromQr(input)).toBe(expected);
  });

  it('keeps an Aztec address whole and refuses text with no address', () => {
    const az = '0x' + 'ab'.repeat(32);
    expect(walletAddressFromQr(az)).toBe(az);
    expect(walletAddressFromQr('hello')).toBeNull();
    expect(walletAddressFromQr('0x1234')).toBeNull();
    expect(walletAddressFromQr('bitcoin:bc1qxyz')).toBeNull();
  });
});
