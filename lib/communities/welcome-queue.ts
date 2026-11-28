/**
 * lib/communities/welcome-queue.ts — "I am a member but this device has no access to the encrypted
 * channel yet". A short-lived signal, no message content: (community, wallet, time). Online members'
 * apps poll it and, when someone is waiting, run the membership sync at once (add the wallet, welcome
 * its new devices, send a history capsule) instead of waiting for their next 20 s tick.
 *
 * In memory with a TTL: losing it on a restart only means the waiting device asks again (it re-posts
 * every few seconds while it waits). Bounded so it cannot grow without limit.
 */

export const WELCOME_TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 20_000;

type Entry = { communityId: string; wallet: string; at: number };

export class WelcomeQueue {
  private entries = new Map<string, Entry>();
  constructor(private ttl = WELCOME_TTL_MS) {}

  private prune(now: number): void {
    for (const [k, e] of this.entries) if (now - e.at > this.ttl) this.entries.delete(k);
    while (this.entries.size > MAX_ENTRIES) {
      const first = this.entries.keys().next().value;
      if (first === undefined) break;
      this.entries.delete(first);
    }
  }

  add(communityId: string, wallet: string, now: number = Date.now()): void {
    const w = wallet.toLowerCase();
    const k = `${communityId}|${w}`;
    this.entries.delete(k); // re-insert keeps insertion order = age order
    this.entries.set(k, { communityId, wallet: w, at: now });
    this.prune(now);
  }

  clear(communityId: string, wallet: string): void {
    this.entries.delete(`${communityId}|${wallet.toLowerCase()}`);
  }

  /** Waiting wallets per community, limited to `communities`, leaving out `exclude` (the caller). */
  pendingFor(communities: Iterable<string>, exclude: string, now: number = Date.now()): { communityId: string; waiting: number }[] {
    this.prune(now);
    const want = new Set(communities);
    const me = exclude.toLowerCase();
    const counts = new Map<string, number>();
    for (const e of this.entries.values()) {
      if (!want.has(e.communityId) || e.wallet === me) continue;
      counts.set(e.communityId, (counts.get(e.communityId) ?? 0) + 1);
    }
    return [...counts].map(([communityId, waiting]) => ({ communityId, waiting }));
  }

  get size(): number { return this.entries.size; }
}

const g = globalThis as unknown as { __hlWelcomeQueue?: WelcomeQueue };
export const welcomeQueue: WelcomeQueue = g.__hlWelcomeQueue ?? (g.__hlWelcomeQueue = new WelcomeQueue());
