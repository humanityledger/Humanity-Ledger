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

'use client';

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
const inboxIdToAddressCache = new Map<string, string>();

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

//  BigInt nanoseconds → Date 
export function nsToDate(ns: bigint | undefined | null): Date {
  if (ns == null) return new Date();
  try {
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
          inboxIdToAddressCache.set(inboxId.toLowerCase(), addr);
          return addr;
        }
      }
      // Fallback: check accountAddresses array
      const addrs: string[] = state.accountAddresses ?? state.addresses ?? [];
      if (addrs.length > 0) {
        const addr = addrs[0].toLowerCase();
        inboxIdToAddressCache.set(inboxId.toLowerCase(), addr);
        return addr;
      }
    }
  } catch (e) {
    // Silently fail — not all installations expose this
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
            inboxIdToAddressCache.set(inboxId.toLowerCase(), addr.toLowerCase());
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
    // Client.create wrapped in 12s timeout — WASM load or network hang must NEVER freeze UI
    const createTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('XMTP_INIT_TIMEOUT: Client.create timed out after 12s. WASM or network may be unavailable.')), 12000)
    );
    client = await Promise.race([
      Client.create(signer, {
        env: XMTP_ENV,
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

/**
 * Revokes all previous installations for a given Inbox ID to fix the 10/10 limit error.
 */
export async function revokeXMTPInstallations(
  wagmiSigner: {
    getAddress: () => Promise<string>;
    signMessage: (message: string | Uint8Array) => Promise<string>;
  },
  inboxId: string
): Promise<void> {
  const signer = buildXmtpSigner(wagmiSigner);
  const states = await (Client as any).inboxStateFromInboxIds([inboxId], XMTP_ENV);
  if (states && states[0] && states[0].installations) {
    const installationsToRevoke = states[0].installations.map((i: any) => i.bytes);
    if (installationsToRevoke.length > 0) {
      await (Client as any).revokeInstallations(signer as any, inboxId, installationsToRevoke, XMTP_ENV);
    }
  }
}

/** Remove a client from the registry (call on wallet disconnect) */
export function destroyXMTPClient(address: string): void {
  clientRegistry.delete(address.toLowerCase());
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
  const dm = await client.conversations.newDmWithIdentifier(identifier);
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
export async function sendMessage(
  client: Client,
  toAddress: string,
  content: string,
  senderEthAddress?: string,
): Promise<void> {
  // CRITICAL: normalize to EIP-55 checksum format before any XMTP call
  // Only attempt XMTP checksum and routing if it's an Ethereum address (42 chars).
  // Aztec Schnorr addresses (66 chars) are not natively routable via XMTP.
  const isAztecAddress = toAddress.length === 66 && toAddress.startsWith('0x');
  
  let lastErr: any;

  if (!isAztecAddress) {
    const normalizedTo = await checksumAddress(toAddress);
    const identifier: XmtpIdentifier = {
      identifier: normalizedTo,
      identifierKind: 'Ethereum',
    };

    for (let i = 0; i < 3; i++) {
      try {
        // Always try direct XMTP send first (newDmWithIdentifier handles
        // both "already exists" and "create new" cases atomically)
        const dm = await client.conversations.newDmWithIdentifier(identifier);
        await dm.send(content);
        // Sync after send to confirm delivery — ignore sync errors, message is already sent
        try { await dm.sync(); } catch {}
        return; // SUCCESS — do not fall through to offline queue
      } catch (sendErr: any) {
        const errMsg = (sendErr?.message || '').toLowerCase();

        // These are fatal errors meaning the recipient definitely cannot receive on XMTP
        // Fall through to offline queue
        const isRecipientOffline =
          errMsg.includes('not on xmtp') ||
          errMsg.includes('no inbox') ||
          errMsg.includes('identity not found') ||
          errMsg.includes('recipient not found');

        if (isRecipientOffline) {
          console.warn('[XMTP] Recipient confirmed offline, queuing:', toAddress);
          break; // Stop retries, fall through to offline queue
        }

        // Non-fatal send error (network blip, timeout, relay issue)
        // Store the error and retry with backoff
        lastErr = sendErr;

        if (i < 2) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i))); // 1s, 2s backoff
        }
      }
    }

    // If we exhausted retries on a non-fatal error, re-throw so the caller
    // can show the user a retry option instead of silently queuing.
    if (lastErr) {
      throw lastErr;
    }
  } else {
    console.log('[XMTP] Aztec address detected. Bypassing native XMTP and using Offline Queue.');
  }

  // === OFFLINE QUEUE FALLBACK ===
  // Only reached if recipient is definitively NOT on XMTP.
  // Use the explicitly passed Ethereum address (never the inboxId).
  const senderAddr: string = senderEthAddress ?? 'unknown';

  try {
    const res = await fetch('/api/chat/queue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-web3-address': senderAddr,
      },
      body: JSON.stringify({
        sender: senderAddr,
        recipient: toAddress,
        content,
      }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.warn('[XMTP Offline Queue] Could not queue message (non-fatal):', errBody.error || res.statusText);
    }
    // Do NOT throw — offline queue failure is non-fatal
    // The message was optimistically shown to the sender already
  } catch (queueErr) {
    console.warn('[XMTP Offline Queue] Network error queuing (non-fatal):', queueErr);
    // Still do NOT throw
  }
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
export async function extractPeerAddress(dm: any, selfInboxId: string): Promise<string | null> {
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
        inboxIdToAddressCache.set(inboxId.toLowerCase(), addrs[0].toLowerCase());
      }
    }

    // Find the peer (not self)
    for (const m of members) {
      if (m.inboxId?.toLowerCase() === selfInboxId?.toLowerCase()) continue;
      const addrs = extractAddrs(m);
      if (addrs.length > 0) return addrs[0].toLowerCase();
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
      const resolved = await resolveInboxIdToAddress(peerInboxId);
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
    // 1. Sync globally
    await client.conversations.sync().catch(console.warn);

    // 2. Get active DM with peer — ALWAYS use checksummed address
    const normalizedPeer = await checksumAddress(peerAddress);
    const identifier: XmtpIdentifier = {
      identifier: normalizedPeer,
      identifierKind: 'Ethereum',
    };
    const dm = await client.conversations.newDmWithIdentifier(identifier);
    
    // 3. Sync DM and fetch messages
    await dm.sync().catch(console.warn);
    const msgs = await dm.messages();
    
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
        const peerAddr = await extractPeerAddress(dm, selfInboxId);
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

/** Async generator streaming all incoming messages in real time with AbortSignal support */
export async function* streamMessages(client: Client, signal?: AbortSignal) {
  // Sync before streaming to ensure we have the latest state
  try { await client.conversations.sync(); } catch {}

  const stream = await client.conversations.streamAllMessages();

  let onAbort: (() => void) | undefined;
  if (signal) {
    onAbort = () => {
      try {
        if (typeof (stream as any).return === 'function') {
          (stream as any).return();
        }
      } catch {}
    };
    signal.addEventListener('abort', onAbort);
  }

  try {
    for await (const message of stream as any) {
      if (signal?.aborted) break;
      yield message;
    }
  } finally {
    if (signal && onAbort) {
      signal.removeEventListener('abort', onAbort);
    }
    try {
      if (typeof (stream as any).return === 'function') {
        (stream as any).return();
      }
    } catch {}
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
