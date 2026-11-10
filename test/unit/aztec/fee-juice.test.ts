import { describe, it, expect } from 'vitest';

import {
  assertNodeFeeJuiceMatchesPins,
  bridgeFeeJuice,
  feePlan,
  loadClaims,
  mergeClaims,
  nextSecretIndex,
  pinnedFeeJuice,
  saveClaims,
  type FeeJuiceClaim,
  type L1Clients,
} from '@/lib/aztec/fee-juice';
import { deriveAccountKeys, deriveFeeJuiceClaimSecrets, WALLET_TYPED_DATA, WALLET_TYPED_DATA_ALPHA } from '@/lib/aztec/wallet/keys';
import { assertNetworkAllowed } from '@/lib/aztec/wallet/config';

const FR = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
const FQ = 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47n;
const SIG = '0x' + 'ab'.repeat(65);
const ME = '0x' + '11'.repeat(32);

const claim = (over: Partial<FeeJuiceClaim> = {}): FeeJuiceClaim => ({
  recipient: ME,
  claimAmount: '1000000000000000000',
  secretIndex: 0,
  messageHash: '0x' + 'aa'.repeat(32),
  messageLeafIndex: '42',
  createdAt: 1,
  ...over,
});

describe('pins', () => {
  it('uses the pinned Alpha portal and AZTEC token', () => {
    const p = pinnedFeeJuice('mainnet');
    expect(p.l1ChainId).toBe(1);
    expect(p.portal).toBe('0x534361be805CA30Bdb6404eC5E6cDAFFB3E9f3b3');
    expect(p.token).toBe('0xA27EC0006e59f245217Ff08CD52A7E8b169E62D2');
  });

  it('refuses a node that reports another portal or token', () => {
    const p = pinnedFeeJuice('mainnet');
    expect(() => assertNodeFeeJuiceMatchesPins('mainnet', { feeJuicePortalAddress: p.portal.toLowerCase(), feeJuiceAddress: p.token })).not.toThrow();
    expect(() => assertNodeFeeJuiceMatchesPins('mainnet', { feeJuicePortalAddress: '0x' + '66'.repeat(20), feeJuiceAddress: p.token })).toThrow(/different Fee Juice/);
    expect(() => assertNodeFeeJuiceMatchesPins('mainnet', undefined)).toThrow(/different Fee Juice/);
  });
});

describe('feePlan', () => {
  const base = { network: 'mainnet' as const, hasSponsor: false, feeJuiceBalance: 0n, minBalance: 1n, claims: [] };

  it('never sponsors on Alpha, even if a sponsor is claimed', () => {
    expect(feePlan({ ...base, hasSponsor: true }).kind).toBe('bridge');
    expect(feePlan({ ...base, network: 'testnet', hasSponsor: true }).kind).toBe('sponsored');
  });

  it('claims a ready deposit before using the balance', () => {
    const c = claim();
    expect(feePlan({ ...base, feeJuiceBalance: 10n ** 18n, claims: [{ claim: c, ready: true }] })).toEqual({ kind: 'claim', claim: c });
  });

  it('pays from the balance, waits for a deposit in flight, or asks to bridge', () => {
    expect(feePlan({ ...base, feeJuiceBalance: 5n }).kind).toBe('balance');
    expect(feePlan({ ...base, claims: [{ claim: claim(), ready: false }] }).kind).toBe('wait-claim');
    expect(feePlan(base).kind).toBe('bridge');
  });
});

describe('claims', () => {
  it('stores without secrets, merges by message hash and never reuses a secret index', () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const a = claim();
    const b = claim({ messageHash: '0x' + 'bb'.repeat(32), secretIndex: 1, createdAt: 2 });
    saveClaims(ME, mergeClaims([a], [b, { ...a, l1TxHash: '0x01' }]), storage);
    const back = loadClaims(ME, storage);
    expect(back.length).toBe(2);
    expect(back[0].l1TxHash).toBe('0x01');
    expect(JSON.stringify(back)).not.toMatch(/secret"/i);
    expect(nextSecretIndex(back)).toBe(2);
    expect(nextSecretIndex(back, [2, 3])).toBe(4);
  });
});

