/**
 * Agreement messages are recognised by their JSON type only, and previews
 * never contain the message (which carries secrets).
 */
import { describe, it, expect } from 'vitest';
import { agreementMessageKind, agreementPreview, isAgreementMessage } from '@/lib/aztec/agreement-message';
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
