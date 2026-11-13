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
    expect(w).toMatch(/if \(state\.plan === 'balance'\) return \{ fee: undefined \};\n    const sponsored = await this\.trySponsor\(\);/);
    expect(read('lib/aztec/wallet/ledger-sponsor.ts')).toMatch(/AZTEC_WALLET_CONFIG\.network === 'mainnet' && ADDRESS_RE\.test\(a\)/);
  });

  it('vouchers need a signed-in wallet and respect per-wallet and daily limits', () => {
    const r = read('app/api/aztec/sponsor/route.ts');
    expect(r).toMatch(/requireWallet\(req\)/);
    expect(r).toMatch(/max: perWallet/);
    expect(r).toMatch(/max: perDay, windowSec: 86400/);
  });
});
