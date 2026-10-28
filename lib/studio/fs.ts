/**
 * Ledger Studio workspace: the project's files, and the tools Studio uses to
 * read and change them (the same jobs as Claude Code's Read, Write, Edit,
 * Glob and Grep).
 *
 * The workspace lives on the user's device. Each turn the browser sends the
 * text files with the request; the server runs the tools against that copy
 * and streams every change back, which the browser applies and checkpoints.
 * Everything here is pure, so the server, the browser and the tests share it.
 */

export interface WsFile {
  path: string;
  /** Text, or base64 when `encoding` is "base64" (images and other binaries). */
  content: string;
  encoding?: 'utf8' | 'base64';
  size: number;
  updatedAt: number;
}

export interface WsChange {
  path: string;
  /** New content; null when the file was deleted. */
  content: string | null;
  /** Content before the change; null when the file is new. */
  previous: string | null;
  op: 'create' | 'update' | 'delete';
  /** "base64" when `content` is a binary file. */
  encoding?: 'utf8' | 'base64';
  /** A move: the file came from this path (binaries are copied from it on the device). */
  from?: string;
}

export const MAX_PATH_CHARS = 300;
export const MAX_FILE_CHARS = 400_000;
export const MAX_WS_FILES = 2_000;
/** Text sent with one request (the whole request is capped at 30 MB). */
export const MAX_WS_TEXT_CHARS = 8_000_000;
const MAX_READ_LINES = 2_000;
const MAX_LINE_CHARS = 2_000;
const MAX_LIST = 500;
const MAX_GREP_RESULTS = 200;
const MAX_GREP_LINE = 1_000;

/** Folders that are never worth importing or listing. */
export const IGNORED_DIRS = /(^|\/)(node_modules|\.git|\.next|dist|build|out|coverage|\.turbo|\.cache|\.venv|venv|__pycache__|target|\.idea|\.vscode)(\/|$)/;

const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|bmp|tiff?|avif|pdf|zip|gz|tgz|bz2|xz|7z|rar|jar|wasm|exe|dll|so|dylib|bin|dat|class|o|a|mp3|mp4|mov|avi|webm|ogg|wav|flac|woff2?|ttf|otf|eot|psd|sketch|fig|sqlite|db)$/i;

export function isBinaryPath(path: string): boolean {
  return BINARY_EXT.test(path);
}

/** A safe relative path ("src/app.ts"), or null. No "..", no absolute paths, no control characters. */
export function normalizePath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let p = raw.trim().replace(/\\/g, '/');
  p = p.replace(/^(\.\/)+/, '').replace(/^\/+/, '').replace(/\/{2,}/g, '/').replace(/\/$/, '');
  if (!p || p.length > MAX_PATH_CHARS) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(p)) return null;
  // Characters Windows cannot have in a name (a drive letter "C:" among them),
  // so an exported ZIP always unpacks inside its folder.
  if (/[:*?"<>|]/.test(p)) return null;
  const parts = p.split('/');
  for (const s of parts) {
    if (!s || s === '.' || s === '..' || s.length > 120) return null;
  }
  return p;
}

/* ── glob ───────────────────────────────────────────────────────────────── */

/** Glob to RegExp: **, *, ?, {a,b}, [abc]. Matches whole relative paths. */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  let i = 0;
  let inGroup = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // "**/" matches zero or more directories; "**" alone matches anything.
        if (glob[i + 2] === '/') { re += '(?:[^/]*/)*'; i += 3; continue; }
        re += '.*'; i += 2; continue;
      }
      re += '[^/]*'; i++; continue;
    }
    if (c === '?') { re += '[^/]'; i++; continue; }
    if (c === '{') { re += '(?:'; inGroup++; i++; continue; }
    if (c === '}' && inGroup) { re += ')'; inGroup--; i++; continue; }
    if (c === ',' && inGroup) { re += '|'; i++; continue; }
    if (c === '[') {
      const end = glob.indexOf(']', i + 1);
      if (end > i + 1) {
        const body = glob.slice(i + 1, end).replace(/\\/g, '\\\\').replace(/^!/, '^');
        re += `[${body}]`;
        i = end + 1;
        continue;
      }
    }
    re += c.replace(/[.+^$()|\\/]/g, m => `\\${m}`);
    i++;
  }
  while (inGroup-- > 0) re += ')';
  return new RegExp(`^${re}$`);
}

