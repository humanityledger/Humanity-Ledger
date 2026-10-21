/**
 * e2e test: ZK L1→L2 bridge with L1 receipt validation.
 */

import { test, expect } from '@playwright/test';

const ZK_ENABLED = process.env.ZK_E2E_ENABLED === 'true';

test.describe('ZK Bridge L1→L2', () => {
  test.skip(!ZK_ENABLED, 'ZK e2e tests disabled.');

  test('Bridge deposit with valid L1 tx succeeds', async ({ page }) => {
    // TODO: 
    // 1. Local Aztec network + Ethereum L1 (anvil)
    // 2. Deploy TokenPortal + TokenBridge contracts
    // 3. Approve + deposit tokens on L1
    // 4. Claim on L2 with valid L1 receipt
    // 5. Verify balance received on L2
    test.skip(true, 'Requires full local stack (anvil + aztec sandbox)');
  });

  test('Fabricated L1 hash is rejected by bridge validation', async ({ page }) => {
    const fakeHash = '0x' + 'beef'.repeat(16);
    
    const res = await page.request.post('/api/aztec/bridge', {
      data: { 
        l1TxHash: fakeHash, 
        amount: '1000000000000000000',
        destinationAddress: '0x0000000000000000000000000000000000000001'
      },
    });

    // Must reject — no valid L1 receipt for fabricated hash
    expect([401, 403, 404, 422]).toContain(res.status());
  });
});
