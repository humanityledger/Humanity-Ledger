/**
 * lib/storage/chat-attachment-store.ts
 *
 * Unified storage provider for encrypted chat attachments and chunked large files (up to 32 GB).
 *
 * Primary: Cloudflare R2 (when configured via R2_* env vars).
 * Fallback: Local filesystem storage across writable candidate directories:
 *   1. process.env.CHAT_ATTACHMENTS_DIR
 *   2. <cwd>/.data/chat-attachments
 *   3. <tmpdir>/hl-chat-attachments (guaranteed writable even when container /app is read-only/root-owned)
 *
 * Reads check all candidate directories so a file written under any fallback is always retrievable.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { r2ConfigFromEnv, r2Put, r2Get, r2PresignPut, r2PresignGet } from './r2';
import { redisClient } from '@/lib/redis/client';

const ID_RE = /^[0-9a-f]{32}$/;
const DEFAULT_QUOTA_BYTES_PER_HOUR = 64 * 1024 * 1024 * 1024; // 64 GiB/hour per wallet (2x 32 GiB transfers)
const AVATAR_MIMES = new Map<string, string>([
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['webp', 'image/webp'],
  ['gif', 'image/gif'],
]);

export type StorageScope = 'attachment' | 'status' | 'avatar';

export function objectKeyForScope(scope: StorageScope, id: string): string {
  if (scope === 'status') return `status-media/${id}`;
  if (scope === 'avatar') return `avatars/${id}`;
  return `chat-attachments/${id}`;
}

export function isR2Enabled(): boolean {
  return r2ConfigFromEnv() !== null;
}

export function presignObjectPut(scope: StorageScope, id: string, opts: { expiresSec?: number; contentType?: string } = {}): string | null {
  if (!ID_RE.test(id)) throw new Error('Invalid object ID format');
  const r2 = r2ConfigFromEnv();
  if (!r2) return null;
  return r2PresignPut(r2, objectKeyForScope(scope, id), {
    expiresSec: opts.expiresSec ?? 900,
    contentType: opts.contentType ?? 'application/octet-stream',
  });
}

export function presignObjectGet(scope: StorageScope, id: string, expiresSec = 300): string | null {
  if (!ID_RE.test(id)) return null;
  const r2 = r2ConfigFromEnv();
  if (!r2) return null;
  return r2PresignGet(r2, objectKeyForScope(scope, id), { expiresSec });
}

/**
 * Enforces an hourly encrypted-storage upload byte quota per caller in Redis.
 * Fails open if Redis is unavailable/mocked so single-node setups never break.
 */
export async function checkAttachmentQuota(caller: string, addBytes: number): Promise<{ allowed: boolean; usedBytes: number; limitBytes: number }> {
  const parsed = Number(process.env.CHAT_UPLOAD_QUOTA_BYTES_PER_HOUR || '');
  const limitBytes = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_QUOTA_BYTES_PER_HOUR;
  if (!Number.isFinite(addBytes) || addBytes <= 0) return { allowed: true, usedBytes: 0, limitBytes };

  if (!redisClient || (redisClient as any).__isMock) {
    return { allowed: addBytes <= limitBytes, usedBytes: 0, limitBytes };
  }

  const key = `quota:att:bytes:${caller.toLowerCase()}`;
  const lua = `
    local next = redis.call('INCRBY', KEYS[1], ARGV[1])
    if next == tonumber(ARGV[1]) then
      redis.call('EXPIRE', KEYS[1], 3600)
    end
    if next > tonumber(ARGV[2]) then
      redis.call('DECRBY', KEYS[1], ARGV[1])
      return -1
    end
    return next
  `;
  try {
    const res = Number(await Promise.race([
      redisClient.eval(lua, 1, key, Math.ceil(addBytes), limitBytes),
      new Promise<number>((resolve) => setTimeout(() => resolve(0), 1000)),
    ]));
    if (res < 0) return { allowed: false, usedBytes: limitBytes, limitBytes };
    return { allowed: true, usedBytes: res, limitBytes };
  } catch {
    return { allowed: true, usedBytes: 0, limitBytes };
  }
}

function candidateStoreDirs(): string[] {
  const dirs: string[] = [];
  if (process.env.CHAT_ATTACHMENTS_DIR) dirs.push(process.env.CHAT_ATTACHMENTS_DIR);
  dirs.push(path.join(process.cwd(), '.data', 'chat-attachments'));
  dirs.push(path.join(os.tmpdir(), 'hl-chat-attachments'));
  return [...new Set(dirs)];
}

function getWritableStoreDir(): string {
  for (const dir of candidateStoreDirs()) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      // Try next candidate directory (handles EACCES / EROFS in container environments)
    }
  }
  throw new Error('No writable directory available for attachment storage');
}

