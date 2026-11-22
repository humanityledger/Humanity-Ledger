/**
 * Routes retired on 22 November 2026 (docs/plan/status-and-phases.md, B11): no caller in the
 * repository and no known outside caller. The middleware answers them with 410 before any
 * handler runs. The routes the chat still calls stay served.
 */
import { describe, expect, it } from 'vitest';
import { isRetiredApiRoute } from '@/lib/security/retiredRoutes';

describe('routes retired on 22 November 2026', () => {
  it('answers 410 for unused and non-chat routes', () => {
    for (const p of [
      '/api/gif/search', '/api/forum/categories/general', '/api/prices', '/api/news', '/api/mempool', '/api/bots',
      '/api/wallet/onchain-balances', '/api/subscription/status',
    ]) {
      expect(isRetiredApiRoute(p), p).toBe(true);
    }
  });

  it('keeps the routes the chat calls', () => {
    for (const p of [
      '/api/siwe/nonce', '/api/siwe/verify', '/api/siwe/logout', '/api/auth/siwe/verify', '/api/gifs', '/api/bots/command',
      '/api/bridge/generate', '/api/chat/communities', '/api/calls/ice', '/api/user/profiles', '/api/push/subscribe',
      '/api/alpha/redeem', '/api/aztec/value-mode', '/api/wallet/payment-report', '/api/market/ticker',
      // An outside caller may use these; an owner decides (D-7).
      '/api/network/ledger/watch', '/api/payments/webhook', '/api/golden-ticket/claim', '/api/geo', '/api/siwe/session',
    ]) {
      expect(isRetiredApiRoute(p), p).toBe(false);
    }
  });
});
