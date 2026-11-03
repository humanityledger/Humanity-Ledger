/**
 * test/zk/pinned-verifier.test.ts — master prompt task R-03 (ZK-07).
 *
 * `verifyProof` used to build the verifier from whatever bytecode was on disk,
 * so swapping the artifact changed what was accepted. It must reject any
 * artifact that does not produce the pinned verification key.
 */

import { describe, it, expect, afterAll } from 'vitest';
import {
  proveStreams,
  verifyProof,
  verifyProofWithArtifact,
  loadCircuitArtifact,
  destroyZkEngine,
} from '../../lib/zk/prover';

describe('Pinned verifier (ZK-07)', () => {
  afterAll(async () => {
    await destroyZkEngine();
  });

  it('accepts a valid proof with the committed artifact and rejects it with a swapped one', async () => {
    const proof = await proveStreams({
      sender_secret: '12345',
      recipient_pubkey: '67890',
      total_allocation: '10000',
      rate_per_second: '10',
      start_time: '1000',
      withdrawn_amount: '200',
      claim_amount: '300',
      salt: '999',
      stream_commitment: '0x1dd07dd799d46a7e7fd63ba40116b21fb43535c17177d811bda7f771aaece6d9',
      current_time: '1060',
      stream_nullifier: '0x13f5958db040e7cd4d94916477e781197eab5361b87b8894c4670b0865ad97cc',
    });

    expect(await verifyProof('streams', proof)).toBe(true);

    // The identity circuit's bytecode presented as "streams": its VK is not the pinned one.
    const swapped = loadCircuitArtifact('identity');
    expect(await verifyProofWithArtifact('streams', swapped, proof)).toBe(false);
  }, 240000);

  it('returns false, never throws, on malformed proof bytes', async () => {
    const bogus = { proof: new Uint8Array(32), publicInputs: [] as string[] };
    expect(await verifyProof('escrow', bogus)).toBe(false);
  }, 120000);
});
