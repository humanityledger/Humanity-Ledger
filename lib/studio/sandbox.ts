/**
 * The code sandbox's file store (server only).
 *
 * Code mode runs code in Anthropic's code execution containers. The
 * workspace goes in as a zip uploaded to the Files API, and files the
 * sandbox saves to $OUTPUT_DIR come back as Files API ids. All of these
 * belong to the operator's Anthropic organization, so every container and
 * file id a browser sends back is checked against the ones this wallet
 * created (kept in Redis for as long as the API keeps them: 30 days).
 */

import Anthropic, { toFile } from '@anthropic-ai/sdk';
import { safeRedisGet, safeRedisSet } from '@/lib/redis/client';
import { isBinaryPath } from './fs';
import type { SandboxIo } from './agent';

export const FILES_BETA = 'files-api-2025-04-14';
/** Containers and their files live 30 days on the API side. */
const OWNERSHIP_TTL_SECONDS = 30 * 86_400;
/** Workspace copies are only needed for the turn; the API deletes them after an hour if we could not. */
const UPLOAD_TTL_SECONDS = 3_600;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_OUTPUT_BYTES = 1024 * 1024;
const MAX_REMEMBERED = 500;

export const CONTAINER_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;
export const FILE_ID_RE = /^file_[A-Za-z0-9_-]{8,128}$/;

const ownKey = (kind: 'containers' | 'files', wallet: string) => `studio:${kind}:${wallet.toLowerCase()}`;

async function readSet(key: string): Promise<Set<string> | null> {
  const raw = await safeRedisGet(key);
  if (raw === 'TIMEOUT') return null;
  if (!raw) return new Set();
  try {
    const v = JSON.parse(raw);
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/**
 * Remember ids this wallet created. A JSON list (not a Redis set) so the
 * in-memory fallback used in development behaves the same.
 */
export async function rememberOwned(kind: 'containers' | 'files', wallet: string, ids: string[]): Promise<void> {
  const fresh = ids.filter(id => (kind === 'files' ? FILE_ID_RE : CONTAINER_ID_RE).test(id));
  if (!fresh.length) return;
  const key = ownKey(kind, wallet);
  const cur = (await readSet(key)) ?? new Set<string>();
  for (const id of fresh) { cur.delete(id); cur.add(id); }
  const list = [...cur].slice(-MAX_REMEMBERED);
  await safeRedisSet(key, JSON.stringify(list), 'EX', OWNERSHIP_TTL_SECONDS);
}

/** The ids of this kind the wallet owns, or null when the store cannot be read (refuse then). */
export async function ownedIds(kind: 'containers' | 'files', wallet: string): Promise<Set<string> | null> {
  return readSet(ownKey(kind, wallet));
}

/** Every file_id in API-produced code execution outputs of a history. */
export function outputFileIdsIn(messages: { role: string; content: unknown }[]): string[] {
  const ids: string[] = [];
  const walk = (v: unknown, depth: number) => {
    if (depth > 12 || !v || typeof v !== 'object') return;
    if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1); return; }
    const o = v as any;
    if (o.type === 'bash_code_execution_output' && typeof o.file_id === 'string') ids.push(o.file_id);
    for (const x of Object.values(o)) walk(x, depth + 1);
  };
  for (const m of messages) if (m.role === 'assistant') walk(m.content, 0);
  return ids;
}

function looksLikeText(bytes: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return false;
  }
  const n = Math.min(bytes.length, 8_000);
  for (let i = 0; i < n; i++) if (bytes[i] === 0) return false;
  return true;
}

export function createSandboxIo(client: Anthropic): SandboxIo {
  const files = (client as any).beta.files;
  return {
    async upload(data, filename) {
      const file = await toFile(data, filename, { type: 'application/zip' });
      const meta = await files.upload({ file, expires_in_seconds: UPLOAD_TTL_SECONDS, betas: [FILES_BETA] });
      return String(meta.id);
    },
    async importOutput(fileId) {
      const meta = await files.retrieveMetadata(fileId, { betas: [FILES_BETA] });
      if (meta?.downloadable === false) return null;
      const size = Number(meta?.size_bytes ?? 0);
      if (!Number.isFinite(size) || size > MAX_OUTPUT_BYTES) return null;
      const res: Response = await files.download(fileId, { betas: [FILES_BETA] });
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length > MAX_OUTPUT_BYTES) return null;
      const filename = String(meta?.filename || 'output').split(/[\\/]/).pop() || 'output';
      if (!isBinaryPath(filename) && bytes.length <= MAX_TEXT_OUTPUT_BYTES && looksLikeText(bytes)) {
        return { filename, content: new TextDecoder().decode(bytes), encoding: 'utf8', size: bytes.length };
      }
      return { filename, content: Buffer.from(bytes).toString('base64'), encoding: 'base64', size: bytes.length };
    },
  };
}

/** Best effort: the uploads also expire on their own after an hour. */
export async function deleteUploads(client: Anthropic, ids: string[]): Promise<void> {
  const files = (client as any).beta.files;
  await Promise.all(ids.map(id => files.delete(id, { betas: [FILES_BETA] }).catch(() => {})));
}
