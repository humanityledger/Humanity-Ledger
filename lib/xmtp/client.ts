'use client';

/**
 * XMTP E2E Encrypted Chat Client
 *
 * Wraps @xmtp/browser-sdk (5.2.0, pinned in package.json and package-lock.json)
 * for wallet-to-wallet encrypted messaging.
 *
 * Signer interface (mandatory):
 *   type          : "EOA" | "SCW"
 *   getIdentifier : () => Promise<{ identifier: string; identifierKind: "Ethereum" }>
 *   signMessage   : (message: string) => Promise<Uint8Array>    string ONLY
 *
 * API used here:
 *   - conversations.newDm(inboxId)             takes inboxId string
 *   - conversations.newDmWithIdentifier(id)    takes Identifier object   USE THIS
 *   - DecodedMessage: senderInboxId, sentAtNs (BigInt ns), content (decoded)
 *   - Dm.peerInboxId()                         async, returns inboxId string
 *   - conversations.sync() required before list/stream
 *
 */


import { diag, short } from './diag';
import { BoundedLRU } from '@/lib/core/BoundedLRU';
import { COUNTERFACTUAL_DEFAULT_CHAIN, SCW_CHAINS, detectWalletKind, isPlainEcdsa, type WalletKind } from './wallet-kind';
import { Buffer } from 'buffer';

if (typeof window !== 'undefined' && !window.Buffer) {
  (window as any).Buffer = Buffer;
}

import { Client, type XmtpEnv } from '@xmtp/browser-sdk';
import { resolveDbKey, browserKeyStore, checkName, wrappedKeyName, legacyKeyName, XmtpDbKeyError } from './db-key';
import { loadDeviceDbKey, saveDeviceDbKey, randomDbKey } from './device-key-vault';
import { isSyncWaitError, redactXmtpError } from './syncErrors';
import { dmHealth, findReadableDuplicate, forgetDmHealth, clearDmHealth, singleFlight, isEphemeralSignal } from './dm-health';

//  Type definitions matching the pinned browser-sdk 
type IdentifierKind = 'Ethereum';
export interface XmtpIdentifier {
  identifier: string;
  identifierKind: IdentifierKind;
}

const XMTP_ENV: XmtpEnv =
  (process.env.NEXT_PUBLIC_XMTP_ENV as XmtpEnv) ?? 'production';

//  Singleton client registry (one client per lowercase address) 
const clientRegistry = new Map<string, Client>();
/** Local database keys for this tab only (lib/xmtp/db-key.ts): memory, never storage. */
const dbKeyCache = new Map<string, Uint8Array>();

// InboxId → Ethereum address cache (bounded 2000-entry LRU backed asynchronously by IndexedDB).
const INBOX_IDB_NAME = 'hl_xmtp_inbox_cache_v1';
const INBOX_IDB_KEY = 'lru_entries';
const INBOX_CACHE_MAX = 2000;
const inboxIdToAddressCache = new Map<string, string>();
let inboxIdbHydrated = false;
let inboxIdbFlushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleInboxIdbFlush() {
  if (typeof indexedDB === 'undefined' || inboxIdbFlushTimer) return;
  inboxIdbFlushTimer = setTimeout(() => {
    inboxIdbFlushTimer = null;
    try {
      const req = indexedDB.open(INBOX_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('kv')) {
          req.result.createObjectStore('kv');
        }
      };
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction('kv', 'readwrite');
          tx.objectStore('kv').put(Array.from(inboxIdToAddressCache.entries()), INBOX_IDB_KEY);
          tx.oncomplete = () => db.close();
        } catch {}
      };
    } catch {}
  }, 1500);
}

export async function hydrateInboxIdCacheFromIdb(): Promise<void> {
  if (inboxIdbHydrated || typeof indexedDB === 'undefined') return;
  inboxIdbHydrated = true;
  await new Promise<void>((resolve) => {
    try {
      const req = indexedDB.open(INBOX_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('kv')) {
          req.result.createObjectStore('kv');
        }
      };
      req.onerror = () => resolve();
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction('kv', 'readonly');
          const getReq = tx.objectStore('kv').get(INBOX_IDB_KEY);
          getReq.onsuccess = () => {
            const entries = getReq.result;
            if (Array.isArray(entries)) {
              for (const pair of entries) {
                if (Array.isArray(pair) && typeof pair[0] === 'string' && typeof pair[1] === 'string') {
                  if (!inboxIdToAddressCache.has(pair[0]) && inboxIdToAddressCache.size < INBOX_CACHE_MAX) {
                    inboxIdToAddressCache.set(pair[0], pair[1]);
                  }
                }
              }
            }
            db.close();
            resolve();
          };
          getReq.onerror = () => { db.close(); resolve(); };
        } catch {
          resolve();
        }
      };
    } catch {
      resolve();
    }
  });
}

