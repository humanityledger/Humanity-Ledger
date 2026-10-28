/**
 * lib/sync/lww.ts
 *
 * The data model behind device sync: a last-writer-wins map.
 *
 * Every synced value is one entry: key -> { value, time, device }. Two
 * entries for the same key are resolved by the higher `time`, and a tie by
 * the higher `device` id, so every device that has seen the same entries
 * holds the same state no matter in which order they arrived, how often, or
 * whether some arrived twice. That is what lets the transport be simple: a
 * device can resend its whole state at any time and nothing breaks.
 *
 * A deletion is an entry whose value is null (a tombstone), so "unmute" on
 * the phone beats an older "mute" on the PC instead of being lost.
 *
 * This file is pure (no DOM, no XMTP) so it is fully unit-tested.
 */

export type SyncValue = string | number | boolean | null;

export interface SyncEntry {
  v: SyncValue;
  /** Hybrid logical time in ms: wall clock, but never behind anything seen. */
  t: number;
  /** Device id of the writer, used to break ties. */
  d: string;
}

export type SyncState = Record<string, SyncEntry>;

/** A wire op: [key, value, time, device]. Arrays keep messages small. */
export type SyncOp = [string, SyncValue, number, string];

export const SYNC_PREFIX = '__HLSYNC1__';
export const MAX_MESSAGE_BYTES = 64 * 1024;
export const MAX_OPS_PER_MESSAGE = 500;

const PEER = '(?:0x[0-9a-f]{40}|[0-9a-f]{64})';
const DISAPPEARING = new Set(['off', '5s', '10s', '30s', '1m', '5m', '1h', '24h', '7d', '90d']);

/**
 * Every key that may be synced, and the value it may hold. Anything else in
 * an incoming message is dropped, so a buggy or hostile client cannot write
 * arbitrary keys into another device's storage.
 */
const KEY_RULES: Array<{ re: RegExp; ok: (v: SyncValue) => boolean }> = [
  { re: new RegExp(`^(muted|locked|archived|fav):${PEER}$`), ok: v => v === true || v === null },
  { re: new RegExp(`^disappearing:${PEER}$`), ok: v => v === null || (typeof v === 'string' && DISAPPEARING.has(v)) },
  { re: new RegExp(`^(cleared|read):${PEER}$`), ok: v => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0) },
  // Chat settings; the field name is checked against the settings schema by the receiver.
  { re: /^pref:[a-z][a-z0-9_]{0,47}$/, ok: v => v === null || typeof v !== 'object' },
];

export function isValidKey(key: string): boolean {
  return typeof key === 'string' && key.length <= 120 && KEY_RULES.some(r => r.re.test(key));
}

export function isValidOp(op: unknown): op is SyncOp {
  if (!Array.isArray(op) || op.length !== 4) return false;
  const [k, v, t, d] = op;
  if (!isValidKey(k)) return false;
  if (typeof t !== 'number' || !Number.isFinite(t) || t <= 0) return false;
  if (typeof d !== 'string' || !/^[A-Za-z0-9_-]{6,64}$/.test(d)) return false;
  if (typeof v === 'string' && v.length > 2000) return false;
  const rule = KEY_RULES.find(r => r.re.test(k))!;
  return rule.ok(v as SyncValue);
}

/** True when `a` should replace `b`. */
export function wins(a: SyncEntry, b: SyncEntry | undefined): boolean {
  if (!b) return true;
  if (a.t !== b.t) return a.t > b.t;
  return a.d > b.d;
}

/**
 * Apply ops to a state. Returns the keys whose value actually changed, so the
 * caller only touches what moved. The input state is not mutated.
 */
export function applyOps(state: SyncState, ops: SyncOp[]): { state: SyncState; changed: string[] } {
  const next: SyncState = { ...state };
  const changed: string[] = [];
  for (const op of ops) {
    if (!isValidOp(op)) continue;
    const [k, v, t, d] = op;
    const entry: SyncEntry = { v, t, d };
    if (wins(entry, next[k])) {
      const before = next[k]?.v;
      next[k] = entry;
      if (before !== v && !changed.includes(k)) changed.push(k);
    }
  }
  return { state: next, changed };
}

export function stateToOps(state: SyncState, limit = MAX_OPS_PER_MESSAGE): SyncOp[] {
  return Object.entries(state)
    .sort((a, b) => b[1].t - a[1].t) // newest first, so a cap keeps what matters
    .slice(0, limit)
    .map(([k, e]) => [k, e.v, e.t, e.d]);
}

/** Highest time present, for the hybrid clock. */
export function maxTime(state: SyncState): number {
  let m = 0;
  for (const e of Object.values(state)) if (e.t > m) m = e.t;
  return m;
}

/** Hybrid logical clock: never goes backwards, even if the wall clock does. */
export function nextTime(lastSeen: number, now = Date.now()): number {
  return Math.max(now, lastSeen + 1);
}

// ── Wire format ─────────────────────────────────────────────────────────────

export type SyncMessage =
  /** Changes made on the sending device. */
  | { k: 'ops'; from: string; ops: SyncOp[] }
  /** The sender's whole state. `ask` asks devices that see it to answer with theirs. */
  | { k: 'snap'; from: string; ops: SyncOp[]; ask?: boolean };

export function encodeMessage(msg: SyncMessage): string {
  return SYNC_PREFIX + JSON.stringify(msg);
}

export function isSyncContent(content: unknown): content is string {
  return typeof content === 'string' && content.startsWith(SYNC_PREFIX);
}

/** Parse and validate. Returns null for anything malformed or oversized. */
export function decodeMessage(content: unknown): SyncMessage | null {
  if (!isSyncContent(content)) return null;
  if (content.length > MAX_MESSAGE_BYTES) return null;
  let raw: any;
  try {
    raw = JSON.parse(content.slice(SYNC_PREFIX.length));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  if (raw.k !== 'ops' && raw.k !== 'snap') return null;
  if (typeof raw.from !== 'string' || !/^[A-Za-z0-9_-]{6,64}$/.test(raw.from)) return null;
  if (!Array.isArray(raw.ops) || raw.ops.length > MAX_OPS_PER_MESSAGE) return null;
  const ops = raw.ops.filter(isValidOp) as SyncOp[];
  if (raw.k === 'snap') return { k: 'snap', from: raw.from, ops, ask: raw.ask === true };
  return { k: 'ops', from: raw.from, ops };
}

/** Split ops into messages that each fit the size and count limits. */
export function chunkOps(ops: SyncOp[], make: (ops: SyncOp[]) => SyncMessage): string[] {
  const out: string[] = [];
  let batch: SyncOp[] = [];
  const flush = () => {
    if (batch.length) out.push(encodeMessage(make(batch)));
    batch = [];
  };
  for (const op of ops) {
    batch.push(op);
    if (batch.length >= MAX_OPS_PER_MESSAGE || encodeMessage(make(batch)).length > MAX_MESSAGE_BYTES - 512) {
      batch.pop();
      flush();
      batch.push(op);
    }
  }
  flush();
  return out;
}
