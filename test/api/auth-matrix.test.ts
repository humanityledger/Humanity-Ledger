import { vi } from 'vitest';

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
}));

import { getSession } from '@/lib/session';
import { requireWallet } from '@/lib/security/requireWallet';

const PROTECTED_ROUTES = [
  '/api/chat/direct',
  '/api/chat/queue',
  '/api/chat/contacts',
  '/api/chat/communities',
  '/api/chat/communities/posts',
  '/api/chat/presence',
  '/api/user/export',
  '/api/events',
  '/api/communities/reports',
];

describe('J-009: Auth Matrix — Protected Routes require valid session', () => {
  const mockGetSession = vi.mocked(getSession);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const route of PROTECTED_ROUTES) {
    it(`rejects unauthenticated request to ${route} with 401`, async () => {
      mockGetSession.mockResolvedValue(null);

      const result = await requireWallet();
      expect(result.walletAddress).toBeUndefined();
      expect(result.errorResponse).toBeDefined();
      expect(result.errorResponse?.status).toBe(401);

      const body = await result.errorResponse!.json();
      expect(body.error).toMatch(/Unauthorized/i);
    });

    it(`accepts valid SIWE session for ${route}`, async () => {
      const validAddress = '0x1111222233334444555566667777888899990000';
      mockGetSession.mockResolvedValue({
        userId: validAddress,
        email: '',
        type: 'access',
      });

      const result = await requireWallet();
      expect(result.errorResponse).toBeUndefined();
      expect(result.walletAddress).toBe(validAddress.toLowerCase());
    });
  }
});
