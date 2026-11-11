/**
 * lib/auth/linkedDevices.ts — Ledger Chat on a computer, linked from the phone (server side).
 *
 * The model is WhatsApp Web / Signal Desktop: the phone holds the account (the wallet); a
 * computer becomes a *linked device* by showing a QR code that the signed-in phone scans and
 * explicitly approves. The computer never holds the wallet. When it needs a wallet signature
 * (to register its chat installation with XMTP, or to open the private Aztec wallet) it asks
 * the phone, which shows what is being signed and signs only if the person approves.
 *
 *   computer  POST /api/auth/qr-init           ephemeral public key + a description of itself
 *   phone     GET  /api/auth/link?uuid=…       what is asking to be linked (for the approval screen)
 *   phone     POST /api/auth/qr-mobile-link    approval: ciphertext for the computer + claim hash
 *   computer  GET  /api/auth/qr-poll           the ciphertext (only this browser, by cookie)
 *   computer  POST /api/auth/qr-hydrate        the claim → HttpOnly session; the device is recorded
 *   both      /api/auth/link (actions)         linked devices, revocation, signing requests
 *
 * End to end: the request and answer of every signature travel encrypted with a 256-bit key
 * the phone generated and sent to the computer inside the QR handshake (ECDH P-256/X25519 +
 * HKDF). The server only relays ciphertext; it never sees that key, the messages or the
 * signatures. Every record expires on its own (Redis TTL).
 */

import { randomBytes } from 'crypto';
import { safeRedisGet, safeRedisSet, redisClient } from '@/lib/redis/client';

export const DEVICE_ID_RE = /^dev_[0-9a-f]{24}$/;
export const REQUEST_ID_RE = /^req_[0-9a-f]{24}$/;
export const MAX_DEVICES = 5;
/** A linked session lives as long as its token (7 days); linking again renews it. */
export const DEVICE_TTL_SEC = 7 * 24 * 60 * 60;
/** A signing request the phone has not answered in this time is dropped. */
export const REQUEST_TTL_SEC = 180;
const MAX_PENDING = 4;

export type SignKind = 'xmtp' | 'aztec';

export interface LinkedDevice {
  id: string;
  /** "Chrome on macOS" — from the computer's own description, shown to the phone. */
  label: string;
  createdAt: number;
  lastSeenAt: number;
  /** SHA-256 of the session token, to revoke it (lib/security/sessionRevocation). */
  tokenFp: string;
  /** Session expiry (ms). */
  expiresAt: number;
}

export interface SignRequest {
  id: string;
  deviceId: string;
  kind: SignKind;
  /** AES-GCM ciphertext (base64) of { kind, message | typedData }, under the device's channel key. */
  ciphertext: string;
  iv: string;
  createdAt: number;
  /** Set by the phone: AES-GCM ciphertext of { signature }, or declined. */
  answer?: { ciphertext?: string; iv?: string; declined?: boolean; at: number };
}

const devicesKey = (wallet: string) => `ldev:${wallet.toLowerCase()}`;
const requestKey = (wallet: string, id: string) => `lreq:${wallet.toLowerCase()}:${id}`;
const pendingKey = (wallet: string) => `lreqs:${wallet.toLowerCase()}`;

export const newDeviceId = () => `dev_${randomBytes(12).toString('hex')}`;
export const newRequestId = () => `req_${randomBytes(12).toString('hex')}`;

async function setJson(key: string, value: unknown, ttlSec: number): Promise<boolean> {
  const r: any = redisClient;
  if (!r) return false;
  try {
    await safeRedisSet(key, JSON.stringify(value), 'EX', ttlSec);
    return true;
  } catch {
    return false;
  }
}

async function getJson<T>(key: string): Promise<T | null> {
  const v = await safeRedisGet(key);
  if (!v || v === 'TIMEOUT') return null;
  try { return JSON.parse(v) as T; } catch { return null; }
}

async function del(key: string): Promise<void> {
  try { await (redisClient as any)?.del?.(key); } catch { /* expires anyway */ }
}

/** A short, plain description from the computer's User-Agent ("Chrome on macOS"). Never trusts it for anything. */
export function describeUserAgent(ua: string | null | undefined): string {
  const s = String(ua ?? '');
  const browser = /Edg\//.test(s) ? 'Edge' : /OPR\/|Opera/.test(s) ? 'Opera' : /Firefox\//.test(s) ? 'Firefox'
    : /Chrome\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : 'Browser';
  const os = /Windows/.test(s) ? 'Windows' : /Mac OS X|Macintosh/.test(s) ? 'macOS' : /CrOS/.test(s) ? 'ChromeOS'
    : /Android/.test(s) ? 'Android' : /iPhone|iPad/.test(s) ? 'iOS' : /Linux/.test(s) ? 'Linux' : 'unknown system';
  return `${browser} on ${os}`;
}

