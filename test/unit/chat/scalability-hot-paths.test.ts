import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';

// The hot paths every open window hits (18 November 2026, scalability pass): what used to cost a
// database query or a network round trip on every beat now costs one only when something changed.

const h = vi.hoisted(() => ({
  redis: new Map<string, string>(),
  countCalls: 0,
  createMany: [] as any[],
  caller: '0x' + 'a'.repeat(40),
}));

vi.mock('@/lib/redis', () => ({
  safeRedisGet: async (k: string) => h.redis.get(k) ?? null,
  safeRedisSet: async (k: string, v: string) => { h.redis.set(k, v); },
}));
vi.mock('@/lib/security/requireWallet', () => ({ requireWallet: async () => ({ walletAddress: h.caller }) }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    chatContact: {
      count: async () => { h.countCalls++; return 2; },
      createMany: async (args: any) => { h.createMany.push(args); return { count: args.data.length }; },
      upsert: async () => { throw new Error('upsert per row must not be used'); },
    },
    $transaction: async () => { throw new Error('a transaction of upserts must not be used'); },
  },
}));

import { POST as PRESENCE } from '@/app/api/chat/presence/route';
import { POST as CONTACTS } from '@/app/api/chat/contacts/route';

const PEER = '0x' + 'b'.repeat(40);
const post = (url: string, body: unknown) =>
  new NextRequest(url, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  h.redis.clear();
  h.countCalls = 0;
  h.createMany = [];
});

describe('presence: the contact check is cached', () => {
  it('ten heartbeats for the same chat query Postgres once', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await PRESENCE(post('https://ledgerchat.org/api/chat/presence', { peerAddress: PEER }));
      expect(res.status).toBe(200);
    }
    expect(h.countCalls).toBe(1);
    expect([...h.redis.keys()].some((k) => k.startsWith('presence:mutual:'))).toBe(true);
  });
});

describe('contacts: one statement, not one upsert per peer', () => {
  it('writes the whole list with createMany and skipDuplicates', async () => {
    const peers = Array.from({ length: 50 }, (_, i) => '0x' + i.toString(16).padStart(40, '0'));
    const res = await CONTACTS(post('https://ledgerchat.org/api/chat/contacts', { peers }));
    expect(res.status).toBe(200);
    expect(h.createMany).toHaveLength(1);
    expect(h.createMany[0].skipDuplicates).toBe(true);
    expect(h.createMany[0].data).toHaveLength(50);
  });
});

describe('client hot paths', () => {
  const chat = readFileSync('components/terminal/LedgerChatV2.tsx', 'utf8');
  const xmtp = readFileSync('lib/xmtp/client.ts', 'utf8');
  const account = readFileSync('hooks/useSystemAccount.ts', 'utf8');

  it('the contact list is posted debounced and only when it changed', () => {
    expect(chat).toMatch(/if \(key === contactsSyncedRef\.current\) return;/);
    expect(chat).toMatch(/contactsTimerRef\.current = setTimeout\(/);
  });

  it('typing signals go out every 5 s and stay shown 7 s', () => {
    expect(chat).toMatch(/const TYPING_SIGNAL_EVERY_MS = 5_000;/);
    expect(chat).toMatch(/const TYPING_SHOWN_MS = 7_000;/);
    expect(chat).not.toMatch(/lastTypingTimeRef\.current > 3000/);
  });

  it('peer discovery resolves each DM once instead of every DM every 10 s', () => {
    expect(xmtp).toMatch(/if \(dm\?\.id && seen\.has\(dm\.id\)\) continue;/);
  });

  it('no call to the retired /api/qds/earn', () => {
    expect(account).not.toMatch(/fetch\('\/api\/qds\/earn'/);
  });
});