function cacheInboxId(inboxId: string, address: string) {
  const key = inboxId.toLowerCase();
  const val = address.toLowerCase();
  if (inboxIdToAddressCache.has(key)) {
    inboxIdToAddressCache.delete(key);
  } else if (inboxIdToAddressCache.size >= INBOX_CACHE_MAX) {
    const oldest = inboxIdToAddressCache.keys().next().value;
    if (oldest !== undefined) inboxIdToAddressCache.delete(oldest);
  }
  inboxIdToAddressCache.set(key, val);
  scheduleInboxIdbFlush();
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

    // browser-sdk 5 reads inbox state through the client (preferences), not a static method: the
    // static call is absent there, so without this every unknown sender stayed unresolved and
    // their chat was filed under an inbox id (24 November 2026, "Not sent" in "71e71fd9…8f34").
    if ((!states || !states[0]) && (client as any)?.preferences?.inboxStateFromInboxIds) {
      try {
        states = await (client as any).preferences.inboxStateFromInboxIds([inboxId], true);
      } catch (e) {
        console.warn('[XMTP] preferences.inboxStateFromInboxIds failed', e);
      }
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
  // inboxStateFromInboxIds may fail. We can securely resolve
  // any inboxId that we already have a DM with by scanning our DMs.
  if (client) {
    try {
      const dms = await client.conversations.listDms();
      for (const dm of dms) {
        const dmAny = dm as any;
        const members: any[] = typeof dmAny.members === 'function' ? await dmAny.members() : (dmAny.members ?? []);
        const targetMember = members.find((m: any) => m.inboxId?.toLowerCase() === inboxId.toLowerCase());
        if (targetMember) {
          const addrs: string[] = targetMember.accountAddresses || targetMember.addresses
            || (targetMember.accountIdentifiers ?? [])
              .filter((id: any) => id?.identifierKind === 'Ethereum' && id?.identifier)
              .map((id: any) => id.identifier);
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
 * Build an XMTP-compatible signer from a wagmi/viem EOA wallet client.
 *
 * Requirements:
 *  - signMessage receives string ONLY (no Uint8Array) and must return Uint8Array
 *  - getIdentifier returns { identifier: checksumAddress, identifierKind: "Ethereum" }
 */
function buildXmtpSigner(
  wagmiSigner: {
    getAddress: () => Promise<string>;
    signMessage: (message: string | Uint8Array) => Promise<string>;
  },
  kind: WalletKind = { type: 'EOA' },
  onSignature?: (hex: string) => void,
) {
  // Smart contract wallets register as SCW on the chain their contract lives on (lib/xmtp/wallet-kind.ts).
  const scwChain = kind.type === 'SCW' ? kind.chainId : 0;
  const scw = kind.type === 'SCW' ? { getChainId: () => BigInt(scwChain) } : {};
  return {
    type: kind.type,
    ...scw,

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

    // signMessage receives string only, must return Uint8Array
    signMessage: async (message: string): Promise<Uint8Array> => {
      const hexSig = await wagmiSigner.signMessage(message);
      onSignature?.(hexSig);
      return hexToBytes(hexSig);
    },
  };
}

/**
 * Initialize or retrieve a cached XMTP client for a wallet address.
 * If a client already exists in the registry (IndexedDB-backed),
 * it is returned immediately without re-prompting the user to sign.
 */
type XmtpWalletSigner = {
  getAddress: () => Promise<string>;
  signMessage: (message: string | Uint8Array) => Promise<string>;
  /** The chain the wallet is on: where a smart contract wallet is looked for first. */
  getChainId?: () => Promise<number | undefined> | number | undefined;
};
type XmtpClientHooks = {
  /** About to ask for the signature that unlocks the local message database. */
  onDbKeyRequest?: () => void;
  /** A plaintext key from an earlier version was encrypted and removed. */
  onLegacyKeyMigrated?: () => void;
};

/**
 * One XMTP client per account per tab (26 November 2026). Each Client.create starts its own
 * worker on the same database file (`xmtp-<env>-<inbox>.db3`), and the XMTP browser SDK must not
 * be used by two clients on one database at once. Two things made a second one:
 *  - concurrent calls (the chat's start-up retry, the dashboard) each ran Client.create;
 *  - the 20 s start-up watchdog rejected the caller while Client.create kept running in its
 *    worker, and the retry started another. The first finished later, unregistered, still running.
 * Now concurrent calls share one start-up, and a retry after the watchdog waits for the creation
 * already running instead of starting another. A creation that finishes after its caller gave up
 * is registered and reused.
 */
const clientInFlight = new Map<string, Promise<Client>>();
const pendingCreates = new Map<string, Promise<Client>>();
const clientGeneration = new Map<string, number>();

export async function getXMTPClient(wagmiSigner: XmtpWalletSigner, hooks?: XmtpClientHooks): Promise<Client> {
  const address = (await wagmiSigner.getAddress()).toLowerCase();
  const ready = clientRegistry.get(address);
  if (ready) return ready;
  const running = clientInFlight.get(address);
  if (running) {
    diag('client_join_inflight', {});
    return running;
  }
  const p = createXMTPClient(address, wagmiSigner, hooks);
  clientInFlight.set(address, p);
  const clear = () => { if (clientInFlight.get(address) === p) clientInFlight.delete(address); };
  p.then(clear, clear);
  return p;
}

async function createXMTPClient(address: string, wagmiSigner: XmtpWalletSigner, hooks?: XmtpClientHooks): Promise<Client> {
  if (clientRegistry.has(address)) {
    return clientRegistry.get(address)!;
  }

  //  Use Standard Wallet Signer 
  // The time a signature takes (the person switching to the wallet app, or approving on their
  // phone for a computer linked by QR) does not count against the start-up watchdog below.
  let signing = 0;
  // EOA or smart contract wallet (lib/xmtp/wallet-kind.ts). Detection never blocks sign-in: any
  // failure keeps EOA, and a non-ECDSA signature below retries as a smart contract wallet.
  const preferredChain = await Promise.resolve(wagmiSigner.getChainId?.()).catch(() => undefined);
  // Detected once per account and device: a returning visit does not wait on seven RPC reads.
  const kindKey = `ledger_xmtp_wallet_kind_${address}`;
  let kind: WalletKind | null = null;
  try { const c = JSON.parse(localStorage.getItem(kindKey) || 'null'); if (c?.type === 'EOA' || (c?.type === 'SCW' && Number.isInteger(c.chainId))) kind = c; } catch {}
  if (!kind) {
    kind = await detectWalletKind(address, preferredChain ?? null).catch(() => ({ type: 'EOA' as const }));
  }
  const rememberKind = (k: WalletKind) => { try { localStorage.setItem(kindKey, JSON.stringify(k)); } catch {} };
  let lastSignature = '';
  diag('signer_kind', { kind: kind.type, chain: kind.type === 'SCW' ? kind.chainId : undefined });
  const countingSigner = {
    getAddress: wagmiSigner.getAddress,
    signMessage: async (m: string | Uint8Array) => { signing++; try { return await wagmiSigner.signMessage(m); } finally { signing--; } },
  };
  const remember = (hex: string) => { lastSignature = hex; };
  let signer = buildXmtpSigner(countingSigner, kind, remember);

  //  Local database key (F-01): never stored in plaintext (lib/xmtp/device-key-vault.ts).
  // One signature to sign in: the key is kept on this device wrapped by a non-extractable
  // browser key, so neither a new account nor a returning visit asks for a second signature.
  // A database locked by the earlier per-load signature (lib/xmtp/db-key.ts) asks for it one
  // last time, then moves to the vault.
  let dbEncryptionKey = dbKeyCache.get(address);
  if (!dbEncryptionKey) {
    const vaultMarker = `ledger_xmtp_db_vault_${address}`;
    let fromVault: Uint8Array | null = null;
    try {
      fromVault = await loadDeviceDbKey(address);
    } catch {
      throw new XmtpDbKeyError('CORRUPT', 'The message database key on this device could not be unlocked, so the database was not opened. Clear this device and retry: your messages come back from the network.');
    }
    if (fromVault) {
      dbEncryptionKey = fromVault;
    } else {
      const signatureLocked = !!(browserKeyStore.get(checkName(address)) || browserKeyStore.get(wrappedKeyName(address)) || browserKeyStore.get(legacyKeyName(address)));
      if (!signatureLocked && browserKeyStore.get(vaultMarker)) {
        // The vault had this account's key and is gone (site data partly cleared): a new key would
        // not open the existing database. Stop and say so.
        throw new XmtpDbKeyError('CORRUPT', 'The message database key on this device was removed by the browser, so the database was not opened. Clear this device and retry: your messages come back from the network.');
      }
      if (!signatureLocked) {
        // No database for this account on this device yet: a random key, no signature.
        const fresh = randomDbKey();
        if (await saveDeviceDbKey(address, fresh)) {
          browserKeyStore.set(vaultMarker, '1');
          dbEncryptionKey = fresh;
        } else {
          fresh.fill(0);
        }
      }
      if (!dbEncryptionKey) {
        // A database locked by the signature, or a browser with no vault: the signature, as before.
        hooks?.onDbKeyRequest?.();
        const resolved = await resolveDbKey(address, async (m) => {
          signing++;
          try {
            return await wagmiSigner.signMessage(m);
          } finally {
            signing--;
          }
        });
        dbEncryptionKey = resolved.key;
        if (resolved.migrated) hooks?.onLegacyKeyMigrated?.();
        // Kept on this device from now on: this was the last time it is asked here.
        if (await saveDeviceDbKey(address, dbEncryptionKey)) browserKeyStore.set(vaultMarker, '1');
      }
    }
    dbKeyCache.set(address, dbEncryptionKey);
  }

  let client: Client;
  const createOnce = async (): Promise<Client> => {
    // Watchdog: 20 s of Client.create work (WASM load, network), not counting time spent waiting
    // for a signature — a WASM or network hang must never freeze the UI, a person signing must
    // never be cut off.
    let watchdog: ReturnType<typeof setInterval> | undefined;
    const createTimeout = new Promise<never>((_, reject) => {
      let busyMs = 0;
      watchdog = setInterval(() => {
        if (signing > 0) return;
        busyMs += 500;
        if (busyMs >= 20_000) {
          clearInterval(watchdog);
          reject(new Error('XMTP_INIT_TIMEOUT: Client.create timed out after 20s. WASM or network may be unavailable.'));
        }
      }, 500);
    });
    createTimeout.catch(() => {});
    // A creation still running from an earlier attempt (its caller hit the watchdog) is waited
    // for, never doubled: its worker already holds this account's database.
    let creation = pendingCreates.get(address);
    if (creation) {
      diag('client_create_resumed', {});
    } else {
      const gen = clientGeneration.get(address) ?? 0;
      const started: Promise<Client> = Client.create(signer as any, {
        env: XMTP_ENV,
        codecs: [],
        dbEncryptionKey,
        appVersion: 'LedgerNetwork-Privacy-Node/1.0.0-obfuscated',
        // The SDK logs every MLS step at "info": thousands of console lines per
        // session, each one work for the main thread. Warnings and errors only.
        loggingLevel: 'warn',
      });
      creation = started;
      pendingCreates.set(address, started);
      started.then(
        (c) => {
          if (pendingCreates.get(address) === started) pendingCreates.delete(address);
          if ((clientGeneration.get(address) ?? 0) !== gen) {
            // Signed out while it was starting: this client must not keep the database open.
            try { (c as any)?.close?.(); } catch { /* already closed */ }
            return;
          }
          // Finished after its caller gave up: registered, so the next call reuses it.
          if (!clientRegistry.has(address)) clientRegistry.set(address, c);
        },
        () => { if (pendingCreates.get(address) === started) pendingCreates.delete(address); },
      );
    }
    return await Promise.race([creation, createTimeout]).finally(() => clearInterval(watchdog)) as Client;
  };
  try {
    try {
      client = await createOnce();
    } catch (first: any) {
      // The wallet answered with a smart contract signature (ERC-6492: a wallet not deployed yet,
      // so no code to find above) while registered as EOA: register again as a smart contract wallet.
      if (kind!.type !== 'EOA' || !lastSignature || isPlainEcdsa(lastSignature)) throw first;
      const chainId = preferredChain && (SCW_CHAINS as readonly number[]).includes(Number(preferredChain)) ? Number(preferredChain) : COUNTERFACTUAL_DEFAULT_CHAIN;
      diag('signer_kind_retry', { chain: chainId });
      signer = buildXmtpSigner(countingSigner, { type: 'SCW', chainId }, remember);
      client = await createOnce();
    }
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
    diag('client_failed', { env: XMTP_ENV, error: String(err?.message ?? err).slice(0, 120) });
    throw err;
  }

  // Only a kind that registered successfully is remembered.
  rememberKind((signer as any).type === 'SCW' ? { type: 'SCW', chainId: Number((signer as any).getChainId()) } : { type: 'EOA' });
  clientRegistry.set(address, client);
  diag('client_ready', { env: XMTP_ENV, inbox: short((client as any).inboxId), installation: short((client as any).installationId) });

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
  const kind = await detectWalletKind((await wagmiSigner.getAddress()).toLowerCase()).catch(() => ({ type: 'EOA' as const }));
  const signer = buildXmtpSigner(wagmiSigner, kind);
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
  const lower = address.toLowerCase();
  // A start-up still running is not adopted after sign-out (see createOnce).
  clientGeneration.set(lower, (clientGeneration.get(lower) ?? 0) + 1);
  pendingCreates.delete(lower);
  clientInFlight.delete(lower);
  dmOpenInFlight.clear();
  clearDmHealth();
  clientRegistry.delete(lower);
  const key = dbKeyCache.get(address.toLowerCase());
  if (key) key.fill(0);
  dbKeyCache.delete(address.toLowerCase());
  // [AUDIT FIX] Clear the inbox-id→address cache on client destroy so stale entries
  // from the previous wallet don't pollute a new session (e.g. after wallet switch).
  inboxIdToAddressCache.clear();
  registeredAddressCache.clear();
  activeDmCache.clear();
  resolvedDmIds.clear();
  dmIdToPeerCache.clear();
}

/**
 * Check if a given Ethereum address has an active XMTP identity.
 * Client.canMessage returns Map<string, boolean>.
 * 
 * CRITICAL FIX: We try multiple casing variants because the Map key can be
 * checksummed or lowercase depending on the XMTP network response.
 */
export async function canReceiveMessages(
  _client: Client,
  address: string,
): Promise<boolean> {
  return (await peerRegistration(address)) === 'yes';
}

/**
 * Whether the network says this address has an XMTP inbox: 'yes', 'no', or 'unknown' when the
 * lookup itself failed. sendMessage gives up on a message only on 'no' (26 Nov 2026): a lookup
 * that failed (a rate limit, a dropped connection) after a slow first attempt used to end the send
 * with "this address has not turned on Ledger Chat", without retrying, for a person who had.
 */
export async function peerRegistration(address: string): Promise<'yes' | 'no' | 'unknown'> {
  const yesNo = (v: boolean): 'yes' | 'no' => (v ? 'yes' : 'no');
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
        if (key.toLowerCase() === lower) return yesNo(!!val);
      }
      return 'no';
    }

    if (result && typeof result === 'object') {
      const lower = address.toLowerCase();
      for (const key of Object.keys(result as object)) {
        if (key.toLowerCase() === lower) return yesNo(!!(result as any)[key]);
      }
      return 'no';
    }

    return 'unknown';
  } catch (err) {
    console.warn('[XMTP] canReceiveMessages error:', err);
    // [FIX — 24 Nov 2026] The old code returned `true` on any error, which meant
    // messages to wallets WITHOUT an XMTP identity appeared to send successfully
    // but vanished into a ghost DM. The sender saw "sent" with ticks, the
    // recipient saw nothing. This was the #1 cause of "messages not arriving".
    //
    // A failed lookup is 'unknown', never 'yes' (that was the ghost DM above) and never 'no':
    // canReceiveMessages() still answers false, while sendMessage keeps retrying the message
    // instead of declaring the person unregistered on a network error.
    reportDelivery('client_failed', err);
    return 'unknown';
  }
}

/**
 * Normalize an Ethereum address to EIP-55 checksum format.
 * XMTP uses the identifier string as a key and is case-sensitive.
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
 * Uses newDmWithIdentifier(): newDm() takes an inboxId, NOT Identifier.
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
 * use newDmWithIdentifier() which accepts an Identifier object.
 * CRITICAL FIX: always checksum the toAddress before creating the DM.
 * XMTP treats identifier strings as case-sensitive keys — a lowercase
 * address will NOT match the peer's checksummed registration and the DM will
 * appear to succeed locally but the peer will never receive the message.
 * After sending, syncs the conversation to confirm delivery.
 */

// Cache for verified registered address casing to avoid redundant network calls
const registeredAddressCache = new Map<string, string>();
// Cache for active DM conversation objects by inboxId:peerAddress to avoid re-creating MLS sessions per message
// Live DM handles (SDK proxies): bounded so long sessions do not pin every chat ever opened.
const activeDmCache = new BoundedLRU<string, any>({ max: 24, name: 'xmtp.activeDm' });
/** The open (find or create) of a conversation's DM still running, per conversation. */
const dmOpenInFlight = new Map<string, Promise<any>>();

/**
 * The DM to write into, checked first: the other person must be one of its members
 * (lib/xmtp/dm-health.ts). When they are not, the DM is synced (that publishes the commit adding
 * them, still pending) and the conversations are synced (that takes a welcome to a DM they created
 * meanwhile), then the DM is looked up again. Signals are dropped for a DM still without them
 * (null); a message a person wrote is written anyway, and publishes once the add has landed.
 */
async function ensureSendableDm(
  client: Client,
  cacheKey: string,
  dm: any,
  selfInbox: string,
  identifier: XmtpIdentifier | null,
  ephemeral: boolean,
): Promise<any | null> {
  if ((await dmHealth(dm, selfInbox)) !== 'peer_missing') return dm;
  diag('dm_peer_not_member', { conv: short(dm?.id) });
  reportDelivery('dm_peer_missing', 'the other person is not a member of this DM yet');
  if (ephemeral) return null;
  await runSerial(cacheKey, () => withTimeout(dm.sync(), 5000, 'sync timeout')).catch(() => {});
  // Welcomes first: the DM the other person created for us arrives as a welcome.
  try { await withTimeout((client.conversations as any).syncAll([0, 1]), 8000, 'sync timeout'); }
  catch { try { await withTimeout(client.conversations.sync(), 5000, 'sync timeout'); } catch { /* the local list may already have it */ } }
  forgetDmHealth(selfInbox, dm?.id);
  let next = dm;
  let peerInbox = '';
  try { peerInbox = String((await dm?.peerInboxId?.()) ?? ''); } catch { /* resolved below */ }
  if (identifier) {
    try {
      const inboxId = await client.findInboxIdByIdentifier(identifier);
      if (inboxId) peerInbox = inboxId;
      const found = inboxId ? await client.conversations.getDmByInboxId(inboxId) : null;
      if (found) next = found;
    } catch { /* keep the DM we have */ }
  }
  let after = await dmHealth(next, selfInbox);
  if (after !== 'ok' && peerInbox) {
    // The stitched lookup returned the broken DM again: pick, among every duplicate, the one the
    // other person is a member of (lib/xmtp/dm-health.ts, findReadableDuplicate).
    const readable = await findReadableDuplicate(client.conversations as any, peerInbox, selfInbox, next?.id).catch(() => null);
    if (readable) { next = readable; after = 'ok'; diag('dm_heal_duplicate', { conv: short((readable as any)?.id) }); }
  }
  diag('dm_heal', { conv: short(next?.id), health: after, switched: next?.id !== dm?.id });
  if (after === 'ok') reportDelivery('dm_healed', next?.id !== dm?.id ? 'switched to a DM the other person can read' : '');
  else reportDelivery('dm_unhealed', 'no DM with the other person on this device yet');
  return next;
}

/**
 * Resolves the EXACT casing of the peer's Ethereum address that is registered on XMTP.
 * Sending to the wrong casing on XMTP creates a ghost DM.
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

/** The recipient has no XMTP inbox yet: nothing can reach them until they sign in once. */
export class PeerNotOnXmtpError extends Error {
  readonly code = 'PEER_NOT_ON_XMTP';
  constructor(readonly address: string) {
    super('PEER_NOT_ON_XMTP: this address has not turned on Ledger Chat or another XMTP app yet');
    this.name = 'PeerNotOnXmtpError';
  }
}

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

  // A chat is not always keyed by an Ethereum address. When the stream could not resolve who
  // wrote (24 November 2026: a chat titled "71e71fd9…8f34"), the chat is filed under the sender's
  // XMTP inbox id or the conversation id, and every reply in it failed with "Not sent": the id
  // was handed to XMTP as if it were an Ethereum address. Those chats now reach the same DM.
  const route = await routeFor(client, toAddress);
  const finalTo = route.kind === 'address'
    ? await (async () => {
        const normalizedTo = await getRegisteredAddress(route.address);
        return (normalizedTo && normalizedTo.length === 42) ? normalizedTo : route.address;
      })()
    : route.ref;

  const identifier: XmtpIdentifier = {
    identifier: finalTo,
    identifierKind: 'Ethereum',
  };
  const cacheKey = `${client.inboxId || ''}:${finalTo.toLowerCase()}`;
  // One open (find or create) per conversation at a time. An attempt that stopped waiting after
  // 8 s and tries again joins the open still running instead of starting a second
  // newDmWithIdentifier while the first is adding the other person (lib/xmtp/dm-health.ts).
  const openDm = (): Promise<any> => singleFlight(dmOpenInFlight, cacheKey, () => (route.kind === 'address'
    ? client.conversations.newDmWithIdentifier(identifier)
    : route.open()));
  const selfInbox = String((client as any).inboxId || '');
  const ephemeral = isEphemeralSignal(content);

  // Typing, read and delivery receipts are sent only when they can arrive now. Queued behind
  // messages the network has not confirmed they only add intents to the same stuck queue.
  if (ephemeral && (publishRetries.has(cacheKey) || undelivered.has(cacheKey))) {
    diag('signal_skipped', { reason: 'publish pending' });
    return undefined;
  }

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
        dm = await withTimeout(openDm(), 8000, 'newDm timeout');
        // Not awaited (it added up to 3 s to the first message), but queued in the same per-
        // conversation order as the publishes: a sync racing the first publish of a new
        // conversation is the kind of collision the serial queue exists to prevent.
        { const fresh = dm; runSerial(cacheKey, () => withTimeout(fresh.sync(), 3000, 'sync timeout')).catch(() => {}); }
      }
      if (!sentId) {
        const usable = await ensureSendableDm(client, cacheKey, dm, selfInbox, route.kind === 'address' ? identifier : null, ephemeral);
        if (!usable) {
          // A receipt or typing signal for a DM the other person cannot read: not sent, never queued.
          diag('signal_skipped', { reason: 'peer not a member' });
          return undefined;
        }
        dm = usable;
        sentId = await withTimeout<string>(dm.sendOptimistic(content), 5000, 'prepare timeout');
      }
      activeDmCache.set(cacheKey, dm);
      // Serialised per conversation (publishSerial). A timeout here only stops waiting: the
      // publish keeps running, and the next attempt queues behind it instead of racing it.
      await withTimeout(publishSerial(cacheKey, dm), PUBLISH_WAIT_MS, 'publish timeout');
      diag('send_published', { conv: short(dm?.id), attempt: i + 1, signal: isSignal(content) });
      if (!isSignal(content)) reportDelivery('send_published', '');
      return sentId;
    } catch (sendErr: any) {
      lastError = sendErr;
      diag('send_attempt_failed', { conv: short(dm?.id), attempt: i + 1, prepared: !!sentId, error: String(sendErr?.message ?? sendErr).slice(0, 120) });
      console.warn(`[XMTP] Attempt ${i + 1} for ${toAddress} did not complete:`, sendErr?.message || sendErr);
      if (sentId) {
        // The message exists locally with its real id. Do not hold the chat's send queue for
        // more attempts (that delayed every following message): publish in the background.
        break;
      }
      if (route.kind === 'address' && isSyncWaitError(sendErr)) {
        // "synced N messages … from cursor": the DM was created and its commit published; only
        // the wait for the network's receipt ran out. Use that DM instead of creating another
        // handle, so the welcome that lets the other person see the chat is not left behind.
        const existing = await findDmFor(client, identifier).catch(() => null);
        if (existing) {
          dm = existing;
          activeDmCache.set(cacheKey, dm);
          continue;
        }
      }
      // The other person has no XMTP inbox (never signed in to Ledger Chat or another XMTP app):
      // no retry can open the chat. Say so instead of four attempts and a generic failure.
      if (route.kind === 'address' && i === 0 && (await peerRegistration(finalTo)) === 'no') {
        diag('send_peer_not_registered', {});
        reportDelivery('peer_not_registered', sendErr);
        throw new PeerNotOnXmtpError(finalTo);
      }
      // Nothing was created yet: a fresh conversation handle is safe.
      activeDmCache.delete(cacheKey);
      dm = null;
      if (i < 3) await new Promise(r => setTimeout(r, 300 * (i + 1)));
    }
  }

  if (sentId && dm) {
    // The message exists locally but the network did not confirm it. Keep
    // publishing in the background; it will not be duplicated, and the chat
    // already shows it with its real id.
    if (isSyncWaitError(lastError)) {
      // The handle may point at a DM that changed since (a welcome from the other person, a
      // duplicate stitched in): the next send looks it up again instead of reusing this one.
      activeDmCache.delete(cacheKey);
      forgetDmHealth(selfInbox, dm?.id);
    }
    schedulePublishRetry(cacheKey, dm, 0, client);
    diag('send_pending', { conv: short(dm?.id) });
    if (!isSignal(content)) reportDelivery('publish_pending', lastError);
    return sentId;
  }

  diag('send_failed', { error: String(lastError?.message ?? lastError).slice(0, 120) });
  reportDelivery('send_failed', lastError);
  throw new Error(`Message delivery failed via XMTP: ${lastError?.message || 'Network error'}`);
}

