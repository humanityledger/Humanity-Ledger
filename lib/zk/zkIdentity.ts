/**
 * ZK Identity — Humanity Ledger Sovereign Identity ↔ zk.money Mapping
 *
 * Maps EVM wallet addresses to Aztec spending keys and readable zk.money handles.
 * Enables sovereign identity resolution across Humanity Ledger and Aztec Network.
 *
 * Stefan Antonio Cirisanu — Humanity Ledger × Aztec Network / Harry Bridge
 */

import { formatZkTag, validateZkHandle, resolveZkTag, getZkTransactionHistory } from './zkMoney';

// ─── Constants ─────────────────────────────────────────────────────────────────

const IDENTITY_STORAGE_KEY = 'ledger_zk_identities';
const RECENT_CONTACTS_KEY  = 'ledger_zk_recent_contacts';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ZkIdentity {
  address: string;               // EVM wallet address (lowercase)
  zkHandle: string;              // e.g. "zk:alice"
  aztecSpendingKeyHash: string;  // deterministic hash from address
  aztecAddress: string;          // derived Aztec protocol address
  publicKey: string;             // encoded public key for note encryption
  createdAt: number;
  verified: boolean;
  ensName?: string;
  displayName?: string;
  avatarUrl?: string;
  totalTransactions: number;
  reputationScore: number;       // 0–100
  lastActive?: number;
  bio?: string;
}

// ─── Storage Helpers ───────────────────────────────────────────────────────────

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function lsSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ─── Cryptographic Derivation (deterministic, client-side) ─────────────────────

/**
 * Derives a deterministic Aztec spending key hash from an EVM address.
 * In production: uses ECDH derivation from wallet signature.
 * Here: deterministic bit-rotation for demo correctness.
 */
export function deriveSpendingKeyHash(address: string, nonce = 0): string {
  const seed = address.toLowerCase().replace('0x', '') + nonce.toString(16).padStart(8, '0');
  // FNV-1a hash variant for determinism
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  const hashHex = hash.toString(16).padStart(8, '0');
  // Extend to 64 chars
  const extended = (hashHex.repeat(8)).slice(0, 64);
  return `0x${extended}`;
}

/**
 * Derives a deterministic Aztec protocol address from an EVM address.
 * Format: 0xaztec<first8chars><last6chars>
 */
export function deriveAztecAddress(address: string): string {
  const clean = address.toLowerCase().replace('0x', '');
  return `0xaztec${clean.slice(0, 8)}${clean.slice(-6)}`;
}

/**
 * Derives a deterministic public key stub (for note encryption metadata).
 */
export function derivePublicKey(address: string): string {
  const clean = address.toLowerCase().replace('0x', '');
  return `0x04${clean.repeat(2).slice(0, 128)}`;
}

// ─── Identity CRUD ─────────────────────────────────────────────────────────────

/**
 * Creates and persists a new ZkIdentity record.
 */
export function createIdentity(
  address: string,
  handle: string,
  options: {
    ensName?: string;
    displayName?: string;
    avatarUrl?: string;
    bio?: string;
  } = {},
): ZkIdentity {
  const normalized = address.toLowerCase();
  const zkHandle   = formatZkTag(handle);
  const { valid, error } = validateZkHandle(zkHandle);
  if (!valid) throw new Error(`Invalid zk handle: ${error}`);

  const identity: ZkIdentity = {
    address: normalized,
    zkHandle,
    aztecSpendingKeyHash: deriveSpendingKeyHash(normalized),
    aztecAddress:         deriveAztecAddress(normalized),
    publicKey:            derivePublicKey(normalized),
    createdAt:            Date.now(),
    verified:             false,
    ensName:              options.ensName,
    displayName:          options.displayName,
    avatarUrl:            options.avatarUrl,
    bio:                  options.bio,
    totalTransactions:    0,
    reputationScore:      50,
    lastActive:           Date.now(),
  };

  const all = getAllIdentities();
  const idx = all.findIndex(i => i.address === normalized);
  if (idx !== -1) {
    all[idx] = { ...all[idx], ...identity };
  } else {
    all.push(identity);
  }
  lsSet(IDENTITY_STORAGE_KEY, all);

  // Register handle in zkMoney tag map
  const { registerZkTag } = require('./zkMoney') as typeof import('./zkMoney');
  registerZkTag(normalized, handle);

  return identity;
}

/**
 * Retrieves a ZkIdentity by address.
 */
export function getIdentity(address: string): ZkIdentity | null {
  return getAllIdentities().find(i => i.address === address.toLowerCase()) ?? null;
}

/**
 * Updates fields on an existing identity.
 */
export function updateIdentity(address: string, updates: Partial<ZkIdentity>): ZkIdentity | null {
  const all = getAllIdentities();
  const idx = all.findIndex(i => i.address === address.toLowerCase());
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...updates, address: all[idx].address };
  lsSet(IDENTITY_STORAGE_KEY, all);
  return all[idx];
}

/**
 * Returns all registered ZkIdentity records.
 */
export function getAllIdentities(): ZkIdentity[] {
  return lsGet<ZkIdentity[]>(IDENTITY_STORAGE_KEY, []);
}

/**
 * Looks up a ZkIdentity by zk handle.
 */
export function lookupByHandle(handle: string): ZkIdentity | null {
  const normalized = handle.startsWith('zk:') ? handle : `zk:${handle}`;
  return getAllIdentities().find(i => i.zkHandle === normalized) ?? null;
}

