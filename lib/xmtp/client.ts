'use client';

/**
 * XMTP E2E Encrypted Chat Client
 *
 * Wraps @xmtp/browser-sdk v5.3.0 for system wallet-to-wallet encrypted messaging.
 *
 * v5.3.0 Signer interface (mandatory):
 *   type          : "EOA" | "SCW"
 *   getIdentifier : () => Promise<{ identifier: string; identifierKind: "Ethereum" }>
 *   signMessage   : (message: string) => Promise<Uint8Array>    string ONLY
 *
 * v5.3.0 Key API changes vs v5.2:
 *   - conversations.newDm(inboxId)             takes inboxId string
 *   - conversations.newDmWithIdentifier(id)    takes Identifier object   USE THIS
 *   - DecodedMessage: senderInboxId, sentAtNs (BigInt ns), content (decoded)
 *   - Dm.peerInboxId()                         async, returns inboxId string
 *   - conversations.sync() required before list/stream
 *
 */


import { Buffer } from 'buffer';

if (typeof window !== 'undefined' && !window.Buffer) {
  (window as any).Buffer = Buffer;
}

import { Client, type XmtpEnv } from '@xmtp/browser-sdk';

//  Type definitions matching browser-sdk v5.3.0 exactly 
type IdentifierKind = 'Ethereum';
export interface XmtpIdentifier {
  identifier: string;
  identifierKind: IdentifierKind;
}

const XMTP_ENV: XmtpEnv =
  (process.env.NEXT_PUBLIC_XMTP_ENV as XmtpEnv) ?? 'production';

//  Singleton client registry (one client per lowercase address) 
const clientRegistry = new Map<string, Client>();

// InboxId → Ethereum address cache (populated during message stream/fetch)
// [AUDIT FIX] Bounded to 1000 entries to prevent unbounded memory growth in long sessions.
const inboxIdToAddressCache = new Map<string, string>();
function cacheInboxId(inboxId: string, address: string) {
  if (inboxIdToAddressCache.size >= 1000) {
    // Evict the oldest 100 entries (Map preserves insertion order)
    let evicted = 0;
    for (const key of inboxIdToAddressCache.keys()) {
      inboxIdToAddressCache.delete(key);
      if (++evicted >= 100) break;
    }
  }
  inboxIdToAddressCache.set(inboxId, address);
}

//  Hex string → Uint8Array 
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error('[XMTP] Malformed hex signature');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

//  BigInt nanoseconds or Number milliseconds → Date 
export function nsToDate(ns: bigint | number | string | undefined | null): Date {
  if (ns == null) return new Date();
  try {
    const rawNum = Number(ns);
    // If timestamp is already in milliseconds range (< 1e14), do not divide by 1,000,000!
    if (!isNaN(rawNum) && rawNum > 0 && rawNum < 1e14) {
      return new Date(rawNum);
    }
    return new Date(Number(BigInt(String(ns)) / 1_000_000n));
  } catch {
    return new Date();
  }
}

/**
 * Resolve inboxId → Ethereum address using the XMTP network.
 * Results are cached to avoid repeated network calls.
 */
export async function resolveInboxIdToAddress(inboxId: string, client?: Client): Promise<string | null> {
  if (!inboxId) return null;
  const cached = inboxIdToAddressCache.get(inboxId.toLowerCase());
  if (cached) return cached;

  try {
    let states: any = null;
    try {
      states = await (Client as any).inboxStateFromInboxIds?.([inboxId], XMTP_ENV);
    } catch (e) {
      console.warn('[XMTP] Static inboxStateFromInboxIds failed', e);
    }

    if (states && states[0]) {
      const state = states[0];
      const identifiers: any[] = state.identifiers ?? state.accountIdentifiers ?? [];
      for (const id of identifiers) {
        if (id?.identifierKind === 'Ethereum' && id?.identifier) {
          const addr = id.identifier.toLowerCase();
          cacheInboxId(inboxId.toLowerCase(), addr);
          return addr;
        }
      }
      // Fallback: check accountAddresses array
      const addrs: string[] = state.accountAddresses ?? state.addresses ?? [];
      if (addrs.length > 0) {
        const addr = addrs[0].toLowerCase();
        cacheInboxId(inboxId.toLowerCase(), addr);
        return addr;
      }
    }
  } catch (e) {
    // Silently fail — not all installations expose this
  }

  // [CRITICAL FIX] Fallback to scanning listDms() to find the address
  // In v5.3.0, inboxStateFromInboxIds may fail. We can securely resolve
  // any inboxId that we already have a DM with by scanning our DMs.
  if (client) {
    try {
      const dms = await client.conversations.listDms();
      for (const dm of dms) {
        const dmAny = dm as any;
        const members: any[] = typeof dmAny.members === 'function' ? await dmAny.members() : (dmAny.members ?? []);
        const targetMember = members.find((m: any) => m.inboxId?.toLowerCase() === inboxId.toLowerCase());
        if (targetMember) {
          const addrs = targetMember.accountAddresses || targetMember.addresses || [];
          if (addrs && addrs.length > 0) {
            const addr = addrs[0].toLowerCase();
            cacheInboxId(inboxId.toLowerCase(), addr);
            return addr;
          }
        }
      }
    } catch (e) {}
  }

  return null;
}

