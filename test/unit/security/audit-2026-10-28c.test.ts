import { vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * PIN attempt gate (2026-10-28, second pass). DELETE checked the PIN with no
 * counter at all, and POST/PUT used a read-compare-write counter that parallel
 * requests shared. Every PIN check now goes through a shared limiter first.
 */

const { gate, db, ME } = vi.hoisted(() => ({
  ME: '0x00000000000000000000000000000000000c0ffe',
  gate: { allowed: true, calls: [] as string[] },
  db: {
    user: { findUnique: vi.fn(), update: vi.fn(async () => ({})), upsert: vi.fn(async () => ({})) },
    authUser: { findFirst: vi.fn(async () => null), update: vi.fn(async () => ({})) },
  },
}));

vi.mock('@/lib/session', () => ({ getSession: vi.fn(async () => ({ userId: ME })) }));
vi.mock('@/lib/prisma', () => ({ prisma: db, default: db }));
vi.mock('@/lib/security/rateLimiter', () => ({
  checkRateLimit: vi.fn(async (_key: string, opts: { prefix?: string }) => {
    gate.calls.push(opts.prefix ?? '');
    return { allowed: gate.allowed, remaining: 0, resetAt: Math.floor(Date.now() / 1000) + 300 };
  }),
  getClientIP: () => '203.0.113.9',
}));

process.env.ENCLAVE_PIN_PEPPER = 'test-pepper-0123456789abcdef';
process.env.ENCLAVE_PIN_SECRET = 'test-secret-0123456789abcdef-0123456789';

import { POST, PUT, DELETE } from '@/app/api/auth/enclave-pin/route';
import { isRetiredApiRoute } from '@/lib/security/retiredRoutes';

const call = (method: string, body: unknown) =>
  new NextRequest('http://localhost/api/auth/enclave-pin', {
    method,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

beforeEach(() => {
  gate.allowed = true;
  gate.calls = [];
  db.user.findUnique.mockResolvedValue({ id: 'u1', enclavePinHash: 'ab'.repeat(32), enclaveOtpAttempts: 0, enclaveOtpExpiresAt: null });
});

describe('enclave PIN attempt gate', () => {
  it('DELETE with currentPin is counted, and refused once the limit is reached', async () => {
    const wrong = await DELETE(call('DELETE', { currentPin: '000000' }));
    expect(wrong.status).toBe(403);
    expect(gate.calls).toContain('rl:pin');
    expect(gate.calls).toContain('rl:pin-day');

    gate.allowed = false;
    const blocked = await DELETE(call('DELETE', { currentPin: '000001' }));
    expect(blocked.status).toBe(429);
  });

  it('POST verify is refused before the PIN is compared when limited', async () => {
    gate.allowed = false;
    const res = await POST(call('POST', { pin: '123456' }));
    expect(res.status).toBe(429);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it('PUT change with currentPin is gated too', async () => {
    gate.allowed = false;
    const res = await PUT(call('PUT', { currentPin: '123456', newPin: '654321' }));
    expect(res.status).toBe(429);
  });

  it('rejects non-string PIN values', async () => {
    const res = await DELETE(call('DELETE', { currentPin: { length: 6 } }));
    expect(res.status).toBe(400);
  });
});

describe('second Stripe webhook', () => {
  it('/api/payment/webhook is retired at the edge', () => {
    expect(isRetiredApiRoute('/api/payment/webhook')).toBe(true);
  });
});
