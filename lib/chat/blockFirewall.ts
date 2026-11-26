import { prisma } from '@/lib/prisma';
import { safeRedisGet, safeRedisSetMany, safeRedisDel } from '@/lib/redis/client';

/**
 * Server-side mutual block firewall. If either wallet blocked the other,
 * nothing passes between them through the server: contact requests,
 * presence, server-fallback messages, offline queue, push, call setup.
 * The answer never says which side blocked.
 */
const ADDR = /^0x[0-9a-f]{40}$/;
const TTL_SEC = 300;
let warned = false;
/** A partial Prisma mock (unit tests) has no chatBlock delegate: fail open, silently. */
function hasDelegate(): boolean {
  return !!(prisma as unknown as { chatBlock?: unknown })?.chatBlock;
}
function warnOnce(e: unknown) {
  if (warned) return;
  warned = true;
  console.warn('[blockFirewall] ChatBlock unavailable; apply migration 20261126120000_chat_block.', (e as Error)?.message);
}
const pairKey = (a: string, b: string) => { const [x, y] = [a, b].sort(); return `block:pair:${x}:${y}`; };

export function normalizePeer(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  return ADDR.test(s) ? s : null;
}

export async function isMutuallyBlocked(a: string, b: string): Promise<boolean> {
  const x = normalizePeer(a), y = normalizePeer(b);
  if (!x || !y || x === y) return false;
  if (!hasDelegate()) return false;
  const cached = await safeRedisGet(pairKey(x, y));
  if (cached === '1') return true;
  if (cached === '0') return false;
  let hit: { id: string } | null;
  try {
    hit = await prisma.chatBlock.findFirst({
      where: { OR: [{ owner: x, blockedPeer: y }, { owner: y, blockedPeer: x }] },
      select: { id: true },
    });
  } catch (e) {
    // Table not migrated yet (prisma/migrations/20261126120000_chat_block): the client-side
    // block (vault + XMTP consent) still holds; do not take messaging down with it.
    warnOnce(e);
    return false;
  }
  await safeRedisSetMany([{ key: pairKey(x, y), value: hit ? '1' : '0', ttlSec: TTL_SEC }]);
  return !!hit;
}

export async function listOwnBlocks(owner: string): Promise<string[]> {
  const o = normalizePeer(owner);
  if (!o || !hasDelegate()) return [];
  const rows = await prisma.chatBlock.findMany({ where: { owner: o }, select: { blockedPeer: true }, take: 1000, orderBy: { createdAt: 'desc' } });
  return rows.map(r => r.blockedPeer);
}

export async function setServerBlock(owner: string, peer: string, blocked: boolean): Promise<void> {
  const o = normalizePeer(owner), p = normalizePeer(peer);
  if (!o || !p || o === p) throw new Error('invalid peer');
  if (blocked) {
    await prisma.chatBlock.upsert({ where: { owner_blockedPeer: { owner: o, blockedPeer: p } }, create: { owner: o, blockedPeer: p }, update: {} });
  } else {
    await prisma.chatBlock.deleteMany({ where: { owner: o, blockedPeer: p } });
  }
  await safeRedisDel(pairKey(o, p));
}

/**
 * Every wallet on the other side of a block involving `me` (I blocked them or
 * they blocked me). Used to filter what the server hands out; the caller
 * never learns which direction applied.
 */
export async function blockedCounterparties(me: string): Promise<Set<string>> {
  const m = normalizePeer(me);
  if (!m || !hasDelegate()) return new Set();
  try {
    const rows = await prisma.chatBlock.findMany({
      where: { OR: [{ owner: m }, { blockedPeer: m }] },
      select: { owner: true, blockedPeer: true },
      take: 2000,
    });
    return new Set(rows.map(r => (r.owner === m ? r.blockedPeer : r.owner)));
  } catch (e) {
    warnOnce(e);
    return new Set();
  }
}