/**
 * Populate inboxIdToAddressCache by scanning all DM member data.
 * Call once after client init to warm up the cache.
 */
export async function warmInboxIdCache(client: Client): Promise<void> {
  try {
    await client.conversations.sync();
    const dms: any[] = await client.conversations.listDms();
    for (const dm of dms) {
      try {
        const members: any[] = typeof dm.members === 'function' ? await dm.members() : (dm.members ?? []);
        for (const m of members) {
          const inboxId: string = m.inboxId ?? '';
          let addr = '';
          if (m.accountAddresses && m.accountAddresses.length > 0) addr = m.accountAddresses[0];
          else if (m.addresses && m.addresses.length > 0) addr = m.addresses[0];
          else if (m.accountIdentifiers) {
            const ids = m.accountIdentifiers.filter((id: any) => id?.identifierKind === 'Ethereum' && id?.identifier);
            if (ids.length > 0) addr = ids[0].identifier;
          }
          if (inboxId && addr) {
            cacheInboxId(inboxId.toLowerCase(), addr.toLowerCase());
          }
        }
      } catch {}
    }
  } catch (e) {
    console.warn('[XMTP] warmInboxIdCache failed:', e);
  }
}

/**
 * Build an XMTP v5.3.0-compatible signer from a wagmi/viem EOA wallet client.
 *
 * CRITICAL v5.3.0 changes:
 *  - signMessage receives string ONLY (no Uint8Array) and must return Uint8Array
 *  - getIdentifier returns { identifier: checksumAddress, identifierKind: "Ethereum" }
 */
function buildXmtpSigner(wagmiSigner: {
  getAddress: () => Promise<string>;
  signMessage: (message: string | Uint8Array) => Promise<string>;
}) {
  return {
    type: 'EOA' as const,

    // getIdentifier: async function returning the exact Identifier shape
    getIdentifier: async (): Promise<XmtpIdentifier> => {
      let address = await wagmiSigner.getAddress();
      try {
        const { getAddress } = await import('viem');
        address = getAddress(address);
      } catch {}
      return {
        identifier: address,
        identifierKind: 'Ethereum' as IdentifierKind,
      };
    },

    // v5.3.0: signMessage receives string only, must return Uint8Array
    signMessage: async (message: string): Promise<Uint8Array> => {
      const hexSig = await wagmiSigner.signMessage(message);
      return hexToBytes(hexSig);
    },
  };
}

/**
 * Initialize or retrieve a cached XMTP client for a wallet address.
 * If a client already exists in the registry (IndexedDB-backed),
 * it is returned immediately without re-prompting the user to sign.
 */
