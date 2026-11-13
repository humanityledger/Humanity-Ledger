/**
 * lib/xmtp/db-key.ts
 *
 * The key that encrypts the local XMTP database (SQLite in the browser's private storage).
 *
 * Until 13 Nov 2026 it was 32 random bytes stored in plaintext in localStorage
 * (`ledger_xmtp_db_key_<address>`, finding F-01): any script on the origin could read it. Now
 * nothing that can decrypt the database is ever stored. Everything comes from one EIP-191
 * signature by the user's own wallet, requested once per page load and kept in memory only:
 *
 *   signature = personal_sign(dbKeyMessage(address))           65-byte ECDSA, deterministic (RFC 6979)
 *   dbKey     = HKDF-SHA256(signature, info "hl/xmtp/v1/db-key")  32 bytes, new databases
 *   kek       = HKDF-SHA256(signature, info "hl/xmtp/v1/wrap")    AES-256-GCM, wraps a legacy key
 *   check     = HKDF-SHA256(signature, info "hl/xmtp/v1/check")   16 bytes, public: detects a different signature
 *
 * Existing users keep their database and their XMTP installation: the old random key is
 * encrypted with the kek (AES-GCM), the ciphertext is stored, and the plaintext is deleted. A
 * fresh key would have made the old database unreadable and registered a new installation, and
 * MLS does not give a new installation the messages sent before it joined: history would have
 * been lost, not just a cache.
 *
 * Fail closed: a refused or failed signature, a signature that is not a 65-byte ECDSA signature
 * (smart-contract wallets may not sign deterministically), a check value that differs from the
 * one recorded on this device, or a ciphertext that does not authenticate all abort: the
 * database is never opened, and a second database or installation is never created by mistake.
 */

export const DB_KEY_VERSION = 'hl/xmtp-db/v1';
const SALT = new TextEncoder().encode('humanity-ledger/xmtp-db');
const enc = new TextEncoder();

export const legacyKeyName = (address: string) => `ledger_xmtp_db_key_${address.toLowerCase()}`;
export const wrappedKeyName = (address: string) => `ledger_xmtp_db_key_wrapped_${address.toLowerCase()}`;
export const checkName = (address: string) => `ledger_xmtp_db_key_check_${address.toLowerCase()}`;

/** The message the wallet shows. Deterministic: same account, same signature, same keys. */
export function dbKeyMessage(address: string): string {
  return [
    'Ledger Chat: unlock my message database on this device',
    '',
    `Account: ${address.toLowerCase()}`,
    'This signature encrypts the copy of your messages kept in this browser. It is never sent to any server.',
    'Only sign it on ledgerchat.org or on your own copy of Ledger Chat: anyone who has it can read the messages stored on this device.',
    '',
    `Version: ${DB_KEY_VERSION}`,
  ].join('\n');
}

export type XmtpDbKeyErrorCode = 'SIGNATURE_FAILED' | 'UNSUPPORTED_SIGNATURE' | 'MISMATCH' | 'CORRUPT' | 'NO_CRYPTO';

export class XmtpDbKeyError extends Error {
  readonly code: XmtpDbKeyErrorCode;
  constructor(code: XmtpDbKeyErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'XmtpDbKeyError';
  }
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]*$/.test(clean) || clean.length % 2 !== 0) {
    throw new XmtpDbKeyError('UNSUPPORTED_SIGNATURE', 'The wallet returned a malformed signature.');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

function toB64(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new XmtpDbKeyError('NO_CRYPTO', 'This browser has no Web Crypto: the message database cannot be unlocked.');
  return s;
}

async function hkdf(ikm: Uint8Array, info: string, length: number): Promise<Uint8Array> {
  const base = await subtle().importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits']);
  const bits = await subtle().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: SALT, info: enc.encode(info) }, base, length * 8);
  return new Uint8Array(bits);
}

interface Derived {
  dbKey: Uint8Array;
  kek: CryptoKey;
  check: string;
}

