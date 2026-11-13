/** Only Ledger Chat ships: retired page paths redirect, kept ones are served. */
import { describe, it, expect } from 'vitest';
import { retiredPageTarget } from '@/lib/security/retiredRoutes';

describe('retiredPageTarget', () => {
  it('sends the old app hub and other products to the chat', () => {
    expect(retiredPageTarget('/hub')).toBe('/chat');
    expect(retiredPageTarget('/hub/anything?x=1')).toBe('/chat');
    expect(retiredPageTarget('/terminal')).toBe('/chat');
    expect(retiredPageTarget('/portfolio')).toBe('/chat');
  });
  it('sends sign-in pages to /connect and company pages to the docs', () => {
    expect(retiredPageTarget('/login')).toBe('/connect');
    expect(retiredPageTarget('/sign-up')).toBe('/connect');
    expect(retiredPageTarget('/blog')).toBe('/docs/blog');
    expect(retiredPageTarget('/zero-knowledge')).toBe('/docs/zero-knowledge');
  });
  it('leaves Ledger Chat routes alone and matches whole segments only', () => {
    for (const p of ['/', '/chat', '/communities', '/connect', '/docs/overview', '/settings', '/scan', '/studio', '/join/ABC', '/legal/privacy', '/privacy', '/terms', '/hubris', '/constructor']) {
      expect(retiredPageTarget(p)).toBeNull();
    }
  });
});
