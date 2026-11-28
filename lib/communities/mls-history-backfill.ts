/**
 * lib/communities/mls-history-backfill.ts — a new member of an MLS community sees the posts sent
 * before they joined, end to end encrypted, with nothing in plain text on our server.
 *
 * Why it is needed: MLS (RFC 9420) gives forward secrecy per epoch. Adding a member starts epoch
 * E(k+1); the newcomer never holds the keys of epochs 0..k and cannot decrypt anything sent before.
 * Without help the reader shows "No posts yet" in a community with hundreds of posts.
 *
 * Protocol: two control messages travel INSIDE the community's own XMTP group (so they are MLS
 * encrypted for the current members only, and never shown as posts: CONTROL_PREFIXES):
 *
 *   __HL_HIST_REQ__::{"v":1,"rid":"…","at":ms}
 *       sent once by a member who just got access and has no history on this device.
 *   __HL_HIST_CAP__::{"v":1,"cid":"…","i":0,"n":3,"for":"rid?","msgs":[…]}
 *       a history capsule: the most recent messages a member's device already decrypted (posts,
 *       replies, votes, reactions, pins, attachments as their encrypted-attachment envelopes), split
 *       into chunks under the 10 000-character group message limit. Sent by the member who added
 *       the newcomer, by "Restore channel", or in answer to a request (one answer per request).
 *
 * Integrity: MLS authenticates who sent the capsule (a current member) but not the messages inside,
 * which another member's device vouches for. So: a message decrypted natively always wins over a
 * relayed copy with the same id; relayed messages are only accepted from before the first message
 * this device decrypted itself (anything later must be readable natively); every relayed message is
 * marked `relayed` so the reader can say where it came from; malformed capsules are dropped whole.
 *
 * The merged history is kept per (wallet, community, group) in IndexedDB, encrypted with AES-GCM
 * under a non-extractable key generated on this device, so it is there instantly after a reload.
 */

export const HIST_REQ_PREFIX = '__HL_HIST_REQ__::';
export const HIST_CAP_PREFIX = '__HL_HIST_CAP__::';

/** Group messages are capped at 10 000 characters (lib/xmtp/groups.ts); stay well below. */
export const CAPSULE_MAX_CHARS = 9_000;
export const CAPSULE_MAX_MSGS = 300;
export const HISTORY_CACHE_MAX = 3_000;
const MAX_CHUNKS = 64;
const MAX_MSGS_PER_CHUNK = 500;
const MAX_ID = 160;
const MAX_CONTENT = 10_000;

export interface RawGroupMsg {
  id: string;
  senderInboxId: string;
  content: string;
  createdAt: number;
  authorAddress?: string;
  /** Came from another member's capsule, not decrypted on this device. */
  relayed?: boolean;
  /** Inbox id of the member whose capsule carried it. */
  relayedBy?: string;
}

export interface HistoryRequest { v: 1; rid: string; at: number }
export interface CapsuleChunk { v: 1; cid: string; i: number; n: number; for?: string; msgs: RawGroupMsg[] }

export type HistoryControl =
  | { kind: 'req'; req: HistoryRequest }
  | { kind: 'cap'; chunk: CapsuleChunk };

export function isHistoryControl(content: unknown): boolean {
  return typeof content === 'string' && (content.startsWith(HIST_REQ_PREFIX) || content.startsWith(HIST_CAP_PREFIX));
}