const INBOX_ID_RE = /^[0-9a-f]{64}$/i;
const CONVERSATION_ID_RE = /^[0-9a-f]{32}$/i;

type SendRoute =
  | { kind: 'address'; address: string }
  | { kind: 'ref'; ref: string; open: () => Promise<any> };

/**
 * Where a message for this chat key goes. An Ethereum address is the normal case. An XMTP inbox
 * id is resolved to its address when the network knows it, and otherwise used directly
 * (getDmByInboxId, then newDm). A conversation id opens that conversation, which only exists
 * on this device if we are a member of it. Anything else fails with a sentence a person can act
 * on, never an SDK error about an invalid address.
 */
export async function routeFor(client: Client, key: string): Promise<SendRoute> {
  const k = (key || '').trim();
  if (ETH_ADDR_RE.test(k)) return { kind: 'address', address: k };
  const conversations: any = client.conversations;
  if (INBOX_ID_RE.test(k)) {
    const inboxId = k.toLowerCase();
    const addr = await resolveInboxIdToAddress(inboxId, client).catch(() => null);
    if (addr && ETH_ADDR_RE.test(addr)) return { kind: 'address', address: addr };
    return {
      kind: 'ref',
      ref: inboxId,
      open: async () => (await conversations.getDmByInboxId?.(inboxId)) ?? conversations.newDm(inboxId),
    };
  }
  if (CONVERSATION_ID_RE.test(k)) {
    const convId = k.toLowerCase();
    return {
      kind: 'ref',
      ref: convId,
      open: async () => {
        let convo = await conversations.getConversationById?.(convId);
        if (!convo) {
          try { await conversations.sync(); } catch { /* the local copy may still be enough */ }
          convo = await conversations.getConversationById?.(convId);
        }
        if (!convo) throw new Error('This conversation is not on this device any more. Start a new chat with their address.');
        return convo;
      },
    };
  }
  throw new Error('This chat has no address to send to. Start a new chat with their address.');
}

