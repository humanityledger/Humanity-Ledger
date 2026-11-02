/**
 * Optional "Sign in with GitHub" for Ledger Studio (server only).
 *
 * Only enabled when the operator registers a GitHub OAuth app
 * (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET). The browser opens GitHub in a
 * popup; GitHub sends it back to /api/studio/github/callback, which swaps
 * the code for a token and keeps it for two minutes under a one-time key
 * bound to the wallet that started the sign-in. The Studio tab then claims
 * it once and stores it encrypted on the device. Nothing is kept after that.
 */

import { randomBytes } from 'crypto';
import { redisClient, safeRedisGet, safeRedisSet } from '@/lib/redis/client';

export const GITHUB_SCOPE = 'repo';
const STATE_TTL = 600;
const TOKEN_TTL = 120;
export const STATE_RE = /^[a-f0-9]{48}$/;

export function githubOAuthConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function appOrigin(reqUrl: string): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  try { if (env) return new URL(env).origin; } catch { /* fall back */ }
  return new URL(reqUrl).origin;
}

export async function createState(wallet: string): Promise<string | null> {
  const state = randomBytes(24).toString('hex');
  await safeRedisSet(`studio:gh:state:${state}`, wallet.toLowerCase(), 'EX', STATE_TTL);
  // Fail closed when it could not be stored (the callback would reject it anyway).
  return (await safeRedisGet(`studio:gh:state:${state}`)) === wallet.toLowerCase() ? state : null;
}

/** Read and delete in one step, so a value can be used only once. */
async function take(key: string): Promise<string | null> {
  const r: any = redisClient;
  if (!r.__isMock && typeof r.getdel === 'function') {
    try { return (await r.getdel(key)) ?? null; } catch { return null; }
  }
  // In-memory fallback (local development without Redis).
  const v = await safeRedisGet(key);
  if (!v || v === 'TIMEOUT') return null;
  try { await r.del(key); } catch { /* expires anyway */ }
  return v;
}

/** One-time: the wallet that started this sign-in. */
export const takeState = (state: string) => (STATE_RE.test(state) ? take(`studio:gh:state:${state}`) : Promise.resolve(null));

export async function keepToken(state: string, wallet: string, token: string): Promise<void> {
  await safeRedisSet(`studio:gh:token:${state}`, JSON.stringify({ wallet: wallet.toLowerCase(), token }), 'EX', TOKEN_TTL);
}

/** One-time: the token for this sign-in, only for the wallet that started it. */
export async function claimToken(state: string, wallet: string): Promise<string | null> {
  if (!STATE_RE.test(state)) return null;
  const raw = await safeRedisGet(`studio:gh:token:${state}`);
  if (!raw || raw === 'TIMEOUT') return null;
  try {
    // Another wallet cannot consume (and so destroy) someone else's sign-in.
    if (JSON.parse(raw)?.wallet !== wallet.toLowerCase()) return null;
    const taken = await take(`studio:gh:token:${state}`);
    const v = taken ? JSON.parse(taken) : null;
    return v?.wallet === wallet.toLowerCase() && typeof v.token === 'string' ? v.token : null;
  } catch {
    return null;
  }
}

export async function exchangeCode(code: string, redirectUri: string, fetcher: typeof fetch = fetch): Promise<string | null> {
  const cfg = githubOAuthConfig();
  if (!cfg || !/^[A-Za-z0-9_-]{4,200}$/.test(code)) return null;
  const res = await fetcher('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: cfg.clientId, client_secret: cfg.clientSecret, code, redirect_uri: redirectUri }),
  });
  if (!res.ok) return null;
  const j = await res.json().catch(() => null);
  const token = typeof j?.access_token === 'string' ? j.access_token : null;
  return token && token.length < 512 ? token : null;
}
