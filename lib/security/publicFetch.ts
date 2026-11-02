/**
 * lib/security/publicFetch.ts
 *
 * Fetch a user-supplied URL from the server without letting it reach anything
 * that is not on the public internet.
 *
 * validateUrlForFetch() alone only inspects the URL text. That misses three
 * things this module closes:
 *
 *  1. Hostnames that resolve to private addresses (127.0.0.1.nip.io,
 *     localtest.me, an attacker's own DNS record).
 *  2. DNS rebinding: a name that resolves to a public address when checked and
 *     to 169.254.169.254 a moment later when connected. Here the check runs in
 *     the socket's own `lookup`, so the address checked is the address used.
 *  3. Redirects. fetch() follows them silently; a public page that answers
 *     302 Location: http://169.254.169.254/ would otherwise be fetched. Here
 *     every hop is validated again, with a small hop limit.
 *
 * It also caps time, bytes (after decompression, so a gzip bomb stops at the
 * cap) and ports (80 and 443 only, so public hosts cannot be port-scanned).
 */

import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import zlib from 'node:zlib';
import type { LookupFunction } from 'node:net';
import { validateUrlForFetch } from './ssrfGuard';
import { isBlockedIp, isIpLiteral } from './ipPolicy';

export class PublicFetchError extends Error {
  constructor(public code: 'BLOCKED' | 'TIMEOUT' | 'TOO_MANY_REDIRECTS' | 'NETWORK', message: string) {
    super(message);
    this.name = 'PublicFetchError';
  }
}

export interface PublicFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
  /** Stop reading once the decoded text contains this marker (e.g. '</head>'). */
  stopAt?: string;
  /** GET (default) or POST. A POST is never redirected: a 3xx is returned as is. */
  method?: 'GET' | 'POST';
  /** Request body for POST. */
  body?: string;
}

export interface PublicFetchResult {
  /** The URL that finally answered, after redirects. */
  url: string;
  status: number;
  contentType: string;
  body: string;
  truncated: boolean;
}

const ALLOWED_PORTS = new Set(['', '80', '443']);

/** DNS lookup that refuses to hand the socket any non-public address. */
export const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) return (callback as any)(err);
    const list = addresses as dns.LookupAddress[];
    if (!list.length || list.some(a => isBlockedIp(a.address))) {
      const blockedErr = Object.assign(new Error(`SSRF: ${hostname} resolves to a non-public address`), { code: 'SSRF_BLOCKED' });
      return (callback as any)(blockedErr);
    }
    if ((options as dns.LookupOptions)?.all) return (callback as any)(null, list);
    return (callback as any)(null, list[0].address, list[0].family);
  });
};

/** Lexical checks for one hop. Throws PublicFetchError when refused. */
export function assertFetchableUrl(raw: string): URL {
  const guard = validateUrlForFetch(raw);
  if (!guard.safe) throw new PublicFetchError('BLOCKED', guard.reason || 'Blocked URL');
  const url = new URL(raw);
  if (!ALLOWED_PORTS.has(url.port)) throw new PublicFetchError('BLOCKED', 'Only ports 80 and 443 are allowed');
  if (url.username || url.password) throw new PublicFetchError('BLOCKED', 'URLs with credentials are not fetched');
  // IP literals skip DNS entirely, so they are checked here.
  if (isIpLiteral(url.hostname) && isBlockedIp(url.hostname)) {
    throw new PublicFetchError('BLOCKED', 'Non-public IP address');
  }
  return url;
}

type ResolvedOptions = {
  timeoutMs: number; maxBytes: number; maxRedirects: number;
  headers: Record<string, string>; stopAt?: string; method: 'GET' | 'POST'; body?: string;
};

