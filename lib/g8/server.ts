import { prisma } from '@/lib/prisma';
import { safeRedisGet, safeRedisSet, safeRedisDel } from '@/lib/redis/client';
import { NONCE_TTL_SECONDS } from '@/lib/g8/constants';

/**
 * G8 server state: single-use challenges (Redis), blind block fingerprints and
 * invite redemptions (Postgres). Every function fails open on a partial Prisma
 * mock or a missing migration (warn once), like lib/chat/blockFirewall.ts.
 */
const ADDR = /^0x[0-9a-f]{40}$/;
const FP = /^[0-9a-f]{64}$/;
let warned = false;
const db = () => prisma as unknown as {
  g8BlockedFingerprint?: { upsert: Function; deleteMany: Function; findMany: Function; findUnique: Function };
  g8InviteRedemption?: { create: Function; findMany: Function };
};
function warnOnce(e: unknown) { if (!warned) { warned = true; console.warn('[g8] tables unavailable; apply migration 20261126200000_g8_admission.', (e as Error)?.message); } }

export const normAddr = (v: unknown) => (typeof v === 'string' && ADDR.test(v.trim().toLowerCase()) ? v.trim().toLowerCase() : null);
export const normFingerprint = (v: unknown) => (typeof v === 'string' && FP.test(v) ? v : null);

/** Issues a nonce bound to (sender, recipient), valid once for NONCE_TTL_SECONDS. */
export async function issueChallenge(sender: string, recipient: string): Promise<string> {
  const nonce = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
  await safeRedisSet(`g8:nonce:${nonce}`, `${sender}|${recipient}`, 'EX', NONCE_TTL_SECONDS);
  return nonce;
}
/** Consumes a nonce; true only once, and only for the same pair. */
export async function consumeChallenge(nonce: string, sender: string, recipient: string): Promise<boolean> {
  if (!/^[0-9a-f]{32}$/.test(nonce)) return false;
  const v = await safeRedisGet(`g8:nonce:${nonce}`);
  if (v !== `${sender}|${recipient}`) return false;
  await safeRedisDel(`g8:nonce:${nonce}`);
  return true;
}

export async function setBlindBlock(owner: string, fingerprint: string, on: boolean): Promise<void> {
  const t = db().g8BlockedFingerprint;
  if (!t) return;
  try {
    if (on) await t.upsert({ where: { owner_fingerprint: { owner, fingerprint } }, create: { owner, fingerprint }, update: {} });
    else await t.deleteMany({ where: { owner, fingerprint } });
  } catch (e) { warnOnce(e); }
}
export async function isBlindBlocked(owner: string, fingerprint: string): Promise<boolean> {
  const t = db().g8BlockedFingerprint;
  if (!t) return false;
  try { return !!(await t.findUnique({ where: { owner_fingerprint: { owner, fingerprint } }, select: { owner: true } })); }
  catch (e) { warnOnce(e); return false; }
}
export async function listBlindBlocks(owner: string): Promise<string[]> {
  const t = db().g8BlockedFingerprint;
  if (!t) return [];
  try { return (await t.findMany({ where: { owner }, select: { fingerprint: true }, take: 2000 })).map((r: { fingerprint: string }) => r.fingerprint); }
  catch (e) { warnOnce(e); return []; }
}

/** Records a redemption; false when the jti was already used (single use). */
export async function redeemInvite(jti: string, issuer: string, redeemedBy: string): Promise<boolean> {
  const t = db().g8InviteRedemption;
  if (!t) return false;
  try { await t.create({ data: { jti, issuer, redeemedBy } }); return true; }
  catch { return false; }
}
export async function invitedBy(issuer: string): Promise<string[]> {
  const t = db().g8InviteRedemption;
  if (!t) return [];
  try { return (await t.findMany({ where: { issuer }, select: { redeemedBy: true }, take: 500, orderBy: { redeemedAt: 'desc' } })).map((r: { redeemedBy: string }) => r.redeemedBy); }
  catch (e) { warnOnce(e); return []; }
}
