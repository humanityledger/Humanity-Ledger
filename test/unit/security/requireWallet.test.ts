import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireWallet } from '@/lib/security/requireWallet';

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    authUser: {
      findUnique: vi.fn(),
    },
  },
}));

import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

describe('requireWallet (A-001)', () => {
  const mockGetSession = vi.mocked(getSession);
  const mockFindUnique = vi.mocked(prisma.authUser.findUnique);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sin sesión → 401 Unauthorized', async () => {
    mockGetSession.mockResolvedValue(null);

    const result = await requireWallet();
    expect(result.walletAddress).toBeUndefined();
    expect(result.errorResponse).toBeDefined();
    expect(result.errorResponse?.status).toBe(401);

    const body = await result.errorResponse!.json();
    expect(body.error).toMatch(/Unauthorized/i);
  });

  it('sesión SIWE → dirección normalizada (lowercase)', async () => {
    const testWallet = '0x1234567890123456789012345678901234567890';
    mockGetSession.mockResolvedValue({
      userId: '0x1234567890123456789012345678901234567890',
      email: '',
      type: 'access',
    });

    const result = await requireWallet();
    expect(result.errorResponse).toBeUndefined();
    expect(result.walletAddress).toBe(testWallet.toLowerCase());
    expect(result.isEmailUser).toBe(false);
  });

  it('email con cartera → su cartera vinculada', async () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    const linkedWallet = '0xAbCdEf1234567890123456789012345678901234';

    mockGetSession.mockResolvedValue({
      userId: uuid,
      email: 'user@example.com',
      type: 'access',
    });

    mockFindUnique.mockResolvedValue({
      walletAddress: linkedWallet,
      email: 'user@example.com',
    } as any);

    const result = await requireWallet();
    expect(result.errorResponse).toBeUndefined();
    expect(result.walletAddress).toBe(linkedWallet.toLowerCase());
    expect(result.isEmailUser).toBe(true);
  });

  it('email sin cartera → 403 Forbidden', async () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000';

    mockGetSession.mockResolvedValue({
      userId: uuid,
      email: 'nowallet@example.com',
      type: 'access',
    });

    mockFindUnique.mockResolvedValue({
      walletAddress: null,
      email: 'nowallet@example.com',
    } as any);

    const result = await requireWallet();
    expect(result.walletAddress).toBeUndefined();
    expect(result.errorResponse).toBeDefined();
    expect(result.errorResponse?.status).toBe(403);

    const body = await result.errorResponse!.json();
    expect(body.error).toMatch(/Forbidden/i);
  });
});
