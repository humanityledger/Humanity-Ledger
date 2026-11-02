import { vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import {
  revokeSessionToken, isSessionTokenRevoked, __resetRevocationCacheForTests,
} from '@/lib/security/sessionRevocation';
import { expireSessionCookies, revokeRequestSessions, SESSION_TOKEN_COOKIES } from '@/lib/security/sessionCookies';
import { POST as authLogout } from '@/app/api/auth/logout/route';
import { POST as siweLogout } from '@/app/api/siwe/logout/route';

async function token(sub: string, ttl = '7d') {
  return new SignJWT({ sub, address: sub })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(new TextEncoder().encode('test-secret-for-logout-xxxxxxxxxxxxxxxxxxxxxxxx'));
}

function setCookieNames(res: Response): string[] {
  const all = (res.headers as any).getSetCookie?.() ?? [res.headers.get('set-cookie') ?? ''];
  return [...new Set(all.map((c: string) => c.split('=')[0].trim()).filter(Boolean))] as string[];
}

describe('session revocation', () => {
  beforeEach(() => __resetRevocationCacheForTests());

  it('a revoked token is refused, others are not', async () => {
    const a = await token('0x' + 'a'.repeat(40));
    const b = await token('0x' + 'b'.repeat(40));
    expect(await isSessionTokenRevoked(a)).toBe(false);
    await revokeSessionToken(a);
    expect(await isSessionTokenRevoked(a)).toBe(true);
    expect(await isSessionTokenRevoked(b)).toBe(false);
  });

  it('revocation is visible after the in-process cache is gone (shared store)', async () => {
    const a = await token('0x' + 'c'.repeat(40));
    await revokeSessionToken(a);
    __resetRevocationCacheForTests(); // simulates another server instance
    expect(await isSessionTokenRevoked(a)).toBe(true);
  });
});

describe('logout endpoints', () => {
  beforeEach(() => __resetRevocationCacheForTests());

  for (const [name, handler] of [['/api/auth/logout', authLogout], ['/api/siwe/logout', siweLogout]] as const) {
    it(`${name} expires hl_session (the primary cookie) and every other session cookie`, async () => {
      const t = await token('0x' + 'd'.repeat(40));
      const req = new NextRequest('http://localhost/api/x', {
        method: 'POST',
        headers: { cookie: `hl_session=${t}; ledger_session=${t}; human_session=${t}` },
      });
      const res = await (handler as any)(req);
      const names = setCookieNames(res);
      for (const c of SESSION_TOKEN_COOKIES) expect(names).toContain(c);
      expect(names).toContain('hl_session');
      // And the token itself no longer counts as a session anywhere.
      expect(await isSessionTokenRevoked(t)).toBe(true);
    });
  }

  it('expired cookies carry Max-Age=0', () => {
    const res = NextResponse.json({});
    expireSessionCookies(res, 'localhost');
    const all = (res.headers as any).getSetCookie() as string[];
    expect(all.filter(c => c.startsWith('hl_session=')).every(c => /Max-Age=0/.test(c))).toBe(true);
  });

  it('revokes each distinct token once', async () => {
    const t1 = await token('0x' + 'e'.repeat(40));
    const t2 = await token('0x' + 'f'.repeat(40));
    const req = new NextRequest('http://localhost/', { headers: { cookie: `hl_session=${t1}; ledger_session=${t1}; human.access-token=${t2}` } });
    expect(await revokeRequestSessions(req)).toBe(2);
  });
});

describe('getSession after logout', () => {
  beforeEach(() => __resetRevocationCacheForTests());

  it('accepts a session before logout and refuses the same cookie after it', async () => {
    const { mintJWT } = await import('@/lib/jwt');
    const { getSession } = await import('@/lib/session');
    const addr = '0x' + '9'.repeat(40);
    const t = await mintJWT({ sub: addr, address: addr, walletAddress: addr });
    const reqLike = { cookies: { get: (n: string) => (n === 'hl_session' ? { value: t } : undefined) } };

    const before = await getSession(reqLike);
    expect(before?.userId).toBe(addr);

    const logoutReq = new NextRequest('http://localhost/api/auth/logout', { method: 'POST', headers: { cookie: `hl_session=${t}` } });
    await authLogout(logoutReq);

    // An attacker replaying the copied cookie gets nothing.
    expect(await getSession(reqLike)).toBeNull();
  });
});