/** Typing, read receipts and similar control messages: not worth a delivery report each. */
function isSignal(content: string): boolean {
  return typeof content === 'string' && /^__(TYPING|READ|DELIVERED|REACT)__/.test(content);
}

/** The DM with this identifier from the local database, without creating one. */
async function findDmFor(client: Client, identifier: XmtpIdentifier): Promise<any | null> {
  try { await client.conversations.sync(); } catch { /* the local list may already have it */ }
  const inboxId = await client.findInboxIdByIdentifier(identifier);
  if (!inboxId) return null;
  return (await client.conversations.getDmByInboxId(inboxId)) ?? null;
}

/**
 * A delivery problem, reported to /api/chat/delivery-report so it shows in the server log.
 * 18 November 2026: messages did not arrive and nothing anywhere said so. The report holds the
 * kind of event, the error text without ids (redactXmtpError) and the browser family: never a
 * message, an address or an inbox id. At most one report per kind every 60 s per page.
 */
const lastReport = new Map<string, number>();
export function reportDelivery(kind: string, err: unknown): void {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  const now = Date.now();
  if (now - (lastReport.get(kind) ?? 0) < 60_000) return;
  lastReport.set(kind, now);
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const browser = /Edg\//.test(ua) ? 'edge' : /Firefox\//.test(ua) ? 'firefox' : /Chrome\//.test(ua) ? 'chrome' : /Safari\//.test(ua) ? 'safari' : 'other';
  const mobile = /Mobi|iPhone|Android/.test(ua);
  try {
    fetch('/api/chat/delivery-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ kind, error: redactXmtpError(err), browser, mobile, env: XMTP_ENV }),
    }).catch(() => {});
  } catch { /* never let reporting break sending */ }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
  ]);
}

