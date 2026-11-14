/**
 * lib/auth/wc-sign-request.ts — the sign-in signature over WalletConnect on iPhone (Safari, Chrome and
 * every other iOS browser, which are all WebKit).
 *
 * What went wrong (report of 14 Nov 2026: Safari and Chrome on iPhone failed with "The wallet did not
 * return the signature", while the Google app signed):
 *
 *   WalletConnect's SignClient.request() does two things at once (sign-client engine, `request`):
 *   it encrypts and publishes the request to the relay, and in parallel it opens the wallet by itself,
 *   with `window.open("<wallet>://wc?requestId=…&sessionTopic=…")`, using the deep link AppKit stored
 *   under WALLETCONNECT_DEEPLINK_CHOICE when the wallet was picked. That open is not inside a tap.
 *   Safari and Chrome on iOS follow it and switch to the wallet at once, often before the encrypted
 *   request has left the page; iOS then suspends the tab and closes its socket. The wallet has nothing
 *   to show, and when the person comes back the relayer's publish timer (60 s, wall clock) has run out
 *   and the request is rejected with "Failed to publish payload". The Google app ignores an app link
 *   opened outside a tap, so there the request was published first and the person opened the wallet
 *   by hand: that is the flow that works, and the one this module makes the only one on iPhone.
 *
 * So, on iPhone, for the one sign-in request:
 *   1. WalletConnect's own open is held back (holdWalletConnectAutoOpen).
 *   2. The page waits until the relay has acknowledged the request (`session_request_sent`, emitted
 *      by the SignClient after the publish), then enables "Open <wallet> to sign".
 *   3. That button opens the wallet from the person's tap, with the link WalletConnect would have used
 *      (`<wallet>://wc?requestId=…&sessionTopic=…`), so the wallet goes straight to this request.
 *
 * Nothing here is used on Android, on a computer, or inside a wallet's own browser.
 */

import { safeNativeWalletLink } from '@/lib/auth/wallet-links';

/** Key under which AppKit stores the picked wallet's link ({ href, name }), read by WalletConnect. */
export const WC_DEEPLINK_KEY = 'WALLETCONNECT_DEEPLINK_CHOICE';
/** Copy kept while the key is held, so a reload in the middle puts it back (restoreHeldWalletLink). */
export const WC_DEEPLINK_STASH_KEY = 'hl.wc_deeplink_hold';

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function safeStorage(kind: 'localStorage' | 'sessionStorage'): KV | null {
  try {
    return typeof window !== 'undefined' ? window[kind] : null;
  } catch {
    return null; // storage disabled (private mode on old iOS, blocked cookies)
  }
}

/** iPhone, iPod, iPad, and iPadOS that reports a Mac user agent. Every browser there is WebKit. */
export function isIOSBrowser(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  maxTouchPoints: number = typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0,
): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
}

/* ── 1. Hold back WalletConnect's own open ─────────────────────────────── */

interface WcClientLike {
  on?: (event: string, listener: (e: unknown) => void) => unknown;
  off?: (event: string, listener: (e: unknown) => void) => unknown;
  session?: { get?: (topic: string) => unknown };
}

interface WcProviderLike {
  client?: WcClientLike;
  signer?: { client?: WcClientLike; session?: WcSessionLike };
  session?: WcSessionLike;
}

interface WcSessionLike {
  topic?: string;
  sessionConfig?: Record<string, unknown>;
  peer?: { metadata?: { name?: unknown; redirect?: { native?: unknown; universal?: unknown } } };
}

function wcClient(provider: unknown): WcClientLike | null {
  const p = provider as WcProviderLike | null | undefined;
  const c = p?.client ?? p?.signer?.client;
  return c && typeof c === 'object' ? c : null;
}

function wcSession(provider: unknown): WcSessionLike | null {
  const p = provider as WcProviderLike | null | undefined;
  const s = p?.session ?? p?.signer?.session;
  return s && typeof s === 'object' ? s : null;
}

export interface HeldWalletLink {
  /** The wallet link AppKit had stored (e.g. "metamask://"), or null. */
  href: string | null;
  /** Puts everything back. Safe to call more than once. */
  release(): void;
}

/**
 * Stops WalletConnect from opening the wallet by itself for the next request:
 *  - removes AppKit's stored link from localStorage (WalletConnect reads it there first), keeping a copy;
 *  - sets `sessionConfig.disableDeepLink` on the live session object, WalletConnect's own switch for
 *    this, in memory only, for the case where the link sits in its IndexedDB store instead.
 * release() restores both. Nothing is changed on the wallet's side.
 */
