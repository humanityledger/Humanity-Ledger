/**
 * lib/chat/send-attachment.ts — turns a file or voice recording into the text
 * of one Ledger Chat message.
 *
 * Normal path: encrypt in the browser (remote-attachment.ts), upload the
 * ciphertext to /api/chat/attachments, check the digest the server computed
 * matches ours, and return an "hl.attachment" message carrying the URL and key.
 *
 * Fallback, only when file storage is unavailable (503 or network error) and
 * the file is small: the legacy inline message (__AUDIO__data:… or
 * [ATTACHMENT:mime]data:…|name). It goes from this browser into XMTP only;
 * our server never receives it. Larger files fail with a clear message, never
 * a silent drop by the relay.
 *
 * Plaintext never leaves this function except inside that inline XMTP message.
 */
import { isCompressiblePhoto, shrinkPhoto } from './compress-image';
import { LargeFileError, MAX_LARGE_FILE_BYTES, sendLargeFile, type Progress } from './large-file';
import { putToPresignedUrl, requestPresignSlots, shouldAttemptDirectPresign } from './presign-upload';
import { looksLikePlaintextFile } from './file-sniff';
import {
  MAX_ATTACHMENT_BYTES,
  encodeAttachmentMessage,
  encryptAttachment,
  kindForMime,
} from './remote-attachment';

/** Raw bytes; base64 grows it by 4/3, which keeps the XMTP message under ~1 MB. */
export const INLINE_MAX_BYTES = 700 * 1024;

const URL_RE = /^\/api\/chat\/attachments\/[0-9a-f]{32}$/;

export interface AttachmentInput {
  filename: string;
  mimeType: string;
  isVoiceNote?: boolean;
  durationSec?: number;
}

export interface PreparedAttachment {
  /** "hl.attachment" up to 20 MB, "hl.largefile" above (lib/chat/large-file.ts). */
  message: string;
  /** 'encrypted' = ciphertext on our storage; 'inline' = inside the XMTP message only. */
  mode: 'encrypted' | 'inline';
}

export class AttachmentError extends Error {}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(bin);
}

function inlineMessage(bytes: Uint8Array, input: AttachmentInput, mime: string): string {
  const dataUrl = `data:${mime};base64,${toBase64(bytes)}`;
  if (input.isVoiceNote) return `__AUDIO__${dataUrl}`;
  const name = (input.filename || 'attachment').replace(/[|\r\n]/g, '_');
  return `[ATTACHMENT:${mime}]${dataUrl}|${name}`;
}

type Upload = { ok: true; url: string; contentDigest: string } | { ok: false; reason: 'unavailable' | 'plaintext' | 'error'; message?: string };

async function upload(ciphertext: Uint8Array, fetchImpl: typeof fetch): Promise<Upload> {
  let res: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await fetchImpl('/api/chat/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: ciphertext as BodyInit,
        credentials: 'same-origin',
      });
    } catch {
      res = null;
    }
    if (res && (res.ok || res.status === 503 || res.status === 422 || res.status === 401 || res.status === 413 || res.status === 415)) {
      break;
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 250));
  }
  if (!res) return { ok: false, reason: 'unavailable' };
  const data = await res.json().catch(() => ({} as any));
  if (res.ok && typeof data.url === 'string' && typeof data.contentDigest === 'string') {
    return { ok: true, url: data.url, contentDigest: data.contentDigest };
  }
  if (res.status === 503) return { ok: false, reason: 'unavailable' };
  if (res.status === 422 && data.error === 'plaintext_suspected') return { ok: false, reason: 'plaintext' };
  return { ok: false, reason: 'error', message: typeof data.error === 'string' ? data.error : `Upload failed (${res.status})` };
}

async function uploadDirectOrProxy(
  ciphertext: Uint8Array,
  contentDigest: string,
  fetchImpl: typeof fetch,
  directUpload?: boolean,
  signal?: AbortSignal,
): Promise<Upload> {
  if (shouldAttemptDirectPresign(fetchImpl, directUpload)) {
    const presign = await requestPresignSlots(fetchImpl, [ciphertext.byteLength], 'attachment', signal);
    if (presign.mode === 'rejected') {
      return { ok: false, reason: 'error', message: presign.error };
    }
    if (presign.mode === 'direct') {
      const slot = presign.slots[0];
      let putRes: Response | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          putRes = await putToPresignedUrl(fetchImpl, slot, ciphertext, signal);
        } catch {
          putRes = null;
        }
        if (putRes?.ok) {
          return { ok: true, url: slot.url, contentDigest };
        }
        if (putRes && putRes.status >= 400 && putRes.status < 500 && putRes.status !== 429) {
          break;
        }
        if (attempt === 0) await new Promise((r) => setTimeout(r, 250));
      }
      // Fall back to same-origin proxy upload if direct R2 PUT hit CORS or transient object-store error
    }
  }
  return upload(ciphertext, fetchImpl);
}

