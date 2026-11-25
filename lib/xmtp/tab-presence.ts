/**
 * lib/xmtp/tab-presence.ts: is Ledger Chat open in another tab of this browser?
 *
 * The XMTP browser SDK keeps its database in the origin's private file system and must not be
 * used from several tabs or windows at once (XMTP browser SDK README, "Limitations"). Two tabs
 * that both run a client compete for the same conversations, and a publish can then wait on an
 * intent that never resolves ("Sync failed to wait for intent", production log of 24 Nov 2026,
 * ending in publish_gave_up). This does not block anyone: it tells the person, once, so they
 * close the other tab, and reports `multi_tab` so the server log shows how often it happens.
 *
 * Messages carry only a random tab id. No address, inbox id or message.
 */

export interface PresenceChannel {
  postMessage(msg: unknown): void;
  addEventListener(type: 'message', fn: (ev: { data: unknown }) => void): void;
  close?(): void;
}

export const TAB_PRESENCE_CHANNEL = 'ledger-xmtp-tabs-v1';

type Msg = { t: 'hello' | 'here'; from: string };

function isMsg(v: unknown): v is Msg {
  const m = v as Msg | null;
  return !!m && typeof m === 'object' && (m.t === 'hello' || m.t === 'here') && typeof m.from === 'string';
}

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Announce this tab and answer the others. `onOtherTab` runs once, the first time another tab
 * with a running client is seen (it announced itself, or it answered this tab's announcement).
 * Returns a function that stops listening.
 */
export function watchOtherTabs(onOtherTab: () => void, opts: { channel?: PresenceChannel | null; tabId?: string } = {}): () => void {
  const tabId = opts.tabId ?? randomId();
  let channel: PresenceChannel | null = opts.channel ?? null;
  if (channel === null && opts.channel === undefined && typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(TAB_PRESENCE_CHANNEL) as unknown as PresenceChannel;
    } catch {
      channel = null;
    }
  }
  if (!channel) return () => {};
  let seen = false;
  let stopped = false;
  const ch = channel;
  ch.addEventListener('message', (ev) => {
    if (stopped || !isMsg(ev.data) || ev.data.from === tabId) return;
    if (ev.data.t === 'hello') {
      try { ch.postMessage({ t: 'here', from: tabId } satisfies Msg); } catch { /* channel closed */ }
    }
    if (!seen) {
      seen = true;
      onOtherTab();
    }
  });
  try { ch.postMessage({ t: 'hello', from: tabId } satisfies Msg); } catch { /* channel closed */ }
  return () => {
    stopped = true;
    try { ch.close?.(); } catch { /* already closed */ }
  };
}

export const OTHER_TAB_NOTICE = {
  title: 'Ledger Chat is open in another tab',
  description: 'Messages are sent from one tab at a time in this browser. Close the other Ledger Chat tab or window so your messages are delivered.',
};