export function holdWalletConnectAutoOpen(provider: unknown, local: KV | null = safeStorage('localStorage'), session: KV | null = safeStorage('sessionStorage')): HeldWalletLink {
  let raw: string | null = null;
  try {
    raw = local?.getItem(WC_DEEPLINK_KEY) ?? null;
    if (raw !== null) {
      session?.setItem(WC_DEEPLINK_STASH_KEY, raw);
      local?.removeItem(WC_DEEPLINK_KEY);
    }
  } catch {
    /* storage unavailable: the session flag below still applies */
  }

  const topic = wcSession(provider)?.topic;
  const store = wcClient(provider)?.session;
  const liveSession = (): WcSessionLike | null => {
    if (typeof topic !== 'string' || typeof store?.get !== 'function') return null;
    try {
      const s = store.get(topic);
      return s && typeof s === 'object' ? (s as WcSessionLike) : null;
    } catch {
      return null;
    }
  };
  let flagSet = false;
  const s = liveSession();
  if (s && s.sessionConfig?.disableDeepLink !== true) {
    s.sessionConfig = { ...(s.sessionConfig ?? {}), disableDeepLink: true };
    flagSet = true;
  }

  let released = false;
  return {
    href: hrefOf(raw),
    release() {
      if (released) return;
      released = true;
      try {
        if (raw !== null && local?.getItem(WC_DEEPLINK_KEY) === null) local?.setItem(WC_DEEPLINK_KEY, raw);
        session?.removeItem(WC_DEEPLINK_STASH_KEY);
      } catch {
        /* storage unavailable */
      }
      if (flagSet) {
        // The store may have replaced the object since (an update copies it): clear it on the current one.
        for (const cur of [s, liveSession()]) {
          if (cur?.sessionConfig && cur.sessionConfig.disableDeepLink === true) {
            const { disableDeepLink: _drop, ...rest } = cur.sessionConfig;
            cur.sessionConfig = Object.keys(rest).length ? rest : undefined;
          }
        }
      }
    },
  };
}

/** Puts back a link held by a sign-in that a reload interrupted. Called when /connect mounts. */
export function restoreHeldWalletLink(local: KV | null = safeStorage('localStorage'), session: KV | null = safeStorage('sessionStorage')): void {
  try {
    const raw = session?.getItem(WC_DEEPLINK_STASH_KEY) ?? null;
    if (raw === null) return;
    if (local?.getItem(WC_DEEPLINK_KEY) === null) local?.setItem(WC_DEEPLINK_KEY, raw);
    session?.removeItem(WC_DEEPLINK_STASH_KEY);
  } catch {
    /* storage unavailable */
  }
}

function hrefOf(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { href?: unknown };
    return typeof v?.href === 'string' ? v.href : null;
  } catch {
    return null;
  }
}

/* ── 2. Know when the relay has the request ────────────────────────────── */

export interface SentRequest {
  id: number;
  topic: string;
}

const TOPIC = /^[0-9a-f]{64}$/;

/**
 * Calls onSent once the SignClient reports the sign-in request as published to the relay
 * (`session_request_sent`, emitted after the relay acknowledged it). Returns a function that stops
 * listening; returns null when the provider is not WalletConnect (the caller then does not wait).
 */
export function watchSentSignRequest(provider: unknown, onSent: (r: SentRequest) => void, method = 'personal_sign'): (() => void) | null {
  const client = wcClient(provider);
  if (!client || typeof client.on !== 'function' || typeof client.off !== 'function') return null;
  const listener = (e: unknown) => {
    const ev = e as { id?: unknown; topic?: unknown; request?: { method?: unknown } } | null;
    if (ev?.request?.method !== method) return;
    if (typeof ev.id !== 'number' || !Number.isSafeInteger(ev.id) || ev.id <= 0) return;
    if (typeof ev.topic !== 'string' || !TOPIC.test(ev.topic)) return;
    onSent({ id: ev.id, topic: ev.topic });
  };
  client.on('session_request_sent', listener);
  let on = true;
  return () => {
    if (!on) return;
    on = false;
    try {
      client.off?.('session_request_sent', listener);
    } catch {
      /* client gone */
    }
  };
}

/* ── 3. The link the tap opens ─────────────────────────────────────────── */

export interface WalletOpenLink {
  href: string;
  /** "_self" for an app scheme (the page stays loaded), "_blank" for a universal https link. */
  target: '_self' | '_blank';
}

/** The connected wallet's own links, as declared in its WalletConnect session metadata. */
export function peerWalletLinks(provider: unknown): { native: string | null; universal: string | null } {
  const r = wcSession(provider)?.peer?.metadata?.redirect;
  return {
    native: typeof r?.native === 'string' ? r.native : null,
    universal: typeof r?.universal === 'string' ? r.universal : null,
  };
}

/**
 * `<base>/wc?requestId=<id>&sessionTopic=<topic>`, the link WalletConnect itself builds
 * (utils formatDeeplinkUrl), from the first usable base. An app scheme is preferred: following it never
 * unloads this page, while a universal link that iOS does not hand to the app would navigate the tab
 * away from the request it is waiting on, so a universal link opens in a new tab. Anything else
 * (javascript:, data:, a malformed value) is skipped.
 */
export function signRequestLink(bases: Array<string | null | undefined>, req: SentRequest | null): WalletOpenLink | null {
  const query = req && Number.isSafeInteger(req.id) && req.id > 0 && TOPIC.test(req.topic) ? `wc?requestId=${req.id}&sessionTopic=${req.topic}` : null;
  const build = (base: string) => {
    const b = base.endsWith('/') ? base.slice(0, -1) : base;
    return query ? `${b}/${query}` : base;
  };
  for (const base of bases) {
    if (typeof base !== 'string' || !base) continue;
    if (safeNativeWalletLink(base)) {
      const href = build(base);
      if (safeNativeWalletLink(href)) return { href, target: '_self' };
    }
  }
  for (const base of bases) {
    if (typeof base !== 'string' || !base || base.length > 512) continue;
    try {
      const u = new URL(base);
      if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) continue;
      return { href: build(u.toString()), target: '_blank' };
    } catch {
      /* not a URL */
    }
  }
  return null;
}