export async function getXMTPClient(
  wagmiSigner: {
    getAddress: () => Promise<string>;
    signMessage: (message: string | Uint8Array) => Promise<string>;
  }
): Promise<Client> {
  const address = (await wagmiSigner.getAddress()).toLowerCase();

  if (clientRegistry.has(address)) {
    return clientRegistry.get(address)!;
  }

  //  Use Standard Wallet Signer 
  const signer = buildXmtpSigner(wagmiSigner);

  //  Retrieve or Generate Local DB Encryption Key 
  // Passing this key prevents XMTP from prompting a signature on every reload
  const storageKey = `ledger_xmtp_db_key_${address}`;
  let dbKeyHex: string | null = null;
  try {
    dbKeyHex = localStorage.getItem(storageKey);
  } catch (e) {
    console.warn('[XMTP] localStorage access denied (private mode?). Regenerating key in memory.');
  }

  if (!dbKeyHex) {
    const keyBytes = new Uint8Array(32);
    crypto.getRandomValues(keyBytes);
    dbKeyHex = Buffer.from(keyBytes).toString('hex');
    try {
      localStorage.setItem(storageKey, dbKeyHex);
    } catch (e) {
      // Ignore setItem error in private mode
    }
  }
  const dbEncryptionKey = new Uint8Array(Buffer.from(dbKeyHex, 'hex'));

  let client: Client;
  try {
    // Client.create wrapped in 8s timeout — WASM load or network hang must NEVER freeze UI
    const createTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('XMTP_INIT_TIMEOUT: Client.create timed out after 20s. WASM or network may be unavailable.')), 20000)
    );
    client = await Promise.race([
      Client.create(signer, {
        env: XMTP_ENV,
        codecs: [],
        dbEncryptionKey,
        appVersion: 'LedgerNetwork-Privacy-Node/1.0.0-obfuscated',
      }),
      createTimeout,
    ]) as Client;
  } catch (err: any) {
    const errorMsg = err?.message || '';
    if (
      errorMsg.includes('already registered 10/10 installations') ||
      errorMsg.includes('Cannot register a new installation')
    ) {
      const match = errorMsg.match(/InboxID\s+([a-fA-F0-9]+)\s+has/i) || errorMsg.match(/InboxID\s+([a-fA-F0-9]+)/i) || errorMsg.match(/InboxID\s*\n*\s*([a-fA-F0-9]+)/i);
      const inboxId = match ? match[1] : null;
      if (inboxId) {
        throw new Error(`XMTP_LIMIT_REACHED:${inboxId}`);
      }
      throw new Error(`XMTP_LIMIT_REACHED`);
    }
    throw err;
  }

  clientRegistry.set(address, client);

  // Warm up the inboxId → address cache in the background
  warmInboxIdCache(client).catch(() => {});

  return client;
}

/** How many of the newest installations survive an automatic cleanup. */
export const KEEP_RECENT_INSTALLATIONS = 4;

/**
 * Pick which installations to revoke when the inbox is at XMTP's 10-device
 * limit: everything except the `keep` most recently created ones.
 *
 * This used to revoke ALL installations. With one account on a PC and a
 * phone, signing in on a new browser then signed the PC and the phone out of
 * XMTP as well, which is the opposite of a multi-device messenger. Stale
 * installations (cleared browser data, old tabs) are the oldest, so keeping
 * the newest few keeps the devices actually in use.
 */
export function selectInstallationsToRevoke(
  installations: Array<{ bytes: Uint8Array; clientTimestampNs?: bigint }>,
  keep = KEEP_RECENT_INSTALLATIONS,
): Uint8Array[] {
  const zero = BigInt(0);
  const sorted = [...installations].sort((a, b) => {
    const ta = a.clientTimestampNs ?? zero;
    const tb = b.clientTimestampNs ?? zero;
    return ta > tb ? -1 : ta < tb ? 1 : 0; // newest first
  });
  return sorted.slice(Math.max(0, keep)).map(i => i.bytes);
}

/**
 * Frees XMTP device slots for an inbox at the 10/10 limit by revoking its
 * oldest installations. The newest KEEP_RECENT_INSTALLATIONS stay signed in.
 * Returns how many were revoked.
 */
export async function revokeXMTPInstallations(
  wagmiSigner: {
    getAddress: () => Promise<string>;
    signMessage: (message: string | Uint8Array) => Promise<string>;
  },
  inboxId: string
): Promise<number> {
  const signer = buildXmtpSigner(wagmiSigner);
  const states = await (Client as any).inboxStateFromInboxIds([inboxId], XMTP_ENV);
  if (states && states[0] && states[0].installations) {
    const installationsToRevoke = selectInstallationsToRevoke(states[0].installations);
    if (installationsToRevoke.length > 0) {
      await (Client as any).revokeInstallations(signer as any, inboxId, installationsToRevoke, XMTP_ENV);
    }
    return installationsToRevoke.length;
  }
  return 0;
}

