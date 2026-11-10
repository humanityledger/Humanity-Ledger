/**
 * lib/chat/remote-attachment.ts
 *
 * Encrypted attachments for Ledger Chat (voice notes, photos, videos, files).
 *
 * The file is encrypted in the sender's browser, only the ciphertext is
 * uploaded (to /api/chat/attachments), and the XMTP message carries what the
 * recipient needs to fetch and decrypt it: the ciphertext URL, its SHA-256
 * digest and the key material. The XMTP message itself travels inside the
 * MLS group, so the key is end-to-end encrypted; our server and the storage
 * bucket only ever hold ciphertext.
 *
 * Encryption follows the scheme of XMTP's RemoteAttachment content type:
 *
 *   secret, salt  = 32 random bytes each, nonce = 12 random bytes
 *   key           = HKDF-SHA256(ikm = secret, salt = salt, info = "") -> AES-256-GCM
 *   ciphertext    = AES-256-GCM(key, nonce, plaintext)   (tag appended)
 *   contentDigest = hex(SHA-256(ciphertext))
 *
 * Not wire compatible with other XMTP apps: XMTP's codec encrypts a protobuf
 * EncodedContent and sends a dedicated content type, and Ledger Chat sends its
 * messages as text. This message is a JSON text message ("hl.attachment"),
 * in the same style as the agreement messages (lib/aztec/agreement-message.ts).
 *
 * Invariants:
 *  - A secret is never reused: every attachment gets a fresh secret and salt.
 *  - The recipient checks the digest before decrypting, and AES-GCM checks the
 *    tag, so a swapped or truncated ciphertext is rejected, never rendered.
 *  - The URL must be our own attachment path. A message cannot make the
 *    recipient's browser fetch an arbitrary host (that would leak their IP
 *    address to whoever wrote the message).
 *  - The message carries a key: it must never be shown, previewed, notified,
 *    copied or moderated as text. Use attachmentPreview() for any label.
 *
 * Isomorphic: uses globalThis.crypto.subtle only (browsers, Node 20+).
 */

export const ATTACHMENT_MESSAGE_TYPE = 'hl.attachment';
export const ATTACHMENT_SCHEME = 'aes-256-gcm-hkdf-sha256';

/** Upper bound on one attachment's plaintext. The route enforces the same on ciphertext. */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
/** AES-GCM appends a 16-byte tag. */
export const GCM_TAG_BYTES = 16;

export type AttachmentKind = 'audio' | 'image' | 'video' | 'file';

export interface AttachmentMessage {
  type: typeof ATTACHMENT_MESSAGE_TYPE;
  v: 1;
  kind: AttachmentKind;
  /** Same-origin path: /api/chat/attachments/<32 hex chars>. */
  url: string;
  scheme: typeof ATTACHMENT_SCHEME;
  /** hex SHA-256 of the ciphertext. */
  contentDigest: string;
  /** hex, 32 bytes. */
  secret: string;
  /** hex, 32 bytes. */
  salt: string;
  /** hex, 12 bytes. */
  nonce: string;
  /** Plaintext length in bytes. */
  contentLength: number;
  mimeType: string;
  filename: string;
  /** Voice notes only. */
  durationSec?: number;
}

export interface EncryptedAttachment {
  ciphertext: Uint8Array;
  contentDigest: string;
  secret: string;
  salt: string;
  nonce: string;
}

const URL_RE = /^\/api\/chat\/attachments\/[0-9a-f]{32}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const HEX24 = /^[0-9a-f]{24}$/;
const KINDS: readonly AttachmentKind[] = ['audio', 'image', 'video', 'file'];
const MAX_FILENAME = 160;
const MAX_MIME = 100;

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('Web Crypto is not available in this browser');
  return s;
}

/** TS 5.7+ types Uint8Array over ArrayBufferLike; Web Crypto wants ArrayBuffer-backed views. */
const bs = (u: Uint8Array) => u as unknown as BufferSource;

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

export function toHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/.test(hex)) throw new Error('Invalid hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  return toHex(new Uint8Array(await subtle().digest('SHA-256', bs(data))));
}

/** Compares two equal-length hex strings without an early exit. */
export function digestsEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function deriveKey(secret: Uint8Array, salt: Uint8Array, usage: KeyUsage): Promise<CryptoKey> {
  const ikm = await subtle().importKey('raw', bs(secret), 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: bs(salt), info: new Uint8Array(0) },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  );
}

export async function encryptAttachment(plaintext: Uint8Array): Promise<EncryptedAttachment> {
  if (plaintext.byteLength === 0) throw new Error('The file is empty');
  if (plaintext.byteLength > MAX_ATTACHMENT_BYTES) throw new Error('Files can be up to 20 MB');
  const secret = randomBytes(32);
  const salt = randomBytes(32);
  const nonce = randomBytes(12);
  const key = await deriveKey(secret, salt, 'encrypt');
  const ciphertext = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: bs(nonce) }, key, bs(plaintext)));
  return {
    ciphertext,
    contentDigest: await sha256Hex(ciphertext),
    secret: toHex(secret),
    salt: toHex(salt),
    nonce: toHex(nonce),
  };
}

