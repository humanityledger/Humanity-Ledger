/**
 * Browser-side helpers for Code mode workspaces: reading files and folders
 * the person picks, applying the changes Studio streams back, and merging.
 */

import { IGNORED_DIRS, isBinaryPath, MAX_FILE_CHARS, MAX_WS_FILES, MAX_WS_TEXT_CHARS, normalizePath, diffStats, type WsChange, type WsFile } from './fs';
import { looksLikeText } from './zip';

export const MAX_BINARY_BYTES = 2 * 1024 * 1024;

export interface ReadResult {
  files: WsFile[];
  skipped: { path: string; reason: string }[];
}

function toBase64(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Strip one common top folder, as a picked folder ("my-app/src/x") has. */
function stripRoot(paths: string[]): (p: string) => string {
  const first = paths[0]?.split('/')[0];
  if (!first || paths.length < 1 || !paths.every(p => p.startsWith(`${first}/`))) return p => p;
  return p => p.slice(first.length + 1);
}

/** Files from an <input type="file" webkitdirectory> or a multi-file pick. */
export async function readPickedFiles(list: FileList | File[], now = Date.now()): Promise<ReadResult> {
  const all = Array.from(list).map(f => ({ f, raw: ((f as any).webkitRelativePath || f.name).replace(/\\/g, '/') as string }));
  const kept = all.filter(x => !IGNORED_DIRS.test(x.raw));
  const strip = stripRoot(kept.map(x => x.raw));
  const files: WsFile[] = [];
  const skipped: ReadResult['skipped'] = [];
  let textChars = 0;
  for (const { f, raw } of kept) {
    const path = normalizePath(strip(raw));
    if (!path) { skipped.push({ path: raw, reason: 'path' }); continue; }
    if (files.length >= MAX_WS_FILES) { skipped.push({ path, reason: 'count' }); continue; }
    if (f.size > Math.max(MAX_BINARY_BYTES, MAX_FILE_CHARS * 4)) { skipped.push({ path, reason: 'size' }); continue; }
    const u8 = new Uint8Array(await f.arrayBuffer());
    if (!isBinaryPath(path) && looksLikeText(u8)) {
      const content = new TextDecoder().decode(u8);
      if (content.length > MAX_FILE_CHARS) { skipped.push({ path, reason: 'size' }); continue; }
      if (textChars + content.length > MAX_WS_TEXT_CHARS) { skipped.push({ path, reason: 'total' }); continue; }
      textChars += content.length;
      files.push({ path, content, encoding: 'utf8', size: content.length, updatedAt: now });
    } else {
      if (u8.length > MAX_BINARY_BYTES) { skipped.push({ path, reason: 'size' }); continue; }
      files.push({ path, content: toBase64(u8), encoding: 'base64', size: u8.length, updatedAt: now });
    }
  }
  return { files, skipped };
}

/** The file a streamed change leaves at its path (null: deleted). */
export function fileAfterChange(files: Map<string, WsFile>, c: WsChange, now = Date.now()): WsFile | null {
  if (c.content === null) return null;
  const encoding = c.encoding === 'base64' ? 'base64' : 'utf8';
  // The server only knows binaries by name: a moved one is copied from here.
  const content = encoding === 'base64' && c.from && !c.content ? files.get(c.from)?.content ?? '' : c.content;
  const size = encoding === 'base64' ? Math.floor((content.length * 3) / 4) : content.length;
  return { path: c.path, content, encoding, size, updatedAt: now };
}

export function textSize(files: Iterable<WsFile>): number {
  let n = 0;
  for (const f of files) if (f.encoding !== 'base64') n += f.content.length;
  return n;
}

/** Lines added and removed between two versions (binary files count as one line). */
export function changeStats(before: WsFile | null | undefined, after: WsFile | null | undefined): { added: number; removed: number } {
  const text = (f: WsFile | null | undefined) => (!f ? null : f.encoding === 'base64' ? '[binary]' : f.content);
  return diffStats(text(before), text(after));
}

export function downloadBlob(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', mp3: 'audio/mpeg', mp4: 'video/mp4', wav: 'audio/wav',
};
export const mimeForPath = (p: string) => MIME_BY_EXT[p.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';

/** Resolve "../img/a.png" against the folder of "site/pages/index.html". */
export function resolveRelative(fromFile: string, ref: string): string | null {
  if (/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref)) return null; // absolute URL, data:, anchor
  const clean = ref.split(/[?#]/)[0];
  if (!clean) return null;
  const base = clean.startsWith('/') ? [] : fromFile.split('/').slice(0, -1);
  for (const part of clean.replace(/^\/+/, '').split('/')) {
    if (part === '..') base.pop();
    else if (part && part !== '.') base.push(part);
  }
  return normalizePath(base.join('/'));
}

/**
 * Make a workspace HTML page previewable on its own: its local stylesheets,
 * scripts and images are inlined from the workspace (the preview frame can
 * load nothing from the network).
 */
export function inlineWorkspaceAssets(html: string, htmlPath: string, files: Map<string, WsFile>): string {
  const text = (ref: string) => {
    const p = resolveRelative(htmlPath, ref);
    const f = p ? files.get(p) : undefined;
    return f && f.encoding !== 'base64' ? f.content : null;
  };
  const dataUrl = (ref: string) => {
    const p = resolveRelative(htmlPath, ref);
    const f = p ? files.get(p) : undefined;
    if (!f) return null;
    if (f.encoding === 'base64') return `data:${mimeForPath(f.path)};base64,${f.content}`;
    if (/\.svg$/i.test(f.path)) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(f.content)}`;
    return null;
  };
  let out = html.replace(/<link\b[^>]*\brel\s*=\s*["']?stylesheet["']?[^>]*>/gi, tag => {
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    const css = href ? text(href) : null;
    return css === null ? tag : `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`;
  });
  out = out.replace(/<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, a, src, b) => {
    const js = text(src);
    return js === null ? tag : `<script${a}${b}>${js.replace(/<\/script/gi, '<\\/script')}</script>`;
  });
  out = out.replace(/(<(?:img|source|audio|video)\b[^>]*\bsrc\s*=\s*["'])([^"']+)(["'])/gi, (m, pre, src, post) => {
    const d = dataUrl(src);
    return d ? `${pre}${d}${post}` : m;
  });
  return out;
}

/** Root-level STUDIO.md (or CLAUDE.md, for repositories that already have one). */
export function projectMemoryFile(files: Iterable<WsFile>): WsFile | null {
  let claude: WsFile | null = null;
  for (const f of files) {
    if (f.encoding === 'base64') continue;
    const p = f.path.toLowerCase();
    if (p === 'studio.md') return f;
    if (p === 'claude.md') claude = f;
  }
  return claude;
}