/** Remove a client from the registry (call on wallet disconnect) */
export function destroyXMTPClient(address: string): void {
  clientRegistry.delete(address.toLowerCase());
  // [AUDIT FIX] Clear the inbox-id→address cache on client destroy so stale entries
  // from the previous wallet don't pollute a new session (e.g. after wallet switch).
  inboxIdToAddressCache.clear();
  registeredAddressCache.clear();
  activeDmCache.clear();
}

/**
 * Check if a given Ethereum address has an active XMTP identity.
 * v5.3.0: Client.canMessage returns Map<string, boolean>.
 * 
 * CRITICAL FIX: We try multiple casing variants because the Map key can be
 * checksummed or lowercase depending on the XMTP network response.
 */
export async function canReceiveMessages(
  _client: Client,
  address: string,
): Promise<boolean> {
  try {
    const identifier: XmtpIdentifier = {
      identifier: address,
      identifierKind: 'Ethereum',
    };

    const result = await Client.canMessage([identifier], XMTP_ENV);

    if (result instanceof Map) {
      // Try all casing variants
      const lower = address.toLowerCase();
      for (const [key, val] of result.entries()) {
        if (key.toLowerCase() === lower) return !!val;
      }
      return false;
    }

    if (result && typeof result === 'object') {
      const lower = address.toLowerCase();
      for (const key of Object.keys(result as object)) {
        if (key.toLowerCase() === lower) return !!(result as any)[key];
      }
      return false;
    }

    return false;
  } catch (err) {
    console.warn('[XMTP] canReceiveMessages error:', err);
    // On error, ASSUME they can receive — let newDmWithIdentifier handle it
    // This prevents all messages from going to the offline queue on network blips
    return true;
  }
}

/**
 * Normalize an Ethereum address to EIP-55 checksum format.
 * XMTP v5.3.0 uses the identifier string as a key and is case-sensitive.
 * Always pass checksummed addresses to avoid silent DM mismatches.
 */
async function checksumAddress(addr: string): Promise<string> {
  try {
    const { getAddress } = await import('viem');
    return getAddress(addr);
  } catch {
    // Fallback: return as-is if viem not available
    return addr;
  }
}

/**
 * Get or create a DM with a peer and return its conversation ID.
 * v5.3.0 FIX: use newDmWithIdentifier()  newDm() takes inboxId, NOT Identifier.
 * CRITICAL: always pass EIP-55 checksummed address as identifier.
 */
export async function getDmId(client: Client, peerAddress: string): Promise<string> {
  const normalized = await checksumAddress(peerAddress);
  const identifier: XmtpIdentifier = {
    identifier: normalized,
    identifierKind: 'Ethereum',
  };
  const dmTimeout = new Promise<any>((_, r) => setTimeout(() => r(new Error('newDm timeout')), 10000));
  const dm = await Promise.race([client.conversations.newDmWithIdentifier(identifier), dmTimeout]);
  return dm.id;
}

/**
 * Send an end to end encrypted message to a wallet address.
 * v5.3.0 FIX: use newDmWithIdentifier() which accepts an Identifier object.
 * CRITICAL FIX: always checksum the toAddress before creating the DM.
 * XMTP v5.3.0 treats identifier strings as case-sensitive keys — a lowercase
 * address will NOT match the peer's checksummed registration and the DM will
 * appear to succeed locally but the peer will never receive the message.
 * After sending, syncs the conversation to confirm delivery.
 */

// Cache for verified registered address casing to avoid redundant network calls
const registeredAddressCache = new Map<string, string>();
// Cache for active DM conversation objects by inboxId:peerAddress to avoid re-creating MLS sessions per message
const activeDmCache = new Map<string, any>();

/**
 * Resolves the EXACT casing of the peer's Ethereum address that is registered on XMTP.
 * Sending to the wrong casing on XMTP v5.3.0 creates a ghost DM.
 */
