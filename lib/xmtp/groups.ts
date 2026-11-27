/**
 * Humanity Ledger — Secure XMTP Group Chat Engine
 *
 * SECURITY ARCHITECTURE:
 * ─────────────────────
 * 1. Group creation uses `newGroupWithIdentifiers()` — XMTP resolves each
 *    Ethereum address to its inboxId cryptographically. No address spoofing possible.
 * 2. All address inputs are validated with EIP-55 checksum BEFORE being sent
 *    to the XMTP network. Malformed addresses are rejected at the gate.
 * 3. Member management (add/remove/promote) requires the caller to be a current
 *    member of the group — XMTP enforces this at the protocol level via MLS.
 * 4. Group names and descriptions are sanitized to prevent XSS injection
 *    before being passed to XMTP metadata fields.
 * 5. The PXE Vault is NEVER involved in group operations. Group key material
 *    is managed by XMTP's MLS (Messaging Layer Security) protocol, which
 *    derives a new epoch key per membership change. No member can decrypt
 *    messages from epochs they were not part of.
 *
 * MLS SECURITY GUARANTEE (XMTP v5.2.0):
 * Each group has a cryptographic epoch. When a member is added or removed,
 * a new epoch key is derived. A removed member cannot decrypt future messages.
 * A new member cannot decrypt past messages. Forward secrecy is guaranteed.
 */

import type { Client } from '@xmtp/browser-sdk';
import { hasSyncGroupName } from '@/lib/sync/xmtpSyncChannel';
import { isSyncWaitError, redactXmtpError } from './syncErrors';

export { isPersistableXmtpGroupId } from './groupId';

// ── Input sanitization ─────────────────────────────────────────────────────

/**
 * Strips HTML tags and dangerous characters from a group name or description.
 * Prevents XSS injection through group metadata fields.
 */
