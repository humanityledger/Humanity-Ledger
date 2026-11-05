/**
 * Agreement messages are recognised by their JSON type only, and previews
 * never contain the message (which carries secrets).
 */
import { describe, it, expect } from 'vitest';
import { agreementMessageKind, agreementPreview, isAgreementMessage, summarizeInvite } from '@/lib/aztec/agreement-message';
import { announcementFor } from '@/lib/aztec/peer-binding';

const SECRET = '0x' + '5e'.repeat(32);
const escrow = JSON.stringify({ type: 'hl.escrow_invite', version: 1, contractSecret: SECRET, claimSecret: SECRET });
const stream = JSON.stringify({ type: 'hl.stream_invite', version: 1, contractSecret: SECRET });

describe('agreement messages', () => {
  it('recognises invitations and announcements', () => {
    expect(agreementMessageKind(escrow)).toBe('escrow');
    expect(agreementMessageKind(stream)).toBe('stream');
    expect(agreementMessageKind(announcementFor('0x' + '1a'.repeat(32)))).toBe('address');
  });

  it('ignores ordinary text, other JSON, broken JSON and oversized content', () => {
    for (const c of ['hola', '{"type":"other"}', '{"type":"hl.escrow_invite"', '{"type":"hl.unknown"}', 42, null, `{"type":"hl.escrow_invite","x":"${'a'.repeat(5000)}"}`]) {
      expect(isAgreementMessage(c)).toBe(false);
    }
  });

  it('previews never contain the secret', () => {
    for (const kind of ['escrow', 'stream', 'address'] as const) {
      expect(agreementPreview(kind)).not.toContain(SECRET);
      expect(agreementPreview(kind)).not.toContain('{');
    }
  });
});

describe('summarizeInvite', () => {
  const h = (n: number) => '0x' + n.toString(16).padStart(64, '0');
  const full = { type: 'hl.escrow_invite', version: 1, instanceAddress: h(1), classId: h(2), salt: h(3), contractSecret: SECRET, token: h(5), tokenSymbol: 'zkUSDC', sender: h(6), recipient: h(7), escrowId: h(8), claimSecret: SECRET, amount: '2500000', deadline: 1_800_000_000 };

  it('shows the public fields and never the secrets', () => {
    const s = summarizeInvite(JSON.stringify(full))!;
    expect(s).toMatchObject({ kind: 'escrow', amount: 2_500_000n, deadline: 1_800_000_000, tokenSymbol: 'zkUSDC' });
    expect(JSON.stringify(s, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain(SECRET.slice(2, 20));
  });

  it('reads streams and rejects malformed invitations', () => {
    const st = { ...full, type: 'hl.stream_invite', total: '1000', rate: '2', start: 1_700_000_000 } as any;
    delete st.amount; delete st.deadline; delete st.escrowId; delete st.claimSecret;
    expect(summarizeInvite(JSON.stringify(st))).toMatchObject({ kind: 'stream', amount: 1000n, rate: 2n, start: 1_700_000_000 });
    expect(summarizeInvite(JSON.stringify({ ...full, sender: '0x12' }))).toBeNull();
    expect(summarizeInvite(JSON.stringify({ ...full, amount: '-1' }))).toBeNull();
    expect(summarizeInvite('hola')).toBeNull();
  });
});