export async function listDevices(wallet: string, now = Date.now()): Promise<LinkedDevice[]> {
  const list = (await getJson<LinkedDevice[]>(devicesKey(wallet))) ?? [];
  return Array.isArray(list) ? list.filter(d => d && DEVICE_ID_RE.test(d.id) && d.expiresAt > now) : [];
}

async function saveDevices(wallet: string, list: LinkedDevice[]): Promise<void> {
  await setJson(devicesKey(wallet), list.slice(-MAX_DEVICES), DEVICE_TTL_SEC);
}

/** Records a newly linked computer. The oldest one is dropped (and returned, to revoke) past MAX_DEVICES. */
export async function addDevice(wallet: string, d: Omit<LinkedDevice, 'lastSeenAt'>, now = Date.now()): Promise<LinkedDevice[]> {
  const list = (await listDevices(wallet, now)).filter(x => x.id !== d.id);
  list.push({ ...d, lastSeenAt: now });
  const dropped = list.length > MAX_DEVICES ? list.splice(0, list.length - MAX_DEVICES) : [];
  await saveDevices(wallet, list);
  return dropped;
}

export async function removeDevice(wallet: string, id: string): Promise<LinkedDevice | null> {
  const list = await listDevices(wallet);
  const found = list.find(d => d.id === id) ?? null;
  if (found) await saveDevices(wallet, list.filter(d => d.id !== id));
  return found;
}

/** Marks a device as seen (at most once a minute, to keep writes low). */
export async function touchDevice(wallet: string, id: string, now = Date.now()): Promise<boolean> {
  const list = await listDevices(wallet, now);
  const d = list.find(x => x.id === id);
  if (!d) return false;
  if (now - d.lastSeenAt > 60_000) {
    d.lastSeenAt = now;
    await saveDevices(wallet, list);
  }
  return true;
}

/* ── signing requests (computer → phone → computer) ───────────────────── */

export async function createRequest(wallet: string, r: Omit<SignRequest, 'id' | 'createdAt' | 'answer'>, now = Date.now()): Promise<SignRequest | 'TOO_MANY' | null> {
  const ids = ((await getJson<string[]>(pendingKey(wallet))) ?? []).filter(x => REQUEST_ID_RE.test(x));
  const live: string[] = [];
  for (const id of ids) {
    const q = await getJson<SignRequest>(requestKey(wallet, id));
    if (q && !q.answer && now - q.createdAt < REQUEST_TTL_SEC * 1000) live.push(id);
  }
  if (live.length >= MAX_PENDING) return 'TOO_MANY';
  const req: SignRequest = { ...r, id: newRequestId(), createdAt: now };
  if (!(await setJson(requestKey(wallet, req.id), req, REQUEST_TTL_SEC))) return null;
  await setJson(pendingKey(wallet), [...live, req.id], REQUEST_TTL_SEC);
  return req;
}

export async function getRequest(wallet: string, id: string): Promise<SignRequest | null> {
  if (!REQUEST_ID_RE.test(id)) return null;
  return getJson<SignRequest>(requestKey(wallet, id));
}

/** Unanswered requests, newest last. */
export async function pendingRequests(wallet: string, now = Date.now()): Promise<SignRequest[]> {
  const ids = ((await getJson<string[]>(pendingKey(wallet))) ?? []).filter(x => REQUEST_ID_RE.test(x));
  const out: SignRequest[] = [];
  for (const id of ids) {
    const q = await getJson<SignRequest>(requestKey(wallet, id));
    if (q && !q.answer && now - q.createdAt < REQUEST_TTL_SEC * 1000) out.push(q);
  }
  return out;
}

export async function answerRequest(wallet: string, id: string, answer: NonNullable<SignRequest['answer']>): Promise<'OK' | 'GONE' | 'ANSWERED'> {
  const q = await getRequest(wallet, id);
  if (!q) return 'GONE';
  if (q.answer) return 'ANSWERED';
  q.answer = answer;
  // Long enough for the computer's next poll.
  await setJson(requestKey(wallet, id), q, 60);
  return 'OK';
}

export async function dropRequest(wallet: string, id: string): Promise<void> {
  await del(requestKey(wallet, id));
}