export function matchGlob(path: string, glob: string): boolean {
  const g = glob.trim();
  if (!g) return true;
  // A pattern without "/" matches the file name anywhere, like most tools.
  const target = g.includes('/') ? path : path.split('/').pop() ?? path;
  try { return globToRegExp(g).test(target); } catch { return false; }
}

/* ── diff ───────────────────────────────────────────────────────────────── */

export interface DiffLine { kind: ' ' | '+' | '-'; text: string; a?: number; b?: number }

/** Line diff (LCS), with a cap so a huge rewrite does not stall the UI. */
export function diffLines(before: string, after: string, maxCells = 4_000_000): DiffLine[] {
  const a = before === '' ? [] : before.split('\n');
  const b = after === '' ? [] : after.split('\n');
  // Trim the common head and tail first: most edits are small.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) { endA--; endB--; }
  const midA = a.slice(start, endA + 1);
  const midB = b.slice(start, endB + 1);
  const out: DiffLine[] = [];
  for (let i = 0; i < start; i++) out.push({ kind: ' ', text: a[i], a: i + 1, b: i + 1 });
  if (midA.length * midB.length > maxCells) {
    midA.forEach((t, i) => out.push({ kind: '-', text: t, a: start + i + 1 }));
    midB.forEach((t, i) => out.push({ kind: '+', text: t, b: start + i + 1 }));
  } else {
    const n = midA.length;
    const m = midB.length;
    const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = midA[i] === midB[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && midA[i] === midB[j]) { out.push({ kind: ' ', text: midA[i], a: start + i + 1, b: start + j + 1 }); i++; j++; }
      // On a tie, removals come first, as in a unified diff ("-old" then "+new").
      else if (i < n && (j >= m || dp[i + 1][j] >= dp[i][j + 1])) { out.push({ kind: '-', text: midA[i], a: start + i + 1 }); i++; }
      else { out.push({ kind: '+', text: midB[j], b: start + j + 1 }); j++; }
    }
  }
  for (let k = 0; k < a.length - 1 - endA; k++) {
    const ia = endA + 1 + k;
    const ib = endB + 1 + k;
    out.push({ kind: ' ', text: a[ia], a: ia + 1, b: ib + 1 });
  }
  return out;
}

/** Only the changed lines with `context` lines around them; null marks a gap. */
export function diffHunks(lines: DiffLine[], context = 3): (DiffLine | null)[] {
  const keep = new Array(lines.length).fill(false);
  lines.forEach((l, i) => {
    if (l.kind !== ' ') for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) keep[k] = true;
  });
  const out: (DiffLine | null)[] = [];
  let gap = false;
  lines.forEach((l, i) => {
    if (keep[i]) { out.push(l); gap = false; } else if (!gap) { out.push(null); gap = true; }
  });
  return out;
}

export function diffStats(before: string | null, after: string | null): { added: number; removed: number } {
  const d = diffLines(before ?? '', after ?? '');
  return { added: d.filter(l => l.kind === '+').length, removed: d.filter(l => l.kind === '-').length };
}

/** A compact unified diff for tool results and commit previews. */
export function unifiedDiff(path: string, before: string | null, after: string | null, context = 3): string {
  const hunks = diffHunks(diffLines(before ?? '', after ?? ''), context);
  const body = hunks.map(l => (l === null ? '@@' : `${l.kind}${l.text}`)).join('\n');
  return `--- ${before === null ? '/dev/null' : `a/${path}`}\n+++ ${after === null ? '/dev/null' : `b/${path}`}\n${body}`;
}

/* ── tools ──────────────────────────────────────────────────────────────── */

export type WsToolName = 'read_file' | 'write_file' | 'edit_file' | 'delete_file' | 'move_file' | 'list_files' | 'grep';
export const WS_READ_TOOLS: WsToolName[] = ['read_file', 'list_files', 'grep'];
export const WS_WRITE_TOOLS: WsToolName[] = ['write_file', 'edit_file', 'delete_file', 'move_file'];

