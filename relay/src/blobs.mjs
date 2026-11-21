// @ts-check
/**
 * The encrypted blob store: ciphertext only, addressed by its SHA-256, deleted on expiry.
 *
 * Clients encrypt every attachment and Status media file on the device (AES-256-GCM) before upload
 * and send the key only inside an MLS message, so the relay holds bytes it cannot read. The store
 * cannot prove that bytes are ciphertext; it refuses uploads that start with a well-known file
 * signature, which catches a client that forgot to encrypt.
 *
 * Storage is a directory: <hash> holds the bytes, <hash>.meta holds the expiry and the SHA-256 of
 * the delete token. Nothing else is kept: no uploader, no address, no name, no type.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const HASH_RE = /^[0-9a-f]{64}$/;

/** File signatures of common plaintext formats. A match means the client did not encrypt. */
const SIGNATURES = [
  [0x89, 0x50, 0x4e, 0x47], // PNG
  [0xff, 0xd8, 0xff], // JPEG
  [0x47, 0x49, 0x46, 0x38], // GIF
  [0x25, 0x50, 0x44, 0x46], // PDF
  [0x50, 0x4b, 0x03, 0x04], // ZIP, DOCX, XLSX
  [0x52, 0x49, 0x46, 0x46], // RIFF: WEBP, WAV, AVI
  [0x1a, 0x45, 0xdf, 0xa3], // Matroska, WebM
  [0x4f, 0x67, 0x67, 0x53], // Ogg
  [0x49, 0x44, 0x33], // MP3 with ID3
];

