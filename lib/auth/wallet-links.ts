/**
 * lib/auth/wallet-links.ts — the only links the connect screen may navigate to
 * to open a mobile wallet (Safari iOS, Chrome Android).
 *
 * Every href comes from this allowlist: a universal link of a known wallet,
 * optionally carrying a WalletConnect v2 pairing URI that passed a strict
 * format check. Anything else (a value from storage, a malformed or
 * non-WalletConnect URI, another scheme such as javascript:) yields null and
 * the caller falls back to the wallet's homepage link.
 */

export type WalletBrand = 'metamask' | 'rainbow' | 'coinbase' | 'trust' | 'okx';

const HOME: Readonly<Record<WalletBrand, string>> = Object.freeze({
  metamask: 'https://metamask.app.link/',
  // Rainbow's universal link host is rnbwapp.com (https://rnbwapp.com/wc?uri=…); rainbow.me is its website
  // and does not open the app.
  rainbow: 'https://rnbwapp.com/',
  coinbase: 'https://go.cb-w.com/',
  trust: 'https://link.trustwallet.com/',
  okx: 'https://www.okx.com/web3',
});

const HOSTS = new Set(['metamask.app.link', 'rnbwapp.com', 'rainbow.me', 'go.cb-w.com', 'link.trustwallet.com', 'www.okx.com']);

/** WalletConnect v2 pairing URI: wc:<64-hex topic>@2?<query>, no whitespace, bounded. */
const WC_V2 = /^wc:[0-9a-f]{64}@2\?[A-Za-z0-9._~%=&+,\[\]-]{1,1024}$/;

export const isWalletConnectUri = (uri: unknown): uri is string => typeof uri === 'string' && WC_V2.test(uri) && /(^|[?&])symKey=[0-9a-f]{64}(&|$)/.test(uri.split('?')[1] ?? '');

/** A stored or untrusted brand name, mapped onto the allowlist (own keys only). */
export function walletBrand(v: unknown): WalletBrand {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(HOME, v) ? (v as WalletBrand) : 'metamask';
}

export function walletHomeLink(brand: unknown): string {
  return HOME[walletBrand(brand)];
}

/** Universal link that opens `brand` with a WalletConnect pairing; the homepage link if the URI is not valid. */
export function walletConnectLink(brand: unknown, wcUri: unknown, origin?: string): string {
  const b = walletBrand(brand);
  if (!isWalletConnectUri(wcUri)) return HOME[b];
  const u = encodeURIComponent(wcUri);
  if (b === 'okx') return `https://www.okx.com/web3/wallet/dapp?dappUrl=${encodeURIComponent(origin ?? '')}&wc=${u}`;
  return `${HOME[b]}wc?uri=${u}`;
}

/** Re-checks an href right before navigation: https on an allowlisted wallet host only. */
export function safeWalletHref(href: unknown): string | null {
  if (typeof href !== 'string' || href.length > 2048) return null;
  try {
    const u = new URL(href);
    return u.protocol === 'https:' && HOSTS.has(u.hostname) && !u.username && !u.password ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Schemes that run or load content in the page; never accepted as a wallet's native deep link. */
const BLOCKED_SCHEMES = new Set(['javascript', 'data', 'vbscript', 'file', 'blob', 'about', 'http', 'https', 'ftp', 'ws', 'wss', 'intent']);

/**
 * A wallet's native deep link (e.g. "metamask://", "rainbow://wc"), as declared by the wallet itself in its
 * WalletConnect session metadata. That value is untrusted: a wallet could declare "javascript:…", which a
 * plain `location.href = …` would execute in this page. Only an app scheme with "://" passes; anything
 * else yields null and the caller falls back to an allowlisted link.
 */
export function safeNativeWalletLink(href: unknown): string | null {
  if (typeof href !== 'string' || href.length > 512 || /[\s"'<>`]/.test(href)) return null;
  const m = /^([a-z][a-z0-9+.-]{1,30}):\/\//i.exec(href);
  if (!m) return null;
  return BLOCKED_SCHEMES.has(m[1].toLowerCase()) ? null : href;
}

