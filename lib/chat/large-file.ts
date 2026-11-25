/**
 * lib/chat/large-file.ts
 *
 * Files larger than one attachment (20 MB), up to 32 GB, sent the same way as every attachment:
 * encrypted on the sender's device, stored as ciphertext only, opened only by the people in the
 * conversation. The file is split into 16 MiB pieces; each piece is encrypted and uploaded on its
 * own through the existing route (/api/chat/attachments), so the server never holds more than one
 * piece in memory and never receives a key.
 *
 * Construction (one key per file, one nonce per piece):
 *   secret, salt = 32 random bytes each; noncePrefix = 8 random bytes
 *   key          = HKDF-SHA256(ikm = secret, salt = salt, info = "hl.largefile/v1") -> AES-256-GCM
 *   nonce_i      = noncePrefix || uint32_be(i)
 *   aad_i        = "hl.largefile/v1|" + i + "|" + total
 *   piece_i      = AES-256-GCM(key, nonce_i, aad_i, plaintext[i * 16 MiB, (i + 1) * 16 MiB))
 * The associated data binds each piece to its position and to the number of pieces, so pieces
 * cannot be reordered, repeated or dropped without the decryption failing. Every piece is also
 * checked against its SHA-256 before it is decrypted.
 *
 * The message ("hl.largefile") carries the key, so, like "hl.attachment", it is never shown,
 * previewed, notified or copied as text (remote-attachment.ts, isAttachmentMessage).
 */
import { fromHex, kindForMime, sha256Hex, toHex, digestsEqual, type AttachmentKind } from './remote-attachment';
import { putToPresignedUrl, requestPresignSlots, shouldAttemptDirectPresign, type PresignSlot } from './presign-upload';

export const LARGE_FILE_TYPE = 'hl.largefile';
export const LARGE_FILE_SCHEME = 'aes-256-gcm-hkdf-sha256-pieces';
export const PIECE_BYTES = 16 * 1024 * 1024;
export const MAX_PIECES = 2048;
/** 32 GiB. */
export const MAX_LARGE_FILE_BYTES = PIECE_BYTES * MAX_PIECES;

const INFO = new TextEncoder().encode('hl.largefile/v1');
const ID_RE = /^[0-9a-f]{32}$/;
const PIECE_RE = /^[0-9a-f]{32}\.[0-9a-f]{64}$/;

export interface LargeFileMessage {
  type: typeof LARGE_FILE_TYPE;
  v: 1;
  kind: AttachmentKind;
  scheme: typeof LARGE_FILE_SCHEME;
  secret: string;
  salt: string;
  noncePrefix: string;
  pieceBytes: number;
  contentLength: number;
  mimeType: string;
  filename: string;
  /** "<storage id>.<sha-256 of the encrypted piece>", in order. */
  pieces: string[];
}

export interface Progress {
  done: number;
  total: number;
  phase: 'encrypting' | 'uploading' | 'downloading' | 'done';
}

export class LargeFileError extends Error {}

const bs = (u: Uint8Array) => u as unknown as BufferSource;

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new LargeFileError('Web Crypto is not available in this browser');
  return s;
}

async function fileKey(secret: Uint8Array, salt: Uint8Array, usage: KeyUsage): Promise<CryptoKey> {
  const ikm = await subtle().importKey('raw', bs(secret), 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: bs(salt), info: bs(INFO) }, ikm, { name: 'AES-GCM', length: 256 }, false, [usage]);
}

export function pieceNonce(prefix: Uint8Array, index: number): Uint8Array {
  const n = new Uint8Array(12);
  n.set(prefix, 0);
  new DataView(n.buffer).setUint32(8, index, false);
  return n;
}

const aad = (index: number, total: number) => new TextEncoder().encode(`hl.largefile/v1|${index}|${total}`);

export const pieceCount = (bytes: number) => Math.ceil(bytes / PIECE_BYTES);

function cleanFilename(name: string): string {
  const s = String(name || 'file').replace(/[\u0000-\u001f\u007f/\\]/g, '_').trim();
  return (s || 'file').slice(0, 160);
}

