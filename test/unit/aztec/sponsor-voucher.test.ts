import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import crypto from 'node:crypto';
import { signVoucher, sponsorBinding, sponsorPublicKey, voucherDigestBytes } from '@/lib/aztec/sponsor-voucher';

const B = { contract: 0x1234n, chainId: 1n, version: 2070860440n };

describe('LedgerSponsor vouchers (server side)', () => {
  it('reproduces the V2 digest the contract test checks (instance 0x1234, chain 1, version 2070860440, voucher 1)', () => {
    const d = crypto.createHash('sha256').update(voucherDigestBytes(B, 1n, 4102444800)).digest('hex');
    expect(d).toBe('ddea223a4a3e37d8e09dfc6b8b83f88bfb0bdcf5186f8dddd5c55cf685a4df9d');
  });

  it('a voucher names one instance of one network (SP-5)', () => {
    const base = voucherDigestBytes(B, 1n, 4102444800);
    expect(voucherDigestBytes({ ...B, contract: 0x1235n }, 1n, 4102444800).equals(base)).toBe(false);
    expect(voucherDigestBytes({ ...B, chainId: 11155111n }, 1n, 4102444800).equals(base)).toBe(false);
    expect(voucherDigestBytes({ ...B, version: 679261766n }, 1n, 4102444800).equals(base)).toBe(false);
    const sponsor = '0x' + 'ab'.repeat(32);
    expect(sponsorBinding({ NEXT_PUBLIC_AZTEC_SPONSOR: sponsor, NEXT_PUBLIC_AZTEC_NETWORK: 'alpha' })).toEqual({ contract: BigInt(sponsor), chainId: 1n, version: 2070860440n });
    expect(sponsorBinding({ NEXT_PUBLIC_AZTEC_SPONSOR: sponsor })).toEqual({ contract: BigInt(sponsor), chainId: 11155111n, version: 679261766n });
    expect(sponsorBinding({ NEXT_PUBLIC_AZTEC_SPONSOR: 'nope' })).toBeNull();
  });

  it('signs low-s vouchers that verify against the published key', () => {
    process.env.AZTEC_SPONSOR_SIGNER_KEY = '11'.repeat(32);
    const v = signVoucher(B, 1_800_000_000)!;
    const pub = sponsorPublicKey()!;
    expect(pub.x).toBe('0x' + Buffer.from(v.signerX).toString('hex'));
    const s = BigInt('0x' + Buffer.from(v.signature.slice(32)).toString('hex'));
    expect(s <= BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141') / 2n).toBe(true);
    const der = Buffer.concat([Buffer.from([0x04]), Buffer.from(v.signerX), Buffer.from(v.signerY)]);
    const key = crypto.createPublicKey({ key: Buffer.concat([Buffer.from('3056301006072a8648ce3d020106052b8104000a034200', 'hex'), der]), format: 'der', type: 'spki' });
    const ok = crypto.verify('sha256', voucherDigestBytes(B, BigInt(v.voucherId), v.expiresAt), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(v.signature));
    expect(ok).toBe(true);
    expect(BigInt(v.voucherId) < 2n ** 248n).toBe(true);
    delete process.env.AZTEC_SPONSOR_SIGNER_KEY;
  });

  it('on Aztec Alpha never derives the signer from JWT_SECRET', () => {
    const prevNet = process.env.NEXT_PUBLIC_AZTEC_NETWORK;
    const prevKey = process.env.AZTEC_SPONSOR_SIGNER_KEY;
    delete process.env.AZTEC_SPONSOR_SIGNER_KEY;
    process.env.NEXT_PUBLIC_AZTEC_NETWORK = 'alpha';
    process.env.JWT_SECRET = 'a-long-test-secret-0123456789';
    expect(sponsorPublicKey()).toBeNull();
    expect(signVoucher(B, 1_000)).toBeNull();
    process.env.AZTEC_SPONSOR_SIGNER_KEY = '11'.repeat(32);
    expect(sponsorPublicKey()).not.toBeNull();
    if (prevNet === undefined) delete process.env.NEXT_PUBLIC_AZTEC_NETWORK; else process.env.NEXT_PUBLIC_AZTEC_NETWORK = prevNet;
    if (prevKey === undefined) delete process.env.AZTEC_SPONSOR_SIGNER_KEY; else process.env.AZTEC_SPONSOR_SIGNER_KEY = prevKey;
    delete process.env.JWT_SECRET;
  });

  it('derives a stable key from JWT_SECRET when no key is set, and none without either', () => {
    process.env.JWT_SECRET = 'a-long-test-secret-0123456789';
    const a = sponsorPublicKey(); const b = sponsorPublicKey();
    expect(a && b && a.x === b.x).toBe(true);
    delete process.env.JWT_SECRET;
    expect(sponsorPublicKey()).toBeNull();
  });
});
