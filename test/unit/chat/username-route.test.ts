import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// An in-memory table with the same unique indexes as prisma/schema.prisma (ChatUsername):
// a second row with the same username or linkToken fails with P2002, as Postgres does.
const db = vi.hoisted(() => {
  type Row = { walletAddress: string; username: string; linkToken: string };
  const rows = new Map<string, Row>();
  const unique = (field: 'username' | 'linkToken', value: string, except?: string) => {
    for (const r of rows.values()) {
      if (r[field] === value && r.walletAddress !== except) {
        throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002', meta: { target: [field] } });
      }
    }
  };
  const chatUsername = {
    findUnique: async ({ where }: any) => {
      if (where.walletAddress) return rows.get(where.walletAddress) ?? null;
      for (const r of rows.values()) if ((where.username && r.username === where.username) || (where.linkToken && r.linkToken === where.linkToken)) return r;
      return null;
    },
    findMany: async ({ where }: any) => [...rows.values()].filter((r) => (where.username?.in ?? []).includes(r.username)),
    create: async ({ data }: any) => {
      // Yield first, so two concurrent saves really interleave.
      await new Promise((r) => setTimeout(r, 0));
      unique('username', data.username);
      unique('linkToken', data.linkToken);
      const row = { ...data };
      rows.set(data.walletAddress, row);
      return row;
    },
    update: async ({ where, data }: any) => {
      await new Promise((r) => setTimeout(r, 0));
      const cur = rows.get(where.walletAddress)!;
      if (data.username) unique('username', data.username, cur.walletAddress);
      if (data.linkToken) unique('linkToken', data.linkToken, cur.walletAddress);
      const row = { ...cur, ...data };
      rows.set(cur.walletAddress, row);
      return row;
    },
    deleteMany: async ({ where }: any) => {
      rows.delete(where.walletAddress);
      return { count: 1 };
    },
  };
  return { rows, prisma: { chatUsername, user: { findUnique: async () => null } }, caller: { current: '' as string } };
});

vi.mock('@/lib/prisma', () => ({ prisma: db.prisma }));
vi.mock('@/lib/security/verifiedCaller', () => ({ getVerifiedCaller: async () => db.caller.current || null }));
vi.mock('@/lib/security/rateLimiter', () => ({ checkRateLimit: async () => ({ allowed: true }) }));

import { DELETE, GET, POST, PUT } from '@/app/api/chat/username/route';
import { GET as LOOKUP } from '@/app/api/chat/username/lookup/route';
import { POST as OPEN_LINK } from '@/app/api/chat/username/link/route';

const A = '0x' + 'a'.repeat(40);
const B = '0x' + 'b'.repeat(40);
const req = (method: string, body?: unknown, url = 'https://ledgerchat.org/api/chat/username') =>
  new NextRequest(url, { method, body: body ? JSON.stringify(body) : undefined, headers: { 'content-type': 'application/json' } });
const as = (who: string) => (db.caller.current = who);

beforeEach(() => {
  db.rows.clear();
  as('');
});

describe('/api/chat/username', () => {
  it('signed-in wallets only', async () => {
    expect((await GET(req('GET'))).status).toBe(401);
    expect((await PUT(req('PUT', { username: 'stefan' }))).status).toBe(401);
  });

  it('reserves a name in its canonical form, with a 22-character link token', async () => {
    as(A);
    const res = await PUT(req('PUT', { username: '@Stefan' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.username).toBe('stefan');
    expect(body.linkToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('a name another account holds cannot be saved, in any capitalisation, and free endings are offered', async () => {
    as(A);
    await PUT(req('PUT', { username: 'stefan' }));
    as(B);
    for (const attempt of ['stefan', 'STEFAN', '@Stefan', ' stefan ']) {
      const res = await PUT(req('PUT', { username: attempt }));
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.problem).toBe('taken');
      expect(body.suggestions.length).toBeGreaterThan(0);
      for (const s of body.suggestions) expect(s).toMatch(/^stefan\.\d{2}$/);
    }
    expect(db.rows.get(B)).toBeUndefined();
  });

  it('two accounts saving the same name at the same instant: exactly one gets it', async () => {
    const tries = await Promise.all([A, B].map(async (who) => {
      as(who);
      return PUT(req('PUT', { username: 'race' }));
    }));
    expect(tries.map((r) => r.status).sort()).toEqual([200, 409]);
    expect([...db.rows.values()].filter((r) => r.username === 'race')).toHaveLength(1);
  });

  it('refuses invalid and reserved names with the reason', async () => {
    as(A);
    for (const [name, problem] of [['ab', 'short'], ['admin', 'reserved'], ['0xabc', 'address'], ['stéfan', 'chars']] as const) {
      const res = await PUT(req('PUT', { username: name }));
      expect(res.status).toBe(400);
      expect((await res.json()).problem).toBe(problem);
    }
  });

  it('changing a name frees the old one; the link stays until it is reset', async () => {
    as(A);
    const first = await (await PUT(req('PUT', { username: 'first' }))).json();
    const second = await (await PUT(req('PUT', { username: 'second' }))).json();
    expect(second.linkToken).toBe(first.linkToken);
    as(B);
    expect((await PUT(req('PUT', { username: 'first' }))).status).toBe(200);
  });

  it('reset gives a new link; the old one stops opening the chat', async () => {
    as(A);
    const { linkToken: old } = await (await PUT(req('PUT', { username: 'linker' }))).json();
    const { linkToken: fresh } = await (await POST(req('POST', { action: 'reset-link' }))).json();
    expect(fresh).not.toBe(old);
    as(B);
    expect((await OPEN_LINK(req('POST', { token: old }, 'https://ledgerchat.org/api/chat/username/link'))).status).toBe(404);
    const ok = await OPEN_LINK(req('POST', { token: fresh }, 'https://ledgerchat.org/api/chat/username/link'));
    expect(ok.status).toBe(200);
    expect((await ok.json()).address).toBe(A);
  });

  it('lookup is exact: a prefix finds nobody', async () => {
    as(A);
    await PUT(req('PUT', { username: 'stefan' }));
    as(B);
    const hit = await LOOKUP(req('GET', undefined, 'https://ledgerchat.org/api/chat/username/lookup?u=%40Stefan'));
    expect(hit.status).toBe(200);
    expect((await hit.json()).address).toBe(A);
    expect((await LOOKUP(req('GET', undefined, 'https://ledgerchat.org/api/chat/username/lookup?u=ste'))).status).toBe(404);
  });

  it('delete frees the name', async () => {
    as(A);
    await PUT(req('PUT', { username: 'leaving' }));
    await DELETE(req('DELETE'));
    as(B);
    expect((await PUT(req('PUT', { username: 'leaving' }))).status).toBe(200);
  });

  it('a missing table (P2021, the 18 Nov 2026 deploy) answers 503 with a sentence, never a bare 500', async () => {
    as(A);
    const missing = () => Promise.reject(Object.assign(new Error('The table `public.ChatUsername` does not exist'), { code: 'P2021' }));
    const spy = vi.spyOn(db.prisma.chatUsername, 'findUnique').mockImplementation(missing as any);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      for (const res of [await GET(req('GET')), await PUT(req('PUT', { username: 'stefan' })), await LOOKUP(req('GET', undefined, 'https://ledgerchat.org/api/chat/username/lookup?u=stefan'))]) {
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.problem).toBe('unavailable');
        expect(body.error).toMatch(/not available right now/);
      }
    } finally {
      spy.mockRestore();
      err.mockRestore();
    }
  });
});