/** True when the bytes look like an unencrypted file. */
export function looksLikePlaintext(/** @type {Uint8Array} */ b) {
  if (SIGNATURES.some((sig) => sig.every((x, i) => b[i] === x))) return true;
  // ISO media (MP4, MOV, HEIC): "ftyp" at offset 4.
  if (b.length > 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return true;
  // Mostly printable ASCII in the first kilobyte: text, JSON, SVG or HTML.
  const n = Math.min(b.length, 1024);
  if (n >= 64) {
    let printable = 0;
    for (let i = 0; i < n; i++) if ((b[i] >= 0x20 && b[i] < 0x7f) || b[i] === 0x0a || b[i] === 0x0d || b[i] === 0x09) printable++;
    if (printable / n > 0.95) return true;
  }
  return false;
}

const sha256 = (/** @type {Uint8Array | string} */ x) => createHash('sha256').update(x).digest('hex');

export class BlobStore {
  /**
   * @param {{ dir: string; maxBytes: number; defaultTtlSeconds: number; maxTtlSeconds: number; quotaBytes: number }} opts
   * @param {() => number} [clock]
   */
  constructor(opts, clock = Date.now) {
    this.opts = opts;
    this.clock = clock;
    this.used = 0;
    this.ready = fs.mkdir(opts.dir, { recursive: true, mode: 0o700 }).then(() => this.recount());
  }

  async recount() {
    let used = 0;
    for (const name of await fs.readdir(this.opts.dir).catch(() => [])) {
      if (!HASH_RE.test(name)) continue;
      used += (await fs.stat(path.join(this.opts.dir, name)).catch(() => ({ size: 0 }))).size;
    }
    this.used = used;
  }

  file(/** @type {string} */ hash) {
    if (!HASH_RE.test(hash)) throw new Error('bad hash');
    return path.join(this.opts.dir, hash);
  }

  /**
   * @param {string} hash the SHA-256 the client computed over the ciphertext
   * @param {Uint8Array} bytes
   * @param {number} [ttlSeconds]
   * @returns {Promise<{ status: number; body: Record<string, unknown> }>}
   */
  async put(hash, bytes, ttlSeconds) {
    await this.ready;
    if (!HASH_RE.test(hash)) return { status: 400, body: { error: 'The address must be a lowercase hex SHA-256.' } };
    if (bytes.length === 0) return { status: 400, body: { error: 'Empty body.' } };
    if (bytes.length > this.opts.maxBytes) return { status: 413, body: { error: 'Too large.', maxBytes: this.opts.maxBytes } };
    if (sha256(bytes) !== hash) return { status: 422, body: { error: 'The body does not match its address.' } };
    if (looksLikePlaintext(bytes)) return { status: 422, body: { error: 'This looks like an unencrypted file. Encrypt on the device before uploading.' } };
    const ttl = Math.min(this.opts.maxTtlSeconds, Math.max(60, Number.isFinite(ttlSeconds) ? Number(ttlSeconds) : this.opts.defaultTtlSeconds));
    const expiresAt = this.clock() + ttl * 1000;
    const file = this.file(hash);
    const existing = await this.meta(hash);
    if (existing && existing.expiresAt > this.clock()) {
      // Same bytes, already here: extend the expiry, keep the first uploader's delete token.
      await this.writeMeta(hash, { ...existing, expiresAt: Math.max(existing.expiresAt, expiresAt) });
      return { status: 200, body: { hash, expiresAt: new Date(Math.max(existing.expiresAt, expiresAt)).toISOString() } };
    }
    if (this.used + bytes.length > this.opts.quotaBytes) return { status: 507, body: { error: 'The relay is full. Try another relay.' } };
    const deleteToken = randomBytes(24).toString('base64url');
    const tmp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
    await fs.writeFile(tmp, bytes, { mode: 0o600 });
    await fs.rename(tmp, file);
    await this.writeMeta(hash, { expiresAt, deleteTokenHash: sha256(deleteToken) });
    this.used += bytes.length;
    return { status: 201, body: { hash, expiresAt: new Date(expiresAt).toISOString(), deleteToken } };
  }

  /** @returns {Promise<Uint8Array | null>} */
  async get(/** @type {string} */ hash) {
    await this.ready;
    if (!HASH_RE.test(hash)) return null;
    const meta = await this.meta(hash);
    if (!meta || meta.expiresAt <= this.clock()) {
      if (meta) await this.remove(hash);
      return null;
    }
    return fs.readFile(this.file(hash)).catch(() => null);
  }

  /** Deletes a blob for whoever holds its delete token. */
  async delete(/** @type {string} */ hash, /** @type {string} */ token) {
    await this.ready;
    const meta = HASH_RE.test(hash) ? await this.meta(hash) : null;
    if (!meta || !token) return false;
    const a = Buffer.from(meta.deleteTokenHash, 'hex');
    const b = Buffer.from(sha256(token), 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    await this.remove(hash);
    return true;
  }

  /** Removes every expired blob. Returns how many. */
  async sweep() {
    await this.ready;
    let n = 0;
    for (const name of await fs.readdir(this.opts.dir).catch(() => [])) {
      if (name.endsWith('.tmp')) continue;
      const hash = name.endsWith('.meta') ? name.slice(0, -5) : name;
      if (!HASH_RE.test(hash)) continue;
      const meta = await this.meta(hash);
      if (!meta || meta.expiresAt <= this.clock()) {
        await this.remove(hash);
        n++;
      }
    }
    return n;
  }

  async remove(/** @type {string} */ hash) {
    const file = this.file(hash);
    const size = (await fs.stat(file).catch(() => ({ size: 0 }))).size;
    await fs.rm(file, { force: true });
    await fs.rm(`${file}.meta`, { force: true });
    this.used = Math.max(0, this.used - size);
  }

  /** @returns {Promise<{ expiresAt: number; deleteTokenHash: string } | null>} */
  async meta(/** @type {string} */ hash) {
    try {
      const m = JSON.parse(await fs.readFile(`${this.file(hash)}.meta`, 'utf8'));
      return typeof m.expiresAt === 'number' && typeof m.deleteTokenHash === 'string' ? m : null;
    } catch {
      return null;
    }
  }

  async writeMeta(/** @type {string} */ hash, /** @type {object} */ meta) {
    await fs.writeFile(`${this.file(hash)}.meta`, JSON.stringify(meta), { mode: 0o600 });
  }
}
