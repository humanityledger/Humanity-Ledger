import { test, expect } from '@playwright/test';

/**
 * H4 regression — shielded balances are never readable without a session.
 *
 * Before the fix, GET /api/zk/balance resolved the address as
 * `session?.userId || queryAddress`, so an unauthenticated request carrying
 * `?address=0x…` returned the shielded balance of an arbitrary wallet. These
 * tests run with no cookies at all and assert the endpoint refuses.
 */

const VICTIM = '0x1111111111111111111111111111111111111111';

test.describe('GET /api/zk/balance without a session', () => {
  test('refuses an arbitrary address passed as a query parameter', async ({ request }) => {
    const res = await request.get(`/api/zk/balance?address=${VICTIM}`);
    expect(res.status()).toBe(401);

    const body = await res.json();
    // The refusal must not leak the balance it declined to serve.
    expect(JSON.stringify(body)).not.toContain('balances');
    expect(JSON.stringify(body).toLowerCase()).not.toContain(VICTIM.toLowerCase());
  });

  test('refuses with no parameters at all', async ({ request }) => {
    const res = await request.get('/api/zk/balance');
    expect(res.status()).toBe(401);
  });

  test('refuses POST the same way', async ({ request }) => {
    const res = await request.post('/api/zk/balance', {
      data: { address: VICTIM },
      headers: { 'sec-fetch-site': 'same-origin' },
    });
    expect(res.status()).toBe(401);
  });

  test('does not serve the balance under a case-varied parameter', async ({ request }) => {
    const res = await request.get(`/api/zk/balance?Address=${VICTIM}&userId=${VICTIM}`);
    expect(res.status()).toBe(401);
  });

  test('marks its response as not cacheable', async ({ request }) => {
    const res = await request.get('/api/zk/balance');
    const cc = res.headers()['cache-control'] ?? '';
    expect(cc).toContain('no-store');
  });
});

test.describe('CSRF perimeter on mutations', () => {
  test('rejects a mutation with no Fetch Metadata and no Origin', async ({ request }) => {
    const res = await request.post('/api/chat/send', {
      data: { text: 'probe' },
      headers: { 'content-type': 'application/json' },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('rejects a mutation from a foreign Origin', async ({ request }) => {
    const res = await request.post('/api/chat/send', {
      data: { text: 'probe' },
      headers: { 'content-type': 'application/json', origin: 'https://attacker.example' },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe('Identity headers are never accepted from the client', () => {
  const spoofed = {
    'x-web3-address': VICTIM,
    'x-wallet-address': VICTIM,
    'x-verified-session-address': VICTIM,
    'x-session-kind': 'wallet',
  };

  test('a spoofed identity header does not authenticate a chat read', async ({ request }) => {
    const res = await request.get('/api/chat/direct', { headers: spoofed });
    expect(res.status()).toBe(401);
  });

  test('a spoofed identity header does not authenticate a balance read', async ({ request }) => {
    const res = await request.get('/api/zk/balance', { headers: spoofed });
    expect(res.status()).toBe(401);
  });
});
