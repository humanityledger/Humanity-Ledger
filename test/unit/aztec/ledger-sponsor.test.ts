import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// P1: the Ledger sponsor. Source-level checks of the rules that must not drift.
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('Ledger sponsor (P1)', () => {
  it('the contract checks the signer, signature, expiry, one use and the fee cap before paying', () => {
    const c = read('contracts/aztec/sponsor/src/main.nr');
    const order = ['voucher expired', 'unknown signer', 'bad signature', 'fee above cap', 'push_nullifier_unsafe', 'set_as_fee_payer', 'end_setup'].map((k) => c.indexOf(k));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // Fees compared as Fields, never through a truncating u128 cast.
    expect(c).toMatch(/max_fee\.lt\(cap\) \| \(max_fee == cap\)/);
  });

  it('the server digest and the contract digest use the same layout', () => {
    expect(read('contracts/aztec/sponsor/src/voucher.nr')).toMatch(/0x48, 0x4c, 0x2d, 0x53, 0x50, 0x4f, 0x4e, 0x53, 0x4f, 0x52, 0x2d, 0x56, 0x32, 0, 0, 0/);
    expect(read('lib/aztec/sponsor-voucher.ts')).toContain("Buffer.from('HL-SPONSOR-V2\\0\\0\\0', 'latin1')");
  });

  it('the wallet only falls back to the sponsor when the user has no usable Fee Juice', () => {
    const w = read('lib/aztec/wallet/client.ts');
    expect(w).toMatch(/const sponsored = state\.plan !== 'claim' \? await this\.trySponsor\(\) : null;/);
    // resolveFee: an account with its own Fee Juice is never sponsored; the sponsor comes last.
    const rf = w.slice(w.indexOf('private async resolveFee('), w.indexOf('async bridgeFeeJuice('));
    expect(rf.indexOf("if (state.plan === 'balance') return { fee: undefined };")).toBeGreaterThan(0);
    expect(rf.indexOf("if (state.plan === 'balance') return { fee: undefined };")).toBeLessThan(rf.indexOf('this.trySponsor()'));
    expect(read('lib/aztec/wallet/ledger-sponsor.ts')).toMatch(/AZTEC_WALLET_CONFIG\.network === 'mainnet' && ADDRESS_RE\.test\(a\)/);
  });

  it('vouchers need a signed-in wallet and take a slot in both limits or in neither', () => {
    const r = read('app/api/aztec/sponsor/route.ts');
    expect(r).toMatch(/requireWallet\(req\)/);
    // The path is public in middleware.ts (so the GET can be read without a session): the POST
    // must check the session itself, first.
    expect(r.indexOf('requireWallet(req)')).toBeLessThan(r.indexOf('takeSponsorSlot('));
    expect(r.slice(r.indexOf('export async function POST'), r.indexOf('requireWallet(req)'))).not.toMatch(/sign|Redis|slot/i);
    // Behaviour of the quota itself: test/unit/aztec/sponsor-quota.test.ts.
    expect(r).toMatch(/takeSponsorSlot\(redisQuotaStore\(redis\), wallet, \{ perWallet, perDay \}\)/);
    expect(r).not.toMatch(/checkRateLimit/);
    // Nothing is counted while the server cannot sign (no key, no binding), and an unavailable
    // store refuses instead of falling back to per-process limits.
    expect(r.indexOf('!sponsorPublicKey()')).toBeGreaterThan(0);
    expect(r.indexOf('!sponsorPublicKey()')).toBeLessThan(r.indexOf('takeSponsorSlot('));
    expect(r).toMatch(/quota === 'unavailable'[\s\S]{0,200}status: 503/);
  });

  it('a sponsored fee is never sent without estimated gas limits (its voucher would be wasted)', () => {
    const w = read('lib/aztec/wallet/client.ts');
    expect(w.match(/if \(this\.sponsoredWithoutLimits\(fee, (deployGas|gasSettings)\)\) \{/g)?.length).toBe(2);
    expect(w).toMatch(/return !gasSettings && !!fee && typeof fee === 'object' && this\.sponsoredFees\.has\(fee\);/);
    // Only estimated transactions may be sponsored; the operator's own transactions are not.
    expect(w).toMatch(/const sponsored = opts\?\.estimated \? await this\.trySponsor\(\) : null;/);
    // The check sits after the estimate and before the send, in both places.
    for (const [est, send] of [['estimatedGasSettings(deploy,', 'deploy.send('], ['estimatedGasSettings(interaction,', 'interaction.send(']]) {
      const i = w.indexOf(est), g = w.indexOf('sponsoredWithoutLimits(fee', i), sd = w.indexOf(send, i);
      expect(i > 0 && g > i && sd > g).toBe(true);
    }
  });
});
