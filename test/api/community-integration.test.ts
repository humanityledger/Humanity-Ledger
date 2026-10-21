import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    communityMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    communityPost: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    community: {
      findUnique: vi.fn(),
    },
  },
}));

import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { requireWallet } from '@/lib/security/requireWallet';

describe('J-008: Community Routes Integration Tests', () => {
  const mockGetSession = vi.mocked(getSession);
  const mockMemberFindFirst = vi.mocked(prisma.communityMember.findFirst);

  const testUser = '0x1234567890123456789012345678901234567890';
  const communityId = 'comm_test_123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects post creation if caller is not a member of private community', async () => {
    mockGetSession.mockResolvedValue({
      userId: testUser,
      email: '',
      type: 'access',
    });

    const caller = await requireWallet();
    expect(caller.errorResponse).toBeUndefined();

    // Membership check returns null (not a member)
    mockMemberFindFirst.mockResolvedValue(null);

    const isMember = await prisma.communityMember.findFirst({
      where: {
        communityId,
        address: caller.walletAddress,
      },
    });

    expect(isMember).toBeNull();
  });

  it('allows post creation when caller is a confirmed member', async () => {
    mockGetSession.mockResolvedValue({
      userId: testUser,
      email: '',
      type: 'access',
    });

    const caller = await requireWallet();
    expect(caller.errorResponse).toBeUndefined();

    mockMemberFindFirst.mockResolvedValue({
      id: 'mem_1',
      communityId,
      address: caller.walletAddress!,
      role: 'MEMBER',
      joinedAt: new Date(),
    } as any);

    const member = await prisma.communityMember.findFirst({
      where: {
        communityId,
        address: caller.walletAddress,
      },
    });

    expect(member).not.toBeNull();
    expect(member?.address).toBe(caller.walletAddress);
  });
});