describe('key derivation per network', () => {
  it('derives deterministic claim secrets, distinct from the account keys', async () => {
    const [a, b] = await Promise.all([deriveFeeJuiceClaimSecrets(SIG, 4, FR), deriveFeeJuiceClaimSecrets(SIG, 4, FR)]);
    expect(a).toEqual(b);
    expect(new Set(a.map(String)).size).toBe(4);
    const keys = await deriveAccountKeys(SIG, FR, FQ);
    expect(a.includes(keys.secret)).toBe(false);
    expect(a.every((x) => x > 0n && x < FR)).toBe(true);
  });

  it('asks Alpha users to sign a different message, naming real funds', () => {
    expect(WALLET_TYPED_DATA_ALPHA.message.network).toMatch(/Alpha.*Real funds/);
    expect(WALLET_TYPED_DATA_ALPHA.message.network).not.toBe(WALLET_TYPED_DATA.message.network);
  });
});

describe('assertNetworkAllowed', () => {
  it('keeps refusing mainnet unless Alpha is configured and enabled', () => {
    expect(() => assertNetworkAllowed(1, { network: 'testnet', alphaEnabled: true })).toThrow(/test network/);
    expect(() => assertNetworkAllowed(1, { network: 'mainnet', alphaEnabled: false })).toThrow(/not enabled/);
    expect(() => assertNetworkAllowed(11155111, { network: 'mainnet', alphaEnabled: true })).toThrow(/does not settle/);
    expect(() => assertNetworkAllowed(1, { network: 'mainnet', alphaEnabled: true })).not.toThrow();
    expect(() => assertNetworkAllowed(11155111, { network: 'testnet', alphaEnabled: false })).not.toThrow();
  });
});

describe('bridgeFeeJuice (L1)', () => {
  function fakeL1(over: Partial<L1Clients> & { balance?: bigint; allowance?: bigint } = {}) {
    const calls: { fn: string; args: any }[] = [];
    const l1: L1Clients = {
      account: ('0x' + '22'.repeat(20)) as `0x${string}`,
      chainId: 1,
      readContract: async (a: any) => (a.functionName === 'balanceOf' ? over.balance ?? 10n ** 21n : over.allowance ?? 0n),
      estimateContractGas: async () => 100_000n,
      writeContract: async (a: any) => {
        calls.push({ fn: a.functionName, args: a });
        return ('0x' + '33'.repeat(32)) as `0x${string}`;
      },
      waitForTransactionReceipt: async () => ({ status: 'success', logs: [], transactionHash: '0x' + '33'.repeat(32) }),
      ...over,
    };
    return { l1, calls };
  }
  const args = { network: 'mainnet' as const, recipient: ME, amount: 10n ** 18n, secretHash: '0x' + '44'.repeat(32), secretIndex: 0 };

  it('refuses the wrong L1 chain and an insufficient AZTEC balance before sending anything', async () => {
    const wrong = fakeL1({ chainId: 11155111 });
    await expect(bridgeFeeJuice(wrong.l1, args)).rejects.toThrow(/Switch your wallet to Ethereum Mainnet/);
    const poor = fakeL1({ balance: 1n });
    await expect(bridgeFeeJuice(poor.l1, args)).rejects.toThrow(/not hold enough AZTEC/);
    expect(wrong.calls.length + poor.calls.length).toBe(0);
  });

  it('approves the exact amount to the pinned portal, deposits with double gas, and stops if no event is found', async () => {
    const { l1, calls } = fakeL1();
    // No logs in the receipt: the deposit must not be reported as a claim.
    await expect(bridgeFeeJuice(l1, args)).rejects.toThrow(/event was not found/);
    expect(calls[0].fn).toBe('approve');
    expect(calls[0].args.args[0]).toBe(pinnedFeeJuice('mainnet').portal);
    expect(calls[0].args.args[1]).toBe(10n ** 18n);
    expect(calls[1].fn).toBe('depositToAztecPublic');
    expect(calls[1].args.address).toBe(pinnedFeeJuice('mainnet').portal);
    expect(calls[1].args.gas).toBe(200_000n);
    expect(calls[1].args.args[0]).toBe(ME);
  });

  it('skips the approval when the allowance already covers the amount', async () => {
    const { l1, calls } = fakeL1({ allowance: 10n ** 18n });
    await expect(bridgeFeeJuice(l1, args)).rejects.toThrow(/event was not found/);
    expect(calls.map((c) => c.fn)).toEqual(['depositToAztecPublic']);
  });
});