function cleanMime(mime: string): string {
  const m = String(mime || '').split(';')[0].trim().toLowerCase();
  return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(m) ? m.slice(0, 100) : 'application/octet-stream';
}

function validate(m: any): m is LargeFileMessage {
  if (!m || typeof m !== 'object' || m.type !== LARGE_FILE_TYPE || m.v !== 1 || m.scheme !== LARGE_FILE_SCHEME) return false;
  if (!['audio', 'image', 'video', 'file'].includes(m.kind)) return false;
  if (!/^[0-9a-f]{64}$/.test(m.secret) || !/^[0-9a-f]{64}$/.test(m.salt) || !/^[0-9a-f]{16}$/.test(m.noncePrefix)) return false;
  if (m.pieceBytes !== PIECE_BYTES) return false;
  if (!Number.isSafeInteger(m.contentLength) || m.contentLength <= 0 || m.contentLength > MAX_LARGE_FILE_BYTES) return false;
  if (typeof m.mimeType !== 'string' || m.mimeType.length > 100 || typeof m.filename !== 'string' || !m.filename || m.filename.length > 160) return false;
  if (!Array.isArray(m.pieces) || m.pieces.length !== pieceCount(m.contentLength)) return false;
  return m.pieces.every((p: unknown) => typeof p === 'string' && PIECE_RE.test(p));
}

export function parseLargeFileMessage(content: unknown): LargeFileMessage | null {
  if (typeof content !== 'string') return null;
  const s = content.trimStart();
  if (!s.startsWith(`{"type":"${LARGE_FILE_TYPE}"`)) return null;
  try {
    const m = JSON.parse(s);
    return validate(m) ? m : null;
  } catch {
    return null;
  }
}

/** Human size: 1.4 GB, 640 MB, 12 KB. */
export function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(n >= 10 * 1024 ** 3 ? 0 : 1)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(n >= 10 * 1024 ** 2 ? 0 : 1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new LargeFileError('Cancelled')); }, { once: true });
  });

/** Retries rate limits, server errors and network drops with backoff; gives up on anything else. */
async function withRetry<T>(run: () => Promise<Response>, read: (res: Response) => Promise<T>, signal?: AbortSignal): Promise<T> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 7; attempt++) {
    if (signal?.aborted) throw new LargeFileError('Cancelled');
    let res: Response | null = null;
    try {
      res = await run();
    } catch {
      res = null;
    }
    if (res && res.ok) return read(res);
    lastStatus = res?.status ?? 0;
    if (res && res.status === 503) throw new LargeFileError('File storage is not switched on for this server yet, so large files cannot be sent.');
    if (res && res.status !== 429 && res.status < 500) {
      const body = await res.json().catch(() => ({} as any));
      throw new LargeFileError(typeof body.error === 'string' ? body.error : `Refused (${res.status})`);
    }
    const retryAfter = Number(res?.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(30_000, 800 * 2 ** attempt), signal);
  }
  throw new LargeFileError(lastStatus === 429 ? 'The server is busy. Try again in a minute.' : 'The connection kept dropping. Try again.');
}

/**
 * Encrypts and uploads a file of up to 32 GB, three pieces at a time, and returns the message.
 * Reads the file piece by piece: memory stays at a few pieces whatever the file size.
 */
