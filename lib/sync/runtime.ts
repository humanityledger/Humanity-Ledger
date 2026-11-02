/**
 * lib/sync/runtime.ts
 *
 * Device sync, wired together: one DeviceStateStore per account (usable as
 * soon as the account is known), plus an XMTP sync channel once the XMTP
 * client is ready.
 *
 * UI code uses three functions:
 *   setSynced(account, { 'muted:0x..': true })   change a value everywhere
 *   getSynced(account, 'muted:0x..')             read the current value
 *   window 'hl:device-sync' event                 something changed
 *
 * The chat stream hands every message to handleDeviceSyncMessage() first;
 * it returns true when the message belonged to device sync (and must not be
 * shown as a chat bubble).
 */

import type { Client } from '@xmtp/browser-sdk';
import { DeviceStateStore, getOrCreateDeviceId, type KV } from './deviceState';
import { XmtpSyncChannel } from './xmtpSyncChannel';
import { chunkOps, decodeMessage, encodeMessage, isSyncContent, type SyncOp, type SyncValue } from './lww';
import { onLocalSettingsChange } from './bus';

export const DEVICE_SYNC_EVENT = 'hl:device-sync';
export interface DeviceSyncEventDetail {
  account: string;
  keys: string[];
  source: 'local' | 'remote';
}

type RemoteSettingsSink = (account: string, changes: Record<string, unknown>) => void;

const stores = new Map<string, DeviceStateStore>();
let runtime: SyncRuntime | null = null;
let settingsSink: RemoteSettingsSink | null = null;

function storage(): KV | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

function randomId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/** The store for an account, created on first use. Null outside the browser. */
export function getDeviceStore(account: string): DeviceStateStore | null {
  const kv = storage();
  if (!kv || !account) return null;
  const key = account.toLowerCase();
  let store = stores.get(key);
  if (!store) {
    // Pass the account as spelled by the caller: legacy keys embed it verbatim.
    store = new DeviceStateStore(account, getOrCreateDeviceId(kv, randomId), kv);
    store.onChange((keys, source) => {
      try {
        window.dispatchEvent(new CustomEvent<DeviceSyncEventDetail>(DEVICE_SYNC_EVENT, {
          detail: { account: key, keys, source },
        }));
      } catch { /* no window */ }
      if (source === 'remote') forwardRemoteSettings(key, keys);
    });
    stores.set(key, store);
  }
  return store;
}

export function getSynced(account: string, key: string): SyncValue | undefined {
  return getDeviceStore(account)?.get(key);
}

/**
 * Change synced values. Applies locally right away (including the legacy
 * localStorage keys) and sends to the other devices when the channel is up;
 * changes made before that go out with the first snapshot.
 */
export function setSynced(account: string, changes: Record<string, SyncValue>): void {
  const store = getDeviceStore(account);
  if (!store) return;
  const ops = store.set(changes);
  if (ops.length && runtime && runtime.account === store.account) runtime.queue(ops);
}

/** The settings engine registers here to receive settings from other devices. */
export function registerRemoteSettingsSink(fn: RemoteSettingsSink): void {
  settingsSink = fn;
}

function forwardRemoteSettings(account: string, keys: string[]) {
  if (!settingsSink) return;
  const store = stores.get(account);
  if (!store) return;
  const changes: Record<string, unknown> = {};
  for (const k of keys) {
    if (!k.startsWith('pref:')) continue;
    const v = store.get(k);
    if (v !== null && v !== undefined) changes[k.slice(5)] = v;
  }
  if (Object.keys(changes).length) {
    try { settingsSink(account, changes); } catch (e) { console.warn('[device-sync] settings sink failed', e); }
  }
}

// ── Runtime (needs the XMTP client) ─────────────────────────────────────────