export const WS_TOOLS: Record<WsToolName, { name: WsToolName; description: string; input_schema: any }> = {
  read_file: {
    name: 'read_file',
    description: 'Read a file from the project workspace. Returns numbered lines (like cat -n). Use offset and limit for long files. Always read a file before editing it.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path, e.g. "src/index.ts".' },
        offset: { type: 'integer', description: 'First line to read (1-based).' },
        limit: { type: 'integer', description: `Number of lines (default ${MAX_READ_LINES}).` },
      },
      required: ['path'],
    },
  },
  write_file: {
    name: 'write_file',
    description: 'Create a file, or replace a file\'s whole content. Prefer edit_file for changes to existing files. Creates parent folders as needed.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string' }, content: { type: 'string' } },
      required: ['path', 'content'],
    },
  },
  edit_file: {
    name: 'edit_file',
    description: 'Replace exact text in a file. old_string must match the file exactly (including indentation) and be unique, unless replace_all is true. Read the file first.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        old_string: { type: 'string' },
        new_string: { type: 'string' },
        replace_all: { type: 'boolean' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },
  delete_file: {
    name: 'delete_file',
    description: 'Delete a file from the workspace.',
    input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  },
  move_file: {
    name: 'move_file',
    description: 'Rename or move a file. Fails if the destination exists unless overwrite is true.',
    input_schema: {
      type: 'object',
      properties: { from: { type: 'string' }, to: { type: 'string' }, overwrite: { type: 'boolean' } },
      required: ['from', 'to'],
    },
  },
  list_files: {
    name: 'list_files',
    description: 'List workspace files matching a glob ("**/*.ts", "src/**", "*.json"). Without a pattern, lists everything. Results are sorted by path.',
    input_schema: {
      type: 'object',
      properties: { pattern: { type: 'string' }, path: { type: 'string', description: 'Only under this folder.' } },
    },
  },
  grep: {
    name: 'grep',
    description: 'Search file contents with a JavaScript regular expression. output: "content" (matching lines with line numbers, default), "files" (paths only) or "count".',
    input_schema: {
      type: 'object',
      properties: {
        pattern: { type: 'string' },
        path: { type: 'string', description: 'Only under this folder or file.' },
        glob: { type: 'string', description: 'Only files matching this glob.' },
        ignore_case: { type: 'boolean' },
        context: { type: 'integer', description: 'Lines of context around each match (max 5).' },
        output: { type: 'string', enum: ['content', 'files', 'count'] },
      },
      required: ['pattern'],
    },
  },
};

export type WsToolResult =
  | { ok: true; text: string; changes: WsChange[] }
  | { ok: false; error: string };

const textOf = (f: WsFile | undefined) => (f && f.encoding !== 'base64' ? f.content : null);

function under(path: string, folder?: string): boolean {
  if (!folder) return true;
  const f = normalizePath(folder);
  if (!f) return false;
  return path === f || path.startsWith(`${f}/`);
}

/** Patterns whose matching time can explode (nested quantifiers like (a+)+). */
export function unsafeRegex(pattern: string): boolean {
  if (pattern.length > 500) return true;
  return /\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)\s*(?:[+*]|\{\d+,?\d*\})/.test(pattern) || /(\.\*){3,}/.test(pattern);
}

function setFile(files: Map<string, WsFile>, path: string, content: string, now: number): WsChange {
  const prev = files.get(path);
  files.set(path, { path, content, encoding: 'utf8', size: content.length, updatedAt: now });
  return { path, content, previous: textOf(prev), op: prev ? 'update' : 'create' };
}

/**
 * Run one workspace tool against `files` (mutated in place for write tools).
 * Errors are returned as text for the model, never thrown.
 */