/**
 * Messages that did not reach the network (18 November 2026, "messages sent from Safari do not
 * arrive"). Three causes, all fixed here:
 *  1. Concurrent publishes of one conversation. A message, its typing signal and its read
 *     receipts each called publishMessages() at once, and each retry after an 8 s timeout started
 *     another one while the first was still running. On a slower engine (Safari's WebAssembly)
 *     they collided and failed together. Now one publish runs per conversation at a time.
 *  2. Giving up. Background retries stopped after about 2 minutes, and nothing published again
 *     when the tab came back or the network returned. Now retries continue with a 30 s cap,
 *     and flushPendingPublishes() runs on `online` and when the page becomes visible.
 *  3. A fixed 8 s wait for the first publish of a new conversation, which on a slow device
 *     declared failure while the publish was about to succeed. The wait is 20 s.
 */
const PUBLISH_WAIT_MS = 20_000;
const publishChain = new Map<string, Promise<void>>();

/**
 * How long a publish waits for the one before it. publishMessages() is a WebAssembly call into
 * the XMTP worker and can stay pending without ever settling (seen on 18 November 2026 after the
 * serial queue went live: once one publish hung, every later message, typing signal and read
 * receipt of that conversation queued behind it for good, and nothing reached the other person
 * until the page was reloaded). After this wait the next publish runs anyway; publishMessages()
 * only sends what is still unpublished, so overlapping one stuck call never duplicates a message.
 */
export const SERIAL_WAIT_MS = 15_000;

/** Run `task` for this conversation after the task in flight, or after SERIAL_WAIT_MS at most. */
export function runSerial(cacheKey: string, task: () => Promise<unknown>): Promise<void> {
  const prev = publishChain.get(cacheKey) ?? Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const waitForPrev = Promise.race([
    prev.catch(() => {}),
    new Promise<void>((resolve) => { timer = setTimeout(resolve, SERIAL_WAIT_MS); }),
  ]).finally(() => { if (timer) clearTimeout(timer); });
  const next: Promise<void> = waitForPrev.then(() => task()).then(() => undefined);
  publishChain.set(cacheKey, next);
  next.then(
    () => { if (publishChain.get(cacheKey) === next) publishChain.delete(cacheKey); },
    () => { if (publishChain.get(cacheKey) === next) publishChain.delete(cacheKey); },
  );
  return next;
}

/** Queue one publishMessages() for this conversation after any publish already in flight. */
export function publishSerial(cacheKey: string, dm: any): Promise<void> {
  return runSerial(cacheKey, () => dm.publishMessages());
}

