/**
 * ZIP in and out of a Studio workspace (fflate; works in the browser and on
 * the server). Importing skips folders like node_modules and .git, refuses
 * unsafe paths, and stops at the workspace limits.
 */

import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { IGNORED_DIRS, isBinaryPath, MAX_FILE_CHARS, MAX_WS_FILES, MAX_WS_TEXT_CHARS, normalizePath, type WsFile } from './fs';

export interface ZipImport {
  files: WsFile[];
  skipped: { path: string; reason: string }[];
}

const MAX_BINARY_BYTES = 2 * 1024 * 1024;

function toBase64(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return typeof btoa === 'function' ? btoa(s) : Buffer.from(u8).toString('base64');
}

function fromBase64(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const s = atob(b64);
    const u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

/** Looks like text: valid UTF-8 without NUL bytes in the first 8 KB. */
export function looksLikeText(u8: Uint8Array): boolean {
  const head = u8.subarray(0, 8192);
  for (let i = 0; i < head.length; i++) if (head[i] === 0) return false;
  // stream: true tolerates a character cut in half at the end of the sample.
  try { new TextDecoder('utf-8', { fatal: true }).decode(head, { stream: head.length < u8.length }); return true; } catch { return false; }
}

/** Strip one common top folder ("repo-main/src/x" → "src/x"), as GitHub and most zips have. */
function commonRoot(paths: string[]): string {
  if (!paths.length) return '';
  const first = paths[0].split('/')[0];
  return paths.every(p => p.startsWith(`${first}/`)) ? `${first}/` : '';
}

export function importZip(data: Uint8Array, now = Date.now()): ZipImport {
  const entries = unzipSync(data, {
    // Skip directories and ignored folders before inflating them.
    filter: f => !f.name.endsWith('/') && !IGNORED_DIRS.test(f.name.replace(/\\/g, '/')) && f.originalSize <= 20 * 1024 * 1024,
  });
  const names = Object.keys(entries);
  const root = commonRoot(names.map(n => n.replace(/\\/g, '/')));
  const files: WsFile[] = [];
  const skipped: ZipImport['skipped'] = [];
  let textChars = 0;
  for (const raw of names) {
    const path = normalizePath(raw.replace(/\\/g, '/').slice(root.length));
    if (!path) { skipped.push({ path: raw, reason: 'unsafe path' }); continue; }
    if (files.length >= MAX_WS_FILES) { skipped.push({ path, reason: 'too many files' }); continue; }
    const u8 = entries[raw];
    if (!isBinaryPath(path) && looksLikeText(u8)) {
      const content = strFromU8(u8);
      if (content.length > MAX_FILE_CHARS) { skipped.push({ path, reason: 'file too large' }); continue; }
      if (textChars + content.length > MAX_WS_TEXT_CHARS) { skipped.push({ path, reason: 'workspace size limit' }); continue; }
      textChars += content.length;
      files.push({ path, content, encoding: 'utf8', size: content.length, updatedAt: now });
    } else {
      if (u8.length > MAX_BINARY_BYTES) { skipped.push({ path, reason: 'binary file too large' }); continue; }
      files.push({ path, content: toBase64(u8), encoding: 'base64', size: u8.length, updatedAt: now });
    }
  }
  return { files, skipped };
}

export function exportZip(files: WsFile[], opts: { textOnly?: boolean } = {}): Uint8Array {
  const z: Zippable = {};
  for (const f of files) {
    const p = normalizePath(f.path);
    if (!p) continue;
    if (f.encoding === 'base64') {
      if (opts.textOnly) continue;
      z[p] = [fromBase64(f.content), { level: 0 }];
    } else {
      z[p] = [strToU8(f.content), { level: 6 }];
    }
  }
  return zipSync(z, { mtime: new Date('2026-01-01T00:00:00Z') });
}