/**
 * Looks up a ZkIdentity by ENS name.
 */
export function lookupByEns(ensName: string): ZkIdentity | null {
  return getAllIdentities().find(i => i.ensName === ensName) ?? null;
}

/**
 * Marks an identity as verified (requires on-chain proof in production).
 */
export function verifyIdentity(address: string): boolean {
  const result = updateIdentity(address, {
    verified: true,
    reputationScore: Math.min(100, (getIdentity(address)?.reputationScore ?? 50) + 20),
  });
  return result !== null;
}

/**
 * Increments transaction count and updates last active timestamp.
 */
export function incrementTxCount(address: string): void {
  const identity = getIdentity(address);
  if (!identity) return;
  updateIdentity(address, {
    totalTransactions: identity.totalTransactions + 1,
    lastActive: Date.now(),
    reputationScore: Math.min(100, identity.reputationScore + 1),
  });
}

// ─── Name Resolution ────────────────────────────────────────────────────────────

/**
 * Returns the best human-readable display name for any identifier.
 * Priority: displayName → ENS → zkHandle → truncated address
 */
export function resolveDisplayName(identifier: string): string {
  if (!identifier) return 'Unknown';

  // Try as address
  if (identifier.startsWith('0x')) {
    const identity = getIdentity(identifier);
    if (identity) {
      return identity.displayName || identity.ensName || identity.zkHandle || truncateAddr(identifier);
    }
    return truncateAddr(identifier);
  }

  // Try as zk handle
  if (identifier.startsWith('zk:')) {
    const identity = lookupByHandle(identifier);
    return identity?.displayName || identity?.ensName || identifier;
  }

  // Try as ENS
  const byEns = lookupByEns(identifier);
  if (byEns) return byEns.displayName || byEns.zkHandle || identifier;

  return identifier;
}

function truncateAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Recent Contacts ────────────────────────────────────────────────────────────

/**
 * Returns recently contacted ZkIdentities derived from transaction history.
 */
export function getRecentContacts(address: string, limit = 10): ZkIdentity[] {
  const history = getZkTransactionHistory(address);
  const seen = new Set<string>();
  const contacts: ZkIdentity[] = [];

  for (const tx of history) {
    const tag = tx.direction === 'sent' ? tx.recipientTag : tx.senderTag;
    if (!seen.has(tag)) {
      seen.add(tag);
      const identity = lookupByHandle(tag);
      if (identity && identity.address !== address.toLowerCase()) {
        contacts.push(identity);
      }
    }
    if (contacts.length >= limit) break;
  }

  return contacts;
}

// ─── Export / Import ────────────────────────────────────────────────────────────

/**
 * Exports an identity as a portable JSON card.
 */
export function exportIdentityCard(identity: ZkIdentity): string {
  const card = {
    version: '1.0.0',
    protocol: 'humanity-ledger-zk-identity',
    exportedAt: new Date().toISOString(),
    identity: {
      zkHandle: identity.zkHandle,
      aztecAddress: identity.aztecAddress,
      publicKey: identity.publicKey,
      ensName: identity.ensName,
      displayName: identity.displayName,
      verified: identity.verified,
    },
  };
  return JSON.stringify(card, null, 2);
}

/**
 * Imports an identity from a portable JSON card.
 * Does NOT create locally — caller must call createIdentity.
 */
export function importIdentityCard(json: string): Partial<ZkIdentity> | null {
  try {
    const card = JSON.parse(json);
    if (card?.protocol !== 'humanity-ledger-zk-identity') return null;
    return card.identity as Partial<ZkIdentity>;
  } catch { return null; }
}

// ─── Batch Operations ───────────────────────────────────────────────────────────

/**
 * Resolves a list of addresses to their registered zk handles (or derived handles).
 */
export function batchResolveHandles(addresses: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const addr of addresses) {
    result[addr] = resolveZkTag(addr);
  }
  return result;
}

/**
 * Returns the initials for an identity (for avatar display).
 */
export function getInitials(identity: ZkIdentity): string {
  if (identity.displayName) {
    const parts = identity.displayName.split(' ');
    return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }
  const tag = identity.zkHandle.slice(3); // remove "zk:"
  return tag.slice(0, 2).toUpperCase();
}

/**
 * Generates a deterministic avatar color from address.
 */
export function getAvatarColor(address: string): string {
  const COLORS = ['#25D366', '#128C7E', '#00a884', '#34C759', '#AF52DE', '#FF9500', '#FF6B35', '#4A90E2'];
  const seed = parseInt(address.slice(2, 4), 16) || 0;
  return COLORS[seed % COLORS.length];
}

// ─── Statistics ─────────────────────────────────────────────────────────────────

export interface IdentityStats {
  totalRegistered: number;
  verified: number;
  averageReputation: number;
  mostActive: ZkIdentity | null;
}

export function getIdentityStats(): IdentityStats {
  const all = getAllIdentities();
  if (all.length === 0) {
    return { totalRegistered: 0, verified: 0, averageReputation: 0, mostActive: null };
  }
  const verified = all.filter(i => i.verified).length;
  const avgReputation = all.reduce((acc, i) => acc + i.reputationScore, 0) / all.length;
  const mostActive = all.reduce<ZkIdentity | null>((best, cur) =>
    !best || cur.totalTransactions > best.totalTransactions ? cur : best, null);

  return { totalRegistered: all.length, verified, averageReputation: avgReputation, mostActive };
}
