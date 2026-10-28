import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
// Set env variable BEFORE importing route so OpenAI initializes
process.env.OPENAI_API_KEY = 'test-key-mock';

import { POST } from '../../../app/api/passport/route';
import { prisma } from '../../../lib/prisma';

// 1. Mock Session
vi.mock('../../../lib/session', () => ({
  getSession: vi.fn().mockResolvedValue({ userId: '0xInstitutionalWallet' })
}));

// 2. Mock Prisma
const { prismaMock } = vi.hoisted(() => {
  const mock: any = {
    productPassport: {
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'mock-id',
        publicSlug: 'mock-slug',
        createdAt: new Date(),
        events: []
      }),
      update: vi.fn().mockResolvedValue({})
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ tier: 'CRYPTOGRAPHIC' })
    },
    $transaction: vi.fn().mockImplementation(async (cb: any) => typeof cb === 'function' ? cb(mock) : Promise.all(cb))
  };
  return { prismaMock: mock };
});

vi.mock('../../../lib/prisma', () => ({
  prisma: prismaMock
}));

// 3. Mock OpenAI for Semantic Validation
vi.mock('openai', () => {
  return {
    // A regular function: the route calls `new OpenAI()`, and Vitest 4+ does
    // not allow arrow-function mocks to be used as constructors.
    default: vi.fn().mockImplementation(function () { return ({
      chat: {
        completions: {
          create: vi.fn().mockImplementation(async (args: any) => {
            const data = JSON.parse(args.messages[1].content);
            const { title, category, batchId } = data;
            
            // Artificial Semantic Logic for Testing
            if (category === 'FOOD' && title.toLowerCase().includes('iphone')) {
              return { choices: [{ message: { content: JSON.stringify({ valid: false, reason: "Food category does not match electronic item." }) } }] };
            }
            if (category === 'DOCUMENTS' && batchId === 'WATER-BOTTLE-123') {
              return { choices: [{ message: { content: JSON.stringify({ valid: false, reason: "Document batch ID resembles a liquid container." }) } }] };
            }
            if (title.toLowerCase().includes('test') || title.toLowerCase().includes('fake')) {
              return { choices: [{ message: { content: JSON.stringify({ valid: false, reason: "Testing/Fake data detected." }) } }] };
            }
            return { choices: [{ message: { content: JSON.stringify({ valid: true }) } }] };
          })
        }
      }
    }); })
  };
});

function createMockRequest(body: any): NextRequest {
  return new NextRequest('http://localhost:3000/api/passport', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

describe('Studio Provenance - Sovereign Mass Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Executes 50 INVALID requests (Syntax, Semantic, and Rate Limit bounds)', async () => {
    let failedCount = 0;
    const invalidScenarios = [];

    // Scenario A: Schema/Regex Violations (lowercase batch, invalid chars)
    for (let i = 0; i < 20; i++) {
      invalidScenarios.push({
        title: `Invalid Item ${i}!@#`, // Invalid chars
        category: 'PHARMA',
        payload: { batchId: `lowercase-batch-${i}` } // Lowercase not allowed
      });
    }

    // Scenario B: Semantic Mismatches (Caught by AI)
    for (let i = 0; i < 20; i++) {
      invalidScenarios.push({
        title: `iPhone 16 Pro Max - Unit ${i}`,
        category: 'FOOD', // AI will reject
        payload: { batchId: `IPHONE-BATCH-${i}` }
      });
    }

    // Scenario C: Spam/Fake Data Checks
    for (let i = 0; i < 10; i++) {
      invalidScenarios.push({
        title: `fake book ${i}`,
        category: 'DOCUMENTS',
        payload: { batchId: `WATER-BOTTLE-123` } // AI will reject
      });
    }

    for (const body of invalidScenarios) {
      const req = createMockRequest(body);
      const res = await POST(req);
      if (res.status === 400 || res.status === 429) {
        failedCount++;
      }
    }
    
    expect(failedCount).toBe(50);
  });

  it('Executes 50 VALID requests (Real products passing strict sovereign filters)', async () => {
    let successCount = 0;
    const validScenarios = [];

    // Generate 50 perfectly valid sovereign products
    for (let i = 0; i < 50; i++) {
      validScenarios.push({
        title: `Paracetamol 500mg Pfizer Box ${i}`,
        category: 'PHARMA',
        payload: { 
          batchId: `PFZ-2026-X${i}`,
          description: `Medical shipment unit ${i}. Compliant with EU health regulations.`,
          origin: 'Germany'
        },
        gs1Gtin: `0001234567890${i % 10}`
      });
    }

    for (const body of validScenarios) {
      const req = createMockRequest(body);
      const res = await POST(req);
      
      if (res.status === 201) {
        successCount++;
      } else {
        console.error('Unexpected failure:', await res.json());
      }
    }

    expect(successCount).toBe(50);
  });

  it('Strictly enforces 5 req/min Rate Limit per Institution', async () => {
    // Override prisma count to simulate rate limit hit
    vi.mocked(prisma.productPassport.count).mockResolvedValue(5);

    const req = createMockRequest({
      title: 'Valid Product But Rate Limited',
      category: 'PHARMA',
      payload: { batchId: 'VALID-BATCH' }
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    
    const data = await res.json();
    expect(data.error).toContain('Rate limit exceeded');
  });
});