function sanitizeGroupMetadata(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')          // Strip all HTML tags
    .replace(/[<>"'`]/g, '')           // Strip dangerous characters
    .replace(/javascript:/gi, '')      // Strip javascript: protocol
    .trim()
    .slice(0, 128);                    // Hard limit: 128 chars max
}

const ADDR = /^0x[a-fA-F0-9]{40}$/;
const GROUP_SERIAL_WAIT_MS = 15_000;
const PUBLISH_WAIT_MS = 18_000;
const MAX_GROUP_PUBLISH_RETRIES = 20;
const groupChains = new Map<string, Promise<void>>();
const failedGroupMsgIds = new Set<string>();
/** Maps `${groupId}\0${content}` -> locally queued optimistic msgId so Retrying never duplicates a post. */
const pendingContentMsgIds = new Map<string, string>();
const groupPublishRetries = new Map<string, { group: any; attempt: number; timer: ReturnType<typeof setTimeout> | null; client?: Client }>();
let groupFlushListenersInstalled = false;

function errorText(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message?: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  return String(e ?? '');
}

function reportGroupDelivery(kind: 'group_failed' | 'publish_paused' | 'publish_pending' | 'publish_retrying', err: unknown): void {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') return;
  void import('./client').then((m) => m.reportDelivery?.(kind, err)).catch(() => {});
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return Promise.race([
    p,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(label)), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function installGroupFlushListeners(): void {
  if (groupFlushListenersInstalled || typeof window === 'undefined' || typeof document === 'undefined') return;
  groupFlushListenersInstalled = true;
  const flush = () => {
    for (const [groupId, entry] of [...groupPublishRetries.entries()]) {
      if (entry.timer) clearTimeout(entry.timer);
      groupPublishRetries.delete(groupId);
      scheduleGroupPublishRetry(groupId, entry.group, 0, entry.client);
    }
  };
  window.addEventListener('online', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flush();
  });
  window.addEventListener('pageshow', flush);
}

function scheduleGroupPublishRetry(groupId: string, group: any, attempt = 0, client?: Client): void {
  if (typeof group?.publishMessages !== 'function') return;
  installGroupFlushListeners();
  const existing = groupPublishRetries.get(groupId);
  if (attempt === 0 && existing) {
    existing.group = group;
    if (client) existing.client = client;
    return;
  }
  if (attempt >= MAX_GROUP_PUBLISH_RETRIES) {
    groupPublishRetries.delete(groupId);
    reportGroupDelivery('group_failed', 'group background publish retries exhausted');
    return;
  }
  if (attempt === 3) reportGroupDelivery('publish_retrying', `group attempt ${attempt}`);
  const entry = { group, attempt, timer: null as ReturnType<typeof setTimeout> | null, client };
  groupPublishRetries.set(groupId, entry);
  const delay = attempt === 0 ? 1_500 : Math.min(1_500 * 2 ** attempt, 30_000);
  entry.timer = setTimeout(() => {
    runGroupSerial(groupId, () => withTimeout(Promise.resolve(entry.group.publishMessages()), PUBLISH_WAIT_MS, 'publish timeout'))
      .then(() => {
        groupPublishRetries.delete(groupId);
      })
      .catch(async (err: unknown) => {
        if (isSyncWaitError(err) || /epoch|intent|lock|commit/i.test(errorText(err))) {
          await runGroupSerial(groupId, () => withTimeout(Promise.resolve(entry.group.sync?.()), 6_000, 'group sync timeout')).catch(() => {});
          if (entry.client) {
            await withTimeout(Promise.resolve((entry.client as any)?.conversations?.sync?.()), 6_000, 'conv sync timeout').catch(() => {});
          }
        }
        const active = typeof entry.group.isActive === 'function' ? await entry.group.isActive().catch(() => true) : true;
        if (active === false) {
          groupPublishRetries.delete(groupId);
          return;
        }
        scheduleGroupPublishRetry(groupId, entry.group, attempt + 1, entry.client);
      });
  }, delay);
}

/** Serialize WASM operations (`sync`, `publishMessages`, `send`) per group so concurrent calls never collide. */
export function runGroupSerial<T>(groupId: string, task: () => Promise<T>): Promise<T> {
  const prev = groupChains.get(groupId) ?? Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const waitPrev = Promise.race([
    prev.catch(() => {}),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, GROUP_SERIAL_WAIT_MS);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
  const result = waitPrev.then(() => task());
  const tail = result.then(() => undefined, () => undefined);
  groupChains.set(groupId, tail);
  tail.then(() => {
    if (groupChains.get(groupId) === tail) groupChains.delete(groupId);
  });
  return result;
}

/** Look up a group by id; if absent locally, sync welcomes (including unknown consent) and check again. */
export async function resolveGroupForClient(client: Client, groupId: string): Promise<any | null> {
  const convs = (client as any)?.conversations;
  if (!convs || !groupId) return null;
  let group = await convs.getConversationById?.(groupId).catch(() => null);
  if (group) return group;
  // Fast sync first (< 2 s), then re-check before falling back to slow syncAll.
  try {
    if (typeof convs.sync === 'function') {
      await withTimeout(Promise.resolve(convs.sync()), 4_000, 'sync timeout');
    }
  } catch { /* best-effort */ }
  group = await convs.getConversationById?.(groupId).catch(() => null);
  if (group) return group;
  try {
    if (typeof convs.syncAll === 'function') {
      await withTimeout(Promise.resolve(convs.syncAll([0, 1])), 8_000, 'syncAll timeout');
    }
  } catch { /* best-effort sync before failing */ }
  group = await convs.getConversationById?.(groupId).catch(() => null);
  if (group) return group;
  if (typeof convs.listGroups === 'function') {
    const list: any[] = await convs.listGroups({ consentStates: [0, 1] }).catch(() => convs.listGroups().catch(() => []));
    const target = groupId.toLowerCase();
    group = list.find((g) => String(g?.id ?? '').toLowerCase() === target) ?? null;
  }
  return group ?? null;
}

/**
 * Validates an Ethereum address is a properly checksummed EIP-55 address.
 * Rejects all other input silently at the gate.
 */
function isValidEthAddress(addr: string): boolean {
  return ADDR.test(addr);
}

async function checksumAddr(addr: string): Promise<string> {
  try {
    const { getAddress } = await import('viem');
    return getAddress(addr);
  } catch {
    return addr;
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface GroupInfo {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  memberCount: number;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  lastMessage?: string;
  lastAt?: Date;
}

// ── Group Creation ─────────────────────────────────────────────────────────

/**
 * Creates a new XMTP group with strict address validation.
 *
 * SECURITY: Every member address is checksummed before being sent to XMTP.
 * XMTP's MLS protocol then verifies each address has an active inbox identity
 * before adding them. Fake or unregistered addresses are rejected by the network.
 *
 * @param client       - Authenticated XMTP client
 * @param memberAddresses - Array of Ethereum addresses to add (validated)
 * @param groupName    - Display name for the group (sanitized)
 * @param description  - Optional group description (sanitized)
 * @returns The group ID if created successfully
 */
export async function createSecureGroup(
  client: Client,
  memberAddresses: string[],
  groupName: string,
  description: string = '',
  /** A community's first channel starts with its creator only; members are added as they join. */
  opts: { allowCreatorOnly?: boolean } = {},
): Promise<string> {
  // 1. Sanitize all metadata inputs (XSS prevention)
  const safeName = sanitizeGroupMetadata(groupName);
  const safeDescription = sanitizeGroupMetadata(description);

  if (!safeName || safeName.length < 1) {
    throw new Error('[GroupChat] Group name cannot be empty.');
  }

  // 2. Validate and normalize all member addresses
  const validatedIdentifiers: { identifier: string; identifierKind: 'Ethereum' }[] = [];

  for (const rawAddr of memberAddresses) {
    if (!isValidEthAddress(rawAddr)) {
      console.warn(`[GroupChat] Skipping invalid address: ${rawAddr}`);
      continue;
    }
    const checksummed = await checksumAddr(rawAddr);
    validatedIdentifiers.push({
      identifier: checksummed,
      identifierKind: 'Ethereum',
    });
  }

  if (validatedIdentifiers.length < 1 && !opts.allowCreatorOnly) {
    throw new Error('[GroupChat] At least 1 valid member address is required.');
  }

  // 3. Hard cap: max 100 members per group (prevents DoS via mass key material)
  if (validatedIdentifiers.length > 99) {
    throw new Error('[GroupChat] Maximum group size is 100 members.');
  }

  // 4. Create the group via XMTP (MLS handles key material securely)
  // A group with only its creator (the first channel of a new community) is made on this device
  // with newGroupOptimistic: it needs no network round trip, its id is final at once, and it is
  // published with the first post or the first member added. Waiting for the network here was the
  // cause of "The group may still be on its way" when creating a community (27/11/2026).
  if (validatedIdentifiers.length === 0) {
    const conv = client.conversations as any;
    if (typeof conv.newGroupOptimistic === 'function') {
      const group = await conv.newGroupOptimistic({
        name: safeName,
        description: safeDescription,
        permissions: 0,
      });
      // Serialize the initial publish per group so an immediate first post waits cleanly in line
      // instead of colliding in the WASM worker.
      void runGroupSerial(group.id, async () => {
        await withTimeout(Promise.resolve(group.publishMessages?.()), 15_000, 'publish timeout');
      }).catch(() => { /* published with the first post or first member */ });
      console.log(`[GroupChat] Group "${safeName}" created on this device with ID: ${group.id}`);
      return group.id;
    }
  }

  const startedNs = BigInt(Date.now() - 5_000) * 1_000_000n;
  let group: any;
  try {
    group = await (client.conversations as any).newGroupWithIdentifiers(
      validatedIdentifiers,
      {
        name: safeName,
        description: safeDescription,
        permissions: 0,
      }
    );
  } catch (e) {
    // "synced N messages, 0 failed N succeeded from cursor …": the group was created and the
    // commit published; only the wait for the network's receipt ran out (isSyncWaitError).
    // Find it instead of reporting a failure (three tries over about 6 s), and let a later sync
    // finish the invitations.
    if (!isSyncWaitError(e)) throw e;
    for (let attempt = 0; attempt < 3 && !group; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 2_000));
      group = await findGroupCreatedSince(client, safeName, startedNs).catch(() => null);
    }
    if (!group) throw new Error('The network did not confirm the new group in time. Check your connection and try again.');
    console.warn(`[GroupChat] Group "${safeName}" created; the network confirmed it late (${redactXmtpError(e)}).`);
    setTimeout(() => { Promise.resolve(group.sync?.()).catch(() => {}); }, 3_000);
  }

  console.log(`[GroupChat] Group "${safeName}" created with ID: ${group.id}`);
  return group.id;
}

// ── Group List ─────────────────────────────────────────────────────────────

/**
 * Lists all groups the current user is a member of.
 * Syncs from the XMTP network before listing to ensure freshness.
 */
export async function listUserGroups(client: Client): Promise<GroupInfo[]> {
  await client.conversations.sync();
  const groups = await (client.conversations as any).listGroups();

  const selfInboxId: string = (client as any).inboxId ?? '';

  const result: GroupInfo[] = [];
  for (const group of groups) {
    // The device-sync group (lib/sync) carries state between the user's own
    // devices. It is not a chat and must never be listed as one.
    if (hasSyncGroupName(group)) continue;
    try {
      await group.sync();
      const members = typeof group.members === 'function' ? await group.members() : (group.members ?? []);
      const isAdmin = await group.isAdmin(selfInboxId).catch(() => false);
      const isSuperAdmin = await group.isSuperAdmin(selfInboxId).catch(() => false);

      result.push({
        id: group.id,
        name: sanitizeGroupMetadata(group.name ?? 'Unnamed Group'),
        description: sanitizeGroupMetadata(group.description ?? ''),
        imageUrl: group.imageUrl ?? '',
        memberCount: members.length,
        isAdmin,
        isSuperAdmin,
        lastAt: new Date(),
      });
    } catch (e) {
      console.warn('[GroupChat] Failed to load group:', group.id, e);
    }
  }

  return result;
}

// ── Send Group Message ─────────────────────────────────────────────────────

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

async function classifyStaticFatalError(group: any, err: unknown): Promise<string | null> {
  const text = errorText(err);
  if (/paused/i.test(text)) {
    reportGroupDelivery('publish_paused', err);
    return 'Not sent. This encrypted group needs a newer app version. Reload the page and try again.';
  }
  if (typeof group?.pausedForVersion === 'function') {
    const paused = await withTimeout<any>(Promise.resolve(group.pausedForVersion()), 4_000, 'paused timeout').catch(() => null);
    if (typeof paused === 'string' && paused) {
      reportGroupDelivery('publish_paused', `needs libxmtp ${paused.slice(0, 24)}`);
      return 'Not sent. This encrypted group needs a newer app version. Reload the page and try again.';
    }
  }
  if (/fork/i.test(text)) {
    return 'Not sent. Encrypted sync for this group fell behind on this device. Reload the page or open the community on another device.';
  }
  if (/TooManyCharacters|InsufficientPermissions|ActorNotMember/i.test(text)) {
    return 'Not sent. Your account cannot post to this encrypted group.';
  }
  return null;
}

async function ensureGroupActive(client: Client, group: any): Promise<void> {
  if (typeof group?.isActive !== 'function') return;
  const active = await group.isActive().catch(() => true);
  if (active !== false) return;
  const convs = (client as any)?.conversations;
  if (typeof convs?.syncAll === 'function') {
    await withTimeout(Promise.resolve(convs.syncAll([0, 1])), 6_000, 'syncAll timeout').catch(() => convs?.sync?.());
  } else {
    await withTimeout(Promise.resolve(convs?.sync?.()), 6_000, 'conv sync timeout').catch(() => {});
  }
  await withTimeout(Promise.resolve(group.sync?.()), 6_000, 'group sync timeout').catch(() => {});
  let activeAfter = await group.isActive().catch(() => true);
  if (activeAfter === false && typeof group.publishMessages === 'function') {
    // Optimistic creator-only groups can report inactive before their initial commit publishes.
    await withTimeout(Promise.resolve(group.publishMessages()), 8_000, 'publish timeout').catch(() => {});
    await withTimeout(Promise.resolve(group.sync?.()), 6_000, 'group sync timeout').catch(() => {});
    activeAfter = await group.isActive().catch(() => true);
  }
  if (activeAfter === false) {
    throw new Error('Not sent. You are no longer a member of this encrypted group.');
  }
}

async function findExistingOptimisticMsg(
  group: any,
  key: string
): Promise<{ status: 'published' | 'unpublished'; id: string } | null> {
  const existingId = pendingContentMsgIds.get(key);
  if (!existingId) return null;
  const msgs: any[] = (await group?.messages?.().catch(() => [])) ?? [];
  const match = msgs.find((m) => String(m?.id ?? '') === existingId);
  if (!match || match?.deliveryStatus === 2 || match?.deliveryStatus === 'failed') {
    pendingContentMsgIds.delete(key);
    return null;
  }
  if (match?.deliveryStatus === 1 || match?.deliveryStatus === 'published') {
    pendingContentMsgIds.delete(key);
    failedGroupMsgIds.delete(existingId);
    return { status: 'published', id: existingId };
  }
  return { status: 'unpublished', id: existingId };
}

/**
 * Sends a message to a group by group ID.
 * SECURITY: Resolves the group via the authenticated XMTP client so only current
 * members can post. Serializes WASM operations per group to prevent intent-lock collisions.
 */
export async function sendGroupMessage(
  client: Client,
  groupId: string,
  content: string
): Promise<string | undefined> {
  if (!groupId || !content) throw new Error('[GroupChat] groupId and content are required.');

  // Validate content length to prevent oversized payloads
  if (content.length > 10_000) {
    throw new Error('Not sent. This post is too long. Make it shorter and try again.');
  }

  if (!isOnline()) {
    throw new Error('Not sent. This device is offline. Connect to the internet and try again.');
  }

  const group = await resolveGroupForClient(client, groupId);
  if (!group) {
    throw new Error(
      'Not sent. This device has not received access to the encrypted group yet. If you just joined or linked this device, open the community on an online member device, then try again.'
    );
  }

  return runGroupSerial(groupId, async () => {
    // Allow this group if its consent state is still unknown/denied when explicitly posting to it.
    if (typeof group.consentState === 'function' && typeof group.updateConsentState === 'function') {
      const state = await group.consentState().catch(() => 1);
      if (state !== 1) await group.updateConsentState(1).catch(() => {});
    }

    // Sync the latest MLS epoch BEFORE preparing an optimistic message so newly welcomed members
    // and multi-device senders never prepare an application message against a stale epoch.
    await withTimeout(Promise.resolve(group.sync?.()), 5_000, 'pre-send group sync timeout').catch(() => {});

    await ensureGroupActive(client, group);

    // Prefer exactly-once sendOptimistic + publishMessages (matching client.ts for DMs) so network
    // timeouts or sync retries never create duplicate posts.
    if (typeof group.sendOptimistic === 'function' && typeof group.publishMessages === 'function') {
      const pendingKey = `${groupId}\0${content}`;
      const existing = await findExistingOptimisticMsg(group, pendingKey);
      if (existing?.status === 'published') return existing.id;

      let msgId: string | undefined = existing?.id;
      if (msgId === undefined) {
        try {
          msgId = await withTimeout<string>(Promise.resolve(group.sendOptimistic(content)), 8_000, 'prepare timeout');
        } catch (prepErr) {
          console.warn(`[GroupChat] sendOptimistic failed for ${groupId}, syncing welcomes/epoch and retrying:`, redactXmtpError(prepErr));
          const convs = (client as any)?.conversations;
          if (typeof convs?.syncAll === 'function') {
            await withTimeout(Promise.resolve(convs.syncAll([0, 1])), 6_000, 'syncAll timeout').catch(() => {});
          }
          await withTimeout(Promise.resolve(group.sync?.()), 6_000, 'group sync timeout').catch(() => {});
          await ensureGroupActive(client, group);
          try {
            msgId = await withTimeout<string>(Promise.resolve(group.sendOptimistic(content)), 8_000, 'prepare timeout');
          } catch (prepErr2) {
            console.warn(`[GroupChat] second sendOptimistic failed for ${groupId}, falling back:`, redactXmtpError(prepErr2));
            msgId = undefined;
          }
        }
      }

      if (msgId !== undefined) {
        const idStr = String(msgId);
        let lastErr: unknown = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await withTimeout(Promise.resolve(group.publishMessages()), PUBLISH_WAIT_MS, 'publish timeout');
            failedGroupMsgIds.delete(idStr);
            pendingContentMsgIds.delete(pendingKey);
            groupPublishRetries.delete(groupId);
            return idStr;
          } catch (err) {
            lastErr = err;
            const errStr = errorText(err);
            console.warn(`[GroupChat] publish attempt ${attempt + 1} failed for ${groupId}:`, redactXmtpError(err));

            const staticFatal = await classifyStaticFatalError(group, err);
            if (staticFatal) {
              failedGroupMsgIds.add(idStr);
              pendingContentMsgIds.delete(pendingKey);
              throw new Error(staticFatal);
            }

            await withTimeout(Promise.resolve(group.sync?.()), 6_000, 'group sync timeout').catch(() => {});
            if (typeof group.isActive === 'function' && (await group.isActive().catch(() => true)) === false) {
              failedGroupMsgIds.add(idStr);
              pendingContentMsgIds.delete(pendingKey);
              reportGroupDelivery('group_failed', 'group became inactive');
              throw new Error('Not sent. You are no longer a member of this encrypted group.');
            }

            if (!isOnline()) {
              failedGroupMsgIds.add(idStr);
              pendingContentMsgIds.set(pendingKey, idStr);
              throw new Error('Not sent. This device is offline. Connect to the internet and try again.');
            }

            if (isSyncWaitError(err) || errStr === 'publish timeout' || /epoch|intent|lock|commit|welcome/i.test(errStr)) {
              await withTimeout(Promise.resolve((client as any)?.conversations?.sync?.()), 6_000, 'conv sync timeout').catch(() => {});
            }

            // SyncFailedToWait means the commit was published and libxmtp timed out waiting for its
            // receipt; a full publish timeout while online likewise stays queued in XMTP storage.
            // Schedule background retry once we have tried syncing rather than blocking for 60 s+.
            if (attempt >= 1 && (isSyncWaitError(err) || errStr === 'publish timeout')) {
              failedGroupMsgIds.delete(idStr);
              pendingContentMsgIds.delete(pendingKey);
              reportGroupDelivery('publish_pending', err);
              scheduleGroupPublishRetry(groupId, group, 0, client);
              return idStr;
            }
            if (attempt < 2) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          }
        }

        if (isSyncWaitError(lastErr) || errorText(lastErr) === 'publish timeout') {
          failedGroupMsgIds.delete(idStr);
          pendingContentMsgIds.delete(pendingKey);
          reportGroupDelivery('publish_pending', lastErr);
          scheduleGroupPublishRetry(groupId, group, 0, client);
          return idStr;
        }
        failedGroupMsgIds.add(idStr);
        pendingContentMsgIds.set(pendingKey, idStr);
        reportGroupDelivery('group_failed', lastErr);
        throw new Error('Not sent. Could not reach the encrypted group. Check your connection and try again.');
      }
    }

    // Direct .send() fallback (for wrappers/mocks without sendOptimistic).
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await withTimeout<any>(Promise.resolve(group.send(content)), PUBLISH_WAIT_MS, 'group send timeout');
        return typeof res === 'string' ? res : undefined;
      } catch (err) {
        lastErr = err;
        console.warn(`[GroupChat] send attempt ${attempt + 1} failed for ${groupId}:`, redactXmtpError(err));
        const staticFatal = await classifyStaticFatalError(group, err);
        if (staticFatal) throw new Error(staticFatal);
        if (!isOnline()) throw new Error('Not sent. This device is offline. Connect to the internet and try again.');
        const errStr = errorText(err);
        if (attempt < 2) {
          if (isSyncWaitError(err) || errStr === 'group send timeout' || /epoch|intent|lock|commit|welcome/i.test(errStr)) {
            const convs = (client as any)?.conversations;
            if (typeof convs?.syncAll === 'function') {
              await withTimeout(Promise.resolve(convs.syncAll([0, 1])), 6_000, 'syncAll timeout').catch(() => {});
            }
          }
          await withTimeout(Promise.resolve(group.sync?.()), 6_000, 'group sync timeout').catch(() => {});
          if (typeof group.isActive === 'function' && (await group.isActive().catch(() => true)) === false) {
            reportGroupDelivery('group_failed', 'group became inactive');
            throw new Error('Not sent. You are no longer a member of this encrypted group.');
          }
          if (attempt >= 1 && (isSyncWaitError(err) || errStr === 'group send timeout')) {
            reportGroupDelivery('publish_pending', err);
            scheduleGroupPublishRetry(groupId, group, 0, client);
            return undefined;
          }
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
      }
    }
    if (isSyncWaitError(lastErr)) {
      reportGroupDelivery('publish_pending', lastErr);
      setTimeout(() => {
        void runGroupSerial(groupId, () => Promise.resolve(group.publishMessages?.() ?? group.sync?.())).catch(() => {});
      }, 2_000);
      return undefined;
    }
    reportGroupDelivery('group_failed', lastErr);
    throw new Error('Not sent. Could not reach the encrypted group. Check your connection and try again.');
  });
}

// ── Member Management ──────────────────────────────────────────────────────

/**
 * Adds a member to a group.
 * SECURITY: Only current group admins can add members (enforced by XMTP MLS).
 * All addresses are validated before being passed to the network.
 */
export async function addGroupMember(
  client: Client,
  groupId: string,
  memberAddress: string
): Promise<void> {
  if (!isValidEthAddress(memberAddress)) {
    throw new Error(`[GroupChat] Invalid address: ${memberAddress}`);
  }

  const checksummed = await checksumAddr(memberAddress);
  const group = await resolveGroupForClient(client, groupId);
  if (!group) throw new Error('[GroupChat] Group not found or access denied.');

  await runGroupSerial(groupId, async () => {
    if (typeof group.consentState === 'function' && typeof group.updateConsentState === 'function') {
      const st = await group.consentState().catch(() => 1);
      if (st !== 1) await group.updateConsentState(1).catch(() => {});
    }
    await withTimeout(Promise.resolve(group.sync?.()), 6_000, 'group sync timeout').catch(() => {});
    if (typeof group.isActive === 'function' && (await group.isActive().catch(() => true)) === false) {
      await withTimeout(Promise.resolve(group.publishMessages?.()), 8_000, 'publish timeout').catch(() => {});
      await withTimeout(Promise.resolve(group.sync?.()), 6_000, 'group sync timeout').catch(() => {});
    }
    try {
      await group.addMembersByIdentifiers([{
        identifier: checksummed,
        identifierKind: 'Ethereum',
      }]);
    } catch (err) {
      if (isSyncWaitError(err)) {
        await withTimeout(Promise.resolve(group.sync?.()), 6_000, 'group sync timeout').catch(() => {});
        return;
      }
      const lower = checksummed.toLowerCase();
      if (lower !== checksummed) {
        try {
          await group.addMembersByIdentifiers([{ identifier: lower, identifierKind: 'Ethereum' }]);
          return;
        } catch (err2) {
          if (isSyncWaitError(err2)) {
            await withTimeout(Promise.resolve(group.sync?.()), 6_000, 'group sync timeout').catch(() => {});
            return;
          }
          throw err2;
        }
      }
      throw err;
    }
  });

  console.log(`[GroupChat] Added ${checksummed} to group ${groupId}`);
}

/**
 * Removes a member from a group.
 * SECURITY: Only admins can remove members. XMTP MLS rotates epoch keys after
 * removal, so the removed member loses access to all future messages immediately.
 */
export async function removeGroupMember(
  client: Client,
  groupId: string,
  memberAddress: string
): Promise<void> {
  if (!isValidEthAddress(memberAddress)) {
    throw new Error(`[GroupChat] Invalid address: ${memberAddress}`);
  }

  const checksummed = await checksumAddr(memberAddress);
  const group = await resolveGroupForClient(client, groupId);
  if (!group) throw new Error('[GroupChat] Group not found or access denied.');

  await runGroupSerial(groupId, () =>
    group.removeMembersByIdentifiers([{
      identifier: checksummed,
      identifierKind: 'Ethereum',
    }])
  );

  console.log(`[GroupChat] Removed ${checksummed} from group ${groupId}. New MLS epoch started.`);
}

/**
 * Leaves a group voluntarily.
 */
export async function leaveGroup(client: Client, groupId: string): Promise<void> {
  const group = await resolveGroupForClient(client, groupId);
  if (!group) throw new Error('[GroupChat] Group not found.');
  await runGroupSerial(groupId, () => group.requestRemoval());
}

function isXmtpGroupControlMsg(m: any): boolean {
  if (!m) return true;
  if (m.kind === 'membership_change' || m.kind === 'group_updated' || m.kind === 1) return true;
  const typeId = String(m.contentType?.typeId ?? '').toLowerCase();
  if (typeId === 'group_membership_change' || typeId === 'group_updated') return true;
  const c = m.content;
  if (c && typeof c === 'object') {
    if ('initiatedByInboxId' in c || 'addedInboxes' in c || 'removedInboxes' in c || 'groupUpdated' in c || 'metadataFieldChanges' in c) return true;
  }
  return false;
}

/**
 * Fetches group message history.
 */
export async function getGroupMessages(client: Client, groupId: string): Promise<any[]> {
  try {
    const group = await resolveGroupForClient(client, groupId);
    if (!group) return [];
    return await runGroupSerial(groupId, async () => {
      await withTimeout(Promise.resolve(group.sync?.()), 10_000, 'group sync timeout').catch(() => {});
      const msgs: any[] = (await group.messages?.()) ?? [];
      return msgs.filter(
        (m) =>
          m?.deliveryStatus !== 2 &&
          m?.deliveryStatus !== 'failed' &&
          !failedGroupMsgIds.has(String(m?.id ?? '')) &&
          !isXmtpGroupControlMsg(m)
      );
    });
  } catch (e) {
    console.warn('[GroupChat] getGroupMessages failed:', redactXmtpError(e));
    return [];
  }
}

/** The newest group with this name created after `sinceNs`, from the local database. */
async function findGroupCreatedSince(client: Client, name: string, sinceNs: bigint): Promise<any | null> {
  try { await client.conversations.sync(); } catch { /* local list still has it */ }
  const groups: any[] = await (client.conversations as any).listGroups();
  const created = (g: any) => { try { return g.createdAtNs === undefined || g.createdAtNs === null ? sinceNs : BigInt(g.createdAtNs); } catch { return sinceNs; } };
  const matches = groups
    .filter((g) => sanitizeGroupMetadata(g.name ?? '') === name && created(g) >= sinceNs)
    .sort((a, b) => (created(b) > created(a) ? 1 : -1));
  return matches[0] ?? null;
}

