/**
 * iPhone sign-in over WalletConnect (Safari, Chrome): report of 14 Nov 2026, "The wallet did not return
 * the signature" in Safari and Chrome while the Google app signed. WalletConnect opened the wallet by
 * itself, outside the tap, before the request had reached the relay. See lib/auth/wc-sign-request.ts.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  WC_DEEPLINK_KEY,
  WC_DEEPLINK_STASH_KEY,
  holdWalletConnectAutoOpen,
  isIOSBrowser,
  peerWalletLinks,
  restoreHeldWalletLink,
  signRequestLink,
  watchSentSignRequest,
} from '@/lib/auth/wc-sign-request';
import { withSignTimeout } from '@/lib/auth/sign-timeout';
import { classifySignError } from '@/lib/auth/sign-error';
import { failedBeforeWallet, relayDidNotTakeRequest } from '@/lib/auth/wallet-sign';

const TOPIC = 'a'.repeat(64);
const CHOICE = JSON.stringify({ href: 'metamask://', name: 'MetaMask' });

function memStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    map: m,
  };
}

function fakeProvider(sessionConfig?: Record<string, unknown>) {
  const listeners = new Map<string, Set<(e: unknown) => void>>();
  const stored = { topic: TOPIC, sessionConfig, peer: { metadata: { name: 'MetaMask', redirect: { native: 'metamask://', universal: 'https://metamask.app.link' } } } };
  const client = {
    on: (ev: string, l: (e: unknown) => void) => { if (!listeners.has(ev)) listeners.set(ev, new Set()); listeners.get(ev)!.add(l); },
    off: (ev: string, l: (e: unknown) => void) => { listeners.get(ev)?.delete(l); },
    emit: (ev: string, e: unknown) => listeners.get(ev)?.forEach((l) => l(e)),
    count: (ev: string) => listeners.get(ev)?.size ?? 0,
    session: { get: (t: string) => { if (t !== TOPIC) throw new Error('No matching key'); return stored; } },
  };
  return { client, session: { ...stored }, stored };
}

function fakeDoc(initial: 'visible' | 'hidden' = 'visible') {
  const ls = new Set<() => void>();
  const doc = {
    visibilityState: initial as string,
    addEventListener: (_: string, l: () => void) => void ls.add(l),
    removeEventListener: (_: string, l: () => void) => void ls.delete(l),
    set(v: 'visible' | 'hidden') { this.visibilityState = v; ls.forEach((l) => l()); },
    get listeners() { return ls.size; },
  };
  return doc;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('iPhone detection', () => {
  it('matches iPhone, iPad and iPadOS (Mac user agent with touch), not Android or a Mac', () => {
    expect(isIOSBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile/15E148 Safari/604.1', 5)).toBe(true);
    expect(isIOSBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 CriOS/131.0 Mobile/15E148 Safari/604.1', 5)).toBe(true);
    expect(isIOSBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.1 Safari/605.1.15', 5)).toBe(true);
    expect(isIOSBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.1 Safari/605.1.15', 0)).toBe(false);
    expect(isIOSBrowser('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36', 5)).toBe(false);
  });
});

describe("holding back WalletConnect's own open", () => {
  it('removes the stored link and sets the session switch, then puts both back', () => {
    const local = memStorage({ [WC_DEEPLINK_KEY]: CHOICE });
    const session = memStorage();
    const p = fakeProvider({ other: 1 });
    const held = holdWalletConnectAutoOpen(p, local, session);
    expect(held.href).toBe('metamask://');
    expect(local.getItem(WC_DEEPLINK_KEY)).toBeNull();
    expect(session.getItem(WC_DEEPLINK_STASH_KEY)).toBe(CHOICE);
    expect(p.stored.sessionConfig).toEqual({ other: 1, disableDeepLink: true });

    held.release();
    held.release(); // idempotent
    expect(local.getItem(WC_DEEPLINK_KEY)).toBe(CHOICE);
    expect(session.getItem(WC_DEEPLINK_STASH_KEY)).toBeNull();
    expect(p.stored.sessionConfig).toEqual({ other: 1 });
  });

  it('leaves a switch the wallet session already had, and a link stored meanwhile', () => {
    const local = memStorage({ [WC_DEEPLINK_KEY]: CHOICE });
    const p = fakeProvider({ disableDeepLink: true });
    const held = holdWalletConnectAutoOpen(p, local, memStorage());
    const newer = JSON.stringify({ href: 'rainbow://', name: 'Rainbow' });
    local.setItem(WC_DEEPLINK_KEY, newer);
    held.release();
    expect(local.getItem(WC_DEEPLINK_KEY)).toBe(newer);
    expect(p.stored.sessionConfig).toEqual({ disableDeepLink: true });
  });

  it('works with no stored link, no storage and no WalletConnect provider', () => {
    const held = holdWalletConnectAutoOpen({ request: async () => '0x' }, null, null);
    expect(held.href).toBeNull();
    expect(() => held.release()).not.toThrow();
  });

  it('puts the link back after a reload in the middle of a sign-in', () => {
    const local = memStorage();
    const session = memStorage({ [WC_DEEPLINK_STASH_KEY]: CHOICE });
    restoreHeldWalletLink(local, session);
    expect(local.getItem(WC_DEEPLINK_KEY)).toBe(CHOICE);
    expect(session.getItem(WC_DEEPLINK_STASH_KEY)).toBeNull();
  });
});

describe('waiting for the relay to have the request', () => {
  it('reports the sign-in request once published, and nothing else', () => {
    const p = fakeProvider();
    const seen: unknown[] = [];
    const stop = watchSentSignRequest(p, (r) => seen.push(r));
    expect(stop).toBeTypeOf('function');
    p.client.emit('session_request_sent', { id: 1731590000000123, topic: TOPIC, request: { method: 'eth_chainId' } });
    p.client.emit('session_request_sent', { id: -1, topic: TOPIC, request: { method: 'personal_sign' } });
    p.client.emit('session_request_sent', { id: 7, topic: 'nope', request: { method: 'personal_sign' } });
    p.client.emit('session_request_sent', { id: 1731590000000123, topic: TOPIC, request: { method: 'personal_sign' } });
    expect(seen).toEqual([{ id: 1731590000000123, topic: TOPIC }]);
    stop!();
    expect(p.client.count('session_request_sent')).toBe(0);
  });

  it('returns null for a provider that is not WalletConnect', () => {
    expect(watchSentSignRequest({ request: async () => null }, () => {})).toBeNull();
    expect(watchSentSignRequest(null, () => {})).toBeNull();
  });
});

describe('the link the tap opens', () => {
  const req = { id: 1731590000000123, topic: TOPIC };

  it('is the link WalletConnect builds, on the app scheme', () => {
    expect(signRequestLink(['metamask://'], req)).toEqual({ href: `metamask://wc?requestId=${req.id}&sessionTopic=${TOPIC}`, target: '_self' });
    expect(signRequestLink(['rainbow://'], req)?.href).toBe(`rainbow://wc?requestId=${req.id}&sessionTopic=${TOPIC}`);
  });

  it('prefers an app scheme over a universal link, which opens in a new tab', () => {
    expect(signRequestLink(['https://metamask.app.link', 'metamask://'], req)?.target).toBe('_self');
    expect(signRequestLink([null, 'https://metamask.app.link/'], req)).toEqual({
      href: `https://metamask.app.link/wc?requestId=${req.id}&sessionTopic=${TOPIC}`,
      target: '_blank',
    });
  });

  it('never follows a link that runs in the page', () => {
    for (const bad of ['javascript://alert(1)', 'data://x', 'http://evil.example', 'https://u:p@evil.example', 'intent://x', 'metamask://"><script>', '']) {
      expect(signRequestLink([bad], req)).toBeNull();
    }
  });

  it('without a request id it opens the wallet itself', () => {
    expect(signRequestLink(['metamask://'], null)).toEqual({ href: 'metamask://', target: '_self' });
    expect(signRequestLink(['metamask://'], { id: 1, topic: 'x' })).toEqual({ href: 'metamask://', target: '_self' });
  });

  it('reads the wallet links from the session metadata', () => {
    expect(peerWalletLinks(fakeProvider())).toEqual({ native: 'metamask://', universal: 'https://metamask.app.link' });
    expect(peerWalletLinks(undefined)).toEqual({ native: null, universal: null });
  });
});

describe('sign timeout while the person is in the wallet', () => {
  it('does not run while the tab is hidden, and leaves a grace period on return', async () => {
    const doc = fakeDoc();
    let answer!: (v: string) => void;
    const p = withSignTimeout(new Promise<string>((r) => (answer = r)), 40, { pauseWhileHidden: true, graceMs: 60, doc });
    doc.set('hidden');
    await sleep(120); // longer than the timeout, in the wallet
    doc.set('visible');
    await sleep(30); // relay reconnecting
    answer('0xsig');
    await expect(p).resolves.toBe('0xsig');
    expect(doc.listeners).toBe(0);
  });

  it('still expires when nothing comes back', async () => {
    const doc = fakeDoc();
    const err = await withSignTimeout(new Promise<string>(() => {}), 20, { pauseWhileHidden: true, graceMs: 0, doc }).catch((e) => e);
    expect(classifySignError(err)).toBe('expired');
    expect(doc.listeners).toBe(0);
  });

  it('passes a decline through untouched', async () => {
    const doc = fakeDoc();
    const err = await withSignTimeout(Promise.reject({ code: 4001, message: 'User rejected.' }), 1000, { pauseWhileHidden: true, doc }).catch((e) => e);
    expect(classifySignError(err)).toBe('declined');
  });
});

describe('what may be sent again', () => {
  it('a request the relay never took, or the page found offline', () => {
    expect(relayDidNotTakeRequest(new Error('Failed to publish payload, please try again. id:1 tag:1108'))).toBe(true);
    expect(relayDidNotTakeRequest(new Error('Socket stalled when trying to connect to wss://relay.walletconnect.org'))).toBe(true);
    expect(relayDidNotTakeRequest(new Error('Request expired. Please try again.'))).toBe(false);
    expect(relayDidNotTakeRequest({ code: 4001, message: 'User rejected.' })).toBe(false);
    expect(failedBeforeWallet(new Error('No internet connection detected. Please restart your network and try again.'))).toBe(true);
  });
});

describe('/connect on iPhone', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'components/landing/ConnectPage.tsx'), 'utf8');
  const view = fs.readFileSync(path.join(process.cwd(), 'components/connect/ConnectView.tsx'), 'utf8');

  it('holds back WalletConnect, waits for the relay, and opens the wallet from the tap', () => {
    expect(page).toMatch(/const iosWalletConnect = isMobile && !isInAppBrowser && isIOSBrowser\(\);/);
    expect(page).toMatch(/held = holdWalletConnectAutoOpen\(provider\);/);
    expect(page).toMatch(/watchSentSignRequest\(provider,/);
    expect(page).toMatch(/held\?\.release\(\);\s*\}/); // released whatever happens
    expect(page).toMatch(/pauseWhileHidden: iosWalletConnect/);
    expect(view).toMatch(/disabled=\{waiting\}/);
    expect(view).toMatch(/if \(openSignLink\(p\.signLink\)\) return;/);
  });

  it('a request that may be open in the wallet is still never sent twice', () => {
    expect(page).toMatch(/relayDidNotTakeRequest\(e\) && !wentHidden/);
  });
});
