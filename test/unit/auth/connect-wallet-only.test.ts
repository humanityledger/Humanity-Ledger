/**
 * /connect: a wallet (SIWE) or a linked phone, nothing else; the wallet app is opened from the
 * visitor's own browser and never replaces it with a wallet's in-app browser.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p: string) => fs.existsSync(path.join(root, p));

describe('sign-in without email', () => {
  it('offers no email sign-in anywhere', () => {
    for (const f of ['components/connect/ConnectView.tsx', 'components/landing/ConnectPage.tsx', 'components/landing/MobileLanding.tsx']) {
      const src = read(f);
      expect(src).not.toMatch(/EmailLoginModal|onEmail|Continue with email|Sign in with Email/);
    }
    expect(exists('components/auth/EmailLoginModal.tsx')).toBe(false);
  });

  it('the email code routes are gone and answer 410 at the edge', async () => {
    const { isRetiredApiRoute } = await import('@/lib/security/retiredRoutes');
    for (const r of ['send-code', 'verify-code', 'check-email']) {
      expect(exists(`app/api/auth/${r}/route.ts`)).toBe(false);
      expect(isRetiredApiRoute(`/api/auth/${r}`)).toBe(true);
    }
    // Wallet sign-in stays served.
    for (const r of ['/api/siwe/nonce', '/api/siwe/verify', '/api/auth/verify-session']) expect(isRetiredApiRoute(r)).toBe(false);
  });
});

describe('wallet apps from Safari and Chrome', () => {
  it('never sends the visitor into a wallet in-app browser', () => {
    for (const f of ['components/connect/ConnectView.tsx', 'components/landing/ConnectPage.tsx']) {
      const src = read(f);
      expect(src).not.toMatch(/metamask\.app\.link\/dapp|metamask-browser|Open in MetaMask App/);
    }
  });

  it('gives wallets no redirect URL that would open the site in a new tab', () => {
    const appkit = read('config/appkit.tsx');
    expect(appkit).not.toMatch(/redirect:\s*\{/);
  });

  it('one-click sign-in is opt-in, phone browsers only, and /connect then waits instead of asking again', () => {
    const appkit = read('config/appkit.tsx');
    expect(appkit).toMatch(/export const ONE_CLICK_AUTH = process\.env\.NEXT_PUBLIC_ONE_CLICK_AUTH === 'true' && isPhoneBrowserWithoutWallet\(\);/);
    expect(appkit).toMatch(/\.\.\.\(ONE_CLICK_AUTH \? \{ siweConfig \} : \{\}\)/);
    const page = read('components/landing/ConnectPage.tsx');
    expect(page).toMatch(/if \(ONE_CLICK_AUTH && !inAppWallet\) \{/);
    // The session must be for the connected address, not any session.
    expect(page).toMatch(/d\?\.authenticated && d\.user\?\.address\?\.toLowerCase\(\) === address\.toLowerCase\(\)/);
  });

  it('tells iPhone users how to come back (iOS does not let a wallet return to the browser)', () => {
    expect(read('components/connect/ConnectView.tsx')).toMatch(/tap "‹ Safari" at the top left/);
  });

  it('no second WalletConnect core on every page', () => {
    expect(read('app/layout.tsx')).not.toMatch(/<WalletConnectProvider\s*\/>/);
  });
});