export async function sendLargeFile(
  file: Blob,
  meta: { filename: string; mimeType: string },
  opts: { onProgress?: (p: Progress) => void; signal?: AbortSignal; fetchImpl?: typeof fetch; concurrency?: number; directUpload?: boolean } = {},
): Promise<string> {
  if (file.size === 0) throw new LargeFileError('The file is empty');
  if (file.size > MAX_LARGE_FILE_BYTES) throw new LargeFileError('Files can be up to 32 GB');
  const f = opts.fetchImpl ?? fetch;
  const total = pieceCount(file.size);
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const prefix = crypto.getRandomValues(new Uint8Array(8));
  const key = await fileKey(secret, salt, 'encrypt');
  const pieces: string[] = new Array(total);
  let done = 0;
  let next = 0;
  let failed = false;
  let useDirect = shouldAttemptDirectPresign(f, opts.directUpload);
  const presignedSlots = new Map<number, PresignSlot>();
  let presignInflights: Promise<void> | null = null;
  const BATCH_PRESIGN = 32;

  const ensureSlot = async (pieceIndex: number): Promise<PresignSlot | null> => {
    if (!useDirect) return null;
    const cached = presignedSlots.get(pieceIndex);
    if (cached) {
      presignedSlots.delete(pieceIndex);
      return cached;
    }
    while (useDirect && !presignedSlots.has(pieceIndex)) {
      if (!presignInflights) {
        const batchStart = Math.floor(pieceIndex / BATCH_PRESIGN) * BATCH_PRESIGN;
        const batchEnd = Math.min(total, batchStart + BATCH_PRESIGN);
        const sizes: number[] = [];
        for (let idx = batchStart; idx < batchEnd; idx++) {
          const s = idx * PIECE_BYTES;
          const plainLen = Math.min(file.size, s + PIECE_BYTES) - s;
          sizes.push(plainLen + 16);
        }
        presignInflights = (async () => {
          const res = await requestPresignSlots(f, sizes, 'attachment', opts.signal);
          if (res.mode === 'rejected') {
            throw new LargeFileError(res.status === 429 ? 'Hourly upload quota exceeded or rate limited. Wait a moment.' : res.error);
          }
          if (res.mode === 'proxy') {
            useDirect = false;
            return;
          }
          for (let j = 0; j < res.slots.length; j++) {
            const targetIdx = batchStart + j;
            if (!presignedSlots.has(targetIdx)) {
              presignedSlots.set(targetIdx, res.slots[j]);
            }
          }
        })().finally(() => { presignInflights = null; });
      }
      await presignInflights;
    }
    const slot = presignedSlots.get(pieceIndex) ?? null;
    if (slot) presignedSlots.delete(pieceIndex);
    return slot;
  };

  opts.onProgress?.({ done: 0, total: file.size, phase: 'encrypting' });

  const worker = async () => {
    try {
      await pump();
    } catch (e) {
      failed = true;
      throw e;
    }
  };
  const pump = async () => {
    for (;;) {
      const i = next++;
      if (i >= total || failed) return;
      if (opts.signal?.aborted) throw new LargeFileError('Cancelled');
      const start = i * PIECE_BYTES;
      const plain = new Uint8Array(await file.slice(start, Math.min(file.size, start + PIECE_BYTES)).arrayBuffer());
      const cipher = new Uint8Array(
        await subtle().encrypt({ name: 'AES-GCM', iv: bs(pieceNonce(prefix, i)), additionalData: bs(aad(i, total)) }, key, bs(plain)),
      );
      const digest = await sha256Hex(cipher);
      const slot = await ensureSlot(i);
      let id = '';
      if (slot) {
        try {
          await withRetry(
            () => putToPresignedUrl(f, slot, cipher, opts.signal),
            async () => true,
            opts.signal,
          );
          id = slot.id;
        } catch (err) {
          if (err instanceof LargeFileError && err.message === 'Cancelled') throw err;
          // Direct R2 PUT failed (e.g. bucket CORS not set); fall back cleanly to same-origin proxy
          useDirect = false;
        }
      }
      if (!id) {
        const up = await withRetry(
          () => f('/api/chat/attachments', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: cipher as BodyInit, credentials: 'same-origin', signal: opts.signal }),
          (res) => res.json() as Promise<{ url?: string; contentDigest?: string }>,
          opts.signal,
        );
        id = String(up.url ?? '').split('/').pop() ?? '';
        if (!ID_RE.test(id) || !up.contentDigest || !digestsEqual(up.contentDigest, digest)) {
          throw new LargeFileError('The server stored something other than what was sent');
        }
      }
      pieces[i] = `${id}.${digest}`;
      done += plain.byteLength;
      opts.onProgress?.({ done, total: file.size, phase: 'uploading' });
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 3, total) }, worker));

  const mime = cleanMime(meta.mimeType || file.type);
  const msg: LargeFileMessage = {
    type: LARGE_FILE_TYPE,
    v: 1,
    kind: kindForMime(mime),
    scheme: LARGE_FILE_SCHEME,
    secret: toHex(secret),
    salt: toHex(salt),
    noncePrefix: toHex(prefix),
    pieceBytes: PIECE_BYTES,
    contentLength: file.size,
    mimeType: mime,
    filename: cleanFilename(meta.filename),
    pieces,
  };
  if (!validate(msg)) throw new LargeFileError('Could not build the file message');
  opts.onProgress?.({ done: file.size, total: file.size, phase: 'done' });
  return JSON.stringify(msg);
}