const publishRetries = new Map<string, { dm: any; attempt: number; timer: ReturnType<typeof setTimeout> | null; client?: Client }>();
/** The client of each conversation being retried, kept across retries and "Retry" from the notice. */
const retryClients = new Map<string, Client>();
const MAX_PUBLISH_RETRIES = 60; // about 25 minutes at the 30 s cap, plus every online/visible flush
/** Conversations whose messages the network has not confirmed after every retry. Never dropped silently. */
const undelivered = new Map<string, any>();

/** Number of conversations with messages the network has not confirmed after every retry. */
export function undeliveredCount(): number {
  return undelivered.size;
}

let lastUndeliveredNotice = 0;
/** Tell the person, once every two minutes at most, with a Retry action (production log: publish_gave_up). */
function noticeUndelivered() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('ledger:undelivered', { detail: { count: undelivered.size } }));
  if (Date.now() - lastUndeliveredNotice < 120_000) return;
  lastUndeliveredNotice = Date.now();
  import('sonner')
    .then(({ toast }) => toast('Some messages are not delivered yet', {
      description: 'The network did not confirm them. They stay in the chat and are sent when you retry or come back online.',
      action: { label: 'Retry', onClick: () => { void retryUndelivered(); } },
      duration: 15_000,
    }))
    .catch(() => {});
}

/** Publish again every conversation that gave up, with a fresh retry budget. */
export async function retryUndelivered(): Promise<number> {
  const stuck = [...undelivered.entries()];
  undelivered.clear();
  for (const [key, dm] of stuck) schedulePublishRetry(key, dm, 0);
  return stuck.length;
}

/** Keep publishing a conversation's unpublished messages until the network confirms them. */
function schedulePublishRetry(cacheKey: string, dm: any, attempt = 0, client?: Client) {
  if (client) retryClients.set(cacheKey, client);
  const existing = publishRetries.get(cacheKey);
  if (attempt === 0 && existing) { existing.dm = dm; return; } // already retrying
  if (attempt >= MAX_PUBLISH_RETRIES) {
    publishRetries.delete(cacheKey);
    // [FIX — 24 Nov 2026] Evict the stale DM handle so the next send creates
    // a fresh MLS session. A handle stuck in a bad epoch can silently swallow
    // every message after a key rotation or network partition.
    activeDmCache.delete(cacheKey);
    undelivered.set(cacheKey, dm);
    reportDelivery('publish_gave_up', 'retries exhausted');
    noticeUndelivered();
    return;
  }
  // [FIX — 24 Nov 2026] Every 10 retries, evict the DM handle and force a
  // fresh one on the next attempt. MLS epoch mismatches accumulate silently
  // and a stale handle never recovers on its own.
  if (attempt > 0 && attempt % 10 === 0) {
    activeDmCache.delete(cacheKey);
    diag('dm_cache_evict', { key: short(cacheKey), attempt });
  }
  if (attempt === 4) reportDelivery('publish_retrying', `attempt ${attempt}`);
  const entry = { dm, attempt, timer: null as ReturnType<typeof setTimeout> | null, client: retryClients.get(cacheKey) };
  publishRetries.set(cacheKey, entry);
  entry.timer = setTimeout(() => {
    publishSerial(cacheKey, entry.dm)
      .then(() => {
        publishRetries.delete(cacheKey); undelivered.delete(cacheKey); retryClients.delete(cacheKey);
        if (attempt > 0) diag('publish_recovered', { conv: short(entry.dm?.id), attempt });
      })
      .catch(async (err: unknown) => {
        // "Sync failed to wait for intent": the publish intent is waiting for the group's state.
        // A sync processes the pending commits that intent waits on; then the next publish can
        // finish instead of waiting on the same intent again (production log, 20/11/2026).
        if (isSyncWaitError(err)) {
          await runSerial(cacheKey, () => withTimeout(entry.dm.sync(), 5000, 'sync timeout')).catch(() => {});
          // The welcomes too: a DM the other person created with us is processed, and stitched in.
          if (entry.client) {
            try { await withTimeout(entry.client.conversations.sync(), 5000, 'sync timeout'); } catch { /* next retry */ }
          }
          if (attempt === 2) void explainStuckPublish(entry.dm, entry.client);
        }
        schedulePublishRetry(cacheKey, entry.dm, attempt + 1);
      });
  }, Math.min(1000 * 2 ** attempt, 30_000));
}

/**
 * Why a conversation keeps failing to publish, reported once per stuck conversation: its MLS
 * state (reportPublishState), whether a newer XMTP version paused it for this one
 * (pausedForVersion(): libxmtp then skips every sync of the group until this app updates), and
 * whether the other person is a member of it at all (dm-health.ts).
 */
async function explainStuckPublish(dm: any, client?: Client): Promise<void> {
  void reportPublishState(dm);
  try {
    const paused = typeof dm?.pausedForVersion === 'function' ? await withTimeout<any>(dm.pausedForVersion(), 5000, 'paused timeout') : null;
    if (typeof paused === 'string' && paused) {
      diag('publish_paused', { version: paused.slice(0, 24) });
      reportDelivery('publish_paused', `needs libxmtp ${paused.slice(0, 24)}`);
    }
  } catch { /* not available in this SDK build */ }
  if (client) {
    const self = String((client as any).inboxId || '');
    forgetDmHealth(self, dm?.id);
    const health = await dmHealth(dm, self);
    if (health === 'peer_missing') {
      diag('dm_peer_not_member', { conv: short(dm?.id), stuck: true });
      reportDelivery('dm_peer_missing', 'stuck publish: the other person is not a member of this DM');
    }
  }
}

/**
 * Why a publish keeps waiting on its intent (24 Nov 2026: Chrome on the desktop gave up every day
 * since 18 Nov while Safari on phones published). The SDK's own debugInfo() says whether the
 * conversation's MLS state may have forked from the other members; a forked conversation never
 * resolves its intents. Reported once per stuck conversation, with no ids: the epoch and the
 * fork flags only.
 */
export async function reportPublishState(dm: any): Promise<string | null> {
  try {
    const info = await withTimeout<any>(dm?.debugInfo?.(), 5000, 'debugInfo timeout');
    if (!info) return null;
    const line = publishStateLine(info);
    reportDelivery('publish_debug', line);
    return line;
  } catch {
    return null;
  }
}

/** The debugInfo() fields that explain a stuck publish, as one short line. */
export function publishStateLine(info: { epoch?: unknown; maybeForked?: unknown; isCommitLogForked?: unknown; forkDetails?: unknown }): string {
  const forkDetails = typeof info.forkDetails === 'string' ? info.forkDetails.replace(/[0-9a-f]{16,}/gi, '…').slice(0, 60) : '';
  return `epoch=${String(info.epoch ?? '?')} maybeForked=${info.maybeForked === true} commitLogForked=${info.isCommitLogForked === true}${forkDetails ? ` details=${forkDetails}` : ''}`;
}

/**
 * Publish now every conversation that still has messages waiting (called when the network
 * returns and when the page becomes visible again). Returns how many conversations it tried.
 */
export async function flushPendingPublishes(): Promise<number> {
  // Coming back online or to the page also retries conversations that had given up.
  if (undelivered.size) await retryUndelivered();
  const pending = [...publishRetries.entries()];
  await Promise.all(
    pending.map(async ([key, entry]) => {
      if (entry.timer) clearTimeout(entry.timer);
      try {
        await publishSerial(key, entry.dm);
        publishRetries.delete(key);
      } catch {
        publishRetries.delete(key);
        schedulePublishRetry(key, entry.dm, Math.min(entry.attempt + 1, MAX_PUBLISH_RETRIES - 1));
      }
    }),
  );
  return pending.length;
}