export async function getRegisteredAddress(address: string): Promise<string> {
  const cached = registeredAddressCache.get(address.toLowerCase());
  if (cached) return cached;
  try {
    const identifier = { identifier: address, identifierKind: 'Ethereum' };
    const result = await Client.canMessage([identifier as any], XMTP_ENV);
    
    if (result instanceof Map) {
      const lower = address.toLowerCase();
      for (const [key, val] of result.entries()) {
        if (key.toLowerCase() === lower && val === true) {
          registeredAddressCache.set(lower, key);
          return key; // Return EXACT registered casing
        }
      }
    } else if (result && typeof result === 'object') {
      const lower = address.toLowerCase();
      for (const key of Object.keys(result)) {
        if (key.toLowerCase() === lower && (result as any)[key] === true) {
          registeredAddressCache.set(lower, key);
          return key;
        }
      }
    }
  } catch (e) {
    console.warn('[XMTP] getRegisteredAddress error', e);
  }
  
  // Fallback: return viem checksummed address
  return await checksumAddress(address);
}

const ETH_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

export async function sendMessage(
  client: Client | null | undefined,
  toAddress: string,
  content: string,
  senderEthAddress?: string,
): Promise<string | undefined> {
  // Returns the XMTP message id of what was sent. The chat uses it to swap
  // its optimistic bubble for the real message deterministically, instead of
  // guessing the pair by content (which left duplicates behind).
  // XMTP Native Delivery — Zero plaintext server persistence (F2-01)
  if (!client) {
    throw new Error('XMTP client is not initialized');
  }

  const isAztecAddress = toAddress.length === 66 && toAddress.startsWith('0x');
  if (isAztecAddress) {
    throw new Error('Direct messaging to Aztec address is not supported over XMTP MLS');
  }

  const normalizedTo = await getRegisteredAddress(toAddress);
  const finalTo = (normalizedTo && normalizedTo.length === 42) ? normalizedTo : toAddress;

  const identifier: XmtpIdentifier = {
    identifier: finalTo,
    identifierKind: 'Ethereum',
  };

  const cacheKey = `${client.inboxId || ''}:${finalTo.toLowerCase()}`;
  let lastError: any = null;

  // ── Exactly-once send ─────────────────────────────────────────────────────
  // This used to call dm.send() inside a timeout and retry up to 4 times. A
  // send that was slow but DID reach the network was then sent again, and the
  // recipient saw the message two or three times. Now the message is created
  // ONCE with sendOptimistic() (stored in the local XMTP database, id known
  // immediately) and only publishMessages() is retried. publishMessages()
  // publishes whatever is still unpublished in that conversation, so calling
  // it again never creates a second copy.
  let dm: any = activeDmCache.get(cacheKey) ?? null;
  let sentId: string | undefined;

  for (let i = 0; i < 4; i++) {
    try {
      if (!dm) {
        dm = await withTimeout(client.conversations.newDmWithIdentifier(identifier), 8000, 'newDm timeout');
        try { await withTimeout(dm.sync(), 3000, 'sync timeout'); } catch {}
      }
      if (!sentId) {
        sentId = await withTimeout<string>(dm.sendOptimistic(content), 5000, 'prepare timeout');
      }
      await withTimeout(dm.publishMessages(), 8000, 'publish timeout');

      activeDmCache.set(cacheKey, dm);
      dm.sync().catch(() => {});
      return sentId;
    } catch (sendErr: any) {
      lastError = sendErr;
      console.warn(`[XMTP] Attempt ${i + 1} for ${toAddress} did not complete:`, sendErr?.message || sendErr);
      if (!sentId) {
        // Nothing was created yet: a fresh conversation handle is safe.
        activeDmCache.delete(cacheKey);
        dm = null;
      }
      if (i < 3) await new Promise(r => setTimeout(r, 300 * (i + 1)));
    }
  }

  if (sentId && dm) {
    // The message exists locally but the network did not confirm it. Keep
    // publishing in the background; it will not be duplicated, and the chat
    // already shows it with its real id.
    schedulePublishRetry(cacheKey, dm);
    return sentId;
  }

  throw new Error(`Message delivery failed via XMTP: ${lastError?.message || 'Network error'}`);
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
  ]);
}

const publishRetries = new Map<string, number>();
/** Retry publishing a conversation's unpublished messages for up to ~2 minutes. */
function schedulePublishRetry(cacheKey: string, dm: any, attempt = 0) {
  if (attempt >= 8) { publishRetries.delete(cacheKey); return; }
  if (attempt === 0 && publishRetries.has(cacheKey)) return; // already retrying
  publishRetries.set(cacheKey, attempt);
  setTimeout(() => {
    dm.publishMessages()
      .then(() => publishRetries.delete(cacheKey))
      .catch(() => schedulePublishRetry(cacheKey, dm, attempt + 1));
  }, Math.min(2000 * 2 ** attempt, 30_000));
}

