/**
 * Mobile wallet links: the connect screen navigates only to allowlisted
 * universal links, with a WalletConnect v2 URI only when it is well formed.
 */
import { describe, it, expect } from 'vitest';
import { isWalletConnectUri, safeNativeWalletLink, safeWalletHref, walletBrand, walletConnectLink, walletHomeLink } from '@/lib/auth/wallet-links';

const TOPIC = 'a'.repeat(64);
const KEY = 'b'.repeat(64);
const WC = `wc:${TOPIC}@2?relay-protocol=irn&symKey=${KEY}&expiryTimestamp=1762790000`;

describe('wallet links', () => {
  it('accepts a WalletConnect v2 pairing URI and encodes it', () => {
    expect(isWalletConnectUri(WC)).toBe(true);
    expect(isWalletConnectUri(`${WC}&methods=[wc_sessionPropose],[wc_authRequest]`)).toBe(true);
    expect(walletConnectLink('metamask', WC)).toBe(`https://metamask.app.link/wc?uri=${encodeURIComponent(WC)}`);
    expect(walletConnectLink('rainbow', WC)).toMatch(/^https:\/\/rnbwapp\.com\/wc\?uri=wc%3A/);
    expect(walletConnectLink('okx', WC, 'https://ledgerchat.org')).toMatch(/^https:\/\/www\.okx\.com\/web3\/wallet\/dapp\?dappUrl=https%3A%2F%2Fledgerchat\.org&wc=wc%3A/);
  });

  it('falls back to the homepage link for a malformed or non-WalletConnect URI', () => {
    for (const bad of ['', 'bad', 'wc:abc@2?symKey=1', `wc:${TOPIC}@1?symKey=${KEY}`, `wc:${TOPIC}@2?relay-protocol=irn`, `${WC} `, `${WC}"><script>`, 'javascript:alert(1)', 42, null]) {
      expect(walletConnectLink('metamask', bad)).toBe('https://metamask.app.link/');
    }
  });

  it('maps unknown or prototype brand names to MetaMask', () => {
    expect(walletBrand('coinbase')).toBe('coinbase');
    expect(walletBrand('evil')).toBe('metamask');
    expect(walletBrand('__proto__')).toBe('metamask');
    expect(walletBrand('constructor')).toBe('metamask');
    expect(walletHomeLink(null)).toBe('https://metamask.app.link/');
  });

  it('re-checks hrefs before navigation: https on a wallet host only', () => {
    expect(safeWalletHref(walletConnectLink('trust', WC))).toMatch(/^https:\/\/link\.trustwallet\.com\/wc\?uri=/);
    for (const bad of ['javascript:alert(1)', 'http://metamask.app.link/', 'https://metamask.app.link.evil.com/', 'https://user:pw@rainbow.me/', 'wc:' + TOPIC, 'metamask://wc', '', undefined, 'https://x/' + 'a'.repeat(3000)]) {
      expect(safeWalletHref(bad)).toBeNull();
    }
  });
});

import { withSignTimeout } from '@/lib/auth/sign-timeout';

describe('withSignTimeout', () => {
  it('passes a timely signature through', async () => {
    expect(await withSignTimeout(Promise.resolve('0xsig'), 50)).toBe('0xsig');
  });
  it('expires a dropped request with a non-retryable message', async () => {
    await expect(withSignTimeout(new Promise<string>(() => {}), 10)).rejects.toThrow('signature request expired');
  });
  it('keeps the wallet error when the wallet answers first', async () => {
    await expect(withSignTimeout(Promise.reject(new Error('User rejected the request')), 50)).rejects.toThrow('User rejected');
  });
});

describe('native wallet deep links from WalletConnect session metadata', () => {
  it('accepts app schemes', () => {
    for (const ok of ['metamask://', 'rainbow://wc', 'trust://', 'okex://main', 'bitkeep://', 'cbwallet://']) expect(safeNativeWalletLink(ok)).toBe(ok);
  });
  it('refuses anything that runs or loads content in the page, or is malformed', () => {
    for (const bad of ['javascript:alert(1)', 'javascript://%0Aalert(1)', 'JAVASCRIPT://x', 'data://text/html,x', 'vbscript://x', 'https://evil.com', 'http://x', 'intent://x', 'file:///etc/passwd', 'metamask:', 'metamask://"><img>', '', null, 42, 'a'.repeat(600) + '://']) {
      expect(safeNativeWalletLink(bad)).toBeNull();
    }
  });
});