export async function prepareAttachmentMessage(
  original: Blob,
  originalInput: AttachmentInput,
  fetchImpl: typeof fetch = fetch,
  opts: { onProgress?: (p: Progress) => void; signal?: AbortSignal; directUpload?: boolean } = {},
): Promise<PreparedAttachment> {
  if (original.size === 0) throw new AttachmentError('The file is empty');

  // Photos up to 20 MB are re-encoded first (lib/chat/compress-image.ts): smaller, metadata removed,
  // and small enough for the inline path if file storage is ever unreachable.
  // Files above 20 MB bypass canvas decoding and go straight through chunked large-file encryption (up to 32 GB).
  let file: Blob = original;
  let input: AttachmentInput = originalInput;
  const originalMime = (originalInput.mimeType || original.type || '').split(';')[0].trim().toLowerCase();
  if (original.size <= MAX_ATTACHMENT_BYTES && !originalInput.isVoiceNote && isCompressiblePhoto(originalMime, original.size, INLINE_MAX_BYTES)) {
    const shrunk = await shrinkPhoto(original, INLINE_MAX_BYTES).catch(() => null);
    if (shrunk) {
      file = shrunk;
      input = { ...originalInput, mimeType: 'image/jpeg', filename: (originalInput.filename || 'photo').replace(/\.[A-Za-z0-9]{1,5}$/, '') + '.jpg' };
    }
  }
  // Larger than one attachment: encrypted and sent in 16 MiB pieces (lib/chat/large-file.ts).
  if (file.size > MAX_ATTACHMENT_BYTES) {
    if (input.isVoiceNote) throw new AttachmentError('Voice messages can be up to 20 MB');
    if (file.size > MAX_LARGE_FILE_BYTES) throw new AttachmentError('Files can be up to 32 GB');
    try {
      const message = await sendLargeFile(file, { filename: input.filename, mimeType: input.mimeType || file.type }, { fetchImpl, ...opts });
      return { mode: 'encrypted', message };
    } catch (e) {
      throw new AttachmentError(e instanceof LargeFileError ? e.message : 'Could not send the file');
    }
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = (input.mimeType || file.type || 'application/octet-stream').split(';')[0].trim().toLowerCase();
  const kind = kindForMime(mime, input.isVoiceNote);

  // Two attempts: a fresh key gives fresh ciphertext, which clears the
  // (~2^-23) chance that random bytes look like a plain file to the server.
  for (let attempt = 0; attempt < 2; attempt++) {
    const enc = await encryptAttachment(bytes);
    if (looksLikePlaintextFile(enc.ciphertext) && attempt === 0) continue;
    const up = await uploadDirectOrProxy(enc.ciphertext, enc.contentDigest, fetchImpl, opts.directUpload, opts.signal);
    if (up.ok) {
      if (!URL_RE.test(up.url) || up.contentDigest !== enc.contentDigest) {
        throw new AttachmentError('The server stored something other than what was sent');
      }
      return {
        mode: 'encrypted',
        message: encodeAttachmentMessage({
          kind,
          url: up.url,
          contentDigest: enc.contentDigest,
          secret: enc.secret,
          salt: enc.salt,
          nonce: enc.nonce,
          contentLength: bytes.byteLength,
          mimeType: mime,
          filename: input.filename,
          durationSec: input.durationSec,
        }),
      };
    }
    if (up.reason === 'plaintext' && attempt === 0) continue;
    if (up.reason === 'unavailable') {
      if (bytes.byteLength <= INLINE_MAX_BYTES) return { mode: 'inline', message: inlineMessage(bytes, input, mime) };
      throw new AttachmentError('File storage is unavailable, so files are limited to 700 KB right now. Photos are reduced automatically; this file could not be.');
    }
    throw new AttachmentError(up.reason === 'error' && up.message ? up.message : 'Could not upload the attachment');
  }
  throw new AttachmentError('Could not upload the attachment');
}
