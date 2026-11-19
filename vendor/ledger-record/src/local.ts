/**
 * Local wrapping of a record content key.
 *
 * The epoch wrap lets every current member open the record. This wrap is
 * only for the copy kept on this device. A passphrase uses Argon2id
 * (RFC 9106) via @noble/hashes. A passkey uses the WebAuthn PRF output,
 * then HKDF, so the authenticator secret is not used as a raw AES key.
 *
 * Argon2id in JavaScript is not constant-time. It is still the right
 * password hash. The production parameters are the memory-constrained
 * profile: 64 MiB, 3 passes, one lane. Tests pass smaller parameters
 * explicitly. The chat must not.
 */

import { argon2idAsync } from '@noble/hashes/argon2';
import { aesOpen, aesSeal, randomBytes, utf8, zeroize } from './hex';
import { hkdfSha256 } from './kdf';
import { RecordError } from './protocol';

/** RFC 9106 memory-constrained profile, one lane because the browser runs lanes in series. */
export const PASSPHRASE_KDF = { t: 3, m: 65_536, p: 1, dkLen: 32 } as const;

export type KdfParams = { t: number; m: number; p: number; dkLen: 32 };

export async function derivePassphraseKek(passphrase: string, salt: Uint8Array, params: KdfParams = PASSPHRASE_KDF): Promise<Uint8Array> {
  if (typeof passphrase !== 'string' || passphrase.length < 8) {
    throw new RecordError('passphrase', 'The passphrase is too short');
  }
  if (salt.byteLength !== 16) throw new RecordError('passphrase', 'The salt is not usable');
  return argon2idAsync(utf8(passphrase), salt, params);
}

/** 32-byte WebAuthn PRF result. HKDF domain-separates it from any other use. */
export async function derivePasskeyKek(prf: Uint8Array): Promise<Uint8Array> {
  if (!(prf instanceof Uint8Array) || prf.byteLength !== 32) {
    throw new RecordError('passkey', 'The passkey result is not usable');
  }
  const salt = utf8('ledger-record/v2/passkey-salt');
  try {
    return await hkdfSha256(prf, salt, 'ledger-record/v2/passkey', 32);
  } finally {
    // The caller still holds prf. We do not wipe their buffer.
  }
}

export interface WrappedKey {
  nonce: string;
  ct: string;
}

function toHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function wrapContentKey(contentKey: Uint8Array, kek: Uint8Array): Promise<WrappedKey> {
  if (contentKey.byteLength !== 32 || kek.byteLength !== 32) throw new RecordError('key', 'The record key is not usable');
  const nonce = randomBytes(12);
  const aad = utf8('ledger-record/v2/local-key');
  const ct = await aesSeal(kek, nonce, contentKey, aad);
  const wrapped = { nonce: toHex(nonce), ct: toHex(ct) };
  zeroize(nonce);
  return wrapped;
}

export async function unwrapContentKey(wrapped: WrappedKey, kek: Uint8Array): Promise<Uint8Array> {
  const aad = utf8('ledger-record/v2/local-key');
  try {
    const key = await aesOpen(kek, fromHex(wrapped.nonce), fromHex(wrapped.ct), aad);
    if (key.byteLength !== 32) throw new RecordError('key', 'The stored record key is not usable');
    return key;
  } catch (error) {
    if (error instanceof RecordError) throw error;
    throw new RecordError('passphrase', 'The passphrase or passkey did not open the record key');
  }
}

/**
 * In-memory session. Locking zeroizes the KEK and every content key it held.
 * Other devices are not touched. A locked session refuses to unwrap.
 */
export class RecordKeySession {
  private kek: Uint8Array | null = null;
  private keys = new Map<string, Uint8Array>();
  locked = true;

  async unlockPassphrase(passphrase: string, salt: Uint8Array, params?: KdfParams): Promise<void> {
    const kek = await derivePassphraseKek(passphrase, salt, params);
    this.adopt(kek);
  }

  async unlockPasskey(prf: Uint8Array): Promise<void> {
    const kek = await derivePasskeyKek(prf);
    this.adopt(kek);
  }

  private adopt(kek: Uint8Array): void {
    if (this.kek) zeroize(this.kek);
    this.kek = kek;
    this.locked = false;
  }

  lock(): void {
    if (this.kek) zeroize(this.kek);
    this.kek = null;
    for (const key of this.keys.values()) zeroize(key);
    this.keys.clear();
    this.locked = true;
  }

  async protect(contentKey: Uint8Array): Promise<WrappedKey> {
    if (this.locked || !this.kek) throw new RecordError('locked', 'This device is locked');
    return wrapContentKey(contentKey, this.kek);
  }

  async hold(id: string, wrapped: WrappedKey): Promise<Uint8Array> {
    if (this.locked || !this.kek) throw new RecordError('locked', 'This device is locked');
    const existing = this.keys.get(id);
    if (existing) return existing;
    const key = await unwrapContentKey(wrapped, this.kek);
    this.keys.set(id, key);
    return key;
  }
}
