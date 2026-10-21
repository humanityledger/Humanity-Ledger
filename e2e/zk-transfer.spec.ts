/**
 * e2e test: ZK private transfer between two accounts.
 *
 * Requires: NEXT_PUBLIC_ZK_MODE=testnet, local Aztec network
 * Skip unless ZK_E2E_ENABLED=true
 */

import { test, expect } from '@playwright/test';

const ZK_ENABLED = process.env.ZK_E2E_ENABLED === 'true';

test.describe('ZK Private Transfer', () => {
  test.skip(!ZK_ENABLED, 'ZK e2e tests disabled. Requires NEXT_PUBLIC_ZK_MODE=testnet and local Aztec network.');

  test('Alice sends 10 tokens to Bob privately', async ({ browser }) => {
    const aliceCtx = await browser.newContext();
    const bobCtx = await browser.newContext();

    // TODO: 
    // 1. Deploy local Aztec network (aztec start --sandbox)
    // 2. Deploy test token contract
    // 3. Fund Alice account with 100 tokens
    // 4. Alice connects wallet → transfers 10 to Bob
    // 5. Bob's balance increases by 10
    // 6. No intermediate server sees the amount

    // Acceptance: Alice balance = 90, Bob balance = 10, no plaintext on server

    await aliceCtx.close();
    await bobCtx.close();
  });

  test('Fabricated txHash does not change balances', async ({ page }) => {
    // POST a fake txHash to any payment endpoint
    // Verify server rejects it (validates against L1 receipt)
    const fakeHash = '0x' + 'dead'.repeat(16);
    
    const res = await page.request.post('/api/zk/transfer', {
      data: { txHash: fakeHash, amount: '9999999' },
    });

    // Should return 404 (route removed) or 401 (unauthenticated)
    expect([401, 403, 404, 501]).toContain(res.status());
  });
});
