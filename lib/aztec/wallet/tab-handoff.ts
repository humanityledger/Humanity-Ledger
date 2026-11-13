/**
 * lib/aztec/wallet/tab-handoff.ts
 *
 * One browser profile, one open private wallet: each encrypted store holds an origin-wide lock on
 * its OPFS pool while open (lib/aztec/wallet/store.ts). When the wallet is opened in a second tab,
 * that tab asks the one holding it to close it, like "Use here" in WhatsApp Web:
 *
 *   - the holding tab closes its wallet and answers "released" when nothing is running there;
 *   - it answers "busy" while a payment or proof is in progress, and keeps the wallet open;
 *   - no answer (an older build, a frozen page) leaves the original "open in another tab" error.
 *
 * Messages carry no keys or balances: only a request id and the tab ids.
 */

export type HandoffResult = 'released' | 'busy' | 'none';

type Msg =
  | { t: 'release'; from: string; req: string }
  | { t: 'released' | 'busy'; from: string; to: string; req: string };

export interface ChannelLike {
  postMessage(msg: unknown): void;
  addEventListener(type: 'message', fn: (ev: { data: unknown }) => void): void;
  close?(): void;
}

export interface TabHandoffOptions {
  /** True while this tab holds the wallet's stores open. */
  holds: () => boolean;
  /** True when closing now loses nothing (no payment, proof or open in progress). */
  canRelease: () => boolean;
  /** Closes the wallet in this tab and frees the stores. */
  release: () => Promise<void>;
  channel?: ChannelLike | null;
  tabId?: string;
}

export const HANDOFF_CHANNEL = 'ledger-private-wallet-v1';

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

function isMsg(v: unknown): v is Msg {
  const m = v as any;
  return !!m && typeof m === 'object' && typeof m.t === 'string' && typeof m.from === 'string' && typeof m.req === 'string';
}

export function createTabHandoff(opts: TabHandoffOptions) {
  const tabId = opts.tabId ?? randomId();
  let channel: ChannelLike | null = opts.channel ?? null;
  if (channel === null && opts.channel === undefined && typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(HANDOFF_CHANNEL) as unknown as ChannelLike;
    } catch {
      channel = null;
    }
  }
  const waiting = new Map<string, (r: HandoffResult) => void>();

  channel?.addEventListener('message', (ev) => {
    const m = ev.data;
    if (!isMsg(m) || m.from === tabId) return;
    if (m.t === 'release') {
      if (!opts.holds()) return; // only the tab holding the wallet answers
      if (!opts.canRelease()) {
        channel?.postMessage({ t: 'busy', from: tabId, to: m.from, req: m.req } satisfies Msg);
        return;
      }
      void opts
        .release()
        .catch(() => {})
        .finally(() => channel?.postMessage({ t: 'released', from: tabId, to: m.from, req: m.req } satisfies Msg));
      return;
    }
    if ((m.t === 'released' || m.t === 'busy') && m.to === tabId) {
      const done = waiting.get(m.req);
      if (done) {
        waiting.delete(m.req);
        done(m.t);
      }
    }
  });

  return {
    tabId,
    /** Asks the tab holding the wallet to close it. Resolves with what it answered. */
    requestRelease(timeoutMs = 5_000): Promise<HandoffResult> {
      if (!channel) return Promise.resolve('none');
      const req = randomId();
      return new Promise<HandoffResult>((resolve) => {
        const timer = setTimeout(() => {
          waiting.delete(req);
          resolve('none');
        }, timeoutMs);
        waiting.set(req, (r) => {
          clearTimeout(timer);
          resolve(r);
        });
        channel!.postMessage({ t: 'release', from: tabId, req } satisfies Msg);
      });
    },
  };
}

/** Store errors that mean another holder has the wallet's storage open. */
export function isStoreBusyError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? '');
  return /SqlitePoolBusyError|is already in use by another store instance/i.test(msg);
}

/** Shown in a tab whose wallet was closed because the wallet was opened in another tab. */
export const HANDED_OFF_MESSAGE =
  'Your private wallet is now open in another Ledger Chat tab or window. Tap Try again to use it here instead. Nothing was sent.';

/** Shown when the other tab is in the middle of a payment or a proof. */
export const BUSY_ELSEWHERE_MESSAGE =
  'Your private wallet is finishing a payment or a proof in another Ledger Chat tab or window. Let it finish there, then try again here. Nothing was sent.';

/** Shown when the page was put in the back/forward cache and its wallet closed to free the locks. */
export const PAUSED_MESSAGE =
  'Your private wallet was closed while this page was in the background, so another tab can use it. Tap Try again to open it here. Nothing was sent.';

/** Shown when the wallet was closed after a long time in the background, to give its memory back. */
export const IDLE_CLOSED_MESSAGE =
  'Your private wallet was closed after a while in the background, to free your device\'s memory. Tap Try again to open it. Nothing was sent.';

/** How long a hidden tab keeps an idle private wallet open (its node and prover hold a lot of memory). */
export const IDLE_CLOSE_MS = 10 * 60_000;
