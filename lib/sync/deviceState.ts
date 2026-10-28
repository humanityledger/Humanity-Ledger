/**
 * lib/sync/deviceState.ts
 *
 * The per-account store of everything that should look the same on every
 * device signed in to that account: which chats are muted, locked, archived
 * or favourite, each chat's disappearing-message timer, when a chat was
 * cleared, when it was last read, and the chat settings.
 *
 * The existing UI reads these from localStorage under older key names
 * (ledger_muted_<peer>, ledger_archived_<account>, ...). Rather than rewrite
 * every reader, the store writes through to those keys whenever a value
 * changes, locally or from another device. Readers keep working unchanged;
 * only writers move to `set()`.
 *
 * Storage is injected so the store can be tested without a browser.
 */

import {
  applyOps, isValidOp, maxTime, nextTime, stateToOps,
  type SyncOp, type SyncState, type SyncValue,
} from './lww';

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type ChangeSource = 'local' | 'remote';
export type ChangeListener = (keys: string[], source: ChangeSource) => void;

const DEVICE_ID_KEY = 'hl_device_id';

export function getOrCreateDeviceId(kv: KV, random: () => string): string {
  try {
    const existing = kv.getItem(DEVICE_ID_KEY);
    if (existing && /^[A-Za-z0-9_-]{6,64}$/.test(existing)) return existing;
    const id = random();
    kv.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return random();
  }
}

/** Split "muted:0xabc" into ["muted", "0xabc"]. */
function splitKey(key: string): [string, string] {
  const i = key.indexOf(':');
  return [key.slice(0, i), key.slice(i + 1)];
}

export class DeviceStateStore {
  private state: SyncState = {};
  private clock = 0;
  private listeners = new Set<ChangeListener>();
  private readonly stateKey: string;
  /** Lowercase account, used for the sync state itself. */
  readonly account: string;
  /**
   * The account exactly as the UI spells it. Some legacy keys embed the
   * address as given (often checksummed), e.g. ledger_archived_0xAbC...,
   * so they must be written with the same spelling to be found.
   */
  private readonly legacyAccount: string;

  constructor(
    account: string,
    readonly deviceId: string,
    private readonly kv: KV,
  ) {
    this.legacyAccount = account;
    this.account = account.toLowerCase();
    this.stateKey = `hl_devsync_${this.account}`;
    this.load();
  }

  // ── Reading ───────────────────────────────────────────────────────────────

  get(key: string): SyncValue | undefined {
    return this.state[key]?.v;
  }

  /** Every op, newest first, for a full snapshot to another device. */
  snapshot(limit?: number): SyncOp[] {
    return stateToOps(this.state, limit);
  }

  // ── Writing ───────────────────────────────────────────────────────────────

  /**
   * Change values made on this device. Returns the ops to send to the other
   * devices (empty when nothing actually changed).
   */
  set(changes: Record<string, SyncValue>): SyncOp[] {
    const ops: SyncOp[] = [];
    for (const [k, v] of Object.entries(changes)) {
      if (this.state[k] && this.state[k].v === v) continue;
      const t = nextTime(this.clock);
      const op: SyncOp = [k, v, t, this.deviceId];
      // Keys outside the schema (e.g. a chat keyed by something other than an
      // address) are not synced; the caller's own storage still holds them.
      if (!isValidOp(op)) continue;
      this.clock = t;
      ops.push(op);
    }
    if (!ops.length) return [];
    const changed = this.merge(ops);
    if (changed.length) this.emit(changed, 'local');
    return ops;
  }

  /** Ops received from another device. Returns the keys that changed. */
  applyRemote(ops: SyncOp[]): string[] {
    const changed = this.merge(ops);
    if (changed.length) this.emit(changed, 'remote');
    return changed;
  }

  onChange(fn: ChangeListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private merge(ops: SyncOp[]): string[] {
    const { state, changed } = applyOps(this.state, ops);
    this.state = state;
    this.clock = Math.max(this.clock, maxTime(state));
    if (changed.length) {
      this.persist();
      for (const k of changed) this.writeLegacy(k);
    }
    return changed;
  }

  private emit(keys: string[], source: ChangeSource) {
    for (const fn of this.listeners) {
      try { fn(keys, source); } catch (e) { console.warn('[device-sync] listener failed', e); }
    }
  }

  private load() {
    try {
      const raw = this.kv.getItem(this.stateKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          // Re-validate on load: storage is not trusted either.
          const ops = Object.entries(parsed as SyncState).map(([k, e]) => [k, e?.v, e?.t, e?.d] as SyncOp);
          this.state = applyOps({}, ops).state;
          this.clock = maxTime(this.state);
          return;
        }
      }
    } catch { /* fall through to import */ }
    this.importLegacy();
  }

