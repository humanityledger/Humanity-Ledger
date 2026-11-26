/**
 * G8 HumanGate — server side. Same construction as lib/security/siweNonce.ts:
 * HMAC-SHA256 sealed tokens keyed from JWT_SECRET (fail-closed when it is
 * missing), short TTLs, single use in memory and in Redis (SET NX).
 *
 *   ChallengeToken  { id, iat, difficulty, seedHex, mode }      TTL 180 s
 *   ReceiptToken    { id, iat, mode }  → cookie hl_human_gate   TTL 300 s
 *
 * A receipt is issued only when the server itself has checked the three
 * signals: the seal, a proof of work bound to the challenge seed, and the
 * kinematics replayed against the seeded path (lib/g8/humanGateMath.ts).
 * The challenge is burnt before the kinematics run, so one challenge allows
 * one attempt.
 *
 * Honest limit: the seed must reach the browser to draw the board, so a
 * script written for this page can compute the path. The gate raises the
 * cost of generic bots, screen-reading agents and mass sign-ups (work per
 * attempt, one attempt per challenge, rate limits, one receipt per sign-in);
 * it is not proof of personhood. Uniqueness is G8 Level 2's job.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { analyzeOrbit, analyzeRhythm, leadingZeroBits, pathParams, type HumanGateMode, HG_MIN_DURATION_MS } from '@/lib/g8/humanGateMath';

export const HUMAN_GATE_TTL_SEC = 180;
export const HUMAN_GATE_RECEIPT_TTL_SEC = 300;
export const HUMAN_GATE_COOKIE = 'hl_human_gate';
export const HG_DIFFICULTY = 12;
export const HG_DIFFICULTY_BURST = 15;
const CLOCK_SLACK_MS = 1500;

function key(label: string): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set.');
  return createHmac('sha256', secret).update(label).digest();
}
const CHAL = 'hl/g8/humangate/chal/v1';
const RCPT = 'hl/g8/humangate/rcpt/v1';

function seal(label: string, payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${createHmac('sha256', key(label)).update(body).digest('base64url')}`;
}
function open<T>(label: string, token: unknown): T | null {
  if (typeof token !== 'string' || token.length > 2048) return null;
  const [body, sig, extra] = token.split('.');
  if (!body || !sig || extra !== undefined) return null;
  const want = Buffer.from(createHmac('sha256', key(label)).update(body).digest('base64url'));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T; } catch { return null; }
}

export interface ChallengePayload { id: string; iat: number; difficulty: number; seedHex: string; mode: HumanGateMode }
interface ReceiptPayload { id: string; iat: number; mode: HumanGateMode }

const MODES: readonly HumanGateMode[] = ['orbit', 'accessible-rhythm'];
export const isMode = (m: unknown): m is HumanGateMode => MODES.includes(m as HumanGateMode);

export function issueChallenge(mode: HumanGateMode, burst = false, now = Date.now()): { token: string; payload: ChallengePayload } {
  const payload: ChallengePayload = { id: randomBytes(16).toString('hex'), iat: now, difficulty: burst ? HG_DIFFICULTY_BURST : HG_DIFFICULTY, seedHex: randomBytes(32).toString('hex'), mode };
  return { token: seal(CHAL, payload), payload };
}

export function openChallenge(token: unknown, now = Date.now()): ChallengePayload | null {
  const p = open<ChallengePayload>(CHAL, token);
  if (!p || !/^[0-9a-f]{32}$/.test(p.id) || !/^[0-9a-f]{64}$/.test(p.seedHex) || !isMode(p.mode)) return null;
  if (!Number.isFinite(p.iat) || now - p.iat > HUMAN_GATE_TTL_SEC * 1000 || p.iat - now > 60_000) return null;
  if (!Number.isInteger(p.difficulty) || p.difficulty < HG_DIFFICULTY || p.difficulty > 24) return null;
  return p;
}

/** PoW bound to the challenge: sha256(seedHex ":" nonce) has `difficulty` leading zero bits. */
export function checkPow(seedHex: string, nonce: unknown, difficulty: number): boolean {
  if (typeof nonce !== 'string' || !/^[0-9]{1,12}$/.test(nonce)) return false;
  return leadingZeroBits(createHash('sha256').update(`${seedHex}:${nonce}`).digest()) >= difficulty;
}

/* ── single use: memory + Redis ─────────────────────────────────────────── */
const usedChallenges = new Map<string, number>();
const usedReceipts = new Map<string, number>();
function consumeLocal(map: Map<string, number>, id: string, ttlMs: number, now: number): boolean {
  if (map.size > 5000) for (const [k, t] of map) if (now - t > ttlMs) map.delete(k);
  if (map.has(id)) return false;
  map.set(id, now);
  return true;
}
export const consumeGateChallengeLocally = (id: string, now = Date.now()) => consumeLocal(usedChallenges, id, HUMAN_GATE_TTL_SEC * 1000, now);
export const consumeGateReceiptLocally = (id: string, now = Date.now()) => consumeLocal(usedReceipts, id, HUMAN_GATE_RECEIPT_TTL_SEC * 1000, now);

