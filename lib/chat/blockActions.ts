/**
 * The one way to block or unblock a peer. Four layers, so a block holds even
 * if one of them is offline:
 *   1. encrypted vault list (this device enforces it on every incoming path);
 *   2. synced device state `blocked:<peer>` (all of the account's devices);
 *   3. XMTP consent Denied/Allowed (protocol level, every installation);
 *   4. server ChatBlock (contact requests, presence, fallback, queue — both directions).
 * Delete-chat never calls this.
 */
import { setBlocked } from '@/lib/chat/blockList';
import { setSynced } from '@/lib/sync/runtime';
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