  private persist() {
    try { this.kv.setItem(this.stateKey, JSON.stringify(this.state)); } catch { /* quota or private mode */ }
  }

  /**
   * First run on this device: adopt what the old keys already say, with the
   * oldest possible time so that any real change made later, on any device,
   * wins over it. Two devices that each had something archived end up with
   * both archived.
   */
  private importLegacy() {
    const ops: SyncOp[] = [];
    const t = 1;
    const add = (k: string, v: SyncValue) => ops.push([k, v, t, this.deviceId]);
    const scan = (prefix: string, fn: (peer: string, raw: string) => void) => {
      const kvAny = this.kv as any;
      const len: number = typeof kvAny.length === 'number' ? kvAny.length : 0;
      for (let i = 0; i < len; i++) {
        const name: string | null = kvAny.key?.(i) ?? null;
        if (!name || !name.startsWith(prefix)) continue;
        const raw = this.kv.getItem(name);
        if (raw != null) fn(name.slice(prefix.length).toLowerCase(), raw);
      }
    };
    try {
      scan('ledger_muted_', p => add(`muted:${p}`, true));
      scan('ledger_locked_', p => add(`locked:${p}`, true));
      scan('ledger_disappearing_', (p, raw) => { if (raw && raw !== 'off') add(`disappearing:${p}`, raw); });
      scan(`ledger_cleared_${this.legacyAccount}_`, (p, raw) => {
        const n = parseInt(raw, 10);
        if (Number.isFinite(n) && n > 0) add(`cleared:${p}`, n);
      });
      const archived = JSON.parse(this.kv.getItem(`ledger_archived_${this.legacyAccount}`) || '[]');
      if (Array.isArray(archived)) for (const p of archived) if (typeof p === 'string') add(`archived:${p.toLowerCase()}`, true);
      const favs = JSON.parse(this.kv.getItem('ledger_favourites') || '[]');
      if (Array.isArray(favs)) for (const p of favs) if (typeof p === 'string') add(`fav:${p.toLowerCase()}`, true);
    } catch { /* malformed legacy data is skipped */ }
    // applyOps drops anything that does not validate (e.g. non-address keys).
    this.state = applyOps({}, ops).state;
    this.clock = maxTime(this.state);
    this.persist();
  }

  /** Keep the old localStorage keys in step, so existing readers see changes. */
  private writeLegacy(key: string) {
    const [ns, peer] = splitKey(key);
    const v = this.state[key]?.v ?? null;
    try {
      switch (ns) {
        case 'muted':
        case 'locked':
          if (v === true) this.kv.setItem(`ledger_${ns}_${peer}`, '1');
          else this.kv.removeItem(`ledger_${ns}_${peer}`);
          break;
        case 'disappearing':
          if (typeof v === 'string' && v !== 'off') this.kv.setItem(`ledger_disappearing_${peer}`, v);
          else this.kv.removeItem(`ledger_disappearing_${peer}`);
          break;
        case 'cleared':
          if (typeof v === 'number') this.kv.setItem(`ledger_cleared_${this.legacyAccount}_${peer}`, String(v));
          else this.kv.removeItem(`ledger_cleared_${this.legacyAccount}_${peer}`);
          break;
        case 'archived':
          this.kv.setItem(`ledger_archived_${this.legacyAccount}`, JSON.stringify(this.peersWhere('archived')));
          break;
        case 'fav':
          this.kv.setItem('ledger_favourites', JSON.stringify(this.peersWhere('fav')));
          break;
      }
    } catch { /* storage unavailable */ }
  }

  /** Peers whose flag in `ns` is currently true. */
  peersWhere(ns: string): string[] {
    const out: string[] = [];
    for (const [k, e] of Object.entries(this.state)) {
      if (e.v === true && k.startsWith(ns + ':')) out.push(k.slice(ns.length + 1));
    }
    return out.sort();
  }
}
