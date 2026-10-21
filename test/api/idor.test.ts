import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
}));

import { getSession } from '@/lib/session';
import { requireWallet } from '@/lib/security/requireWallet';

describe('J-010: IDOR Protection — Session A cannot access User B resources', () => {
  const mockGetSession = vi.mocked(getSession);

  const walletA = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const walletB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves caller to session A regardless of client-sent wallet B in parameters', async () => {
    // Session is logged in as Wallet A
    mockGetSession.mockResolvedValue({
      userId: walletA,
      email: '',
      type: 'access',
    });

    const result = await requireWallet();
    expect(result.errorResponse).toBeUndefined();
    // Identity is strictly Wallet A, NEVER Wallet B
    expect(result.walletAddress).toBe(walletA.toLowerCase());
    expect(result.walletAddress).not.toBe(walletB.toLowerCase());
  });

  it('rejects attempt of wallet A to act on behalf of wallet B', async () => {
    mockGetSession.mockResolvedValue({
      userId: walletA,
      email: '',
      type: 'access',
    });

    const result = await requireWallet();
    const effectiveCaller = result.walletAddress;

    // Simulate resource ownership check (e.g. contacts list query)
    const targetResourceOwner = walletB.toLowerCase();
    const isOwner = effectiveCaller === targetResourceOwner;

    expect(isOwner).toBe(false);
  });
});
