/**
 * Smart contract wallets register with XMTP as SCW on their chain (lib/xmtp/wallet-kind.ts).
 * Registered as EOA they had no inbox, and messages to them never arrived.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { chainsToCheck, detectWalletKind, isDelegatedEoa, isPlainEcdsa, kindFromCode, SCW_CHAINS } from '@/lib/xmtp/wallet-kind';

const A = '0x' + '11'.repeat(20);

describe('wallet kind', () => {
  it('no code is a plain key', () => {
    expect(kindFromCode('0x', 1)).toBeNull();
    expect(kindFromCode(undefined, 1)).toBeNull();
    expect(kindFromCode('0x00', 1)).toBeNull();
  });

  it('contract code is a smart contract wallet on that chain', () => {
    expect(kindFromCode('0x6080604052', 8453)).toEqual({ type: 'SCW', chainId: 8453 });
  });

  it('an EIP-7702 delegated account keeps signing as EOA', () => {
    const code = '0xef0100' + 'ab'.repeat(20);
    expect(isDelegatedEoa(code)).toBe(true);
    expect(kindFromCode(code, 1)).toEqual({ type: 'EOA' });
  });

  it('the wallet chain is checked first, without repeats', () => {
    expect(chainsToCheck(8453)[0]).toBe(8453);
    expect(new Set(chainsToCheck(8453)).size).toBe(chainsToCheck(8453).length);
    expect(chainsToCheck(undefined)).toEqual([...SCW_CHAINS]);
    expect(chainsToCheck(11155111)[0]).toBe(11155111);
  });

  it('finds a Coinbase Smart Wallet on Base when the wallet is on mainnet', async () => {
    const k = await detectWalletKind(A, 1, async (c) => (c === 8453 ? '0x363d3d373d3d' : '0x'));
    expect(k).toEqual({ type: 'SCW', chainId: 8453 });
  });

  it('prefers the chain the wallet is on when the contract exists on several', async () => {
    const k = await detectWalletKind(A, 10, async () => '0x6080');
    expect(k).toEqual({ type: 'SCW', chainId: 10 });
  });

  it('RPC failures never block sign-in: EOA', async () => {
    const k = await detectWalletKind(A, 1, async () => { throw new Error('rpc down'); });
    expect(k).toEqual({ type: 'EOA' });
  });

  it('a 65-byte signature is ECDSA; ERC-1271/6492 signatures are not', () => {
    expect(isPlainEcdsa('0x' + 'ab'.repeat(65))).toBe(true);
    expect(isPlainEcdsa('0x' + 'ab'.repeat(64))).toBe(false);
    expect(isPlainEcdsa('0x' + 'ab'.repeat(300) + '6492649264926492649264926492649264926492649264926492649264926492')).toBe(false);
  });
});

describe('XMTP client wiring', () => {
  const src = readFileSync('lib/xmtp/client.ts', 'utf8');
  it('the signer type comes from the detected kind, never a fixed EOA', () => {
    expect(src).not.toMatch(/type:\s*'EOA'\s+as const,\s*\n\s*\/\/ getIdentifier/);
    expect(src).toMatch(/type: kind\.type/);
    expect(src).toMatch(/getChainId: \(\) => BigInt\(scwChain\)/);
  });
  it('a non-ECDSA signature registered as EOA is retried as SCW', () => {
    expect(src).toMatch(/isPlainEcdsa\(lastSignature\)/);
    expect(src).toMatch(/type: 'SCW', chainId/);
  });
  it('a recipient without an inbox is named, not retried four times', () => {
    expect(src).toMatch(/throw new PeerNotOnXmtpError/);
  });
});
