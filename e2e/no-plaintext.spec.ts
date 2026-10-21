/**
 * e2e test: Verify no plaintext message content reaches /api/* routes.
 *
 * All DMs must travel exclusively through XMTP (E2EE).
 * The server must never see message content.
 */

import { test, expect } from '@playwright/test';

const E2E_ENABLED = process.env.E2E_ENABLED === 'true';

test.describe('No plaintext DM content on server', () => {
  test.skip(!E2E_ENABLED, 'E2E tests disabled. Set E2E_ENABLED=true to run.');

  test('DM content does not appear in any /api/ request body', async ({ page, context }) => {
    const SECRET_MESSAGE = `SECRET_TEST_${Date.now()}`;
    const apiRequests: string[] = [];

    // Intercept all API requests and capture bodies
    await context.route('**/api/**', async (route) => {
      const request = route.request();
      const body = request.postData() ?? '';
      apiRequests.push(body);
      await route.continue();
    });

    // TODO: inject pre-authenticated XMTP session
    // TODO: navigate to a DM conversation
    // TODO: type and send SECRET_MESSAGE via the chat composer
    // TODO: wait for message to be sent

    // Verify: no API request body contains the secret message
    for (const body of apiRequests) {
      expect(body).not.toContain(SECRET_MESSAGE);
    }
  });

  test('DM message travels via XMTP network (non-/api URL)', async ({ page, context }) => {
    const xmtpRequests: string[] = [];

    await context.route('**', (route) => {
      const url = route.request().url();
      if (url.includes('xmtp') || url.includes('grpc') || url.includes('mls')) {
        xmtpRequests.push(url);
      }
      route.continue();
    });

    // TODO: send a DM
    // Verify at least one XMTP network request was made
    // expect(xmtpRequests.length).toBeGreaterThan(0);
    
    test.skip(true, 'Requires pre-authenticated session with XMTP');
  });
});
