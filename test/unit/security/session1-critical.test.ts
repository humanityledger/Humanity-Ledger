import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { checkWebhookUrl, parseIpWhitelist, ipInWhitelist } from '@/lib/security/webhookTarget';
import { postBodyColumns } from '@/lib/communities/postBody';
import { isRetiredApiRoute } from '@/lib/security/retiredRoutes';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

describe('SEG-C1 api-guard tier + HMAC', () => {
  const src = read('lib/api-guard.ts');
  it('normalises tier and checks HMAC for any casing of elite', () => {
    expect(src).toMatch(/String\(subscription\.tier \?\? 'starter'\)\.toLowerCase\(\)/);
    expect(src).toMatch(/tier === 'elite' && subscription\.hmacSecret/);
    expect(src).not.toMatch(/tier === 'Elite'/);
    expect(src).toMatch(/\belite: \{ threshold/);
  });
  it('rejects malformed signatures and NaN timestamps before comparing', () => {
    expect(src).toMatch(/HMAC_HEX\.test\(signature\)/);
    expect(src).toMatch(/Number\.isFinite\(ts\)/);
  });
  it('dev bypass needs development + explicit opt-in, and IP comes from getClientIP', () => {
    expect(src).toMatch(/NODE_ENV === 'development' && process\.env\.ALLOW_DEV_INTERNAL_WAC === '1'/);
    expect(src).not.toMatch(/x-forwarded-for/);
  });
  it('keys/update compares tier case-insensitively', () => {
    expect(read('app/api/v1/user/keys/update/route.ts')).toMatch(/toLowerCase\(\) !== 'elite'/);
  });
});

describe('SEG-C1 webhook SSRF + ip whitelist', () => {
  it.each([
    'https://169.254.169.254/latest/meta-data', 'https://127.0.0.1/x', 'https://[::1]/x',
    'http://example.com/hook', 'https://example.com:8443/hook', 'https://u:p@example.com/',
    'https://localhost/x', 'https://metadata.google.internal/', 'https://10.0.0.5/',
  ])('rejects %s', async (u) => {
    expect((await checkWebhookUrl(u)).ok).toBe(false);
  });
  it('accepts a public IP literal over https', async () => {
    expect((await checkWebhookUrl('https://1.1.1.1/hook')).ok).toBe(true);
  });
  it('validates whitelist entries', () => {
    expect(parseIpWhitelist(['1.2.3.4', '10.0.0.0/8', '2001:db8::/32'])).toEqual({ ok: true, value: ['1.2.3.4', '10.0.0.0/8', '2001:db8::/32'] });
    expect(parseIpWhitelist(['1.2.3.4/33']).ok).toBe(false);
    expect(parseIpWhitelist(['evil.com']).ok).toBe(false);
    expect(parseIpWhitelist('1.2.3.4').ok).toBe(false);
    expect(parseIpWhitelist(Array.from({ length: 33 }, (_, i) => `1.1.1.${i}`)).ok).toBe(false);
  });
  it('matches addresses and CIDRs', () => {
    expect(ipInWhitelist('10.1.2.3', ['10.0.0.0/8'])).toBe(true);
    expect(ipInWhitelist('11.1.2.3', ['10.0.0.0/8'])).toBe(false);
    expect(ipInWhitelist('1.2.3.4', ['1.2.3.4'])).toBe(true);
    expect(ipInWhitelist('unknown', ['1.2.3.4'])).toBe(false);
  });
});

describe('SEG-C2 / SEG-H4 retired billing + dev routes', () => {
  const routes = ['/api/payment/confirm', '/api/payment/create-subscription', '/api/payment/portal',
    '/api/payments/checkout', '/api/payments/provision-owner', '/api/payments/customer-portal',
    '/api/dev/deploy', '/api/admin/launch-checklist', '/api/admin/logout'];
  it.each(routes)('%s answers 410 in middleware and in its own file', (r) => {
    expect(isRetiredApiRoute(r)).toBe(true);
    const f = read(`app${r}/route.ts`);
    expect(f).toMatch(/status: 410/);
    expect(f).not.toMatch(/prisma|stripe|Resend|priceEur|OWNER_WALLET/);
  });
  it('checkout is no longer public and no client-set price survives', () => {
    expect(read('middleware.ts')).not.toMatch(/'\/api\/payments\/checkout'/);
    expect(read('next.config.js')).not.toMatch(/Content-Security-Policy-Report-Only', value/);
  });
});

describe('SEG-C3 community posts store no client HTML', () => {
  it.each(['<img src=x onerror=alert(1)>', '<svg onload=alert(1)>', '"><script>alert(1)</script>'])('neutralises %s', (payload) => {
    const cols = postBodyColumns(payload)!;
    expect(cols.contentHtml).not.toMatch(/[<>"]/);
    expect(cols.content).toBe(payload);
  });
  it('rejects empty bodies and ignores client contentHtml', () => {
    expect(postBodyColumns('   ')).toBeNull();
    for (const f of ['app/api/chat/communities/posts/route.ts', 'app/api/chat/communities/[id]/posts/route.ts']) {
      const s = read(f);
      expect(s).toMatch(/postBodyColumns/);
      expect(s).not.toMatch(/contentHtml:\s*(html|contentHtml)/);
    }
    expect(read('components/communities/CommunityReader.tsx')).not.toMatch(/contentHtml: body/);
  });
});