/**
 * List all DM conversations.
 * v5.3.0: Must sync() first, then listDms().
 */
export async function listConversations(client: Client): Promise<any[]> {
  await client.conversations.sync();
  return client.conversations.listDms();
}

/**
 * Extract the peer Ethereum address from a DM conversation object.
 * Checks members array first, then peerInboxId resolution, with cache.
 */
export async function extractPeerAddress(dm: any, selfInboxId: string, selfEthAddress?: string, client?: Client): Promise<string | null> {
  try {
    const members: any[] = typeof dm.members === 'function' ? await dm.members() : (dm.members ?? []);

    const extractAddrs = (m: any): string[] => {
      if (m.accountAddresses) return m.accountAddresses;
      if (m.addresses) return m.addresses;
      if (m.accountIdentifiers) {
        return m.accountIdentifiers
          .filter((id: any) => id?.identifierKind === 'Ethereum' && id?.identifier)
          .map((id: any) => id.identifier);
      }
      return [];
    };

    // Populate cache while we're here
    for (const m of members) {
      const inboxId: string = m.inboxId ?? '';
      const addrs = extractAddrs(m);
      if (inboxId && addrs.length > 0) {
        cacheInboxId(inboxId.toLowerCase(), addrs[0].toLowerCase());
      }
    }

    // Find the peer (not self)
    for (const m of members) {
      if (selfInboxId && m.inboxId?.toLowerCase() === selfInboxId.toLowerCase()) continue;
      
      const addrs = extractAddrs(m);
      if (addrs.length > 0) {
        const addr = addrs[0].toLowerCase();
        if (selfEthAddress && addr === selfEthAddress.toLowerCase()) continue;
        return addr;
      }
    }
  } catch (e) {
    console.warn('[XMTP] Error extracting peer address from members:', e);
  }

  // Fallback: peerInboxId → cache lookup
  try {
    const peerInboxId: string = typeof dm.peerInboxId === 'function'
      ? await dm.peerInboxId()
      : (dm.peerInboxId ?? '');
    if (peerInboxId) {
      const cached = inboxIdToAddressCache.get(peerInboxId.toLowerCase());
      if (cached) return cached;
      // Try network resolution
      const resolved = await resolveInboxIdToAddress(peerInboxId, client);
      if (resolved) return resolved;
    }
  } catch (e) {
    console.warn('[XMTP] Error extracting peer address from peerInboxId:', e);
  }

  return null;
}

/**
 * Retrieve message history for a specific peer conversation.
 *
 * FIX v4 — Simplified + more robust:
 * 1. Sync all conversations from the network
 * 2. List DMs and find the one matching the peer address
 * 3. Sync that specific DM to get latest messages
 * 4. Return messages
 *
 * The key improvement: we now use extractPeerAddress() which properly
 * resolves both accountAddresses and inboxId-based lookups with caching.
 */
/**
 * Retrieve message history for a specific peer conversation.
 *
 * CRITICAL FIX v5: Always checksum peerAddress before XMTP lookup.
 * XMTP v5.3.0 identifier matching is case-sensitive.
 */
