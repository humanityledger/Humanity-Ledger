/**
 * lib/relay/relays.ts
 *
 * Which Ledger Relays this client may use, and in what order (design note:
 * docs/design/ledger-relay.md). Off unless NEXT_PUBLIC_LEDGER_RELAY=1; with it off, nothing in the
 * app changes.
 *
 * Sources of relays, in order of trust:
 *   1. the organisation's list, set at build time (NEXT_PUBLIC_LEDGER_RELAYS);
 *   2. a signed default list, accepted only when its ECDSA P-256 signature verifies against the
 *      public key set at build time (NEXT_PUBLIC_LEDGER_RELAY_LIST_KEY); no key is set yet;
 *   3. relays the user adds on this device.
 * With NEXT_PUBLIC_LEDGER_RELAY_PIN=1 only the organisation's list is used (data residency).
 */

export interface Relay {
  /** https origin of the relay, no path. */
  url: string;
  source: 'organisation' | 'signed' | 'user';
}

export interface RelayInfo {
  protocol: string;
  capabilities: { turn: boolean; signalling: boolean; blobs: boolean; push: boolean };
}

const USER_KEY = 'hl.relays.user';

export function relayEnabled(env: Record<string, string | undefined> = { NEXT_PUBLIC_LEDGER_RELAY: process.env.NEXT_PUBLIC_LEDGER_RELAY }): boolean {
  return env.NEXT_PUBLIC_LEDGER_RELAY === '1';
}

/** An https origin with no credentials, path, query or fragment; anything else is refused. */
export function normaliseRelayUrl(input: string): string | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  if ((u.pathname && u.pathname !== '/') || u.search || u.hash) return null;
  if (!/^[a-z0-9.-]+$/i.test(u.hostname) || u.hostname === 'localhost') return null;
  return u.origin;
}

function parseList(raw: string | undefined, source: Relay['source']): Relay[] {
  const out: Relay[] = [];
  for (const item of (raw ?? '').split(',')) {
    const url = normaliseRelayUrl(item);
    if (url && !out.some((r) => r.url === url)) out.push({ url, source });
  }
  return out;
}

export function organisationRelays(env: Record<string, string | undefined> = { NEXT_PUBLIC_LEDGER_RELAYS: process.env.NEXT_PUBLIC_LEDGER_RELAYS }): Relay[] {
  return parseList(env.NEXT_PUBLIC_LEDGER_RELAYS, 'organisation');
}

export function pinnedToOrganisation(env: Record<string, string | undefined> = { NEXT_PUBLIC_LEDGER_RELAY_PIN: process.env.NEXT_PUBLIC_LEDGER_RELAY_PIN }): boolean {
  return env.NEXT_PUBLIC_LEDGER_RELAY_PIN === '1';
}

/** Relays the user added on this device. Browser storage can be missing or throw: then none. */
export function userRelays(storage: Pick<Storage, 'getItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null): Relay[] {
  try {
    const raw = storage?.getItem(USER_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? parseList(list.filter((x) => typeof x === 'string').join(','), 'user') : [];
  } catch {
    return [];
  }
}

export function saveUserRelays(urls: string[], storage: Pick<Storage, 'setItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null): string[] {
  const clean = parseList(urls.join(','), 'user').map((r) => r.url);
  try {
    storage?.setItem(USER_KEY, JSON.stringify(clean));
  } catch {
    /* storage unavailable: the list lasts for this page only */
  }
  return clean;
}

/** The relays to try, in order, without duplicates. */
export function candidateRelays(opts: { organisation: Relay[]; signed?: Relay[]; user?: Relay[]; pinned: boolean }): Relay[] {
  const all = opts.pinned ? opts.organisation : [...opts.organisation, ...(opts.signed ?? []), ...(opts.user ?? [])];
  const seen = new Set<string>();
  return all.filter((r) => (seen.has(r.url) ? false : (seen.add(r.url), true)));
}

/** Canonical JSON: keys sorted at every level, so the signer and the client hash the same bytes. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export interface SignedRelayList {
  /** ISO date after which the list is refused. */
  expires: string;
  relays: string[];
  /** base64url ECDSA P-256 / SHA-256 signature (IEEE P1363) over canonicalJson({ expires, relays }). */
  signature: string;
}

/**
 * Verifies a signed relay list. Returns the relays, or null when the key is missing, the
 * signature does not verify or the list has expired.
 */
export async function verifyRelayList(
  list: SignedRelayList,
  publicKeyJwk: JsonWebKey | null,
  now: number = Date.now(),
  subtle: SubtleCrypto | undefined = globalThis.crypto?.subtle,
): Promise<Relay[] | null> {
  if (!publicKeyJwk || !subtle || !list || !Array.isArray(list.relays) || typeof list.signature !== 'string') return null;
  const expires = Date.parse(list.expires);
  if (!Number.isFinite(expires) || expires <= now) return null;
  try {
    const key = await subtle.importKey('jwk', publicKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const data = new TextEncoder().encode(canonicalJson({ expires: list.expires, relays: list.relays }));
    const sig = base64UrlToBytes(list.signature);
    const ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig, data);
    return ok ? parseList(list.relays.join(','), 'signed') : null;
  } catch {
    return null;
  }
}

export function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The public key for signed lists, from the build. None today: signed lists are refused. */
export function relayListKey(raw: string | undefined = process.env.NEXT_PUBLIC_LEDGER_RELAY_LIST_KEY): JsonWebKey | null {
  if (!raw) return null;
  try {
    const k = JSON.parse(raw) as JsonWebKey;
    return k.kty === 'EC' && k.crv === 'P-256' && typeof k.x === 'string' && typeof k.y === 'string' && !('d' in k) ? k : null;
  } catch {
    return null;
  }
}

/**
 * Probes the candidates and returns the healthy ones that offer `need`, fastest first. A relay
 * that does not answer within `timeoutMs` is skipped; the order is the failover order.
 */
export async function healthyRelays(
  candidates: Relay[],
  need: keyof RelayInfo['capabilities'],
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 2500,
): Promise<Relay[]> {
  const probes = await Promise.all(
    candidates.map(async (r) => {
      const started = Date.now();
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
      try {
        const res = await fetchImpl(`${r.url}/v0/info`, { cache: 'no-store', credentials: 'omit', signal: ctrl?.signal });
        if (!res.ok) return null;
        const info = (await res.json()) as RelayInfo;
        if (!String(info?.protocol ?? '').startsWith('ledger-relay/0') || !info.capabilities?.[need]) return null;
        return { relay: r, ms: Date.now() - started };
      } catch {
        return null;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }),
  );
  return probes.filter((p): p is { relay: Relay; ms: number } => p !== null).sort((a, b) => a.ms - b.ms).map((p) => p.relay);
}