class SyncRuntime {
  readonly channel: XmtpSyncChannel;
  private pending: SyncOp[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private answered = new Set<string>();
  private stopped = false;
  private unsubSettings: () => void;
  private retryMs = 1000;

  constructor(client: Client, readonly account: string, readonly store: DeviceStateStore) {
    this.channel = new XmtpSyncChannel(client);
    this.unsubSettings = onLocalSettingsChange(({ account: acc, changes }) => {
      if (acc !== this.account) return;
      const prefs: Record<string, SyncValue> = {};
      for (const [k, v] of Object.entries(changes)) {
        if (/^[a-z][a-z0-9_]{0,47}$/.test(k) && (v === null || ['string', 'number', 'boolean'].includes(typeof v))) {
          prefs[`pref:${k}`] = v as SyncValue;
        }
      }
      if (Object.keys(prefs).length) setSynced(this.account, prefs);
    });
  }

  async start() {
    await this.channel.open();
    if (this.stopped) return;
    await this.sendSnapshot(true);
  }

  stop() {
    this.stopped = true;
    this.unsubSettings();
    if (this.flushTimer) clearTimeout(this.flushTimer);
  }

  queue(ops: SyncOp[]) {
    this.pending.push(...ops);
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => { this.flushTimer = null; void this.flush(); }, 250);
  }

  private async flush() {
    if (this.stopped || !this.pending.length) return;
    const ops = this.pending;
    this.pending = [];
    try {
      for (const text of chunkOps(ops, batch => ({ k: 'ops', from: this.store.deviceId, ops: batch }))) {
        await this.channel.send(text);
      }
      this.retryMs = 1000;
    } catch (e) {
      // Offline or XMTP hiccup: keep the ops and try again later. Order does
      // not matter (last-writer-wins), so re-queuing is safe.
      this.pending = ops.concat(this.pending);
      console.warn('[device-sync] send failed, retrying', e);
      this.flushTimer = setTimeout(() => { this.flushTimer = null; void this.flush(); }, this.retryMs);
      this.retryMs = Math.min(this.retryMs * 2, 60_000);
    }
  }

  private async sendSnapshot(ask: boolean) {
    const ops = this.store.snapshot();
    // An empty snapshot is still sent when asking, so other devices answer.
    const texts = ops.length
      ? chunkOps(ops, batch => ({ k: 'snap', from: this.store.deviceId, ops: batch, ask }))
      : [encodeMessage({ k: 'snap', from: this.store.deviceId, ops: [], ask })];
    for (const t of texts) await this.channel.send(t);
  }

  async handle(msg: { content?: unknown; conversationId?: string; senderInboxId?: string }): Promise<void> {
    if (!this.channel.accepts(msg)) {
      // Possibly a sync group another of our devices created since we looked.
      if (msg.senderInboxId !== this.channel.selfInboxId) return;
      await this.channel.refresh();
      if (!this.channel.accepts(msg)) return;
    }
    const m = decodeMessage(msg.content);
    if (!m || m.from === this.store.deviceId) return; // malformed, or our own echo
    this.store.applyRemote(m.ops);
    if (m.k === 'snap' && m.ask && !this.answered.has(m.from)) {
      // A device just started: answer once with everything we know.
      this.answered.add(m.from);
      await this.sendSnapshot(false).catch(() => {});
    }
  }
}

/** Start device sync for an account once its XMTP client exists. Idempotent. */
export async function startDeviceSync(client: Client, account: string): Promise<void> {
  const store = getDeviceStore(account);
  if (!store) return;
  if (runtime && runtime.account === store.account) return;
  runtime?.stop();
  runtime = new SyncRuntime(client, store.account, store);
  try {
    await runtime.start();
  } catch (e) {
    console.warn('[device-sync] could not start; changes stay on this device until next start', e);
  }
}

export function stopDeviceSync(): void {
  runtime?.stop();
  runtime = null;
}

/**
 * Give a streamed XMTP message to device sync. Returns true when it was a
 * device-sync message, which the caller must then skip (never render it).
 */
export function handleDeviceSyncMessage(msg: { content?: unknown; conversationId?: string; senderInboxId?: string }): boolean {
  if (!isSyncContent(msg.content)) return false;
  if (runtime) void runtime.handle(msg).catch(e => console.warn('[device-sync] apply failed', e));
  return true;
}

export { isSyncContent };
