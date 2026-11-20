/**
 * Photo and short-video Status.
 *
 * The file is encrypted in the browser (AES-256-GCM, the chat attachment scheme) and the
 * ciphertext is uploaded to /api/chat/attachments (R2), or, when no bucket is configured, to
 * /api/chat/stories/media (Postgres, 24 hours). The key travels in the Status record itself,
 * in the URL fragment, and the Status record is stored on our server. So Status media is
 * encrypted at rest, but the server can read it: it is NOT end-to-end encrypted, and the
 * composer says so.
 *
 * Viewers only ever fetch the same-origin attachment path, never the host written in the record,
 * so a Status cannot make a viewer's browser contact a third-party server.
 */
import { decryptAttachment, encryptAttachment, MAX_ATTACHMENT_BYTES } from './remote-attachment';

export const STATUS_VIDEO_MAX_SECONDS = 30;
export const STATUS_MEDIA_MAX_BYTES = MAX_ATTACHMENT_BYTES;
export const STATUS_AUDIENCE_MAX = 256;

const PATH_RE = /^\/api\/chat\/(?:attachments|stories\/media)\/[0-9a-f]{32}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const HEX24 = /^[0-9a-f]{24}$/;
const MIME_RE = /^(image\/(jpeg|png|webp|gif|avif)|video\/(mp4|webm|quicktime))$/;

export interface StatusMedia {
  path: string;
  mime: string;
  contentDigest: string;
  secret: string;
  salt: string;
  nonce: string;
}

export function encodeStatusMedia(m: StatusMedia, origin: string): string {
  const f = new URLSearchParams({ m: m.mime, d: m.contentDigest, s: m.secret, a: m.salt, n: m.nonce });
  return `${origin}${m.path}#${f.toString()}`;
}

/** Parses a Status media URL. Null unless it is https, our attachment path and a full key. */
export function parseStatusMedia(contentUrl: unknown): StatusMedia | null {
  if (typeof contentUrl !== 'string' || contentUrl.length > 2048) return null;
  let u: URL;
  try { u = new URL(contentUrl); } catch { return null; }
  if (u.protocol !== 'https:' || u.search || !PATH_RE.test(u.pathname)) return null;
  const f = new URLSearchParams(u.hash.slice(1));
  const m = { path: u.pathname, mime: f.get('m') || '', contentDigest: f.get('d') || '', secret: f.get('s') || '', salt: f.get('a') || '', nonce: f.get('n') || '' };
  if (!MIME_RE.test(m.mime) || !HEX64.test(m.contentDigest) || !HEX64.test(m.secret) || !HEX64.test(m.salt) || !HEX24.test(m.nonce)) return null;
  return m;
}

/** The kind a Status media URL must be posted as, from its MIME type. */
export function statusKindOf(m: StatusMedia): 'image' | 'video' {
  return m.mime.startsWith('video/') ? 'video' : 'image';
}

/** Lowercase, unique, valid 0x addresses, capped. Anything else is dropped. */
export function normalizeAudience(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<string>();
  for (const a of input) {
    if (typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a)) out.add(a.toLowerCase());
    if (out.size >= STATUS_AUDIENCE_MAX) break;
  }
  return Array.from(out);
}

/** Whether `viewer` may see a status of `author` with `audience`, given the viewer is a contact. */
export function audienceAllows(author: string, audience: string[] | undefined, viewer: string): boolean {
  const v = viewer.toLowerCase();
  if (author.toLowerCase() === v) return true;
  return !audience || audience.length === 0 || audience.includes(v);
}

/** Reads a video's duration in seconds, in the browser. */
export function videoSeconds(file: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration); };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new StatusMediaError('This video cannot be read here. Try an MP4.')); };
    v.src = url;
  });
}

/** Encrypts and uploads a photo or short video; returns the Status media URL to post. */
export async function uploadStatusMedia(file: File, fetchImpl: typeof fetch = fetch): Promise<{ url: string; kind: 'image' | 'video' }> {
  if (!MIME_RE.test(file.type)) throw new StatusMediaError('Use a JPEG, PNG, WebP, GIF or AVIF photo, or an MP4, WebM or MOV video.');
  if (file.size === 0 || file.size > STATUS_MEDIA_MAX_BYTES) throw new StatusMediaError('Files can be up to 20 MB.');
  if (file.type.startsWith('video/')) {
    const secs = await videoSeconds(file);
    if (!(secs > 0) || secs > STATUS_VIDEO_MAX_SECONDS + 0.5) throw new StatusMediaError(`Videos can be up to ${STATUS_VIDEO_MAX_SECONDS} seconds.`);
  }
  const enc = await encryptAttachment(new Uint8Array(await file.arrayBuffer()));
  const put = async (path: string) => {
    const res = await fetchImpl(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: enc.ciphertext as BodyInit,
      credentials: 'same-origin',
    });
    return { res, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  };
  // R2 first; without a bucket (503 storage_unavailable) the Status store in Postgres. This was
  // the "Could not post your status" of 20 Nov 2026: production has no bucket.
  let { res, data } = await put('/api/chat/attachments');
  if (res.status === 503) ({ res, data } = await put('/api/chat/stories/media'));
  if (!res.ok || typeof data.url !== 'string') throw new StatusMediaError(uploadErrorText(res.status, data.error));
  const media: StatusMedia = { path: data.url, mime: file.type, contentDigest: enc.contentDigest, secret: enc.secret, salt: enc.salt, nonce: enc.nonce };
  return { url: encodeStatusMedia(media, window.location.origin), kind: statusKindOf(media) };
}

export class StatusMediaError extends Error {}

/** The sentence the composer shows for a failed upload. */
export function uploadErrorText(status: number, error: unknown): string {
  if (status === 401) return 'Your session has expired. Sign in again to post.';
  if (status === 413) return 'Files can be up to 20 MB.';
  if (status === 429) return error === 'Too many active statuses' ? 'You have 30 active statuses. Delete one first.' : 'Too many uploads. Wait a moment.';
  if (status === 503) return 'Photos and videos cannot be stored right now. Try again later, or post a text.';
  return 'The upload did not finish. Try again.';
}

/** Fetches the same-origin ciphertext, checks it and decrypts it into a blob: URL. */
export async function loadStatusMedia(m: StatusMedia, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(m.path, { credentials: 'same-origin', cache: 'force-cache' });
  if (!res.ok) throw new Error('This status is no longer available');
  const plain = await decryptAttachment(new Uint8Array(await res.arrayBuffer()), m);
  return URL.createObjectURL(new Blob([plain as BlobPart], { type: m.mime }));
}