export async function getMessages(client: Client, peerAddress: string): Promise<any[]> {
  try {
    // 1. Sync conversations globally — ensures DM list is up to date
    await client.conversations.sync().catch(console.warn);

    // 2. Get active DM with peer — ALWAYS use checksummed address
    const normalizedPeer = await getRegisteredAddress(peerAddress);
    const identifier: XmtpIdentifier = {
      identifier: normalizedPeer,
      identifierKind: 'Ethereum',
    };

    // [CRITICAL FIX v6] Try to find the DM in the local list FIRST.
    // newDmWithIdentifier creates a new DM if one doesn't exist, which on XMTP v5.3.0
    // can occasionally return a freshly-created (empty) conversation instead of the existing one.
    // Using the existing DM object from listDms() gives us reliable message access.
    let dm: any = null;
    const selfInboxId = (client as any).inboxId ?? '';
    try {
      const dms: any[] = await client.conversations.listDms();
      for (const d of dms) {
        const peerAddr = await extractPeerAddress(d, selfInboxId, (client as any).accountAddress, client).catch(() => null);
        if (peerAddr && peerAddr.toLowerCase() === normalizedPeer.toLowerCase()) {
          dm = d;
          break;
        }
      }
    } catch (listErr) {
      console.warn('[XMTP] listDms failed, falling back to newDmWithIdentifier', listErr);
    }

    // Fallback: create/get DM via identifier if not found in list
    if (!dm) {
      const dmTimeout = new Promise<any>((_, r) => setTimeout(() => r(new Error('newDm timeout')), 10000));
      dm = await Promise.race([client.conversations.newDmWithIdentifier(identifier), dmTimeout]);
    }

    if (!dm) return [];

    // 3. CRITICAL: Sync the specific DM from the network (not just local cache)
    // First sync — pulls network state
    try {
      await dm.sync();
    } catch (syncErr) {
      console.warn('[XMTP] dm.sync() first attempt failed:', syncErr);
    }

    // 4. Fetch messages (now from properly synced state)
    const msgs = await dm.messages();

    // 5. If we got 0 messages but this is an existing DM, do a second sync and retry
    // (XMTP MLS sometimes needs two syncs on first open or after key rotation)
    if ((!msgs || msgs.length === 0)) {
      try {
        await client.conversations.sync();
        await dm.sync();
        const retryMsgs = await dm.messages();
        return retryMsgs ?? [];
      } catch (retryErr) {
        console.warn('[XMTP] Retry sync/messages failed:', retryErr);
      }
    }

    return msgs ?? [];
  } catch (e) {
    console.warn('[XMTP] getMessages failed:', e);
    return [];
  }
}


/**
 * Discover all DMs from the network and return new peer addresses
 * not yet present in the known set. Used by Ledger Chat global sync loop.
 */
export async function discoverNewPeers(
  client: Client,
  selfAddress: string,
  knownPeers: Set<string>,
): Promise<string[]> {
  try {
    const selfInboxId = (client as any).inboxId ?? '';
    await client.conversations.sync();
    const dms: any[] = await client.conversations.listDms();
    const newPeers: string[] = [];
    const selfNorm = selfAddress.toLowerCase();

    for (const dm of dms) {
      try {
        const peerAddr = await extractPeerAddress(dm, selfInboxId, (client as any).accountAddress, client);
        if (
          peerAddr &&
          /^0x[a-fA-F0-9]{40}$/i.test(peerAddr) &&
          peerAddr !== selfNorm &&
          !knownPeers.has(peerAddr)
        ) {
          newPeers.push(peerAddr);
          knownPeers.add(peerAddr);
        }
      } catch {}
    }
    return newPeers;
  } catch (e) {
    console.warn('[XMTP] discoverNewPeers failed:', e);
    return [];
  }
}

/** Async generator streaming all incoming messages in real time with AbortSignal support.
 *
 * XMTP browser-sdk v5 Worker exposes streamAllMessages(callback, onFail) -> StreamCloser.
 * The higher-level Client class exposes streamAllMessages() -> Promise<AsyncStreamProxy>.
 * We use the callback form because that is what the browser SDK worker actually exposes,
 * and convert it into an async generator via a bounded queue so the rest of the app can
 * use `for await (const msg of streamMessages(...))` unchanged.
 */
function _isXmtpSystemMsg(msg: any): boolean {
  if (!msg) return true;
  const c = msg.content;
  if (c && typeof c === 'object') {
    if ('initiatedByInboxId' in c || 'addedInboxes' in c || 'groupUpdated' in c) return true;
  }
  const s = typeof c === 'string' ? c : (c && typeof c === 'object' ? JSON.stringify(c) : '');
  if (s.includes('initiatedByInboxId') || s.includes('addedInboxes') || s.includes('groupUpdated') || s.includes('group is inactive') || s === '{}' || s === '') return true;
  if (msg.kind === 'membership_change' || msg.kind === 'group_updated') return true;
  return false;
}