async function signAndDerive(address: string, sign: (message: string) => Promise<string>): Promise<Derived> {
  let sigHex: string;
  try {
    sigHex = await sign(dbKeyMessage(address));
  } catch (e) {
    throw new XmtpDbKeyError('SIGNATURE_FAILED', e instanceof Error ? e.message : 'The signature was not given.');
  }
  const sig = hexToBytes(String(sigHex ?? ''));
  try {
    if (sig.length !== 65) {
      throw new XmtpDbKeyError(
        'UNSUPPORTED_SIGNATURE',
        'This wallet does not give a standard 65-byte signature, so the message database key cannot be derived the same way twice. Use an Ethereum account wallet (MetaMask, Rabby, Ledger, Trezor and similar).',
      );
    }
    const [dbKey, kekBytes, check] = await Promise.all([
      hkdf(sig, 'hl/xmtp/v1/db-key', 32),
      hkdf(sig, 'hl/xmtp/v1/wrap', 32),
      hkdf(sig, 'hl/xmtp/v1/check', 16),
    ]);
    const kek = await subtle().importKey('raw', kekBytes as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    kekBytes.fill(0);
    return { dbKey, kek, check: toHex(check) };
  } finally {
    sig.fill(0);
  }
}

/** Pure derivation, no storage: the key a NEW database uses. */
export async function deriveDbKey(address: string, sign: (message: string) => Promise<string>): Promise<Uint8Array> {
  const d = await signAndDerive(address, sign);
  return d.dbKey;
}

export interface KeyStore {
  get(name: string): string | null;
  set(name: string, value: string): void;
  remove(name: string): void;
}

/** localStorage, or a no-op store when it is unavailable (private mode): the derivation still works. */
export const browserKeyStore: KeyStore = {
  get: (n) => {
    try {
      return localStorage.getItem(n);
    } catch {
      return null;
    }
  },
  set: (n, v) => {
    try {
      localStorage.setItem(n, v);
    } catch {
      /* not persisted: the next load derives again */
    }
  },
  remove: (n) => {
    try {
      localStorage.removeItem(n);
    } catch {
      /* nothing to remove */
    }
  },
};

export interface ResolvedDbKey {
  key: Uint8Array;
  /** The plaintext key of an earlier version was found and replaced by its encrypted form. */
  migrated: boolean;
}

/**
 * The key to open this device's XMTP database. Stores only ciphertext and a public check value.
 */
export async function resolveDbKey(
  address: string,
  sign: (message: string) => Promise<string>,
  store: KeyStore = browserKeyStore,
): Promise<ResolvedDbKey> {
  const d = await signAndDerive(address, sign);
  const storedCheck = store.get(checkName(address));
  if (storedCheck && storedCheck !== d.check) {
    d.dbKey.fill(0);
    throw new XmtpDbKeyError(
      'MISMATCH',
      'This signature differs from the one that locked the message database on this device, so it was not opened. Sign with the same wallet account.',
    );
  }

  // 1. Migration: a plaintext key from an earlier version.
  const legacy = store.get(legacyKeyName(address));
  if (legacy && /^[0-9a-fA-F]{64}$/.test(legacy)) {
    const legacyKey = hexToBytes(legacy);
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, d.kek, legacyKey as BufferSource));
    const blob = new Uint8Array(iv.length + ct.length);
    blob.set(iv);
    blob.set(ct, iv.length);
    store.set(wrappedKeyName(address), toB64(blob));
    store.set(checkName(address), d.check);
    store.remove(legacyKeyName(address));
    d.dbKey.fill(0);
    return { key: legacyKey, migrated: true };
  }

  // 2. A migrated key: decrypt it. A failure means a different signature or tampering.
  const wrapped = store.get(wrappedKeyName(address));
  if (wrapped) {
    let key: Uint8Array;
    try {
      const blob = fromB64(wrapped);
      if (blob.length < 12 + 16 + 32) throw new Error('short');
      const pt = await subtle().decrypt({ name: 'AES-GCM', iv: blob.slice(0, 12) }, d.kek, blob.slice(12) as BufferSource);
      key = new Uint8Array(pt);
    } catch {
      d.dbKey.fill(0);
      throw new XmtpDbKeyError('CORRUPT', 'The encrypted database key on this device could not be decrypted with this signature, so the database was not opened.');
    }
    d.dbKey.fill(0);
    if (key.length !== 32) throw new XmtpDbKeyError('CORRUPT', 'The encrypted database key on this device is malformed.');
    if (!storedCheck) store.set(checkName(address), d.check);
    return { key, migrated: false };
  }

  // 3. A database created with the derived key (or none yet).
  if (!storedCheck) store.set(checkName(address), d.check);
  return { key: d.dbKey, migrated: false };
}