/**
 * Checks the digest, then decrypts. Throws on any mismatch; never returns
 * partially decrypted data.
 */
export async function decryptAttachment(
  ciphertext: Uint8Array,
  params: Pick<AttachmentMessage, 'contentDigest' | 'secret' | 'salt' | 'nonce'>,
): Promise<Uint8Array> {
  const digest = await sha256Hex(ciphertext);
  if (!digestsEqual(digest, params.contentDigest)) {
    throw new Error('The attachment does not match its digest');
  }
  const key = await deriveKey(fromHex(params.secret), fromHex(params.salt), 'decrypt');
  try {
    return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: bs(fromHex(params.nonce)) }, key, bs(ciphertext)));
  } catch {
    throw new Error('The attachment could not be decrypted');
  }
}

// ─── Message encoding ────────────────────────────────────────────────────────

function cleanFilename(name: string): string {
  // No path separators or control characters; the name is only ever a label
  // and a download name.
  const s = String(name || 'attachment').replace(/[\u0000-\u001f\u007f/\\]/g, '_').trim();
  return (s || 'attachment').slice(0, MAX_FILENAME);
}

function cleanMime(mime: string): string {
  const m = String(mime || '').split(';')[0].trim().toLowerCase();
  return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(m) ? m.slice(0, MAX_MIME) : 'application/octet-stream';
}

export function encodeAttachmentMessage(input: Omit<AttachmentMessage, 'type' | 'v' | 'scheme'>): string {
  const msg: AttachmentMessage = {
    type: ATTACHMENT_MESSAGE_TYPE,
    v: 1,
    kind: input.kind,
    url: input.url,
    scheme: ATTACHMENT_SCHEME,
    contentDigest: input.contentDigest,
    secret: input.secret,
    salt: input.salt,
    nonce: input.nonce,
    contentLength: input.contentLength,
    mimeType: cleanMime(input.mimeType),
    filename: cleanFilename(input.filename),
    ...(typeof input.durationSec === 'number' ? { durationSec: Math.max(0, Math.round(input.durationSec)) } : {}),
  };
  // Validate what we are about to send with the same rules the recipient uses.
  if (!validate(msg)) throw new Error('Invalid attachment message');
  return JSON.stringify(msg);
}

function validate(m: any): m is AttachmentMessage {
  return (
    m && typeof m === 'object' &&
    m.type === ATTACHMENT_MESSAGE_TYPE &&
    m.v === 1 &&
    KINDS.includes(m.kind) &&
    typeof m.url === 'string' && URL_RE.test(m.url) &&
    m.scheme === ATTACHMENT_SCHEME &&
    typeof m.contentDigest === 'string' && HEX64.test(m.contentDigest) &&
    typeof m.secret === 'string' && HEX64.test(m.secret) &&
    typeof m.salt === 'string' && HEX64.test(m.salt) &&
    typeof m.nonce === 'string' && HEX24.test(m.nonce) &&
    Number.isSafeInteger(m.contentLength) && m.contentLength > 0 && m.contentLength <= MAX_ATTACHMENT_BYTES &&
    typeof m.mimeType === 'string' && m.mimeType.length <= MAX_MIME &&
    typeof m.filename === 'string' && m.filename.length > 0 && m.filename.length <= MAX_FILENAME &&
    (m.durationSec === undefined || (Number.isFinite(m.durationSec) && m.durationSec >= 0 && m.durationSec <= 24 * 3600))
  );
}

/** Cheap prefix test, safe to call on every message. */
export function isAttachmentMessage(content: unknown): boolean {
  return parseAttachmentMessage(content) !== null;
}

/** Returns the attachment, or null if the text is not a valid attachment message. */
export function parseAttachmentMessage(content: unknown): AttachmentMessage | null {
  if (typeof content !== 'string') return null;
  const s = content.trimStart();
  if (!s.startsWith('{"type":"hl.attachment"')) return null;
  try {
    const m = JSON.parse(s);
    return validate(m) ? m : null;
  } catch {
    return null;
  }
}

/** Words for chat lists, notifications, replies and Copy; never the message itself. */
export function attachmentPreview(msg: Pick<AttachmentMessage, 'kind' | 'filename'> | null): string {
  if (!msg) return 'Attachment';
  if (msg.kind === 'audio') return 'Voice message';
  if (msg.kind === 'image') return 'Photo';
  if (msg.kind === 'video') return 'Video';
  return msg.filename || 'File';
}

/** Picks the kind from what the sender selected. The recipient re-checks the bytes (file-sniff.ts). */
export function kindForMime(mime: string, isVoiceNote = false): AttachmentKind {
  if (isVoiceNote) return 'audio';
  const m = cleanMime(mime);
  if (m.startsWith('image/') && m !== 'image/svg+xml') return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  return 'file';
}
