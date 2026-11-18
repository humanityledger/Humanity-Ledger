/**
 * IR-01 (internal security review, 18 November 2026): a refresh token revoked by logout, or
 * already rotated, never mints a new session.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  revoked: new Set<string>(),
  cookie: 'refresh-A' as string | undefined,
  setSessionCookies: vi.fn(async () => {}),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (n === 'human.refresh-token' && m.cookie ? { value: m.cookie } : undefined) }),
}));
vi.mock('@/lib/security/sessionRevocation', () => ({
  isSessionTokenRevoked: async (t: string) => m.revoked.has(t),
  revokeSessionToken: async (t: string) => {
    m.revoked.add(t);
  },
}));
vi.mock('@/lib/session', () => ({
  verifyToken: async () => ({ type: 'refresh', userId: '0x2222222222222222222222222222222222222222', email: null }),
  createAccessToken: async () => 'access-new',
  createRefreshToken: async () => 'refresh-new',
  setSessionCookies: m.setSessionCookies,
  generateFingerprint: () => 'fp',
  validateFingerprint: () => true,
}));

import { POST } from '@/app/api/auth/refresh/route';

const req = () => new Request('https://ledgerchat.org/api/auth/refresh', { method: 'POST' }) as any;

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    m.revoked.clear();
    m.cookie = 'refresh-A';
    m.setSessionCookies.mockClear();
  });

  it('a refresh token revoked by logout is refused and mints nothing', async () => {
    m.revoked.add('refresh-A');
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(m.setSessionCookies).not.toHaveBeenCalled();
  });

  it('a refresh token works once: the rotation revokes it', async () => {
    expect((await POST(req())).status).toBe(200);
    expect(m.revoked.has('refresh-A')).toBe(true);
    const replay = await POST(req());
    expect(replay.status).toBe(401);
    expect(m.setSessionCookies).toHaveBeenCalledTimes(1);
  });
});
