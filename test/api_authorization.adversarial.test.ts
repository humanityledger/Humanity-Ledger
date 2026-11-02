/**
 * API Perimeter and Authorization Adversarial Tests
 * Covers IDOR, privilege escalation, JWT manipulation, rate limit bypass,
 * mass assignment, input injection, and multi-tenant isolation attacks.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createHmac } from 'crypto';

// ---------------------------------------------------------------------------
// Simulated API Layer
// ---------------------------------------------------------------------------

interface User {
  id: string;
  role: 'user' | 'admin' | 'relayer';
  walletAddress: string;
  communityIds: string[];
}

interface JWTPayload {
  sub: string;
  role: 'user' | 'admin' | 'relayer';
  walletAddress: string;
  exp: number;
  iat: number;
}

const JWT_SECRET = 'test-secret-key-do-not-use-in-production';

function signJWT(payload: JWTPayload): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyJWT(token: string): JWTPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('JWT_INVALID: malformed token');

  const [header, body, sig] = parts;
  const expectedSig = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  if (sig !== expectedSig) throw new Error('JWT_INVALID: signature mismatch');

  const payload: JWTPayload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('JWT_EXPIRED');

  return payload;
}

// Simulated authorization guard
function requireRole(payload: JWTPayload, required: 'user' | 'admin' | 'relayer'): void {
  if (payload.role !== required && payload.role !== 'admin') {
    throw new Error(`FORBIDDEN: requires role '${required}', got '${payload.role}'`);
  }
}

// Simulated resource ownership check (IDOR prevention)
function requireOwnership(payload: JWTPayload, resourceOwnerId: string): void {
  if (payload.sub !== resourceOwnerId && payload.role !== 'admin') {
    throw new Error(`IDOR_BLOCKED: user '${payload.sub}' cannot access resource of '${resourceOwnerId}'`);
  }
}

// Simulated rate limit state (per user, per window)
const rateLimitStore: Map<string, { count: number; resetAt: number }> = new Map();

function checkRateLimit(userId: string, maxRequests: number, windowMs: number): void {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + windowMs });
    return;
  }
  entry.count++;
  if (entry.count > maxRequests) {
    throw new Error(`RATE_LIMIT_EXCEEDED: user '${userId}' exceeded ${maxRequests} requests in ${windowMs}ms`);
  }
}

// Simulated input sanitizer
function sanitizeInput(input: string): string {
  // Block SQL injection patterns
  const sqlPatterns = [/'\s*OR\s*'1'\s*=\s*'1/i, /;\s*DROP\s+TABLE/i, /UNION\s+SELECT/i];
  for (const pattern of sqlPatterns) {
    if (pattern.test(input)) throw new Error('SQL_INJECTION_DETECTED');
  }
  // Block NoSQL injection
  if (input.includes('$where') || input.includes('$gt') || input.includes('$ne')) {
    throw new Error('NOSQL_INJECTION_DETECTED');
  }
  return input.trim().slice(0, 1000);
}

// Simulated mass assignment guard
function safeUpdateUser(
  updates: Record<string, unknown>,
  allowedFields: string[]
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in updates) filtered[field] = updates[field];
  }
  return filtered;
}

// Simulated multi-tenant community isolation
const communityData: Map<string, { ownerId: string; name: string }> = new Map([
  ['community-1', { ownerId: 'user-alice', name: 'Alice Community' }],
  ['community-2', { ownerId: 'user-bob', name: 'Bob Community' }],
]);

function getCommunityData(userId: string, communityId: string): { name: string } {
  const community = communityData.get(communityId);
  if (!community) throw new Error('COMMUNITY_NOT_FOUND');
  if (community.ownerId !== userId) throw new Error('COMMUNITY_ACCESS_DENIED: cross-tenant isolation');
  return { name: community.name };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('API Perimeter and Authorization Adversarial Hardening', () => {
  beforeEach(() => {
    rateLimitStore.clear();
  });

  const now = Math.floor(Date.now() / 1000);

  const alicePayload: JWTPayload = {
    sub: 'user-alice',
    role: 'user',
    walletAddress: '0x' + 'a1'.repeat(20),
    exp: now + 3600,
    iat: now,
  };
  const bobPayload: JWTPayload = {
    sub: 'user-bob',
    role: 'user',
    walletAddress: '0x' + 'b2'.repeat(20),
    exp: now + 3600,
    iat: now,
  };

  // --- JWT Security ---
  it('API-01: valid JWT is accepted', () => {
    const token = signJWT(alicePayload);
    expect(() => verifyJWT(token)).not.toThrow();
  });

  it('API-02: tampered JWT payload is rejected (signature mismatch)', () => {
    const token = signJWT(alicePayload);
    const parts = token.split('.');
    // Tamper with payload: change role to admin
    const tamperedBody = Buffer.from(JSON.stringify({ ...alicePayload, role: 'admin' })).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedBody}.${parts[2]}`;
    expect(() => verifyJWT(tamperedToken)).toThrow('JWT_INVALID: signature mismatch');
  });

  it('API-03: expired JWT is rejected', () => {
    const expiredPayload: JWTPayload = { ...alicePayload, exp: now - 1 };
    const token = signJWT(expiredPayload);
    expect(() => verifyJWT(token)).toThrow('JWT_EXPIRED');
  });

  it('API-04: malformed JWT (wrong number of segments) is rejected', () => {
    expect(() => verifyJWT('not.a.valid.jwt.token')).toThrow('JWT_INVALID: malformed token');
  });

  it('API-05: alg:none attack is blocked (token with removed signature)', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ ...alicePayload, role: 'admin' })).toString('base64url');
    const algNoneToken = `${header}.${body}.`;
    expect(() => verifyJWT(algNoneToken)).toThrow('JWT_INVALID');
  });

  // --- IDOR ---
  it('API-06: user cannot access another user\'s resource (IDOR blocked)', () => {
    expect(() => requireOwnership(alicePayload, 'user-bob')).toThrow('IDOR_BLOCKED');
  });

  it('API-07: user can access their own resource', () => {
    expect(() => requireOwnership(alicePayload, 'user-alice')).not.toThrow();
  });

  it('API-08: admin can access any user\'s resource', () => {
    const adminPayload: JWTPayload = { ...alicePayload, role: 'admin', sub: 'user-admin' };
    expect(() => requireOwnership(adminPayload, 'user-bob')).not.toThrow();
  });

  // --- Privilege Escalation ---
  it('API-09: user cannot call admin-only endpoint (privilege escalation blocked)', () => {
    expect(() => requireRole(alicePayload, 'admin')).toThrow('FORBIDDEN');
  });

  it('API-10: relayer role cannot escalate to admin', () => {
    const relayerPayload: JWTPayload = { ...alicePayload, role: 'relayer', sub: 'relayer-1' };
    expect(() => requireRole(relayerPayload, 'admin')).toThrow('FORBIDDEN');
  });

  // --- Rate Limiting ---
  it('API-11: rate limit blocks excessive requests from same user', () => {
    // Allow 5 requests per window
    for (let i = 0; i < 5; i++) checkRateLimit('user-alice', 5, 60000);
    expect(() => checkRateLimit('user-alice', 5, 60000)).toThrow('RATE_LIMIT_EXCEEDED');
  });

  it('API-12: rate limit is per-user (user A limit does not affect user B)', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('user-alice', 5, 60000);
    expect(() => checkRateLimit('user-alice', 5, 60000)).toThrow('RATE_LIMIT_EXCEEDED');
    // Bob's counter is independent
    expect(() => checkRateLimit('user-bob', 5, 60000)).not.toThrow();
  });

  // --- Input Injection ---
  it('API-13: SQL injection in username input is blocked', () => {
    expect(() => sanitizeInput("' OR '1'='1")).toThrow('SQL_INJECTION_DETECTED');
  });

  it('API-14: SQL DROP TABLE injection is blocked', () => {
    expect(() => sanitizeInput('; DROP TABLE users;')).toThrow('SQL_INJECTION_DETECTED');
  });

  it('API-15: NoSQL injection with $where is blocked', () => {
    expect(() => sanitizeInput('{"$where": "this.password == 1"}')).toThrow('NOSQL_INJECTION_DETECTED');
  });

  it('API-16: valid input passes sanitization', () => {
    const result = sanitizeInput('alice.eth');
    expect(result).toBe('alice.eth');
  });

  // --- Mass Assignment ---
  it('API-17: mass assignment cannot set role field (not in allowedFields)', () => {
    const maliciousUpdate = { username: 'alice', role: 'admin', walletAddress: '0x1234' };
    const allowed = ['username', 'walletAddress'];
    const safe = safeUpdateUser(maliciousUpdate, allowed);
    expect(safe).not.toHaveProperty('role');
    expect(safe.username).toBe('alice');
  });

  it('API-18: mass assignment cannot set internal id field', () => {
    const maliciousUpdate = { username: 'alice', id: 'admin-account-id' };
    const allowed = ['username'];
    const safe = safeUpdateUser(maliciousUpdate, allowed);
    expect(safe).not.toHaveProperty('id');
  });

  // --- Multi-Tenant Isolation ---
  it('API-19: user cannot read another tenant\'s community data (cross-tenant isolation)', () => {
    // Alice tries to read Bob's community
    expect(() => getCommunityData('user-alice', 'community-2')).toThrow('COMMUNITY_ACCESS_DENIED');
  });

  it('API-20: user can read their own community data', () => {
    const data = getCommunityData('user-alice', 'community-1');
    expect(data.name).toBe('Alice Community');
  });
});