/** Where downloaded pieces go: the disk (File System Access) or memory-backed Blob parts. */
export interface PieceSink {
  write(bytes: Uint8Array): Promise<void>;
  close(): Promise<Blob | null>;
  abort(): Promise<void>;
}

export function blobSink(mime: string): PieceSink {
  const parts: BlobPart[] = [];
  return {
    async write(b) { parts.push(b as unknown as BlobPart); },
    async close() { return new Blob(parts, { type: mime }); },
    async abort() { parts.length = 0; },
  };
}

/** Streams to a file the person picks, where the browser allows it (Chrome, Edge). Null elsewhere. */
export async function diskSink(filename: string): Promise<PieceSink | null> {
  const pick = (globalThis as any).showSaveFilePicker as undefined | ((o: unknown) => Promise<any>);
  if (typeof pick !== 'function') return null;
  const handle = await pick({ suggestedName: filename });
  const writable = await handle.createWritable();
  return {
    async write(b) { await writable.write(b); },
    async close() { await writable.close(); return null; },
    async abort() { try { await writable.abort(); } catch { /* already closed */ } },
  };
}

/**
 * Downloads, checks and decrypts every piece in order, writing each to the sink as soon as it is
 * open. Any piece that does not match its digest or its position stops the download: nothing
 * partial is ever presented as the file.
 */
export async function receiveLargeFile(
  msg: LargeFileMessage,
  sink: PieceSink,
  opts: { onProgress?: (p: Progress) => void; signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<Blob | null> {
  const f = opts.fetchImpl ?? fetch;
  const total = msg.pieces.length;
  const key = await fileKey(fromHex(msg.secret), fromHex(msg.salt), 'decrypt');
  const prefix = fromHex(msg.noncePrefix);
  let done = 0;
  // One piece ahead: the next download overlaps the current decryption.
  const fetchPiece = (i: number) => {
    const [id, digest] = msg.pieces[i].split('.');
    return withRetry(
      () => f(`/api/chat/attachments/${id}`, { credentials: 'same-origin', signal: opts.signal }),
      async (res) => ({ bytes: new Uint8Array(await res.arrayBuffer()), digest }),
      opts.signal,
    );
  };
  try {
    let pending = fetchPiece(0);
    pending.catch(() => {});
    for (let i = 0; i < total; i++) {
      const { bytes, digest } = await pending;
      if (i + 1 < total) {
        pending = fetchPiece(i + 1);
        pending.catch(() => {}); // awaited on the next turn; never an unhandled rejection
      }
      if (!digestsEqual(await sha256Hex(bytes), digest)) throw new LargeFileError('A piece of the file does not match. The download was stopped.');
      let plain: Uint8Array;
      try {
        plain = new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: bs(pieceNonce(prefix, i)), additionalData: bs(aad(i, total)) }, key, bs(bytes)));
      } catch {
        throw new LargeFileError('A piece of the file could not be decrypted. The download was stopped.');
      }
      await sink.write(plain);
      done += plain.byteLength;
      opts.onProgress?.({ done, total: msg.contentLength, phase: 'downloading' });
    }
    if (done !== msg.contentLength) throw new LargeFileError('The file is shorter than announced. The download was stopped.');
    const out = await sink.close();
    opts.onProgress?.({ done, total: msg.contentLength, phase: 'done' });
    return out;
  } catch (e) {
    await sink.abort();
    throw e instanceof LargeFileError ? e : new LargeFileError('The download did not finish. Try again.');
  }
}
