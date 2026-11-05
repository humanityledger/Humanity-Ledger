/**
 * escrowMismatches / streamMismatches: an agreement is confirmed only when
 * the contract's stored note agrees with every field of the invitation.
 * Pure comparison of decoded view results; no network.
 */
import { describe, it, expect } from 'vitest';
import { escrowMismatches, streamMismatches, type EscrowView, type StreamView } from '@/lib/aztec/agreements';
import type { EscrowInvite, StreamInvite } from '@/lib/aztec/agreement-invite';

const h = (n: number) => '0x' + n.toString(16).padStart(64, '0');
const SENDER = h(0xa1);
const RECIPIENT = h(0xb2);

const common = {
  version: 1 as const,
  instanceAddress: h(1),
  classId: h(2),
  salt: h(3),
  contractSecret: h(4),
  token: h(5),
  tokenSymbol: 'zkUSDC',
  sender: SENDER,
  recipient: RECIPIENT,
};

const escrowInvite: EscrowInvite = {
  type: 'hl.escrow_invite',
  ...common,
  escrowId: h(7),
  claimSecret: h(8),
  amount: '100',
  deadline: 1_800_000_000,
};
const SECRET_HASH = 0x99n;

const escrowView = (over: Partial<EscrowView['note']> = {}, flags: Partial<EscrowView> = {}): EscrowView => ({
  found: true,
  settled: false,
  note: {
    escrow_id: 7n,
    // Addresses may come back as objects with toBigInt(), as aztec.js decodes them.
    sender: { toBigInt: () => 0xa1n },
    recipient: 0xb2n,
    amount: 100n,
    deadline: 1_800_000_000n,
    claim_secret_hash: SECRET_HASH,
    ...over,
  },
  ...flags,
});

const streamInvite: StreamInvite = {
  type: 'hl.stream_invite',
  ...common,
  streamSalt: h(9),
  total: '1000',
  rate: '2',
  start: 1_700_000_000,
};

const streamView = (over: Partial<StreamView['note']> = {}, flags: Partial<StreamView> = {}): StreamView => ({
  found: true,
  live: true,
  available: 0n,
  note: {
    sender: 0xa1n,
    recipient: 0xb2n,
    total: 1000n,
    rate: 2n,
    start: 1_700_000_000n,
    withdrawn: 0n,
    salt: 9n,
    index: 0n,
    ...over,
  },
  ...flags,
});

describe('escrowMismatches', () => {
  it('confirms an escrow whose note matches the invitation', () => {
    expect(escrowMismatches(escrowView(), escrowInvite, SECRET_HASH)).toEqual([]);
  });

  it('names every field the note contradicts', () => {
    expect(escrowMismatches(escrowView({ amount: 1n }), escrowInvite, SECRET_HASH)).toEqual(['amount']);
    expect(escrowMismatches(escrowView({ deadline: 1_700_000_000n }), escrowInvite, SECRET_HASH)).toEqual(['deadline']);
    expect(escrowMismatches(escrowView({ claim_secret_hash: 1n }), escrowInvite, SECRET_HASH)).toEqual(['claimSecret']);
    expect(escrowMismatches(escrowView({ sender: 0xc3n, recipient: 0xc4n }), escrowInvite, SECRET_HASH)).toEqual(['sender', 'recipient']);
  });

  it('refuses a missing or settled escrow', () => {
    expect(escrowMismatches(escrowView({}, { found: false }), escrowInvite, SECRET_HASH)).toEqual(['escrow not found in your notes']);
    expect(escrowMismatches(escrowView({}, { settled: true }), escrowInvite, SECRET_HASH)).toEqual(['already settled']);
  });
});

describe('streamMismatches', () => {
  it('confirms a stream whose live state matches the invitation', () => {
    expect(streamMismatches(streamView(), streamInvite)).toEqual([]);
  });

  it('names every field the state contradicts', () => {
    expect(streamMismatches(streamView({ rate: 3n }), streamInvite)).toEqual(['rate']);
    expect(streamMismatches(streamView({ total: 10n, start: 1n }), streamInvite)).toEqual(['total', 'start']);
  });

  it('refuses a missing or finished stream', () => {
    expect(streamMismatches(streamView({}, { found: false }), streamInvite)).toEqual(['stream not found in your notes']);
    expect(streamMismatches(streamView({}, { live: false }), streamInvite)).toEqual(['stream no longer live']);
  });
});
