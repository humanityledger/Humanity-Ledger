/**
 * KNOWN ISSUE ZK-01 (critical) — master prompt task R-06.
 *
 * The streams circuit takes `withdrawn_amount` as a free private input and
 * derives the nullifier as H(commitment, withdrawn + claim). Nothing ties
 * `withdrawn_amount` to earlier withdrawals, so a recipient can always declare
 * `withdrawn = 0` and change `claim`: each claim gets a new nullifier and a
 * valid proof. With an accrual of 600, claims of 600, 599, ..., 1 are all valid,
 * 180,300 units in total against an allocation of 10,000.
 *
 * This test DOCUMENTS the vulnerability: it passes while the bug exists. When
 * the streams contract with a state note lands (task R-09), this file must be
 * replaced by a test that shows the second claim is rejected.
 *
 * Nullifiers below were computed with nargo 1.0.0:
 *   pedersen_hash([commitment, 600]) and pedersen_hash([commitment, 599]).
 */

import { describe, it, expect, afterAll } from 'vitest';
import { proveStreams, verifyProof, destroyZkEngine, type StreamsWitness } from '../../lib/zk/prover';

const COMMITMENT = '0x1dd07dd799d46a7e7fd63ba40116b21fb43535c17177d811bda7f771aaece6d9';

const base: Omit<StreamsWitness, 'claim_amount' | 'stream_nullifier'> = {
  sender_secret: '12345',
  recipient_pubkey: '67890',
  total_allocation: '10000',
  rate_per_second: '10',
  start_time: '1000',
  withdrawn_amount: '0', // the lie: earlier withdrawals are not proven
  salt: '999',
  stream_commitment: COMMITMENT,
  current_time: '1060', // 60 s at 10/s → accrual of 600
};

describe('KNOWN ISSUE ZK-01: streams circuit accepts repeated claims of the same accrual', () => {
  afterAll(async () => {
    await destroyZkEngine();
  });

  it('two claims against one accrual both verify, with different nullifiers', async () => {
    const first = await proveStreams({
      ...base,
      claim_amount: '600',
      stream_nullifier: '0x1bac71daea6364d00ab94febd98681d68bf9839f3488cfb8f530a67c4daf4f8d',
    });
    const second = await proveStreams({
      ...base,
      claim_amount: '599',
      stream_nullifier: '0x2a4112b1abaa9b5fd8cc569bbf0c8ac95dccc3af3954d0cc0409c4b80cde9381',
    });

    expect(await verifyProof('streams', first)).toBe(true);
    expect(await verifyProof('streams', second)).toBe(true);
    // Different nullifiers: a nullifier set does not stop the second claim.
    expect(first.publicInputs).not.toEqual(second.publicInputs);
    // 600 + 599 already exceeds the 600 that accrued.
  }, 240000);
});