export function randomId(): string {
  const a = new Uint8Array(12);
  globalThis.crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function encodeHistoryRequest(rid: string = randomId(), at: number = Date.now()): string {
  const req: HistoryRequest = { v: 1, rid, at };
  return HIST_REQ_PREFIX + JSON.stringify(req);
}

const str = (x: unknown, max: number): x is string => typeof x === 'string' && x.length > 0 && x.length <= max;
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0;

function validMsg(m: any): RawGroupMsg | null {
  if (!m || typeof m !== 'object') return null;
  if (!str(m.id, MAX_ID) || typeof m.senderInboxId !== 'string' || m.senderInboxId.length > MAX_ID) return null;
  if (typeof m.content !== 'string' || m.content.length === 0 || m.content.length > MAX_CONTENT) return null;
  if (!finite(m.createdAt)) return null;
  // A capsule never carries another capsule or request: no nesting, no amplification.
  if (isHistoryControl(m.content)) return null;
  const out: RawGroupMsg = { id: m.id, senderInboxId: m.senderInboxId, content: m.content, createdAt: m.createdAt };
  if (typeof m.authorAddress === 'string' && /^0x[0-9a-fA-F]{40}$/.test(m.authorAddress)) out.authorAddress = m.authorAddress.toLowerCase();
  return out;
}

/** Parse a control message; anything malformed returns null and is ignored whole. */
export function parseHistoryControl(content: unknown): HistoryControl | null {
  if (typeof content !== 'string') return null;
  try {
    if (content.startsWith(HIST_REQ_PREFIX)) {
      const r = JSON.parse(content.slice(HIST_REQ_PREFIX.length));
      if (r?.v !== 1 || !str(r.rid, MAX_ID) || !finite(r.at)) return null;
      return { kind: 'req', req: { v: 1, rid: r.rid, at: r.at } };
    }
    if (content.startsWith(HIST_CAP_PREFIX)) {
      const c = JSON.parse(content.slice(HIST_CAP_PREFIX.length));
      if (c?.v !== 1 || !str(c.cid, MAX_ID)) return null;
      if (!Number.isInteger(c.n) || c.n < 1 || c.n > MAX_CHUNKS) return null;
      if (!Number.isInteger(c.i) || c.i < 0 || c.i >= c.n) return null;
      if (c.for !== undefined && !str(c.for, MAX_ID)) return null;
      if (!Array.isArray(c.msgs) || c.msgs.length > MAX_MSGS_PER_CHUNK) return null;
      const msgs: RawGroupMsg[] = [];
      for (const m of c.msgs) {
        const v = validMsg(m);
        if (!v) return null; // one bad entry rejects the chunk
        msgs.push(v);
      }
      return { kind: 'cap', chunk: { v: 1, cid: c.cid, i: c.i, n: c.n, ...(c.for ? { for: c.for } : {}), msgs } };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Split the most recent messages into capsule chunks, each one a complete group message under
 * CAPSULE_MAX_CHARS. A single message too large for a chunk is skipped (it is still readable by
 * whoever holds it natively).
 */
export function buildCapsuleChunks(
  msgs: readonly RawGroupMsg[],
  opts: { forRid?: string; maxMsgs?: number; maxChars?: number; cid?: string } = {},
): string[] {
  const maxChars = opts.maxChars ?? CAPSULE_MAX_CHARS;
  const cid = opts.cid ?? randomId();
  const recent = msgs
    .filter((m) => !isHistoryControl(m.content))
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-(opts.maxMsgs ?? CAPSULE_MAX_MSGS))
    .map((m) => {
      const o: RawGroupMsg = { id: m.id, senderInboxId: m.senderInboxId, content: m.content, createdAt: m.createdAt };
      if (m.authorAddress) o.authorAddress = m.authorAddress;
      return o;
    });
  // Envelope overhead with a two-digit index/count and the longest ids we allow.
  const overhead = HIST_CAP_PREFIX.length + JSON.stringify({ v: 1, cid, i: 99, n: 99, for: opts.forRid, msgs: [] }).length;
  const groups: RawGroupMsg[][] = [];
  let cur: RawGroupMsg[] = [];
  let size = overhead;
  for (const m of recent) {
    const len = JSON.stringify(m).length + 1;
    if (overhead + len > maxChars) continue;
    if (size + len > maxChars && cur.length) {
      groups.push(cur);
      cur = [];
      size = overhead;
    }
    cur.push(m);
    size += len;
  }
  if (cur.length) groups.push(cur);
  const n = Math.min(groups.length, MAX_CHUNKS);
  // When over the chunk limit keep the newest chunks.
  const kept = groups.slice(groups.length - n);
  return kept.map((g, i) => HIST_CAP_PREFIX + JSON.stringify({ v: 1, cid, i, n, ...(opts.forRid ? { for: opts.forRid } : {}), msgs: g }));
}

export interface SplitHistory {
  /** Ordinary messages decrypted on this device (posts and post-level controls such as votes). */
  native: RawGroupMsg[];
  /** Messages carried by valid capsules, marked relayed. */
  relayed: RawGroupMsg[];
  requests: { rid: string; at: number; senderInboxId: string; createdAt: number }[];
  /** Request ids already answered by any member's capsule. */
  answered: Set<string>;
}

/** Separate history control messages from the group's ordinary messages. */
export function splitHistory(all: readonly RawGroupMsg[]): SplitHistory {
  const native: RawGroupMsg[] = [];
  const relayed: RawGroupMsg[] = [];
  const requests: SplitHistory['requests'] = [];
  const answered = new Set<string>();
  for (const m of all) {
    if (!isHistoryControl(m.content)) { native.push(m); continue; }
    const ctl = parseHistoryControl(m.content);
    if (!ctl) continue;
    if (ctl.kind === 'req') {
      requests.push({ rid: ctl.req.rid, at: ctl.req.at, senderInboxId: m.senderInboxId, createdAt: m.createdAt });
    } else {
      if (ctl.chunk.for) answered.add(ctl.chunk.for);
      for (const r of ctl.chunk.msgs) relayed.push({ ...r, relayed: true, relayedBy: m.senderInboxId });
    }
  }
  return { native, relayed, requests, answered };
}

/**
 * One chronological history: native beats cached beats relayed for the same id; relayed copies
 * (fresh or from the cache) are accepted only from before the first natively decrypted message.
 */
export function mergeHistory(
  native: readonly RawGroupMsg[],
  relayed: readonly RawGroupMsg[],
  cached: readonly RawGroupMsg[] = [],
  max: number = HISTORY_CACHE_MAX,
): RawGroupMsg[] {
  const floor = native.length ? Math.min(...native.map((m) => m.createdAt)) : Number.POSITIVE_INFINITY;
  const byId = new Map<string, RawGroupMsg>();
  const offer = (m: RawGroupMsg) => {
    if (!m || !m.id || isHistoryControl(m.content)) return;
    if (m.relayed && m.createdAt >= floor) return;
    const have = byId.get(m.id);
    if (!have) { byId.set(m.id, m); return; }
    if (have.relayed && !m.relayed) byId.set(m.id, m);
  };
  for (const m of native) offer({ ...m, relayed: undefined, relayedBy: undefined });
  for (const m of cached) offer(m);
  for (const m of relayed) offer(m);
  const out = [...byId.values()].map((m) => {
    if (!m.relayed) { const { relayed: _r, relayedBy: _b, ...rest } = m; return rest as RawGroupMsg; }
    return m;
  });
  out.sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out.length > max ? out.slice(out.length - max) : out;
}

/** Requests from others, recent, and not yet answered by anyone. */
export function requestsToAnswer(split: SplitHistory, selfInbox: string, now: number = Date.now(), maxAgeMs = 30 * 60_000) {
  return split.requests.filter(
    (r) => r.senderInboxId !== selfInbox && !split.answered.has(r.rid) && now - r.createdAt <= maxAgeMs,
  );
}

// ── Encrypted local cache ──────────────────────────────────────────────────────────────────────

export interface HistoryStore {
  load(key: string): Promise<RawGroupMsg[]>;
  save(key: string, msgs: RawGroupMsg[]): Promise<void>;
}

export function historyKey(wallet: string, communityId: string, groupId: string): string {
  return `${wallet.toLowerCase()}|${communityId}|${groupId.toLowerCase()}`;
}

/** In-memory store (tests, and browsers without IndexedDB / WebCrypto). */
export function memoryHistoryStore(): HistoryStore {
  const m = new Map<string, RawGroupMsg[]>();
  return {
    async load(k) { return (m.get(k) ?? []).map((x) => ({ ...x })); },
    async save(k, v) { m.set(k, v.map((x) => ({ ...x }))); },
  };
}

const DB = 'hl_community_history_v1';
const MSGS = 'msgs';
const KEYS = 'keys';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(MSGS)) db.createObjectStore(MSGS);
      if (!db.objectStoreNames.contains(KEYS)) db.createObjectStore(KEYS);
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function idb<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

/** IndexedDB + AES-GCM with a non-extractable per-wallet key (CryptoKey objects are storable). */
export function indexedDbHistoryStore(): HistoryStore {
  let dbp: Promise<IDBDatabase> | null = null;
  const db = () => (dbp ??= openDb());
  const keyFor = async (wallet: string): Promise<CryptoKey> => {
    const d = await db();
    const have = await idb<CryptoKey | undefined>(d, KEYS, 'readonly', (s) => s.get(wallet));
    if (have) return have;
    const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await idb(d, KEYS, 'readwrite', (s) => s.put(k, wallet));
    return k;
  };
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  return {
    async load(k) {
      try {
        const d = await db();
        const rec = await idb<{ iv: Uint8Array; data: ArrayBuffer } | undefined>(d, MSGS, 'readonly', (s) => s.get(k));
        if (!rec) return [];
        const key = await keyFor(k.split('|')[0]);
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv as BufferSource }, key, rec.data);
        const arr = JSON.parse(dec.decode(plain));
        return Array.isArray(arr) ? arr.filter((m) => m && typeof m.id === 'string') : [];
      } catch {
        return [];
      }
    },
    async save(k, msgs) {
      try {
        const d = await db();
        const key = await keyFor(k.split('|')[0]);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(msgs)));
        await idb(d, MSGS, 'readwrite', (s) => s.put({ iv, data }, k));
      } catch { /* best effort: the next read rebuilds it */ }
    },
  };
}

