import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { EDIT_WINDOW_MS, mayEdit, mayRevoke, sentAtMs, withinEditWindow } from '@/lib/chat/message-authority';

const NOW = Date.UTC(2026, 10, 24, 12);
const mine = { senderInboxId: 'inbox-me', sentAtNs: NOW - 1000 };

describe('who may change a message', () => {
  it('only the author may delete it for everyone', () => {
    expect(mayRevoke(mine, 'inbox-me')).toBe(true);
    expect(mayRevoke(mine, 'INBOX-ME')).toBe(true);
    expect(mayRevoke(mine, 'inbox-peer')).toBe(false);
    expect(mayRevoke(undefined, 'inbox-me')).toBe(false);
    expect(mayRevoke({ senderInboxId: '' }, 'inbox-me')).toBe(false);
  });
  it('only the author may edit it, within 24 hours', () => {
    expect(mayEdit(mine, 'inbox-me', NOW)).toBe(true);
    expect(mayEdit(mine, 'inbox-peer', NOW)).toBe(false);
    expect(mayEdit({ ...mine, sentAtNs: NOW - EDIT_WINDOW_MS - 1 }, 'inbox-me', NOW)).toBe(false);
  });
  it('reads sentAtNs whether it holds milliseconds or nanoseconds', () => {
    expect(sentAtMs(NOW)).toBe(NOW);
    expect(sentAtMs(NOW * 1_000_000)).toBe(NOW);
    expect(sentAtMs(BigInt(NOW) * 1_000_000n)).toBe(NOW);
    expect(sentAtMs('x')).toBeNull();
    expect(withinEditWindow({ sentAtNs: undefined }, NOW)).toBe(false);
  });
  it('the chat applies remote edits and deletions only through these checks', () => {
    const src = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');
    expect(src).toMatch(/if \(mayRevoke\(messagesRef\.current\.find\(\(m: any\) => m\.id === revokeId\), msg\.senderInboxId\)\)/);
    expect(src).toMatch(/if \(mayEdit\(messagesRef\.current\.find\(\(m: any\) => m\.id === editTargetId\), msg\.senderInboxId\)\)/);
    expect(src).toMatch(/if \(mayRevoke\(historyById\.get\(revId\), m\.senderInboxId\)\)/);
  });
});