export function applyWsTool(files: Map<string, WsFile>, name: string, input: any, now = Date.now()): WsToolResult {
  const inp = input && typeof input === 'object' ? input : {};
  switch (name) {
    case 'read_file': {
      const path = normalizePath(inp.path);
      if (!path) return { ok: false, error: 'Invalid path.' };
      const f = files.get(path);
      if (!f) {
        const near = [...files.keys()].filter(p => p.endsWith(`/${path.split('/').pop()}`)).slice(0, 5);
        return { ok: false, error: `File not found: ${path}.${near.length ? ` Did you mean: ${near.join(', ')}?` : ''}` };
      }
      if (f.encoding === 'base64') return { ok: true, changes: [], text: `${path} is a binary file (${f.size} bytes); it cannot be shown as text.` };
      const lines = f.content.split('\n');
      const offset = Math.max(1, Math.floor(Number(inp.offset) || 1));
      const limit = Math.min(MAX_READ_LINES, Math.max(1, Math.floor(Number(inp.limit) || MAX_READ_LINES)));
      const slice = lines.slice(offset - 1, offset - 1 + limit);
      if (!slice.length) return { ok: true, changes: [], text: f.content === '' ? `${path} is empty.` : `${path} has ${lines.length} lines; offset ${offset} is past the end.` };
      const width = String(offset + slice.length - 1).length;
      const body = slice
        .map((l, i) => `${String(offset + i).padStart(width, ' ')}\t${l.length > MAX_LINE_CHARS ? `${l.slice(0, MAX_LINE_CHARS)}… [line truncated]` : l}`)
        .join('\n');
      const more = offset - 1 + slice.length < lines.length ? `\n[${lines.length - (offset - 1 + slice.length)} more lines; read with offset ${offset + slice.length}]` : '';
      return { ok: true, changes: [], text: body + more };
    }
    case 'write_file': {
      const path = normalizePath(inp.path);
      if (!path) return { ok: false, error: 'Invalid path. Use a relative path without "..".' };
      if (typeof inp.content !== 'string') return { ok: false, error: 'content must be a string.' };
      if (inp.content.length > MAX_FILE_CHARS) return { ok: false, error: `File is over ${MAX_FILE_CHARS} characters.` };
      if (!files.has(path) && files.size >= MAX_WS_FILES) return { ok: false, error: `The workspace already has ${MAX_WS_FILES} files.` };
      if ([...files.keys()].some(p => p.startsWith(`${path}/`))) return { ok: false, error: `${path} is a folder.` };
      const change = setFile(files, path, inp.content, now);
      return { ok: true, changes: [change], text: `${change.op === 'create' ? 'Created' : 'Wrote'} ${path} (${inp.content.split('\n').length} lines).` };
    }
    case 'edit_file': {
      const path = normalizePath(inp.path);
      if (!path) return { ok: false, error: 'Invalid path.' };
      const f = files.get(path);
      const cur = textOf(f);
      if (cur === null) return { ok: false, error: f ? `${path} is binary.` : `File not found: ${path}. Use write_file to create it.` };
      if (typeof inp.old_string !== 'string' || typeof inp.new_string !== 'string') return { ok: false, error: 'old_string and new_string must be strings.' };
      if (inp.old_string === '') return { ok: false, error: 'old_string is empty. Use write_file to replace the whole file.' };
      if (inp.old_string === inp.new_string) return { ok: false, error: 'old_string and new_string are the same.' };
      const first = cur.indexOf(inp.old_string);
      if (first < 0) return { ok: false, error: `old_string was not found in ${path}. Read the file again and copy the text exactly, including whitespace.` };
      let next: string;
      let count = 1;
      if (inp.replace_all) {
        count = cur.split(inp.old_string).length - 1;
        next = cur.split(inp.old_string).join(inp.new_string);
      } else {
        if (cur.indexOf(inp.old_string, first + 1) >= 0) {
          return { ok: false, error: `old_string appears ${cur.split(inp.old_string).length - 1} times in ${path}. Add surrounding lines to make it unique, or set replace_all.` };
        }
        next = cur.slice(0, first) + inp.new_string + cur.slice(first + inp.old_string.length);
      }
      if (next.length > MAX_FILE_CHARS) return { ok: false, error: `Result is over ${MAX_FILE_CHARS} characters.` };
      const change = setFile(files, path, next, now);
      const st = diffStats(cur, next);
      return { ok: true, changes: [change], text: `Edited ${path}: ${count} replacement${count === 1 ? '' : 's'} (+${st.added} −${st.removed} lines).` };
    }
    case 'delete_file': {
      const path = normalizePath(inp.path);
      if (!path) return { ok: false, error: 'Invalid path.' };
      const f = files.get(path);
      if (!f) return { ok: false, error: `File not found: ${path}.` };
      files.delete(path);
      return { ok: true, changes: [{ path, content: null, previous: textOf(f), op: 'delete' }], text: `Deleted ${path}.` };
    }
    case 'move_file': {
      const from = normalizePath(inp.from);
      const to = normalizePath(inp.to);
      if (!from || !to) return { ok: false, error: 'Invalid path.' };
      if (from === to) return { ok: false, error: 'from and to are the same.' };
      const f = files.get(from);
      if (!f) return { ok: false, error: `File not found: ${from}.` };
      if (files.has(to) && !inp.overwrite) return { ok: false, error: `${to} exists. Set overwrite to replace it.` };
      const prevTo = files.get(to);
      files.delete(from);
      files.set(to, { ...f, path: to, updatedAt: now });
      return {
        ok: true,
        text: `Moved ${from} to ${to}.`,
        // The new path first, so the device can still copy a binary from the old one.
        changes: [
          { path: to, content: f.content, previous: textOf(prevTo), op: prevTo ? 'update' : 'create', encoding: f.encoding === 'base64' ? 'base64' : 'utf8', from },
          { path: from, content: null, previous: textOf(f), op: 'delete' },
        ],
      };
    }
    case 'list_files': {
      const pattern = typeof inp.pattern === 'string' ? inp.pattern.slice(0, 300) : '';
      const all = [...files.values()].filter(f => under(f.path, inp.path) && matchGlob(f.path, pattern)).sort((a, b) => a.path.localeCompare(b.path));
      if (!all.length) return { ok: true, changes: [], text: files.size ? 'No files match.' : 'The workspace is empty.' };
      const shown = all.slice(0, MAX_LIST).map(f => `${f.path}${f.encoding === 'base64' ? ' (binary)' : ''}  ${f.size}`);
      return { ok: true, changes: [], text: shown.join('\n') + (all.length > MAX_LIST ? `\n[${all.length - MAX_LIST} more; narrow the pattern]` : '') };
    }
    case 'grep': {
      if (typeof inp.pattern !== 'string' || !inp.pattern) return { ok: false, error: 'pattern is required.' };
      if (unsafeRegex(inp.pattern)) return { ok: false, error: 'This pattern could take too long to run (nested repetition or too long). Simplify it.' };
      let re: RegExp;
      try { re = new RegExp(inp.pattern, inp.ignore_case ? 'i' : ''); } catch (e: any) { return { ok: false, error: `Invalid regular expression: ${String(e?.message ?? e).slice(0, 200)}` }; }
      const ctx = Math.min(5, Math.max(0, Math.floor(Number(inp.context) || 0)));
      const output = inp.output === 'files' || inp.output === 'count' ? inp.output : 'content';
      const glob = typeof inp.glob === 'string' ? inp.glob.slice(0, 300) : '';
      const out: string[] = [];
      let total = 0;
      let truncated = false;
      const startedAt = Date.now();
      for (const f of [...files.values()].sort((a, b) => a.path.localeCompare(b.path))) {
        if (f.encoding === 'base64' || !under(f.path, inp.path) || !matchGlob(f.path, glob)) continue;
        if (Date.now() - startedAt > 2_000) { truncated = true; break; }
        const lines = f.content.split('\n');
        const hits: number[] = [];
        for (let i = 0; i < lines.length; i++) {
          if (re.test(lines[i].length > MAX_GREP_LINE ? lines[i].slice(0, MAX_GREP_LINE) : lines[i])) hits.push(i);
        }
        if (!hits.length) continue;
        total += hits.length;
        if (output === 'files') out.push(f.path);
        else if (output === 'count') out.push(`${f.path}: ${hits.length}`);
        else {
          const shown = new Set<number>();
          for (const h of hits) for (let k = Math.max(0, h - ctx); k <= Math.min(lines.length - 1, h + ctx); k++) shown.add(k);
          let last = -2;
          for (const k of [...shown].sort((a, b) => a - b)) {
            if (out.length >= MAX_GREP_RESULTS) { truncated = true; break; }
            if (ctx && last >= 0 && k > last + 1) out.push('--');
            const line = lines[k].length > 300 ? `${lines[k].slice(0, 300)}…` : lines[k];
            out.push(`${f.path}:${k + 1}${hits.includes(k) ? ':' : '-'}${line}`);
            last = k;
          }
        }
        if (out.length >= MAX_GREP_RESULTS) { truncated = true; break; }
      }
      if (!out.length) return { ok: true, changes: [], text: 'No matches.' };
      return { ok: true, changes: [], text: out.join('\n') + (truncated ? `\n[results truncated; ${total}+ matches. Narrow path or glob]` : '') };
    }
    default:
      return { ok: false, error: `Unknown workspace tool ${String(name).slice(0, 40)}.` };
  }
}

/** An indented tree of the workspace for the system prompt. */
export function workspaceTree(paths: string[], max = 400): string {
  const sorted = [...paths].sort();
  const lines: string[] = [];
  const seenDirs = new Set<string>();
  for (const p of sorted) {
    if (lines.length >= max) { lines.push(`… and ${sorted.length - max} more files (use list_files)`); break; }
    const parts = p.split('/');
    for (let d = 1; d < parts.length; d++) {
      const dir = parts.slice(0, d).join('/');
      if (!seenDirs.has(dir)) { seenDirs.add(dir); lines.push(`${'  '.repeat(d - 1)}${parts[d - 1]}/`); }
    }
    lines.push(`${'  '.repeat(parts.length - 1)}${parts[parts.length - 1]}`);
  }
  return lines.join('\n');
}
