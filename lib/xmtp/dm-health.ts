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

interface DuplicateDmLike extends DmLike { peerInboxId?: () => Promise<unknown>; createdAtNs?: unknown }
interface DmLister { listDms: (options?: Record<string, unknown>) => Promise<unknown> }

const ns = (v: unknown): number => { try { return Number(typeof v === 'bigint' ? v : BigInt(String(v ?? 0))); } catch { return 0; } };

/**
 * A DM with this person that they can actually read, among ALL the duplicates on this device.
 *
 * 26 November 2026 (production log): Safari on a phone kept `dm_peer_missing` → `publish_pending`
 * → `publish_retrying` for one chat while Chrome on the other side published fine. Its own DM was
 * stuck at epoch 0 without the other person; the healthy DM the other person created (whose
 * welcome this device had received) existed, but `getDmByInboxId` and `newDmWithIdentifier` both
 * return the stitched duplicate with the newest local activity, which was the broken one, so the
 * repair kept landing on it. `listDms({ includeDuplicateDms: true })` returns every DM group; the
 * newest one whose member list includes someone other than us is used instead.
 */
export async function findReadableDuplicate(
  conversations: DmLister,
  peerInboxId: string,
  selfInboxId: string,
  skipId?: unknown,
  timeoutMs = 3000,
): Promise<DuplicateDmLike | null> {
  const peer = (peerInboxId || '').toLowerCase();
  if (!peer) return null;
  let list: unknown;
  try { list = await within(conversations.listDms({ includeDuplicateDms: true }), timeoutMs * 2); } catch { return null; }
  if (!Array.isArray(list)) return null;
  const candidates: DuplicateDmLike[] = [];
  for (const d of list as DuplicateDmLike[]) {
    if (!d || d.id === skipId || typeof d.peerInboxId !== 'function') continue;
    let p = '';
    try { p = String(await within(d.peerInboxId(), timeoutMs)).toLowerCase(); } catch { continue; }
    if (p === peer) candidates.push(d);
  }
  candidates.sort((a, b) => ns(b.createdAtNs) - ns(a.createdAtNs));
  for (const d of candidates) {
    if ((await dmHealth(d, selfInboxId, timeoutMs)) === 'ok') return d;
  }
  return null;
}
