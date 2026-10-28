/**
 * lib/sync/xmtpSyncChannel.ts
 *
 * The transport for device sync: an XMTP group whose only member is the
 * account itself.
 *
 * Why this works: in XMTP v3 every device (installation) of an inbox is part
 * of every conversation that inbox is in. A group with no other members
 * therefore reaches exactly the account's own devices, end-to-end encrypted
 * with MLS like any other conversation. The server never sees the contents,
 * and no new key exchange or server endpoint is needed: the phone and the PC
 * are already trusted by the inbox because the user signed each one in.
 *
 * Rules that keep it safe:
 *  - A group counts as a sync group only if it has the reserved name AND
 *    every member is our own inbox. Someone else cannot invite us into a
 *    "sync group" and feed us state.
 *  - A message is applied only if its sender is our own inbox.
 *  - If two devices each create a sync group before seeing the other's (both
 *    set up at the same moment), we keep all valid ones and send to each.
 *    The data model (lib/sync/lww.ts) makes duplicates harmless.
 */

import type { Client } from '@xmtp/browser-sdk';

export const SYNC_GROUP_NAME = 'hl.device-sync.v1';
const SYNC_GROUP_DESCRIPTION = 'Keeps Ledger Chat in step across your own devices. Not a chat.';

type AnyGroup = {
  id: string;
  name?: string;
  createdAtNs?: bigint;
  members(): Promise<Array<{ inboxId: string }>>;
  send(content: string): Promise<string>;
  sync?(): Promise<unknown>;
};

/** True for a group that carries the reserved name, whatever its members. */
export function hasSyncGroupName(conv: { name?: string } | null | undefined): boolean {
  return !!conv && conv.name === SYNC_GROUP_NAME;
}

export class XmtpSyncChannel {
  private groups: AnyGroup[] = [];
  private ids = new Set<string>();

  constructor(private readonly client: Client) {}

  get selfInboxId(): string {
    return (this.client as any).inboxId ?? '';
  }

  /** Conversation ids of the sync groups currently in use. */
  isSyncConversation(conversationId: string | undefined | null): boolean {
    return !!conversationId && this.ids.has(conversationId);
  }

  /** Find our sync group(s), creating one if none exists yet. */
  async open(): Promise<void> {
    await this.refresh();
    if (this.groups.length) return;
    const created = await (this.client.conversations as any).newGroup([], {
      name: SYNC_GROUP_NAME,
      description: SYNC_GROUP_DESCRIPTION,
    }) as AnyGroup;
    this.groups = [created];
    this.ids = new Set([created.id]);
  }

  /** Re-scan for sync groups (another device may have created one). */
  async refresh(): Promise<void> {
    const self = this.selfInboxId;
    if (!self) return;
    try { await this.client.conversations.sync(); } catch { /* offline: use local view */ }
    const all = (await (this.client.conversations as any).listGroups()) as AnyGroup[];
    const valid: AnyGroup[] = [];
    for (const g of all) {
      if (!hasSyncGroupName(g)) continue;
      try {
        const members = await g.members();
        if (members.length > 0 && members.every(m => m.inboxId === self)) valid.push(g);
      } catch { /* skip groups we cannot inspect */ }
    }
    valid.sort((a, b) => {
      const zero = BigInt(0);
      const ta = a.createdAtNs ?? zero, tb = b.createdAtNs ?? zero;
      return ta < tb ? -1 : ta > tb ? 1 : a.id.localeCompare(b.id);
    });
    // Keep the oldest few; more than that would only come from a bug.
    this.groups = valid.slice(0, 3);
    this.ids = new Set(this.groups.map(g => g.id));
  }

  /** Send one encoded message to every sync group. */
  async send(text: string): Promise<void> {
    if (!this.groups.length) await this.open();
    const results = await Promise.allSettled(this.groups.map(g => g.send(text)));
    if (results.every(r => r.status === 'rejected')) {
      throw (results[0] as PromiseRejectedResult).reason;
    }
  }

  /**
   * Whether a streamed message should be applied: it must come from one of
   * our sync groups and from our own inbox.
   */
  accepts(msg: { conversationId?: string; senderInboxId?: string }): boolean {
    return this.isSyncConversation(msg.conversationId) && msg.senderInboxId === this.selfInboxId;
  }
}
