/**
 * The one way to block or unblock a peer. Four layers, so a block holds even
 * if one of them is offline:
 *   1. encrypted vault list (this device enforces it on every incoming path);
 *   2. synced device state `blocked:<peer>` (all of the account's devices);
 *   3. XMTP consent Denied/Allowed (protocol level, every installation);
 *   4. server ChatBlock (contact requests, presence, fallback, queue — both directions).
 * Delete-chat never calls this.
 */
import { setBlocked, loadBlockList, saveBlockList, normalizeBlockList } from '@/lib/chat/blockList';
import { setSynced, getSynced } from '@/lib/sync/runtime';
import { setPeerConsent, getOpenXmtpClient } from '@/lib/xmtp/client';

export interface BlockContext {
  account?: string | null;
  client?: unknown;
  fetchImpl?: typeof fetch;
}

export async function applyPeerBlock(peer: string, blocked: boolean, ctx: BlockContext = {}): Promise<string[]> {
  const p = peer.trim().toLowerCase();
  const list = await setBlocked(p, blocked);
  if (ctx.account) { try { setSynced(ctx.account.toLowerCase(), { [`blocked:${p}`]: blocked ? true : null }); } catch {} }
  // Best effort, in parallel; the local block above already holds.
  const f = ctx.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  await Promise.allSettled([
    setPeerConsent((ctx.client ?? getOpenXmtpClient(ctx.account)) as any, p, blocked ? 'denied' : 'allowed'),
    f?.('/api/chat/blocks', {
      method: blocked ? 'POST' : 'DELETE', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ peer: p }),
    }),
  ]);
  return list;
}

/** Applies `blocked:<peer>` changes that arrived from the account's other devices. */
export async function applySyncedBlocks(changes: ReadonlyArray<[peer: string, blocked: boolean]>, client?: unknown): Promise<string[] | null> {
  let last: string[] | null = null;
  for (const [peer, blocked] of changes) {
    last = await setBlocked(peer, blocked);
    void setPeerConsent(client as any, peer, blocked ? 'denied' : 'allowed');
  }
  return last;
}

type Synced = (key: string) => unknown;

/**
 * Fresh device / reload: brings in the server's block list and reconciles it
 * with this account's synced state. A local unblock (tombstone `blocked:<p>`
 * = null) is newer than the server copy and wins (the server is told); a
 * local block the server lacks is pushed up. Returns the merged list, or
 * null when the server could not be read (the local list stands).
 */
export async function hydrateServerBlocks(ctx: BlockContext & { synced?: Synced }): Promise<string[] | null> {
  const f = ctx.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!f || !ctx.account) return null;
  let server: string[];
  try {
    const res = await f('/api/chat/blocks', { credentials: 'include', cache: 'no-store' });
    if (!res.ok) return null;
    const body = await res.json() as { blocked?: unknown };
    server = normalizeBlockList(body.blocked);
  } catch { return null; }
  const account = ctx.account.toLowerCase();
  const synced: Synced = ctx.synced ?? (k => getSynced(account, k));
  const local = await loadBlockList();
  const localSet = new Set(local);
  const serverSet = new Set(server);
  const merged = new Set(local);
  const sends: Array<Promise<unknown>> = [];
  const send = (peer: string, block: boolean) => sends.push(f('/api/chat/blocks', {
    method: block ? 'POST' : 'DELETE', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ peer }),
  }).catch(() => undefined));
  const client = ctx.client ?? getOpenXmtpClient(account);
  for (const p of server) {
    if (localSet.has(p)) continue;
    if (synced(`blocked:${p}`) === null) { send(p, false); continue; } // unblocked here later
    merged.add(p);
    void setPeerConsent(client as any, p, 'denied');
    try { setSynced(account, { [`blocked:${p}`]: true }); } catch {}
  }
  for (const p of local) if (!serverSet.has(p)) send(p, true);
  await Promise.allSettled(sends);
  const list = [...merged];
  if (list.length !== local.length) await saveBlockList(list);
  return list;
}

/** Pre-call check; false only when the server says the peer is unavailable (block either way). */
export async function callPreflight(peer: string, fetchImpl: typeof fetch | undefined = typeof fetch === 'function' ? fetch : undefined): Promise<boolean> {
  if (!fetchImpl) return true;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 1500);
  try {
    const res = await fetchImpl('/api/calls/preflight', {
      method: 'POST', credentials: 'include', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ peer: peer.toLowerCase() }),
    });
    return res.status !== 403;
  } catch {
    return true; // offline or slow: never block a call on the check itself
  } finally { clearTimeout(t); }
}
