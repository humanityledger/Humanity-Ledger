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
      expect(src).not.toMatch(/location\.href\s*=\s*['"]https:\/\/link\.metamask\.io/);
    }
  });

  it('Open in MetaMask opens the installed app: its scheme on iPhone, an intent on Android', async () => {
    // The universal link alone is ignored by iOS Safari on many phones (MetaMask issue #3965):
    // it is kept only as the install link for a phone without MetaMask.
    const m = await import('@/lib/wallet/mobileWallet');
    expect(m.METAMASK_IOS_APP_URL).toBe('metamask://dapp/ledgerchat.org');
    expect(m.METAMASK_ANDROID_APP_URL).toBe(
      'intent://dapp/ledgerchat.org#Intent;scheme=metamask;package=io.metamask;S.browser_fallback_url=https%3A%2F%2Flink.metamask.io%2Fdapp%2Fledgerchat.org;end',
    );
    expect(m.METAMASK_DAPP_URL).toBe('https://link.metamask.io/dapp/ledgerchat.org');
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
    const iphoneChrome = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1';
    const ipadOS = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
    const android = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
    expect(m.metamaskOpenHref(m.phonePlatform(iphone))).toBe(m.METAMASK_IOS_APP_URL);
    expect(m.metamaskOpenHref(m.phonePlatform(iphoneChrome))).toBe(m.METAMASK_IOS_APP_URL);
    expect(m.metamaskOpenHref(m.phonePlatform(ipadOS, 5))).toBe(m.METAMASK_IOS_APP_URL);
    expect(m.metamaskOpenHref(m.phonePlatform(android))).toBe(m.METAMASK_ANDROID_APP_URL);
    expect(m.metamaskOpenHref(m.phonePlatform(ipadOS, 0))).toBe(m.METAMASK_DAPP_URL);
  });

  it('Open in MetaMask is a link the person taps, shown only in an external phone browser', () => {
    const src = read('components/connect/ConnectView.tsx');
    expect(src).toMatch(/<a href=\{href\} className=\{`\$\{s\.btn\} \$\{s\.btnPrimary\}`\} data-testid="open-in-metamask">/);
    expect(src).toContain('metamaskOpenHref(platform)');
    expect(src).not.toMatch(/location\.(href|assign|replace)\s*[=(][^;]*METAMASK/);
    expect(src).toMatch(/externalMobile \? <MetaMaskDappLink/);
    expect(src).toContain('If your wallet says “simulation failed”, that is expected: this is a signature, not a transaction.');
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
