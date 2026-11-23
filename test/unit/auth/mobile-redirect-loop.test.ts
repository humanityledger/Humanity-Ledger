/**
 * Phones (iPhone and Android, Safari and Chrome) must not loop between pages (23/11/2026).
 *
 * 1. MobileEnforcer sent every route missing from its allowlist to /chat. /beta was missing, and the
 *    middleware sends a signed-in user without a beta pass from /chat to /beta: /chat → /beta → /chat …
 * 2. /connect redirected to the app on `isLinked` alone, which LinkedGate sets whenever WalletConnect
 *    reconnects the wallet: with an expired session, /connect → /chat → /connect … with no loop breaker.
 * 3. TitaniumGate must treat as public the pages the middleware serves to signed-out visitors.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '../../..', p), 'utf8');
/** Source without comments, so explanations that mention the old code do not count as code. */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('mobile redirect loops', () => {
  it('MobileEnforcer never redirects: route decisions belong to the middleware', () => {
    const src = code('components/layout/MobileEnforcer.tsx');
    expect(src).not.toMatch(/location\.(replace|assign)\s*\(/);
    expect(src).not.toMatch(/location\.href\s*=/);
    expect(src).not.toMatch(/router\.(replace|push)\s*\(/);
  });

  it('the middleware sends a member-less session from /chat to /beta, which phones must be able to render', () => {
    expect(read('middleware.ts')).toMatch(/url\.pathname = '\/beta'/);
    expect(read('lib/beta/landing.ts')).toMatch(/return '\/beta'/);
  });

  it('/connect does not leave for the app on isLinked alone', () => {
    const src = code('components/landing/ConnectPage.tsx');
    expect(src).not.toMatch(/if\s*\(\s*isLinked\s*\)\s*\{[^}]*goAfterSignIn/);
    // Every automatic redirect to the app after a server check goes through the loop breaker.
    const breakers = src.match(/allowAutoRedirect\(\)/g) ?? [];
    expect(breakers.length).toBeGreaterThanOrEqual(4);
  });

  it('TitaniumGate treats the middleware public pages as public', () => {
    const src = read('components/layout/TitaniumGate.tsx');
    const list = src.match(/const PUBLIC_PAGES = \[([\s\S]*?)\];/)?.[1] ?? '';
    for (const p of ['/beta', '/alpha', '/chat', '/connect', '/status', '/trust', '/security', '/legal']) {
      expect(list).toContain(`'${p}'`);
    }
  });
});
