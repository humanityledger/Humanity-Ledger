import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { matchesPrefix, isPublicPath, checkCsrf } from '@/middleware';

/**
 * Regression tests for the identity perimeter.
 *
 * Each block below pins a specific defect that was present in the middleware
 * and would silently come back if the logic were simplified again. These are
 * assertions about what must be REFUSED — a test that only checks the happy
 * path would still pass against the broken versions.
 */

function mutation(headers: Record<string, string>, url = 'https://ledger.example/api/chat/send') {
  return new NextRequest(url, { method: 'POST', headers });
}

describe('matchesPrefix — public prefixes match only at a path boundary', () => {
  it('matches the prefix itself', () => {
    expect(matchesPrefix('/api/settings', '/api/settings')).toBe(true);
  });

  it('matches a child path', () => {
    expect(matchesPrefix('/api/settings/sync', '/api/settings')).toBe(true);
  });

  it('treats a trailing slash in the prefix as equivalent', () => {
    expect(matchesPrefix('/api/auth', '/api/auth/')).toBe(true);
    expect(matchesPrefix('/api/auth/verify', '/api/auth/')).toBe(true);
  });

  // The defect: `pathname.startsWith(prefix)` made every one of these public.
  it.each([
    ['/api/settingsExport', '/api/settings'],
    ['/api/settings-debug', '/api/settings'],
    ['/api/healthz-internal', '/api/health'],
    ['/api/statuses', '/api/status'],
    ['/api/user/profiles/all', '/api/user/profile'],
    ['/api/chat/stories-admin', '/api/chat/stories'],
    ['/api/authorize', '/api/auth/'],
  ])('does NOT match %s against %s', (pathname, prefix) => {
    expect(matchesPrefix(pathname, prefix)).toBe(false);
  });
});

describe('isPublicPath — sibling routes do not inherit a neighbour’s exemption', () => {
  it('keeps the documented public routes public', () => {
    expect(isPublicPath('/api/auth/nonce')).toBe(true);
    expect(isPublicPath('/api/health')).toBe(true);
    expect(isPublicPath('/api/chat/users/search')).toBe(true);
  });

  it('keeps protected routes protected', () => {
    expect(isPublicPath('/api/chat/direct')).toBe(false);
    expect(isPublicPath('/api/zk/balance')).toBe(false);
    expect(isPublicPath('/api/zk/transfer')).toBe(false);
  });

  it('does not exempt a route that merely shares a prefix string', () => {
    expect(isPublicPath('/api/settingsExport')).toBe(false);
    expect(isPublicPath('/api/authorize')).toBe(false);
  });
});

describe('checkCsrf — fails closed on state-changing API calls', () => {
  const OLD = process.env.NEXT_PUBLIC_APP_URL;
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://ledger.example';
  });
  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = OLD;
  });

  it('rejects an explicit cross-site mutation', () => {
    const res = checkCsrf(mutation({ 'sec-fetch-site': 'cross-site' }));
    expect(res?.status).toBe(403);
  });

  // The defect: omitting the header skipped the check entirely.
  it('rejects a mutation that carries neither Fetch Metadata nor an Origin', () => {
    const res = checkCsrf(mutation({}));
    expect(res?.status).toBe(403);
  });

  it('rejects a mutation whose Origin is not allowed', () => {
    const res = checkCsrf(mutation({ origin: 'https://attacker.example' }));
    expect(res?.status).toBe(403);
  });

  it('allows a same-origin mutation', () => {
    expect(checkCsrf(mutation({ 'sec-fetch-site': 'same-origin' }))).toBeNull();
  });

  it('allows a same-site mutation', () => {
    expect(checkCsrf(mutation({ 'sec-fetch-site': 'same-site' }))).toBeNull();
  });

  it('allows a client without Fetch Metadata that presents the app Origin', () => {
    expect(checkCsrf(mutation({ origin: 'https://ledger.example' }))).toBeNull();
  });

  it('allows the Capacitor WebView origin', () => {
    expect(checkCsrf(mutation({ origin: 'capacitor://localhost' }))).toBeNull();
  });
});
