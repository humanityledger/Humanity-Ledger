/**
 * HKDF-SHA-256 via Web Crypto. The epoch secret is the input keying material.
 * It is never written into a record. Callers pass the MLS exporter output and
 * nothing else. HMAC keys from the messaging SDK are a different purpose and
 * must not be used here.
 */

import { utf8 } from './hex';

const subtle = () => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('Web Crypto is not available');
  return s;
};

export async function hkdfSha256(ikm: Uint8Array, salt: Uint8Array, info: string, length = 32): Promise<Uint8Array> {
  if (ikm.byteLength !== 32) throw new Error('HKDF input must be 32 bytes');
  if (salt.byteLength === 0) throw new Error('HKDF salt must not be empty');
  const key = await subtle().importKey('raw', ikm as unknown as BufferSource, 'HKDF', false, ['deriveBits']);
  const bits = await subtle().deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as unknown as BufferSource, info: utf8(info) as unknown as BufferSource },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}
