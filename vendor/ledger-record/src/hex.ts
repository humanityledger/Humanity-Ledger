/** Bytes, hex and UTF-8. No dependencies. Web Crypto only, so the same file runs in the browser and in Node 22. */

const HEX = /^[0-9a-f]*$/;

export function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function utf8Decode(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !HEX.test(hex)) throw new Error('Invalid hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Equal-length strings, no early exit. A length mismatch is rejected at once: the lengths are public. */
export function hexEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) throw new Error('Web Crypto is not available');
  cryptoApi.getRandomValues(out);
  return out;
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto is not available');
  const digest = await subtle.digest('SHA-256', data as unknown as BufferSource);
  return toHex(new Uint8Array(digest));
}

const bs = (u: Uint8Array) => u as unknown as BufferSource;

export async function aesSeal(key: Uint8Array, nonce: Uint8Array, plain: Uint8Array): Promise<Uint8Array> {
  const subtle = globalThis.crypto.subtle;
  const cryptoKey = await subtle.importKey('raw', bs(key), 'AES-GCM', false, ['encrypt']);
  const cipher = await subtle.encrypt({ name: 'AES-GCM', iv: bs(nonce) }, cryptoKey, bs(plain));
  return new Uint8Array(cipher);
}

export async function aesOpen(key: Uint8Array, nonce: Uint8Array, cipher: Uint8Array): Promise<Uint8Array> {
  const subtle = globalThis.crypto.subtle;
  const cryptoKey = await subtle.importKey('raw', bs(key), 'AES-GCM', false, ['decrypt']);
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv: bs(nonce) }, cryptoKey, bs(cipher));
  return new Uint8Array(plain);
}
