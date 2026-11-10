import { describe, it, expect, beforeEach } from 'vitest';
import {
  hiddenIds,
  isHidden,
  markDeletedForMe,
  markRevoked,
  verifyRevoke,
  shouldHonourRevoke,
} from '@/lib/chat/deleted-messages';

class MockStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.get(key) ?? null; }
  key(index: number) { return Array.from(this.store.keys())[index] ?? null; }
  removeItem(key: string) { this.store.delete(key); }
  setItem(key: string, value: string) { this.store.set(key, value); }
}

describe('deleted-messages helper', () => {
  let mockKv: Storage;

  beforeEach(() => {
    mockKv = new MockStorage();
  });

  it('marks deleted for me correctly under peer scope', () => {
    const peer = '0x1234567890abcdef1234567890abcdef12345678';
    expect(isHidden(peer, 'msg-1', mockKv)).toBe(false);

    markDeletedForMe(peer, 'msg-1', mockKv);
    expect(isHidden(peer, 'msg-1', mockKv)).toBe(true);

    // Another peer should not see it hidden
    expect(isHidden('0x9999999999999999999999999999999999999999', 'msg-1', mockKv)).toBe(false);
  });

  it('marks revoked globally across all peers', () => {
    markRevoked('msg-revoked', mockKv);
    expect(isHidden('0xpeer1', 'msg-revoked', mockKv)).toBe(true);
    expect(isHidden('0xpeer2', 'msg-revoked', mockKv)).toBe(true);
  });

  it('verifies revoke authority strictly', () => {
    const author = '0xAuthorAddress';
    const target = { senderAddress: author };

    expect(verifyRevoke(target, author)).toBe('honour');
    expect(shouldHonourRevoke(target, author)).toBe(true);

    // Attacker cannot revoke victim message
    expect(verifyRevoke(target, '0xAttacker')).toBe('reject');
    expect(shouldHonourRevoke(target, '0xAttacker')).toBe(false);

    // Missing target
    expect(verifyRevoke(undefined, author)).toBe('unknown');
  });
});
