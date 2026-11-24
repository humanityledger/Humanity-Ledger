/**
 * lib/backup/encrypted-archive.ts — a file only its owner can open (alignment items 45 and 90).
 *
 * The person chooses a passphrase; nothing about it leaves the device. PBKDF2-SHA256 with
 * 600,000 iterations (OWASP 2023 for PBKDF2-SHA256) turns it into an AES-256-GCM key; the salt and
 * IV are random per file. The file is JSON so it can be inspected: its header says how it was
 * sealed, its body is ciphertext. A wrong passphrase or a modified file fails the GCM tag check
 * and nothing is restored.
 *
 * WebCrypto only: no dependency, constant-time primitives from the browser.
 */

export const ARCHIVE_FORMAT = 'ledger-chat-archive';
export const ARCHIVE_VERSION = 1;
export const PBKDF2_ITERATIONS = 600_000;
export const MIN_PASSPHRASE = 12;

export interface SealedArchive {
  format: typeof ARCHIVE_FORMAT;
  v: typeof ARCHIVE_VERSION;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function chunkedB64(u: Uint8Array): string {
  let out = '';
  for (let i = 0; i < u.length; i += 0x8000) out += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(out);
}

export function passphraseProblem(p: string): string | null {
  if (p.length < MIN_PASSPHRASE) return `Use at least ${MIN_PASSPHRASE} characters.`;
  if (/^(.)\1+$/.test(p)) return 'Use more than one repeated character.';
  return null;
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Seals any JSON-serialisable value. Throws if the passphrase is too weak. */
export async function sealArchive(data: unknown, passphrase: string, iterations = PBKDF2_ITERATIONS): Promise<SealedArchive> {
  const problem = passphraseProblem(passphrase);
  if (problem) throw new Error(problem);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations);
  const plain = new TextEncoder().encode(JSON.stringify(data));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource, additionalData: new TextEncoder().encode(`${ARCHIVE_FORMAT}/v${ARCHIVE_VERSION}`) as BufferSource }, key, plain as BufferSource));
  return { format: ARCHIVE_FORMAT, v: ARCHIVE_VERSION, kdf: 'PBKDF2-SHA256', iterations, salt: b64(salt), iv: b64(iv), ciphertext: chunkedB64(ct) };
}

/** Opens a sealed archive. Throws "Wrong passphrase or damaged file." on any failure of the tag. */
export async function openArchive<T = unknown>(sealed: unknown, passphrase: string): Promise<T> {
  const s = sealed as Partial<SealedArchive>;
  if (!s || s.format !== ARCHIVE_FORMAT || s.v !== ARCHIVE_VERSION || s.kdf !== 'PBKDF2-SHA256' || typeof s.iterations !== 'number' || s.iterations < 100_000 || !s.salt || !s.iv || !s.ciphertext) {
    throw new Error('This is not a Ledger Chat archive.');
  }
  const key = await deriveKey(passphrase, unb64(s.salt), s.iterations);
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(s.iv) as BufferSource, additionalData: new TextEncoder().encode(`${ARCHIVE_FORMAT}/v${ARCHIVE_VERSION}`) as BufferSource }, key, unb64(s.ciphertext) as BufferSource);
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    throw new Error('Wrong passphrase or damaged file.');
  }
}
