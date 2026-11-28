/**
 * 28 Nov 2026: messages stayed on one tick between some people, and community history capsules
 * (__HL_HIST_CAP__) showed as chat bubbles and as the last message in Chats.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const chat = fs.readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');

describe('delivery receipts', () => {
  it('every real message gets "delivered" unless a "read" receipt is sent for it', () => {
    const at = chat.indexOf('const willSendRead =');
    expect(at).toBeGreaterThan(0);
    const block = chat.slice(at, at + 900);
    expect(block).toContain("!isSystemSignal(content)");
    expect(block).toContain('!willSendRead');
    // Wrapped messages (replies, GIFs, photos, payments) and read receipts off no longer skip it.
    expect(block).not.toMatch(/firstSight && fromPeer && msg\.id && typeof content === 'string' && !content\.startsWith\('__'\)/);
    expect(chat).toContain('sendMessage(client, msgConvPeer, `__DELIVERED__${realId}`, address)');
  });
});

describe('community history capsules', () => {
  it('are signals in the chat: never a bubble, a preview or an unread message', () => {
    const fn = chat.slice(chat.indexOf('export const isSystemSignal'), chat.indexOf('export const isSystemSignal') + 900);
    expect(fn).toContain("content.startsWith('__HL_HIST_')");
  });

  it('community channels never show in the Chats list', () => {
    expect(chat).toContain(".filter(conv => !communityGroupIdsRef.current.has(String(conv.peerAddress || '').toLowerCase()))");
  });
});