let defaultStore: HistoryStore | null = null;
export function getHistoryStore(): HistoryStore {
  if (defaultStore) return defaultStore;
  const ok = typeof indexedDB !== 'undefined' && typeof crypto !== 'undefined' && !!crypto.subtle;
  defaultStore = ok ? indexedDbHistoryStore() : memoryHistoryStore();
  return defaultStore;
}
export function setHistoryStoreForTests(s: HistoryStore | null): void {
  defaultStore = s;
}

/**
 * Read path for the reader: split controls, merge with the encrypted cache, save, and return the
 * full history plus the requests this device should answer.
 */
export async function absorbHistory(
  ctx: { wallet: string; communityId: string; groupId: string; selfInbox: string },
  all: readonly RawGroupMsg[],
  store: HistoryStore = getHistoryStore(),
): Promise<{ history: RawGroupMsg[]; toAnswer: ReturnType<typeof requestsToAnswer>; hadCache: boolean; nativeCount: number }> {
  const key = historyKey(ctx.wallet, ctx.communityId, ctx.groupId);
  const split = splitHistory(all);
  const cached = await store.load(key);
  const history = mergeHistory(split.native, split.relayed, cached);
  if (history.length !== cached.length || split.relayed.length || split.native.length) await store.save(key, history);
  return { history, toAnswer: requestsToAnswer(split, ctx.selfInbox), hadCache: cached.length > 0, nativeCount: split.native.length };
}

// ── Throttles (per device) ─────────────────────────────────────────────────────────────────────

const mem = new Map<string, number>();
function lastAt(key: string): number {
  try { const v = localStorage.getItem(key); if (v) return Number(v) || 0; } catch { /* storage blocked */ }
  return mem.get(key) ?? 0;
}
function markAt(key: string, t: number): void {
  mem.set(key, t);
  try { localStorage.setItem(key, String(t)); } catch { /* storage blocked */ }
}

/** True at most once per `everyMs` for this key on this device; records the attempt. */
export function takeSlot(key: string, everyMs: number, now: number = Date.now()): boolean {
  if (now - lastAt(key) < everyMs) return false;
  markAt(key, now);
  return true;
}
