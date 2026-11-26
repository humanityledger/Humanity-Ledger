import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { decideIncoming, deletionWatermark, saveDeleteSnapshot, isPreDeleteId, reviveDeletedChat, SKEW_GRACE_MS } from '@/lib/chat/incoming-revival';
import { markDeleted, deletedAtMs } from '@/lib/chat/cleared-chats';
import { isValidOp } from '@/lib/sync/lww';
import { normalizePeer } from '@/lib/chat/blockFirewall';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; }, clear: () => m.clear(), key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null), setItem: (k: string, v: string) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
  } as Storage;
}

const A = '0x' + 'a'.repeat(40), B = '0x' + 'b'.repeat(40);
const NOW = 1_800_000_000_000;

describe('Delete ≠ Block: deleting never stops the other person', () => {
  it('watermark uses network times seen, never the local clock', () => {
    // Device clock 5 min ahead of the network: last seen message at NOW, local clock NOW+5min.
    expect(deletionWatermark(NOW + SKEW_GRACE_MS, [NOW - 1000, NOW])).toBe(NOW);
    expect(deletionWatermark(NOW, [])).toBe(NOW - SKEW_GRACE_MS);
    // Absurd future stamps are ignored.
    expect(deletionWatermark(NOW, [NOW + 10 * SKEW_GRACE_MS, NOW - 5])).toBe(NOW - 5);
  });

  it.each([-5, -1, 0, 1, 5])('A deletes B, B replies with %s min clock skew → A revives the chat', (skewMin) => {
    const cut = deletionWatermark(NOW + skewMin * 60_000, [NOW]);
    const reply = NOW + 1; // network time of B's reply, right after the last seen message
    expect(decideIncoming({ blocked: false, msgMs: reply, cutMs: cut, deletedAt: cut, preDelete: false })).toBe('revive');
  });

  it('a live-stream message after deletion always revives, even if stamped earlier (reconnect)', () => {
    expect(decideIncoming({ blocked: false, msgMs: NOW - 60_000, cutMs: NOW, deletedAt: NOW, preDelete: false, live: true })).toBe('revive');
  });

  it('history from before the deletion stays hidden (by id and by time)', () => {
    expect(decideIncoming({ blocked: false, msgMs: NOW + 99, cutMs: NOW, deletedAt: NOW, preDelete: true, live: true })).toBe('suppress');
    expect(decideIncoming({ blocked: false, msgMs: NOW - 1, cutMs: NOW, deletedAt: NOW, preDelete: false })).toBe('suppress');
  });

  it('pre-delete ids persist across reloads and are bounded', () => {
    const s = memStorage();
    saveDeleteSnapshot(B, [A], Array.from({ length: 300 }, (_, i) => `m${i}`), s);
    expect(isPreDeleteId(B, 'm299', [A], s)).toBe(true);
    expect(isPreDeleteId(B, 'm0', [A], s)).toBe(false); // ring of 256 digests
    expect(isPreDeleteId(B, 'new', [A], s)).toBe(false);
  });

  it('revive clears the deletion mark and announces it to other devices', () => {
    const s = memStorage();
    expect(markDeleted(B, [A], NOW, s)).toBe(true);
    let announced = '';
    reviveDeletedChat(B, [A], p => { announced = p; }, s);
    expect(deletedAtMs(B, [A], s)).toBe(0);
    expect(announced).toBe(B);
  });

  it('symmetric: B deletes A, A replies → B revives', () => {
    expect(decideIncoming({ blocked: false, msgMs: NOW + 1, cutMs: NOW, deletedAt: NOW, preDelete: false })).toBe('revive');
  });

  it('delete never touches XMTP consent; only block/unblock does', () => {
    const chat = read('components/terminal/LedgerChatV2.tsx');
    const del = chat.slice(chat.indexOf('const deleteConversation = '), chat.indexOf('const markConversationAsRead'));
    expect(del).not.toMatch(/setPeerConsent|applyPeerBlock|updateConsentState/);
    expect(del).toMatch(/deletionWatermark\(/);
    expect(chat).not.toMatch(/clearCutoff\(/);
    expect(read('lib/chat/blockActions.ts')).toMatch(/blocked \? 'denied' : 'allowed'/);
  });

  it('every incoming path uses the same decision', () => {
    const chat = read('components/terminal/LedgerChatV2.tsx');
    expect((chat.match(/decideIncoming\(\{/g) || []).length).toBeGreaterThanOrEqual(5);
  });
});

describe('Block: mutual, synced, fail-closed', () => {
  it('blocking drops everything from that peer', () => {
    expect(decideIncoming({ blocked: true, msgMs: NOW + 1, cutMs: 0, deletedAt: 0, preDelete: false, live: true })).toBe('drop');
  });
  it('unblocked peer is delivered normally', () => {
    expect(decideIncoming({ blocked: false, msgMs: NOW, cutMs: 0, deletedAt: 0, preDelete: false })).toBe('deliver');
  });
  it('blocked:<peer> syncs across the account devices (true/null only)', () => {
    expect(isValidOp([`blocked:${B}`, true, 5, 'device01'])).toBe(true);
    expect(isValidOp([`blocked:${B}`, null, 6, 'device01'])).toBe(true);
    expect(isValidOp([`blocked:${B}`, 'yes', 7, 'device01'])).toBe(false);
    expect(isValidOp(['blocked:not-an-address', true, 7, 'device01'])).toBe(false);
  });
  it('server firewall: every cross-user route checks both directions', () => {
    expect(read('app/api/chat/contacts/request/route.ts')).toMatch(/isMutuallyBlocked\(caller, to\)/);
    expect(read('app/api/chat/contacts/request/[action]/route.ts')).toMatch(/isMutuallyBlocked\(caller, request\.fromAddress\)/);
    expect(read('app/api/chat/presence/route.ts')).toMatch(/isMutuallyBlocked\(callerAddress, normalizedPeer\)/);
    expect(read('app/api/chat/direct/route.ts')).toMatch(/blockedCounterparties\(address\)/);
    expect(read('app/api/chat/queue/route.ts')).toMatch(/blockedCounterparties\(normalized\)/);
    const fw = read('lib/chat/blockFirewall.ts');
    expect(fw).toMatch(/OR: \[\{ owner: x, blockedPeer: y \}, \{ owner: y, blockedPeer: x \}\]/);
    expect(fw).not.toMatch(/as any/);
  });
  it('GET /api/chat/blocks only lists the caller own blocks', () => {
    const r = read('app/api/chat/blocks/route.ts');
    expect(r).toMatch(/listOwnBlocks\(auth\.walletAddress\)/);
    expect(r).toMatch(/requireWallet\(req\)/);
    expect(read('lib/chat/blockFirewall.ts')).toMatch(/where: \{ owner: o \}/);
  });
  it('no fake Aztec address derivation in contact requests', () => {
    expect(read('app/api/chat/contacts/request/route.ts')).not.toMatch(/deriveAztecAddress/);
    expect(read('app/api/chat/contacts/request/[action]/route.ts')).not.toMatch(/deriveAztecAddress/);
  });
  it('sending and calling fail closed when I blocked the peer', () => {
    const chat = read('components/terminal/LedgerChatV2.tsx');
    expect(chat).toMatch(/You blocked this contact\. Unblock to send messages\./);
    expect(chat).toMatch(/You blocked this contact\. Unblock to call\./);
  });
  it('normalizes peers strictly', () => {
    expect(normalizePeer(' 0x' + 'A'.repeat(40))).toBe(A.replace('a'.repeat(40), 'a'.repeat(40)));
    expect(normalizePeer('0x123')).toBeNull();
    expect(normalizePeer(42)).toBeNull();
  });
});
