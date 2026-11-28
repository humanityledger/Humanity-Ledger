/**
 * History capsules for MLS communities (lib/communities/mls-history-backfill.ts): a member added in
 * epoch k+1 sees the posts sent before, end to end encrypted, deduplicated and in order.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import fs from 'node:fs';
import {
  HIST_CAP_PREFIX, HIST_REQ_PREFIX, absorbHistory, buildCapsuleChunks, encodeHistoryRequest, historyKey, isHistoryControl,
  memoryHistoryStore, mergeHistory, parseHistoryControl, requestsToAnswer, splitHistory, type RawGroupMsg,
} from '@/lib/communities/mls-history-backfill';
import { isControlMessage } from '@/lib/communities/media-index';

const msg = (id: string, t: number, content = `post ${id}`, sender = 'inbox-a'): RawGroupMsg => ({ id, senderInboxId: sender, content, createdAt: t });

describe('history capsules', () => {
  it('requests and capsules are control messages, never shown as posts', () => {
    expect(isControlMessage(encodeHistoryRequest())).toBe(true);
    const [chunk] = buildCapsuleChunks([msg('1', 1)]);
    expect(isControlMessage(chunk)).toBe(true);
    expect(isHistoryControl(chunk)).toBe(true);
    expect(chunk.startsWith(HIST_CAP_PREFIX)).toBe(true);
  });

  it('round-trips posts, votes and replies through capsule chunks under the group size limit', () => {
    const many = Array.from({ length: 240 }, (_, i) => msg(`m${i}`, 1_000 + i, i % 7 === 0 ? `__VOTE__p1__::${i % 3}` : 'x'.repeat(120) + i));
    const chunks = buildCapsuleChunks(many, { forRid: 'r1' });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(9_000);
    const back = chunks.map((c) => parseHistoryControl(c)).flatMap((x) => (x && x.kind === 'cap' ? x.chunk.msgs : []));
    expect(back.map((m) => m.id)).toEqual(many.map((m) => m.id));
    const first = parseHistoryControl(chunks[0]);
    expect(first && first.kind === 'cap' && first.chunk.for).toBe('r1');
  });

  it('keeps only the newest messages when there are more than the capsule limit', () => {
    const many = Array.from({ length: 400 }, (_, i) => msg(`m${i}`, i));
    const ids = buildCapsuleChunks(many, { maxMsgs: 50 }).flatMap((c) => { const p = parseHistoryControl(c); return p && p.kind === 'cap' ? p.chunk.msgs.map((m) => m.id) : []; });
    expect(ids.length).toBe(50);
    expect(ids[0]).toBe('m350');
  });

  it('rejects malformed capsules whole and never nests controls', () => {
    expect(parseHistoryControl(HIST_CAP_PREFIX + '{not json')).toBeNull();
    expect(parseHistoryControl(HIST_CAP_PREFIX + JSON.stringify({ v: 2, cid: 'c', i: 0, n: 1, msgs: [] }))).toBeNull();
    expect(parseHistoryControl(HIST_CAP_PREFIX + JSON.stringify({ v: 1, cid: 'c', i: 3, n: 1, msgs: [] }))).toBeNull();
    const nested = { v: 1, cid: 'c', i: 0, n: 1, msgs: [msg('a', 1, HIST_REQ_PREFIX + '{}')] };
    expect(parseHistoryControl(HIST_CAP_PREFIX + JSON.stringify(nested))).toBeNull();
    const bad = { v: 1, cid: 'c', i: 0, n: 1, msgs: [msg('a', 1), { id: 5, content: 'x' }] };
    expect(parseHistoryControl(HIST_CAP_PREFIX + JSON.stringify(bad))).toBeNull();
    expect(parseHistoryControl(HIST_REQ_PREFIX + JSON.stringify({ v: 1, rid: '', at: 1 }))).toBeNull();
  });

  it('merges by id in chronological order; a native copy always wins over a relayed one', () => {
    const native = [msg('n1', 500, 'native one'), msg('shared', 600, 'native text')];
    const relayed = [msg('old1', 100), msg('old2', 200), { ...msg('shared', 600, 'forged text'), relayed: true }].map((m) => ({ ...m, relayed: true }));
    const out = mergeHistory(native, relayed);
    expect(out.map((m) => m.id)).toEqual(['old1', 'old2', 'n1', 'shared']);
    expect(out.find((m) => m.id === 'shared')?.content).toBe('native text');
    expect(out.find((m) => m.id === 'shared')?.relayed).toBeUndefined();
    expect(out.find((m) => m.id === 'old1')?.relayed).toBe(true);
  });

  it('relayed messages claiming to be newer than what this device decrypts itself are refused', () => {
    const native = [msg('n1', 1_000)];
    const relayed = [{ ...msg('fake', 2_000), relayed: true }, { ...msg('ok', 10), relayed: true }];
    expect(mergeHistory(native, relayed).map((m) => m.id)).toEqual(['ok', 'n1']);
  });

  it('splits controls from posts, tracks answered requests and picks the ones to answer', () => {
    const req = { ...msg('r', 900, encodeHistoryRequest('rid-1', 900), 'inbox-new') };
    const req2 = { ...msg('r2', 905, encodeHistoryRequest('rid-2', 905), 'inbox-new') };
    const [cap] = buildCapsuleChunks([msg('h1', 10)], { forRid: 'rid-2' });
    const all = [msg('p1', 950), req, req2, { ...msg('c', 960, cap, 'inbox-old') }];
    const split = splitHistory(all);
    expect(split.native.map((m) => m.id)).toEqual(['p1']);
    expect(split.relayed.map((m) => m.id)).toEqual(['h1']);
    expect(split.relayed[0].relayedBy).toBe('inbox-old');
    expect([...split.answered]).toEqual(['rid-2']);
    expect(requestsToAnswer(split, 'inbox-old', 1_000).map((r) => r.rid)).toEqual(['rid-1']);
    expect(requestsToAnswer(split, 'inbox-new', 1_000)).toEqual([]); // never answer yourself
  });

  describe('encrypted local cache', () => {
    let store = memoryHistoryStore();
    beforeEach(() => { store = memoryHistoryStore(); });

    it('persists the merged history per wallet, community and group, and survives a reload', async () => {
      const ctx = { wallet: '0xAbC0000000000000000000000000000000000001', communityId: 'c1', groupId: 'G1', selfInbox: 'me' };
      const [cap] = buildCapsuleChunks([msg('h1', 10), msg('h2', 20)]);
      const first = await absorbHistory(ctx, [msg('n1', 100), msg('c', 110, cap, 'inbox-old')], store);
      expect(first.history.map((m) => m.id)).toEqual(['h1', 'h2', 'n1']);
      expect(first.hadCache).toBe(false);
      // Next open: the capsule message is gone from the device (or not re-read); the cache keeps it.
      const second = await absorbHistory(ctx, [msg('n1', 100), msg('n2', 120)], store);
      expect(second.history.map((m) => m.id)).toEqual(['h1', 'h2', 'n1', 'n2']);
      expect(second.hadCache).toBe(true);
      // Another wallet on the same browser sees nothing of it.
      const other = await absorbHistory({ ...ctx, wallet: '0x0000000000000000000000000000000000000002' }, [], store);
      expect(other.history).toEqual([]);
      expect(historyKey(ctx.wallet, 'c1', 'G1')).toBe('0xabc0000000000000000000000000000000000001|c1|g1');
    });
  });

  it('the reader merges capsules before showing posts, answers requests and asks once when empty', () => {
    const src = fs.readFileSync('components/communities/CommunityReader.tsx', 'utf8');
    expect(src).toContain('absorbHistory({ wallet: me, communityId, groupId: mlsGroup, selfInbox }, native)');
    expect(src).toContain('sendHistoryCapsule(xmtpClient, me, communityId, gid, r.rid)');
    expect(src).toContain('requestHistory(xmtpClient, me, mlsGroup)');
    // No composer while the device waits for the channel's key; a live access card instead.
    expect(src).toContain("const awaitingAccess = !!mlsGroup && load === 'waiting';");
    expect(src).toContain('data-testid="mls-access-card"');
  });

  it('whoever adds members sends them a capsule; Restore channel exists for admins', () => {
    const mls = fs.readFileSync('lib/communities/mls.ts', 'utf8');
    expect(mls).toMatch(/if \(added > 0\) void sendHistoryCapsule\(/);
    expect(mls).toMatch(/export async function restoreChannel\(/);
    expect(fs.readFileSync('components/communities/CommunityManage.tsx', 'utf8')).toContain('data-testid="restore-channel"');
  });
});
