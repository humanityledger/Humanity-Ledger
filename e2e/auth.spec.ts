/**
 * Playwright e2e tests — Authentication flows
 *
 * Requires: PLAYWRIGHT_BASE_URL, TEST_WALLET_PRIVATE_KEY env vars
 * Skip in CI unless E2E_ENABLED=true
 */

import { test, expect, Page } from '@playwright/test';

const E2E_ENABLED = process.env.E2E_ENABLED === 'true';

test.describe('Authentication', () => {
  test.skip(!E2E_ENABLED, 'E2E tests disabled. Set E2E_ENABLED=true to run.');

  test('email login flow', async ({ page }: { page: Page }) => {
    await page.goto('/connect');
    
    // Should see email login option
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    
    // Enter email
    await page.getByPlaceholder(/email/i).fill('test@example.com');
    await page.getByRole('button', { name: /continue|send code/i }).click();
    
    // Should show OTP input
    await expect(page.getByPlaceholder(/code|otp/i)).toBeVisible({ timeout: 5000 });
  });

  test('wallet login flow (SIWE)', async ({ page }: { page: Page }) => {
    await page.goto('/connect');
    
    // Should see wallet connect option
    const walletBtn = page.getByRole('button', { name: /wallet|connect wallet|sign in with ethereum/i });
    await expect(walletBtn).toBeVisible();
  });

  test('PIN setup after login', async ({ page }: { page: Page }) => {
    // This test requires a pre-authenticated session
    // In CI: inject session cookie before navigating
    test.skip(true, 'Requires pre-authenticated session');
  });

  test('unauthenticated user redirected from /chat', async ({ page }: { page: Page }) => {
    await page.goto('/chat');
    // Should redirect to /connect or show auth wall
    await expect(page).toHaveURL(/connect|sign-in|login/);
  });
});

test.describe('DM Flow', () => {
  test.skip(!E2E_ENABLED, 'E2E tests disabled.');

  test('send and receive DM via XMTP', async ({ browser }) => {
    // Creates two browser contexts (Alice and Bob)
    const alice = await browser.newContext();
    const bob = await browser.newContext();
    
    const alicePage = await alice.newPage();
    const bobPage = await bob.newPage();
    
    // TODO: inject pre-authenticated sessions for Alice and Bob
    // TODO: verify message delivery < 1s via XMTP stream
    // TODO: verify 0 requests to /api/chat/direct
    
    await alice.close();
    await bob.close();
  });
});

test.describe('Community Flow', () => {
  test.skip(!E2E_ENABLED, 'E2E tests disabled.');

  test('create community, post, and verify membership enforcement', async ({ page }: { page: Page }) => {
    // TODO: authenticated session required
    test.skip(true, 'Requires pre-authenticated session');
  });
});
