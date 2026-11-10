/**
 * R-11: a private payment from a DM goes only to the pinned peer address, and
 * on Alpha only with a fresh G7 proof, the acknowledgement and a cap. Every
 * refusal happens before anything is proven or sent.
 */
import { describe, it, expect } from 'vitest';
import { checkDirectPaymentPolicy, directPaymentMessage, sendDirectPrivatePayment, type DirectPaymentDeps } from '@/lib/payments/direct-private';

const PEER = '0x' + '1a'.repeat(32);
const TOKEN = '0x' + 'cd'.repeat(32);
const HASH = '0x' + 'ef'.repeat(32);
const ACK = { unaudited: true, publicFeePayer: true };

function deps(o: { l1ChainId?: number; network?: 'testnet' | 'mainnet'; alphaEnabled?: boolean; address?: string; verified?: boolean; cap?: bigint; hash?: string } = {}) {
  const sent: unknown[][] = [];
  const d: DirectPaymentDeps = {
    nodeInfo: async () => ({ l1ChainId: o.l1ChainId ?? 1 }),
    binding: async () => ({ address: 'address' in o ? o.address : PEER, verified: o.verified ?? true }),
    send: async (...a) => {
      sent.push(a);
      return { txHash: o.hash ?? HASH };
    },
    config: { network: o.network ?? 'mainnet', alphaEnabled: o.alphaEnabled ?? true, agreementCaps: o.cap === undefined ? { [TOKEN]: 100n * 10n ** 6n } : { [TOKEN]: o.cap } },
    tokenOf: () => ({ address: TOKEN, decimals: 6 }),
  };
  return { d, sent };
}
const req = { token: 'USDC' as const, amount: '5', dmPeerInboxId: 'peerinbox', selfInboxId: 'meinbox', ack: ACK };

describe('sendDirectPrivatePayment', () => {
  it('sends to the pinned address on Alpha with G7, acknowledgement and cap', async () => {
    const { d, sent } = deps();
    expect(await sendDirectPrivatePayment(req, d)).toEqual({ txHash: HASH, payee: PEER });
    expect(sent).toEqual([['USDC', '5', PEER]]);
  });

  it('refuses on Alpha without a verified G7 binding, before sending', async () => {
    const { d, sent } = deps({ verified: false });
    await expect(sendDirectPrivatePayment(req, d)).rejects.toThrow(/G7/);
    expect(sent).toEqual([]);
  });

  it('refuses on Alpha without the fee-payer or audit acknowledgement, before sending', async () => {
    const a = deps();
    await expect(sendDirectPrivatePayment({ ...req, ack: { unaudited: true, publicFeePayer: false } }, a.d)).rejects.toThrow(/fee payer is public/);
    await expect(sendDirectPrivatePayment({ ...req, ack: undefined }, a.d)).rejects.toThrow(/unaudited/);
    expect(a.sent).toEqual([]);
  });

  it('refuses a node on another network than the build, or Alpha not enabled, before sending', async () => {
    const a = deps({ l1ChainId: 11155111 });
    await expect(sendDirectPrivatePayment(req, a.d)).rejects.toThrow(/different network/);
    const b = deps({ alphaEnabled: false });
    await expect(sendDirectPrivatePayment(req, b.d)).rejects.toThrow(/not enabled/);
    expect([...a.sent, ...b.sent]).toEqual([]);
  });

  it('refuses without a pinned address, above the cap, and with no valid hash after sending', async () => {
    const a = deps({ address: undefined });
    await expect(sendDirectPrivatePayment(req, a.d)).rejects.toThrow(/has not shared/);
    const b = deps({ cap: 1n });
    await expect(sendDirectPrivatePayment(req, b.d)).rejects.toThrow(/cap/);
    expect([...a.sent, ...b.sent]).toEqual([]);
    const c = deps({ hash: '' });
    await expect(sendDirectPrivatePayment(req, c.d)).rejects.toThrow(/no transaction hash/);
  });

  it('requires G7 on the test network too, but not the Alpha acknowledgement', async () => {
    const v1 = deps({ l1ChainId: 11155111, network: 'testnet', alphaEnabled: false, verified: false });
    await expect(sendDirectPrivatePayment({ ...req, ack: undefined }, v1.d)).rejects.toThrow(/G7/);
    expect(v1.sent).toEqual([]);
    const { d, sent } = deps({ l1ChainId: 11155111, network: 'testnet', alphaEnabled: false, verified: true });
    expect((await sendDirectPrivatePayment({ ...req, ack: undefined }, d)).txHash).toBe(HASH);
    expect(sent.length).toBe(1);
  });
});

describe('checkDirectPaymentPolicy', () => {
  const base = { network: 'mainnet' as const, token: TOKEN, amount: 5n, caps: { [TOKEN]: 10n }, peerVerified: true, acknowledgedUnaudited: true, acknowledgedPublicFeePayer: true };
  it('refuses a non-positive amount everywhere, and a missing cap on Alpha', () => {
    expect(checkDirectPaymentPolicy(base)).toEqual({ ok: true });
    expect(checkDirectPaymentPolicy({ ...base, network: 'testnet', amount: 0n }).ok).toBe(false);
    expect(checkDirectPaymentPolicy({ ...base, caps: {} })).toEqual({ ok: false, reasons: ['no amount cap configured for this token on mainnet'] });
  });
});

describe('directPaymentMessage', () => {
  it('always carries the hash and never claims unlinkability on Alpha', () => {
    const m = directPaymentMessage({ token: 'USDC', txHash: HASH, network: 'mainnet' });
    expect(m).toContain(HASH);
    expect(m).toMatch(/paid publicly/);
    expect(m).not.toMatch(/test tokens/);
    expect(directPaymentMessage({ token: 'USDC', txHash: HASH, network: 'testnet' })).toMatch(/test tokens/);
  });
});
