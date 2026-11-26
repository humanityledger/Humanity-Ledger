/**
 * lib/xmtp/dm-health.ts — can the other person read the DM we are about to write into?
 *
 * 26 November 2026 (production log): Chrome on the desktop reported `publish_pending` with
 * "Sync failed to wait for intent" for one conversation after another, and `publish_debug` showed
 * a DM at `epoch=0`. In libxmtp 1.6.6 (the engine of @xmtp/browser-sdk 5.2.0) a DM is created in
 * two steps: `create_dm_and_insert` writes it to the local database at epoch 0 with only us as a
 * member, then `add_members_by_inbox_id` publishes the commit that adds the other person and sends
 * them the welcome. When that second step has not landed, the DM exists only on this device. Every
 * message written into it is invisible to the other person, and every by-id lookup of the DM
 * (`findGroupById` → `stitched_group`) picks the duplicate with the newest `last_message_ns`, which
 * a local optimistic send (typing, read and delivery receipts included) keeps refreshing. A DM in
 * that state captures every later message of the chat.
 *
 * Here: a DM is sendable when its member list holds someone other than us. Unknown (an SDK without
 * members(), a timeout) is treated as sendable, so this never blocks a working chat.
 */

export type DmHealth = 'ok' | 'peer_missing' | 'unknown';

interface MemberLike { inboxId?: unknown }
interface DmLike { id?: unknown; members?: () => Promise<unknown> }

const HEALTH_OK_TTL_MS = 5 * 60_000;
const healthCache = new Map<string, { at: number; health: DmHealth }>();

function within<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p,
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('members timeout')), ms); }),
  ]).finally(() => { if (timer) clearTimeout(timer); });
}

/** 'ok' when someone other than `selfInboxId` is a member, 'peer_missing' when nobody else is. */
export async function dmHealth(dm: DmLike | null | undefined, selfInboxId: string, timeoutMs = 3000): Promise<DmHealth> {
  if (!dm || typeof dm.members !== 'function') return 'unknown';
  const key = typeof dm.id === 'string' ? `${selfInboxId}:${dm.id}` : '';
  const cached = key ? healthCache.get(key) : undefined;
  if (cached && cached.health === 'ok' && Date.now() - cached.at < HEALTH_OK_TTL_MS) return 'ok';
  let health: DmHealth = 'unknown';
  try {
    const members = await within(dm.members(), timeoutMs);
    if (Array.isArray(members)) {
      const self = (selfInboxId || '').toLowerCase();
      const others = (members as MemberLike[]).filter(
        (m) => typeof m?.inboxId === 'string' && m.inboxId !== '' && m.inboxId.toLowerCase() !== self,
      );
      health = others.length > 0 ? 'ok' : 'peer_missing';
    }
  } catch {
    health = 'unknown';
  }
  if (key) {
    if (health === 'ok') healthCache.set(key, { at: Date.now(), health });
    else healthCache.delete(key);
  }
  return health;
}

/** Forget what is known about a DM (after a sync that may have added the other person). */
export function forgetDmHealth(selfInboxId: string, dmId: unknown): void {
  if (typeof dmId === 'string') healthCache.delete(`${selfInboxId}:${dmId}`);
}

export function clearDmHealth(): void {
  healthCache.clear();
}

/**
 * One in-flight operation per key. A caller that stopped waiting (its own timeout) and asks again
 * gets the same promise, never a second operation: a second `newDmWithIdentifier` while the first
 * is still adding the other person is how the epoch-0 duplicate above was made.
 */
export function singleFlight<V>(inFlight: Map<string, Promise<V>>, key: string, run: () => Promise<V>): Promise<V> {
  const running = inFlight.get(key);
  if (running) return running;
  const p = Promise.resolve().then(run);
  inFlight.set(key, p);
  const clear = () => { if (inFlight.get(key) === p) inFlight.delete(key); };
  p.then(clear, clear);
  return p;
}

/**
 * Control messages that are only worth sending when they can arrive now: typing, read and
 * delivery receipts. Each one is an MLS application message (an intent to publish, a row that
 * moves the DM's last_message_ns). Reactions are not here: they are content a person chose.
 */
export function isEphemeralSignal(content: unknown): boolean {
  return typeof content === 'string' && /^__(TYPING|READ|DELIVERED)__/.test(content);
}