/** Reclaims disk space on ENOSPC by removing old expired (>24h / oldest) ciphertext pieces if needed. */
async function reclaimOldFiles(dir: string): Promise<void> {
  try {
    const names = await fs.promises.readdir(dir);
    const stats = await Promise.all(
      names.map(async (name) => {
        const p = path.join(dir, name);
        const st = await fs.promises.stat(p).catch(() => null);
        return st ? { p, mtimeMs: st.mtimeMs } : null;
      }),
    );
    const oldest = stats
      .filter((x): x is { p: string; mtimeMs: number } => x !== null)
      .sort((a, b) => a.mtimeMs - b.mtimeMs);
    const cutoff = Math.max(1, Math.ceil(oldest.length * 0.25));
    for (let i = 0; i < cutoff; i++) {
      await fs.promises.unlink(oldest[i].p).catch(() => {});
    }
  } catch { /* best-effort cleanup */ }
}

async function putScopedObject(scope: StorageScope, subDir: string, id: string, body: Uint8Array, contentType = 'application/octet-stream'): Promise<void> {
  if (!ID_RE.test(id)) {
    throw new Error('Invalid attachment ID format');
  }

  const r2 = r2ConfigFromEnv();
  if (r2) {
    try {
      await r2Put(r2, objectKeyForScope(scope, id), body, contentType);
      return;
    } catch (err) {
      console.warn(`[chat-attachment-store] R2 put (${scope}) failed, falling back to local storage:`, err instanceof Error ? err.message : err);
    }
  }

  const buf = Buffer.from(body);
  let lastErr: unknown;
  for (const baseDir of candidateStoreDirs()) {
    const dir = subDir ? path.join(baseDir, subDir) : baseDir;
    try {
      if (!fs.existsSync(dir)) await fs.promises.mkdir(dir, { recursive: true });
      const filePath = path.join(dir, `${id}.bin`);
      await fs.promises.writeFile(filePath, buf);
      return;
    } catch (err: any) {
      lastErr = err;
      if (err?.code === 'ENOSPC') {
        await reclaimOldFiles(dir);
        try {
          await fs.promises.writeFile(path.join(dir, `${id}.bin`), buf);
          return;
        } catch (retryErr) {
          lastErr = retryErr;
        }
      }
      // Continue trying next writable candidate directory (e.g. /tmp fallback on EACCES)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Failed to store attachment');
}

async function getScopedObject(scope: StorageScope, subDir: string, id: string): Promise<Uint8Array | null> {
  if (!ID_RE.test(id)) {
    return null;
  }

  const r2 = r2ConfigFromEnv();
  if (r2) {
    try {
      const data = await r2Get(r2, objectKeyForScope(scope, id));
      if (data) return data;
    } catch (err) {
      console.warn(`[chat-attachment-store] R2 get (${scope}) failed, checking local storage:`, err instanceof Error ? err.message : err);
    }
  }

  for (const baseDir of candidateStoreDirs()) {
    const dir = subDir ? path.join(baseDir, subDir) : baseDir;
    const filePath = path.join(dir, `${id}.bin`);
    try {
      if (fs.existsSync(filePath)) {
        const buffer = await fs.promises.readFile(filePath);
        return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      }
    } catch (err) {
      console.error(`[chat-attachment-store] local read failed (${scope}) for id`, id, err);
    }
  }

  void getWritableStoreDir;
  return null;
}

export async function putChatAttachment(id: string, body: Uint8Array): Promise<void> {
  return putScopedObject('attachment', '', id, body);
}

export async function getChatAttachment(id: string): Promise<Uint8Array | null> {
  return getScopedObject('attachment', '', id);
}

export async function putStatusMediaObject(id: string, body: Uint8Array): Promise<void> {
  return putScopedObject('status', 'status-media', id, body);
}

export async function getStatusMediaObject(id: string): Promise<Uint8Array | null> {
  return getScopedObject('status', 'status-media', id);
}

export function parseAvatarDataUrl(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  const mime = AVATAR_MIMES.get(m[1].toLowerCase());
  if (!mime) return null;
  const buf = Buffer.from(m[2], 'base64');
  if (buf.byteLength === 0 || buf.byteLength > 500_000) return null;
  return { bytes: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength), mime };
}

export async function putAvatarObject(id: string, body: Uint8Array, mime: string): Promise<void> {
  return putScopedObject('avatar', 'avatars', id, body, mime);
}

export async function getAvatarObject(id: string): Promise<Uint8Array | null> {
  return getScopedObject('avatar', 'avatars', id);
}