export async function* streamMessages(client: Client, signal?: AbortSignal) {
  // Sync first so we don't miss messages that arrived before the stream opens.
  try { await client.conversations.sync(); } catch {}

  if (signal?.aborted) return;

  // Try the v5 high-level AsyncStreamProxy path first (Client.conversations.streamAllMessages())
  // If it returns something iterable, use it directly.
  let streamResult: any;
  try {
    streamResult = await (client.conversations as any).streamAllMessages();
  } catch {}

  // If streamResult is an async iterable (has [Symbol.asyncIterator]), use it directly
  if (streamResult && typeof streamResult[Symbol.asyncIterator] === 'function') {
    let onAbort: (() => void) | undefined;
    if (signal) {
      onAbort = () => {
        try { if (typeof streamResult.return === 'function') streamResult.return(); } catch {}
      };
      signal.addEventListener('abort', onAbort);
    }
    try {
      for await (const message of streamResult) {
        if (signal?.aborted) break;
        if (_isXmtpSystemMsg(message)) continue; yield message;
      }
    } finally {
      if (signal && onAbort) signal.removeEventListener('abort', onAbort);
      try { if (typeof streamResult.return === 'function') streamResult.return(); } catch {}
    }
    return;
  }

  // Fallback: Worker callback-based API: streamAllMessages(callback, onFail) -> StreamCloser
  // Convert to async generator via a bounded message queue + promise signalling.
  type Resolve = (value: { msg: any } | { done: true }) => void;
  const queue: any[] = [];
  let waiting: Resolve | null = null;
  let closed = false;
  let streamCloser: any;

  const enqueue = (msg: any) => {
    if (closed) return;
    if (waiting) {
      const resolve = waiting;
      waiting = null;
      resolve({ msg });
    } else {
      if (_isXmtpSystemMsg(msg)) return; queue.push(msg);
    }
  };

  const close = () => {
    if (closed) return;
    closed = true;
    if (waiting) {
      const resolve = waiting;
      waiting = null;
      resolve({ done: true });
    }
  };

  try {
    streamCloser = (client.conversations as any).streamAllMessages(
      (msg: any) => enqueue(msg),
      () => close(), // onFail → close stream gracefully
    );
  } catch (e) {
    console.warn('[XMTP] streamAllMessages callback API failed:', e);
    return;
  }

  const onAbort = () => close();
  if (signal) signal.addEventListener('abort', onAbort);

  try {
    while (!closed) {
      if (signal?.aborted) break;
      if (queue.length > 0) {
        yield queue.shift();
      } else {
        // Wait for the next message
        const next = await new Promise<{ msg: any } | { done: true }>((resolve) => {
          if (queue.length > 0) {
            resolve({ msg: queue.shift() });
          } else if (closed) {
            resolve({ done: true });
          } else {
            waiting = resolve;
          }
        });
        if ('done' in next) break;
        if (signal?.aborted) break;
        yield next.msg;
      }
    }
  } finally {
    closed = true;
    if (signal) signal.removeEventListener('abort', onAbort);
    try { if (streamCloser && typeof streamCloser.end === 'function') streamCloser.end(); } catch {}
    try { if (streamCloser && typeof streamCloser.close === 'function') streamCloser.close(); } catch {}
  }
}

/**
 * Given a senderInboxId from a streamed/fetched message, resolve
 * the Ethereum address of the sender using the cache or network.
 */
export async function resolveSenderAddress(senderInboxId: string, client?: Client): Promise<string | null> {
  if (!senderInboxId) return null;
  const cached = inboxIdToAddressCache.get(senderInboxId.toLowerCase());
  if (cached) return cached;
  return resolveInboxIdToAddress(senderInboxId, client);
}




export async function getXmtpGroup(client: Client, groupId: string) { await client.conversations.sync(); const groups = await (client.conversations as any).listGroups(); return groups.find((g: any) => g.id === groupId); }
export async function createXmtpGroup(client: Client, peerAddresses: string[]) { await client.conversations.sync(); return await (client.conversations as any).newGroup(peerAddresses); }

// Tracks IDs we've already dispatched in this session to prevent duplicates across rapid polls
const _dispatchedOfflineIds = new Set<string>();

// === OFFLINE QUEUE SYNC ===
// Offline queue disabled in favor of native XMTP MLS message history & sync
export async function syncOfflineQueue(_client: Client, _myEthAddress: string): Promise<void> {
  return;
}