function requestOnce(url: URL, opts: ResolvedOptions, deadline: number) {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string; truncated: boolean }>((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const remaining = Math.max(1, deadline - Date.now());
    const bodyBuf = opts.method === 'POST' && opts.body != null ? Buffer.from(opts.body) : null;
    const req = lib.request(url, {
      method: opts.method,
      headers: {
        'Accept-Encoding': 'gzip, deflate, br',
        ...(bodyBuf ? { 'Content-Length': String(bodyBuf.length) } : {}),
        ...opts.headers,
      },
      lookup: publicOnlyLookup,
      timeout: remaining,
    }, res => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400) {
        res.resume();
        return resolve({ status, headers: res.headers, body: '', truncated: false });
      }
      const enc = String(res.headers['content-encoding'] || '').toLowerCase();
      let stream: NodeJS.ReadableStream = res;
      if (enc === 'gzip' || enc === 'x-gzip') stream = res.pipe(zlib.createGunzip());
      else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
      else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());

      const decoder = new TextDecoder();
      let body = '';
      let bytes = 0;
      let done = false;
      const finish = (truncated: boolean) => {
        if (done) return;
        done = true;
        body += decoder.decode();
        req.destroy();
        resolve({ status, headers: res.headers, body, truncated });
      };
      stream.on('data', (chunk: Buffer) => {
        if (done) return;
        const room = opts.maxBytes - bytes;
        const slice = chunk.length > room ? chunk.subarray(0, room) : chunk;
        bytes += slice.length;
        body += decoder.decode(slice, { stream: true });
        if (bytes >= opts.maxBytes) return finish(true);
        if (opts.stopAt && body.includes(opts.stopAt)) return finish(true);
      });
      stream.on('end', () => finish(false));
      stream.on('error', e => { if (!done) { done = true; reject(new PublicFetchError('NETWORK', String(e))); } });
    });
    // `timeout` above only measures socket inactivity; this bounds the whole hop.
    const timer = setTimeout(() => req.destroy(new PublicFetchError('TIMEOUT', 'Timed out')), remaining);
    req.on('close', () => clearTimeout(timer));
    req.on('timeout', () => req.destroy(new PublicFetchError('TIMEOUT', 'Timed out')));
    req.on('error', (e: any) => {
      if (e instanceof PublicFetchError) return reject(e);
      if (e?.code === 'SSRF_BLOCKED') return reject(new PublicFetchError('BLOCKED', e.message));
      reject(new PublicFetchError('NETWORK', e?.message || 'Network error'));
    });
    req.end(bodyBuf ?? undefined);
  });
}

/**
 * GET a public URL. Rejects with PublicFetchError('BLOCKED') for any hop that
 * points at a non-public address, port or scheme.
 */
export async function fetchPublicUrl(raw: string, options: PublicFetchOptions = {}): Promise<PublicFetchResult> {
  const method = options.method ?? 'GET';
  const opts: ResolvedOptions = {
    timeoutMs: options.timeoutMs ?? 3500,
    maxBytes: options.maxBytes ?? 300 * 1024,
    // Never re-send a POST body to wherever a redirect points.
    maxRedirects: method === 'POST' ? 0 : (options.maxRedirects ?? 3),
    headers: options.headers ?? {},
    stopAt: options.stopAt,
    method,
    body: options.body,
  };
  const deadline = Date.now() + opts.timeoutMs;
  let url = assertFetchableUrl(raw);

  for (let hop = 0; hop <= opts.maxRedirects; hop++) {
    if (Date.now() >= deadline) throw new PublicFetchError('TIMEOUT', 'Timed out');
    const res = await requestOnce(url, opts, deadline);
    if (res.status >= 300 && res.status < 400 && method === 'GET') {
      const location = res.headers.location;
      if (!location) throw new PublicFetchError('NETWORK', 'Redirect without Location');
      url = assertFetchableUrl(new URL(location, url).href);
      continue;
    }
    return {
      url: url.href,
      status: res.status,
      contentType: String(res.headers['content-type'] || ''),
      body: res.body,
      truncated: res.truncated,
    };
  }
  throw new PublicFetchError('TOO_MANY_REDIRECTS', 'Too many redirects');
}
