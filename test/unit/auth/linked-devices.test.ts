/**
 * Linked devices (WhatsApp Web / Signal Desktop model): the server records, the relay of
 * signing requests, and the end-to-end channel between phone and computer.
 */
import { vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, string>());
vi.mock('@/lib/redis/client', () => ({
  redisClient: { del: async (k: string) => (mem.delete(k) ? 1 : 0) },
  safeRedisGet: async (k: string) => mem.get(k) ?? null,
  safeRedisSet: async (k: string, v: string) => { mem.set(k, String(v)); return 'OK'; },
}));

import {
  addDevice, answerRequest, createRequest, describeUserAgent, getRequest, listDevices, MAX_DEVICES, newDeviceId,
  pendingRequests, removeDevice,
} from '@/lib/auth/linkedDevices';
import { newChannelKey, open, seal } from '@/lib/link/channel';

const W = '0x1111111111111111111111111111111111111111';

beforeEach(() => mem.clear());

describe('linked devices', () => {
  it('describes a computer without trusting the User-Agent for anything else', () => {
    expect(describeUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Chrome/131.0 Safari/537.36')).toBe('Chrome on macOS');
    expect(describeUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gecko/20100101 Firefox/133.0')).toBe('Firefox on Windows');
    expect(describeUserAgent(null)).toBe('Browser on unknown system');
  });

  it('records, lists and removes linked computers, keeping at most MAX_DEVICES', async () => {
    const ids: string[] = [];
    for (let i = 0; i < MAX_DEVICES + 1; i++) {
      const id = newDeviceId();
      ids.push(id);
      const dropped = await addDevice(W, { id, label: `PC ${i}`, createdAt: i, tokenFp: 'a'.repeat(64), expiresAt: Date.now() + 1e6 });
      if (i === MAX_DEVICES) expect(dropped.map(d => d.id)).toEqual([ids[0]]); // the oldest is signed out
    }
    expect((await listDevices(W)).map(d => d.id)).toEqual(ids.slice(1));
    expect((await removeDevice(W, ids[2]))?.label).toBe('PC 2');
    expect((await listDevices(W)).some(d => d.id === ids[2])).toBe(false);
  });

  it('relays a signing request and its answer once', async () => {
    const deviceId = newDeviceId();
    const r = await createRequest(W, { deviceId, kind: 'xmtp', ciphertext: 'Y2lwaGVy', iv: 'aXZpdml2aXY' });
    if (typeof r === 'string' || !r) throw new Error('not created');
    expect((await pendingRequests(W)).map(x => x.id)).toEqual([r.id]);
    expect(await answerRequest(W, r.id, { ciphertext: 'YW5zd2Vy', iv: 'aXZpdml2aXY', at: 1 })).toBe('OK');
    expect(await answerRequest(W, r.id, { declined: true, at: 2 })).toBe('ANSWERED');
    expect(await pendingRequests(W)).toEqual([]);
    expect((await getRequest(W, r.id))?.answer?.ciphertext).toBe('YW5zd2Vy');
  });

  it('caps the requests waiting on the phone', async () => {
    const deviceId = newDeviceId();
    for (let i = 0; i < 4; i++) expect(typeof (await createRequest(W, { deviceId, kind: 'xmtp', ciphertext: 'Y2lwaGVy', iv: 'aXZpdml2aXY' }))).toBe('object');
    expect(await createRequest(W, { deviceId, kind: 'xmtp', ciphertext: 'Y2lwaGVy', iv: 'aXZpdml2aXY' })).toBe('TOO_MANY');
  });
});

describe('end-to-end channel', () => {
  it('round-trips, and an answer sealed for one request cannot be opened for another', async () => {
    const key = newChannelKey();
    const s = await seal(key, 'ans|req_1|xmtp', { signature: '0xabc' });
    expect(await open(key, 'ans|req_1|xmtp', s.ciphertext, s.iv)).toEqual({ signature: '0xabc' });
    await expect(open(key, 'ans|req_2|xmtp', s.ciphertext, s.iv)).rejects.toBeTruthy();
    await expect(open(newChannelKey(), 'ans|req_1|xmtp', s.ciphertext, s.iv)).rejects.toBeTruthy();
  });
});
