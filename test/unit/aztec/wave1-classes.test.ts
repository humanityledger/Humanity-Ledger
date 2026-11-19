/**
 * Package 4: the closed-alpha classes recorded in deployments/aztec-mainnet.json are the classes of
 * the committed artifacts (which the "Aztec contracts" workflow recompiles with 6.0.0 and fails on
 * when stale), and both sources keep the alpha limits: 100 HLC maximum (OD-2), no fee (OD-7), no
 * owner or pause that could block an exit.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { loadContractArtifact } from '@aztec-labs/aztec.js/abi';

const mainnet = JSON.parse(fs.readFileSync('deployments/aztec-mainnet.json', 'utf8'));
const ARTIFACTS = [
  'contracts/aztec/escrow/target/private_escrow-PrivateEscrow.json',
  'contracts/aztec/streams/target/payment_stream-PaymentStream.json',
];
const SOURCES = ['contracts/aztec/escrow/src/main.nr', 'contracts/aztec/streams/src/main.nr'];

describe('closed alpha wave 1 classes', () => {
  it('closedAlpha.classes are the class ids of the committed artifacts, in order', async () => {
    const { getContractClassFromArtifact } = await import('@aztec-labs/stdlib/contract');
    const ids: string[] = [];
    for (const a of ARTIFACTS) ids.push((await getContractClassFromArtifact(loadContractArtifact(JSON.parse(fs.readFileSync(a, 'utf8'))))).id.toString());
    expect(mainnet.closedAlpha.classes).toEqual(ids);
  });
  it('both sources: maximum 100 HLC (6 decimals), fee zero, no owner and no pause', () => {
    for (const f of SOURCES) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src).toMatch(/global MAX_AMOUNT: u128 = 100000000;/);
      expect(src).toMatch(/global FEE_BPS: u128 = 0;/);
      expect(src).toMatch(/global (STREAM_)?MIN_FEE: u128 = 0;/);
      expect(src).not.toMatch(/fn (pause|unpause|set_owner|set_admin|set_fee|upgrade)\b/);
    }
  });
  it('the TXE suites keep the exit and limit tests', () => {
    const escrow = fs.readFileSync('contracts/aztec/escrow/src/test.nr', 'utf8');
    const stream = fs.readFileSync('contracts/aztec/streams/src/test.nr', 'utf8');
    for (const t of ['the_alpha_maximum_is_accepted_and_claimed_in_full', 'the_alpha_maximum_is_refunded_in_full_without_fee', 'above_the_alpha_maximum_is_refused', 'small_amounts_are_paid_in_full_without_fee', 'the_recipient_cannot_take_the_refund', 'claimed_escrow_cannot_also_be_refunded']) expect(escrow).toContain(`fn ${t}(`);
    for (const t of ['the_alpha_maximum_streams_in_full_without_fee', 'a_stream_above_the_alpha_maximum_is_refused', 'cancel_fee_never_refuses', 'cancel_of_a_maximum_stream_pays_all_accrued_without_fee', 'only_the_recipient_can_withdraw', 'only_the_sender_can_cancel']) expect(stream).toContain(`fn ${t}(`);
  });
});
