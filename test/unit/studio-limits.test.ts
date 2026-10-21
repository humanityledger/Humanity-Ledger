import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../app/api/passport/route';
import { NextRequest } from 'next/server';
import { prisma } from '../../lib/prisma';
import { sequencer } from '../../lib/provenance/qd-sequencer';

// Mock the dependencies
vi.mock('../../lib/prisma', () => {
  const mockPrisma: any = {
    productPassport: {
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (cbOrArray: any) => {
      if (typeof cbOrArray === 'function') {
        return cbOrArray(mockPrisma);
      }
      if (Array.isArray(cbOrArray)) {
        return Promise.all(cbOrArray);
      }
      return cbOrArray;
    }),
  };
  return { prisma: mockPrisma };
});

vi.mock('../../lib/session', () => ({
  getSession: vi.fn()
}));

vi.mock('../../lib/provenance/qd-sequencer', () => ({
  sequencer: {
    submitPassportToAztec: vi.fn().mockResolvedValue(true)
  }
}));

// Mock Next.js NextResponse
vi.mock('next/server', async () => {
  const actual = await vi.importActual('next/server');
  return {
    ...actual as any,
    NextResponse: {
      json: vi.fn((data, init) => {
        return {
          status: init?.status || 200,
          json: async () => data,
        };
      })
    }
  };
});

describe('Studio Provenance Plan Limits', () => {
  let mockGetSession: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetSession = (await import('../../lib/session')).getSession;
  });

  const createMockRequest = (body: any) => {
    return {
      json: async () => body
    } as unknown as NextRequest;
  };

  const validPayload = {
    title: 'Test Product',
    category: 'TECH',
    payload: { batchId: '001', description: 'Test' }
  };

  it('allows the Owner Wallet to create infinite passports (bypasses limits)', async () => {
    mockGetSession.mockResolvedValue({ userId: '0x78831c25c86ea2a78a6127fc2ccb95e612d87b4a' });
    const req = createMockRequest(validPayload);
    
    // Simulate 1000 passports already existing in DB
    vi.mocked(prisma.productPassport.count).mockResolvedValue(1000);
    vi.mocked(prisma.productPassport.create).mockResolvedValue({ id: 'owner-1', createdAt: new Date(), events: [] } as any);

    const res = await POST(req) as any;
    expect(res.status).toBe(201);
    expect(prisma.productPassport.count).not.toHaveBeenCalled(); // Owner bypasses count entirely
    expect(sequencer.submitPassportToAztec).toHaveBeenCalled(); // Ensure Aztec is triggered
  });

  it('blocks FREE tier users who try to create more than 3 passports', async () => {
    mockGetSession.mockResolvedValue({ userId: '0xnormalUser' });
    const req = createMockRequest(validPayload);
    
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ tier: 'FREE' } as any);
    // User already has 3 passports
    vi.mocked(prisma.productPassport.count).mockResolvedValue(3);

    const res = await POST(req) as any;
    const data = await res.json();
    
    expect(res.status).toBe(403);
    expect(data.error).toContain('Free tier limit reached');
    expect(prisma.productPassport.create).not.toHaveBeenCalled();
    expect(sequencer.submitPassportToAztec).not.toHaveBeenCalled();
  });

  it('allows FREE tier users to create if under 3 passports', async () => {
    mockGetSession.mockResolvedValue({ userId: '0xnormalUser' });
    const req = createMockRequest(validPayload);
    
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ tier: 'FREE' } as any);
    vi.mocked(prisma.productPassport.count).mockImplementation(async (args: any) => {
      // Return 0 for rate limit (minute), and 2 for lifetime count
      if (args.where.createdAt) return 0;
      return 2;
    });
    vi.mocked(prisma.productPassport.create).mockResolvedValue({ id: 'free-user-3', createdAt: new Date(), events: [] } as any);

    const res = await POST(req) as any;
    expect(res.status).toBe(201);
    expect(prisma.productPassport.create).toHaveBeenCalled();
    expect(sequencer.submitPassportToAztec).toHaveBeenCalledWith('free-user-3', expect.any(Object));
  });
});
