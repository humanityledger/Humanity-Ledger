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
  let res: Response;
  try {
    res = await fetchImpl('/api/chat/attachments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: ciphertext as BodyInit,
      credentials: 'same-origin',
    });
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  const data = await res.json().catch(() => ({} as any));
  if (res.ok && typeof data.url === 'string' && typeof data.contentDigest === 'string') {
    return { ok: true, url: data.url, contentDigest: data.contentDigest };
  }
  if (res.status === 503) return { ok: false, reason: 'unavailable' };
  if (res.status === 422 && data.error === 'plaintext_suspected') return { ok: false, reason: 'plaintext' };
  return { ok: false, reason: 'error', message: typeof data.error === 'string' ? data.error : `Upload failed (${res.status})` };
}

export async function prepareAttachmentMessage(
  file: Blob,
  input: AttachmentInput,
  fetchImpl: typeof fetch = fetch,
): Promise<PreparedAttachment> {
  if (file.size === 0) throw new AttachmentError('The file is empty');
  if (file.size > MAX_ATTACHMENT_BYTES) throw new AttachmentError('Files can be up to 20 MB');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = (input.mimeType || file.type || 'application/octet-stream').split(';')[0].trim().toLowerCase();
  const kind = kindForMime(mime, input.isVoiceNote);

  // Two attempts: a fresh key gives fresh ciphertext, which clears the
  // (~2^-23) chance that random bytes look like a plain file to the server.
  for (let attempt = 0; attempt < 2; attempt++) {
    const enc = await encryptAttachment(bytes);
    const up = await upload(enc.ciphertext, fetchImpl);
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
      throw new AttachmentError('File storage is unavailable, so attachments are limited to 700 KB right now');
    }
    throw new AttachmentError(up.reason === 'error' && up.message ? up.message : 'Could not upload the attachment');
  }
  throw new AttachmentError('Could not upload the attachment');
}