let flushListenersInstalled = false;
/** Install the online/visibility listeners once per page. */
export function installPublishFlushListeners(): void {
  if (flushListenersInstalled || typeof window === 'undefined') return;
  flushListenersInstalled = true;
  const flush = () => { flushPendingPublishes().catch(() => {}); };
  window.addEventListener('online', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') flush(); });
  // Safari restores pages from the back/forward cache without a reload.
  window.addEventListener('pageshow', flush);
}

/**
 * List all DM conversations.
 * Must sync() first, then listDms().
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
 * XMTP identifier matching is case-sensitive.
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
    // newDmWithIdentifier creates a new DM if one doesn't exist, which on XMTP 
    // can occasionally return a freshly-created (empty) conversation instead of the existing one.
    // Using the existing DM object from listDms() gives us reliable message access.
    let dm: any = null;
    const selfInboxId = (client as any).inboxId ?? '';
    // Fast path: the peer's inbox, then the DM with that inbox, straight from
    // the local database. The scan below resolved the peer of every DM on
    // every open, which grew with the number of conversations.
    try {
      const peerInboxId = await client.findInboxIdByIdentifier(identifier);
      if (peerInboxId) dm = (await client.conversations.getDmByInboxId(peerInboxId)) ?? null;
    } catch (fastErr) {
      console.warn('[XMTP] getDmByInboxId failed, scanning DMs', fastErr);
    }
    if (!dm) try {
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

    // Reading never creates a conversation (26 November 2026). This used to call
    // newDmWithIdentifier here, on every poll of the open chat (every 10 s, on the receiving side
    // too): each call that found nothing locally created a DM of our own with the other person,
    // racing the DM the send path was creating and the welcome of theirs, and a creation cut off
    // half way stayed at epoch 0 without them (lib/xmtp/dm-health.ts). Nothing here yet means no
    // message yet; sending is what opens the DM.
    if (!dm) {
      diag('read_no_dm', { peer: short(normalizedPeer.toLowerCase()) });
      return [];
    }

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
/** DM ids whose peer discoverNewPeers already resolved, per inbox. */
const resolvedDmIds = new Map<string, BoundedLRU<string, true>>();
/** Cached lowercase peer address per DM conversation id, per inbox. */
const dmIdToPeerCache = new Map<string, BoundedLRU<string, string>>();
/** Per-inbox caps: an evicted DM id is simply resolved again on the next scan. */
const DM_CACHE_MAX = 500;
function newDmCache<V>(name: string): BoundedLRU<string, V> { return new BoundedLRU<string, V>({ max: DM_CACHE_MAX, name }); }

/** Forgets a previously resolved DM id for a deleted peer so future activity is detected promptly. */
export function forgetResolvedPeer(client: Client | null | undefined, peerAddress: string): void {
  if (!client || !peerAddress) return;
  const selfInboxId = (client as any).inboxId ?? '';
  const target = peerAddress.toLowerCase();
  const seen = resolvedDmIds.get(selfInboxId);
  const byId = dmIdToPeerCache.get(selfInboxId);
  if (seen && byId) {
    for (const [dmId, peer] of byId.entries()) {
      if (peer === target) seen.delete(dmId);
    }
  }
}

export interface DmScanEntry {
  peerAddress: string;
  dmId: string;
  messages: any[];
  lastMessage: any | null;
}

/**
 * Syncs and inspects DMs from the network:
 * - For DMs NOT in `visiblePeers` (brand new or previously deleted chats): calls `dm.sync()`
 *   and reads recent messages so any post-deletion messages are discovered even if the stream
 *   dropped or arrived while offline.
 * - For DMs already in `visiblePeers`: reads local `dm.lastMessage()` so missed stream events
 *   after `syncAll` are still surfaced without extra per-DM network calls.
 */
export async function scanDmsForActivity(
  client: Client,
  selfAddress: string,
  options: {
    visiblePeers: Set<string>;
    blockedPeers?: Set<string>;
    fullSync?: boolean;
    maxDms?: number;
  },
): Promise<DmScanEntry[]> {
  try {
    await hydrateInboxIdCacheFromIdb().catch(() => {});
    const selfInboxId = (client as any).inboxId ?? '';
    const selfNorm = selfAddress.toLowerCase();
    const convs = client.conversations as any;

    if (options.fullSync && typeof convs.syncAll === 'function') {
      await convs.syncAll([0, 1]).catch(() => convs.sync());
    } else {
      await convs.sync().catch(() => {});
    }

    let dms: any[] = (await convs.listDms?.()) || [];
    if (dms.length > 1) {
      // Prioritize recently active DMs first when timestamps exist so massive accounts surface latest activity fastest.
      dms = [...dms].sort((a, b) => {
        const ta = Number(a?.lastMessage?.sentAtNs ?? a?.createdAtNs ?? 0);
        const tb = Number(b?.lastMessage?.sentAtNs ?? b?.createdAtNs ?? 0);
        return tb - ta;
      });
    }
    const maxDms = options.maxDms && options.maxDms > 0 ? options.maxDms : 250;
    if (dms.length > maxDms) {
      dms = dms.slice(0, maxDms);
    }

    let byId = dmIdToPeerCache.get(selfInboxId);
    if (!byId) { byId = newDmCache<string>('xmtp.dmIdToPeer'); dmIdToPeerCache.set(selfInboxId, byId); }

    // Batch-resolve missing peer inboxIds in a single preferences call when supported
    const unresolvedInboxIds = new Set<string>();
    for (const dm of dms) {
      if (!dm || (dm.id && byId.has(dm.id))) continue;
      const peerInboxId = typeof dm.peerInboxId === 'string'
        ? dm.peerInboxId
        : (typeof dm.peerInboxId === 'function' ? await dm.peerInboxId().catch(() => null) : null);
      if (typeof peerInboxId === 'string' && peerInboxId && !inboxIdToAddressCache.has(peerInboxId.toLowerCase())) {
        unresolvedInboxIds.add(peerInboxId);
      }
    }
    if (unresolvedInboxIds.size > 0 && (client as any)?.preferences?.inboxStateFromInboxIds) {
      try {
        const states = await (client as any).preferences.inboxStateFromInboxIds(Array.from(unresolvedInboxIds), true);
        if (Array.isArray(states)) {
          for (const st of states) {
            const iid = st?.inboxId;
            if (!iid) continue;
            const ids: any[] = st.identifiers ?? st.accountIdentifiers ?? [];
            const eth = ids.find((x) => x?.identifierKind === 'Ethereum' && x?.identifier)?.identifier
              ?? st.accountAddresses?.[0]
              ?? st.addresses?.[0];
            if (typeof eth === 'string' && /^0x[a-fA-F0-9]{40}$/i.test(eth)) {
              cacheInboxId(iid, eth);
            }
          }
        }
      } catch {}
    }

    const entries: DmScanEntry[] = [];
    const CONCURRENCY = 6;
    let cursor = 0;

    async function worker() {
      while (cursor < dms.length) {
        const dm = dms[cursor++];
        if (!dm) continue;
        try {
          let peerLower = dm.id ? byId!.get(dm.id) : undefined;
          if (!peerLower) {
            const resolved = await extractPeerAddress(dm, selfInboxId, (client as any).accountAddress || selfAddress, client);
            if (resolved && /^0x[a-fA-F0-9]{40}$/i.test(resolved)) {
              peerLower = resolved.toLowerCase();
              if (dm.id) byId!.set(dm.id, peerLower);
            }
          }
          if (!peerLower || peerLower === selfNorm) continue;
          if (options.blockedPeers?.has(peerLower)) continue;

          const isVisible = options.visiblePeers.has(peerLower);
          if (!isVisible) {
            // Hidden/deleted or brand-new conversation: sync it explicitly so post-delete messages arrive.
            if (typeof dm.sync === 'function') {
              await dm.sync().catch(() => {});
            }
            const msgs: any[] = typeof dm.messages === 'function'
              ? ((await dm.messages({ limit: 30 }).catch(() => [])) || []).filter((m: any) => !_isXmtpSystemMsg(m))
              : [];
            const last = msgs.length > 0 ? msgs[msgs.length - 1] : null;
            entries.push({ peerAddress: peerLower, dmId: dm.id || '', messages: msgs, lastMessage: last });
          } else {
            // Visible chat: lightweight local read after sync/syncAll to catch missed previews.
            let last: any = null;
            if (typeof dm.lastMessage === 'function') {
              const candidate = await dm.lastMessage().catch(() => null);
              if (candidate && !_isXmtpSystemMsg(candidate)) last = candidate;
            }
            if (last) {
              entries.push({ peerAddress: peerLower, dmId: dm.id || '', messages: [], lastMessage: last });
            }
          }
        } catch { /* ignore per-dm resolution failure */ }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, dms.length) }, () => worker()));
    return entries;
  } catch (e) {
    console.warn('[XMTP] scanDmsForActivity failed:', e);
    return [];
  }
}

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
    // Each DM's peer is resolved once per page (extractPeerAddress can go to the network). This
    // runs every 10 s, and it used to resolve every DM of the account every time: the cost grew
    // with the number of conversations, for every open window.
    let seen = resolvedDmIds.get(selfInboxId);
    if (!seen) { seen = newDmCache<true>('xmtp.resolvedDmIds'); resolvedDmIds.set(selfInboxId, seen); }
    let byId = dmIdToPeerCache.get(selfInboxId);
    if (!byId) { byId = newDmCache<string>('xmtp.dmIdToPeer'); dmIdToPeerCache.set(selfInboxId, byId); }

    for (const dm of dms) {
      if (dm?.id && seen.has(dm.id)) continue;
      try {
        const peerAddr = await extractPeerAddress(dm, selfInboxId, (client as any).accountAddress, client);
        if (peerAddr && dm?.id) {
          seen.set(dm.id, true);
          byId.set(dm.id, peerAddr.toLowerCase());
        }
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
  // Explicitly include Unknown (0) and Allowed (1) consent states (never Denied = 2) so
  // deleted or freshly reopened conversations never get suppressed at the protocol level.
  let streamResult: any;
  try {
    streamResult = await (client.conversations as any).streamAllMessages({ consentStates: [0, 1] });
  } catch (e) {
    diag('stream_open_failed', { path: 'iterable', error: String((e as Error)?.message ?? e).slice(0, 120) });
  }

  // If streamResult is an async iterable (has [Symbol.asyncIterator]), use it directly
  if (streamResult && typeof streamResult[Symbol.asyncIterator] === 'function') {
    let onAbort: (() => void) | undefined;
    if (signal) {
      onAbort = () => {
        try { if (typeof streamResult.return === 'function') streamResult.return(); } catch {}
      };
      signal.addEventListener('abort', onAbort);
    }
    diag('stream_open', { path: 'iterable' });
    try {
      for await (const message of streamResult) {
        if (signal?.aborted) break;
        if (_isXmtpSystemMsg(message)) continue; yield message;
      }
    } catch (e) {
      diag('stream_error', { path: 'iterable', error: String((e as Error)?.message ?? e).slice(0, 120) });
      throw e;
    } finally {
      diag('stream_closed', { path: 'iterable', aborted: !!signal?.aborted });
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
    if (closed || _isXmtpSystemMsg(msg)) return;
    if (waiting) {
      const resolve = waiting;
      waiting = null;
      resolve({ msg });
    } else {
      queue.push(msg);
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
      () => { diag('stream_error', { path: 'callback' }); close(); }, // onFail → close stream gracefully
      undefined,
      [0, 1],
    );
  } catch (e) {
    console.warn('[XMTP] streamAllMessages callback API failed:', e);
    diag('stream_open_failed', { path: 'callback', error: String((e as Error)?.message ?? e).slice(0, 120) });
    reportDelivery('stream_failed', e);
    return;
  }
  diag('stream_open', { path: 'callback' });

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



/**
 * XMTP protocol consent for a peer's DM. Block → Denied (the peer's messages
 * stop at the protocol level on every device of this inbox); Unblock →
 * Allowed. Delete never calls this: deleting a chat is not blocking.
 * Returns false when the SDK wrapper offers no way to set it (never throws).
 */
export async function setPeerConsent(client: Client | null | undefined, peerAddress: string, state: 'allowed' | 'denied'): Promise<boolean> {
  if (!client || !/^0x[0-9a-fA-F]{40}$/.test(peerAddress)) return false;
  const value = state === 'denied' ? 2 : 1; // ConsentState.Denied / Allowed
  try {
    const identifier: XmtpIdentifier = { identifier: await checksumAddress(peerAddress), identifierKind: 'Ethereum' };
    let done = false;
    // 1. Inbox-level consent: works with no DM open or even created yet, on every installation.
    const inboxId = typeof (client as any).findInboxIdByIdentifier === 'function'
      ? await (client as any).findInboxIdByIdentifier(identifier) : undefined;
    const prefs = (client as any).preferences;
    if (inboxId && prefs && typeof prefs.setConsentStates === 'function') {
      await prefs.setConsentStates([{ entity: inboxId, entityType: 1 /* ConsentEntityType.InboxId */, state: value }]);
      done = true;
    }
    // 2. The DM's own consent too, when one exists (older SDK wrappers read only this).
    const convs = client.conversations as any;
    const dm = typeof convs.getDmByIdentifier === 'function' ? await convs.getDmByIdentifier(identifier) : undefined;
    if (dm && typeof dm.updateConsentState === 'function') {
      await dm.updateConsentState(value);
      done = true;
    }
    return done;
  } catch (e) {
    diag('consent_set_failed', { peer: short(peerAddress.toLowerCase()), state });
  }
  return false;
}

/** The already-open XMTP client for an account, if this tab has one (never creates one). */
export function getOpenXmtpClient(account: string | null | undefined): Client | undefined {
  if (!account) return undefined;
  return clientRegistry.get(account) ?? clientRegistry.get(account.toLowerCase());
}

/** Latest messages of the DM with a peer from the local XMTP store (no network); [] when none. */
export async function recentDmMessages(client: Client | null | undefined, peerAddress: string, limit = 32): Promise<Array<{ id?: unknown; sentAtNs?: unknown }>> {
  if (!client || !/^0x[0-9a-fA-F]{40}$/.test(peerAddress)) return [];
  try {
    const identifier: XmtpIdentifier = { identifier: await checksumAddress(peerAddress), identifierKind: 'Ethereum' };
    const dm = await (client.conversations as any).getDmByIdentifier?.(identifier);
    if (!dm || typeof dm.messages !== 'function') return [];
    const list = await dm.messages({ limit: BigInt(limit) });
    return Array.isArray(list) ? list.map((m: any) => ({ id: m?.id, sentAtNs: m?.sentAtNs })) : [];
  } catch {
    return [];
  }
}
