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

/* ── @-mentions ── */

export const MAX_MENTIONS = 12;
export const MAX_MENTION_CHARS = 200_000;
const MENTION_RE = /(^|[\s([{"'`])@([^\s@"'`<>()[\]{}]+)/g;

/** Workspace paths mentioned as "@path" in a prompt (in order, without repeats). */
export function mentionedPaths(text: string, paths: Iterable<string>): string[] {
  const known = new Set(paths);
  const out: string[] = [];
  for (const m of text.matchAll(MENTION_RE)) {
    // Trailing punctuation ("see @a.ts.") is not part of the path.
    let p = m[2];
    while (p && !known.has(p) && /[.,;:!?]$/.test(p)) p = p.slice(0, -1);
    if (known.has(p) && !out.includes(p)) out.push(p);
    if (out.length >= MAX_MENTIONS) break;
  }
  return out;
}

/** The mentioned files as text blocks for the prompt (binaries are named only). */
export function mentionBlocks(files: Map<string, WsFile>, paths: string[], budget = MAX_MENTION_CHARS): { type: 'text'; text: string }[] {
  const blocks: { type: 'text'; text: string }[] = [];
  let left = budget;
  for (const p of paths) {
    const f = files.get(p);
    if (!f) continue;
    if (f.encoding === 'base64') { blocks.push({ type: 'text', text: `<file path="${p}" binary="true" size="${f.size}" />` }); continue; }
    if (left <= 0) { blocks.push({ type: 'text', text: `<file path="${p}" omitted="too large; use read_file" />` }); continue; }
    const body = f.content.length > left ? `${f.content.slice(0, left)}\n[… truncated; use read_file for the rest]` : f.content;
    left -= Math.min(f.content.length, left);
    blocks.push({ type: 'text', text: `<file path="${p}">\n${body}\n</file>` });
  }
  return blocks;
}

/** The "@query" being typed at the caret, if any. */
export function mentionAtCaret(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const m = /(^|[\s([{"'`])@([^\s@"'`<>()[\]{}]*)$/.exec(before);
  if (!m) return null;
  return { start: before.length - m[2].length - 1, query: m[2] };
}

/** Best matches for a typed path fragment: name prefix, then path prefix, then anywhere. */
export function rankPaths(paths: string[], query: string, limit = 8): string[] {
  const q = query.toLowerCase();
  if (!q) return [...paths].sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b)).slice(0, limit);
  const scored: [number, string][] = [];
  for (const p of paths) {
    const lp = p.toLowerCase();
    const name = lp.split('/').pop() ?? lp;
    const score = name.startsWith(q) ? 0 : lp.startsWith(q) ? 1 : name.includes(q) ? 2 : lp.includes(q) ? 3 : -1;
    if (score >= 0) scored.push([score * 1000 + Math.min(p.length, 999), p]);
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1])).slice(0, limit).map(x => x[1]);
}

/* ── content search ── */

export interface SearchHit { path: string; line: number; text: string }

/** Lines that contain `query` (case-insensitive), across text files. */
export function searchWorkspace(files: Iterable<WsFile>, query: string, limit = 200): { hits: SearchHit[]; files: number; truncated: boolean } {
  const q = query.toLowerCase();
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  if (!q) return { hits, files: 0, truncated: false };
  for (const f of files) {
    if (f.encoding === 'base64') continue;
    if (!f.content.toLowerCase().includes(q)) continue;
    const lines = f.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].toLowerCase().includes(q)) continue;
      seen.add(f.path);
      if (hits.length >= limit) return { hits, files: seen.size, truncated: true };
      hits.push({ path: f.path, line: i + 1, text: lines[i].trim().slice(0, 240) });
    }
  }
  return { hits, files: seen.size, truncated: false };
}

/* ── what a chat changed ── */

type Before = { content: string; encoding: 'utf8' | 'base64' } | null;
export interface ChatChange { path: string; op: 'create' | 'update' | 'delete'; added: number; removed: number }

/** Every file a chat changed, against how it was before the chat first touched it (checkpoints oldest first). */
export function chatChanges(checkpoints: { before: Record<string, Before> }[], current: Map<string, WsFile>): ChatChange[] {
  const original = new Map<string, Before>();
  for (const cp of checkpoints) for (const [p, b] of Object.entries(cp.before)) if (!original.has(p)) original.set(p, b);
  const out: ChatChange[] = [];
  for (const [path, b] of original) {
    const now = current.get(path) ?? null;
    if (!b && !now) continue;
    if (b && now && b.content === now.content && (b.encoding === 'base64') === (now.encoding === 'base64')) continue;
    const before: WsFile | null = b ? { path, content: b.content, encoding: b.encoding, size: b.content.length, updatedAt: 0 } : null;
    const st = changeStats(before, now);
    out.push({ path, op: !b ? 'create' : !now ? 'delete' : 'update', added: st.added, removed: st.removed });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/** The file as it was before the chat first changed it (undefined: the chat never changed it). */
export function chatOriginal(checkpoints: { before: Record<string, Before> }[], path: string): Before | undefined {
  for (const cp of checkpoints) if (path in cp.before) return cp.before[path];
  return undefined;
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