type RedisLike = { set: (...a: any[]) => Promise<unknown> } | null;
async function redisOnce(redis: RedisLike, k: string, ttl: number): Promise<boolean> {
  if (!redis) return true;
  try { return (await redis.set(k, '1', 'EX', ttl, 'NX')) !== null; } catch { return true; } // memory registry still holds
}
async function defaultRedis(): Promise<RedisLike> {
  try { const { getRedisClient } = await import('@/lib/redis'); return (await getRedisClient()) as unknown as RedisLike; } catch { return null; }
}

export interface Submission {
  challengeToken: unknown; powNonce: unknown; mode: unknown;
  samples?: unknown; presses?: unknown; trustedRatio?: unknown; coalescedCount?: unknown;
}
export type GateResult = { ok: true; receipt: string; lagMs: number } | { ok: false; reason: string };

/** Fail-closed verification of one attempt. */
export async function verifyHumanGateSubmission(sub: Submission, opts: { now?: number; redis?: RedisLike } = {}): Promise<GateResult> {
  const now = opts.now ?? Date.now();
  const c = openChallenge(sub?.challengeToken, now);
  if (!c) return { ok: false, reason: 'challenge' };
  if (sub.mode !== c.mode) return { ok: false, reason: 'mode' };
  if (!checkPow(c.seedHex, sub.powNonce, c.difficulty)) return { ok: false, reason: 'pow' };
  // One attempt per challenge: burn it before looking at the movement.
  if (!consumeGateChallengeLocally(c.id, now)) return { ok: false, reason: 'replay' };
  const redis = opts.redis !== undefined ? opts.redis : await defaultRedis();
  if (!(await redisOnce(redis, `g8:hg:chal:${c.id}`, HUMAN_GATE_TTL_SEC))) return { ok: false, reason: 'replay' };
  if (Number(sub.trustedRatio) !== 1) return { ok: false, reason: 'untrusted-events' };
  const elapsed = now - c.iat;
  if (elapsed < 1000) return { ok: false, reason: 'server-clock' };

  let v;
  if (c.mode === 'orbit') {
    v = analyzeOrbit(pathParams(c.seedHex), sub.samples);
    const s = sub.samples as { tMs: number }[];
    if (v.ok && (s[s.length - 1].tMs > elapsed + CLOCK_SLACK_MS || elapsed < HG_MIN_DURATION_MS)) v = { ok: false as const, reason: 'server-clock' };
  } else {
    v = analyzeRhythm(c.seedHex, sub.presses);
    const p = sub.presses as number[];
    if (v.ok && Number(p[p.length - 1]) > elapsed + CLOCK_SLACK_MS) v = { ok: false as const, reason: 'server-clock' };
  }
  if (!v.ok) return v;
  return { ok: true, lagMs: v.lagMs, receipt: seal(RCPT, { id: randomBytes(16).toString('hex'), iat: now, mode: c.mode } satisfies ReceiptPayload) };
}

export function openReceipt(token: unknown, now = Date.now()): ReceiptPayload | null {
  const p = open<ReceiptPayload>(RCPT, token);
  if (!p || !/^[0-9a-f]{32}$/.test(p.id) || !isMode(p.mode) || !Number.isFinite(p.iat)) return null;
  if (now - p.iat > HUMAN_GATE_RECEIPT_TTL_SEC * 1000 || p.iat - now > 60_000) return null;
  return p;
}

/**
 * Whether the /connect page of this build shows the check. Literal access, so Next.js inlines the
 * same build-time value here as in the client bundle.
 */
export function humanGateBuilt(v: string | undefined = process.env.NEXT_PUBLIC_HUMAN_GATE): boolean {
  return v === '1' || v === 'true';
}

/**
 * Whether this sign-in must present a receipt: server switch, or the new client flow asking for it.
 * Never when this build's page cannot show the check: HUMAN_GATE_REQUIRED=1 on a build without
 * NEXT_PUBLIC_HUMAN_GATE locked every sign-in out (26 Nov 2026), because the server demanded a
 * receipt that no page could produce.
 */
export function humanGateRequiredFor(body: unknown, built = humanGateBuilt()): boolean {
  if (!built) return false;
  return process.env.HUMAN_GATE_REQUIRED === '1' || (body as { humanGateRequired?: unknown })?.humanGateRequired === true;
}

/**
 * Step 1 (before SIWE work): the cookie must hold a valid, unexpired receipt.
 * Step 2 (`consume`, right before the session is minted): single use.
 */
export function peekHumanGateCookie(req: { cookies: { get(n: string): { value: string } | undefined } }, now = Date.now()): ReceiptPayload | null {
  return openReceipt(req.cookies.get(HUMAN_GATE_COOKIE)?.value, now);
}
export async function consumeHumanGateReceipt(r: ReceiptPayload, opts: { now?: number; redis?: RedisLike } = {}): Promise<boolean> {
  if (!consumeGateReceiptLocally(r.id, opts.now ?? Date.now())) return false;
  const redis = opts.redis !== undefined ? opts.redis : await defaultRedis();
  return redisOnce(redis, `g8:hg:rcpt:${r.id}`, HUMAN_GATE_RECEIPT_TTL_SEC);
}

export function gateCookieOptions(maxAge: number) {
  const isProd = process.env.NODE_ENV === 'production';
  return { httpOnly: true, secure: isProd, sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax', path: '/', maxAge };
}
