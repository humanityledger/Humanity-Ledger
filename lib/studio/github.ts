/**
 * GitHub for Code mode workspaces, straight from the browser to
 * api.github.com with the person's own token (it never reaches Humanity
 * Ledger's servers, except during the optional OAuth sign-in exchange).
 *
 * Import: the branch's tree and blobs. Push: a new branch with one commit
 * built from the files that differ from the imported version (by git blob
 * SHA), then a pull request; later pushes add commits to that branch.
 */

import { IGNORED_DIRS, isBinaryPath, MAX_FILE_CHARS, MAX_WS_FILES, MAX_WS_TEXT_CHARS, normalizePath, type WsFile } from './fs';
import { looksLikeText } from './zip';

const API = 'https://api.github.com';
const MAX_BLOB_BYTES = 2 * 1024 * 1024;
const CONCURRENCY = 8;

export interface GitLink {
  owner: string;
  repo: string;
  /** The branch the workspace was imported from (the pull request's base). */
  base: string;
  /** The branch pushes go to (equal to base until a pull request exists). */
  branch: string;
  /** Commit and tree the workspace matches on `branch`. */
  commit: string;
  tree: string;
  /** path → git blob SHA of the version on `branch`. */
  shas: Record<string, string>;
  pr?: { number: number; url: string };
}

export class GitHubError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'GitHubError'; }
}

const REPO_RE = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
const BRANCH_RE = /^(?!\/|.*(?:\/\.|\/\/|\.\.|@\{|\\))[^\s~^:?*[\x00-\x1f\x7f]{1,200}(?<![./])$/;

/** "owner/repo", "https://github.com/owner/repo(.git)(/tree/branch)" → parts. */
export function parseRepo(input: string): { owner: string; repo: string; branch?: string } | null {
  let s = input.trim();
  const m = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:\/tree\/([^\s#?]+))?\/?(?:[#?].*)?$/i.exec(s);
  if (m) {
    s = `${m[1]}/${m[2]}`;
    if (!REPO_RE.test(s)) return null;
    const branch = m[3] ? decodeURIComponent(m[3]) : undefined;
    return { owner: m[1], repo: m[2], ...(branch && isValidBranch(branch) ? { branch } : {}) };
  }
  s = s.replace(/\.git$/, '');
  if (!REPO_RE.test(s)) return null;
  const [owner, repo] = s.split('/');
  return { owner, repo };
}

export function isValidBranch(name: string): boolean {
  return BRANCH_RE.test(name) && !name.endsWith('.lock');
}

const enc = encodeURIComponent;
const repoPath = (l: { owner: string; repo: string }) => `/repos/${enc(l.owner)}/${enc(l.repo)}`;

export async function gh<T = any>(token: string, path: string, init: RequestInit = {}, fetcher: typeof fetch = fetch): Promise<T> {
  const res = await fetcher(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!res.ok) {
    let msg = '';
    try { msg = String((await res.json())?.message ?? ''); } catch { /* not JSON */ }
    const rate = res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0';
    throw new GitHubError(rate ? 429 : res.status, msg.slice(0, 300) || `HTTP ${res.status}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export async function getViewer(token: string, fetcher?: typeof fetch): Promise<{ login: string }> {
  const u = await gh(token, '/user', {}, fetcher);
  return { login: String(u.login) };
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''));
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
function bytesToB64(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
}

/** git's blob id: sha1("blob <size>\0" + bytes). */
export async function gitBlobSha(bytes: Uint8Array): Promise<string> {
  const head = new TextEncoder().encode(`blob ${bytes.length}\0`);
  const all = new Uint8Array(head.length + bytes.length);
  all.set(head); all.set(bytes, head.length);
  const d = new Uint8Array(await crypto.subtle.digest('SHA-1', all));
  return Array.from(d, b => b.toString(16).padStart(2, '0')).join('');
}

export function fileBytes(f: WsFile): Uint8Array {
  return f.encoding === 'base64' ? b64ToBytes(f.content) : new TextEncoder().encode(f.content);
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

export interface ImportResult { files: WsFile[]; link: GitLink; skipped: number; truncated: boolean }

export async function importRepo(token: string, owner: string, repo: string, branch?: string, onProgress?: (done: number, total: number) => void, fetcher?: typeof fetch): Promise<ImportResult> {
  const r = repoPath({ owner, repo });
  const info = await gh(token, r, {}, fetcher);
  const base = branch || String(info.default_branch || 'main');
  const br = await gh(token, `${r}/branches/${enc(base)}`, {}, fetcher);
  const commit = String(br.commit.sha);
  const tree = String(br.commit.commit.tree.sha);
  const t = await gh(token, `${r}/git/trees/${enc(tree)}?recursive=1`, {}, fetcher);
  const entries = (t.tree as any[]).filter(e => e.type === 'blob' && e.mode !== '120000' && e.mode !== '160000');
  let skipped = 0;
  const wanted: { path: string; sha: string; size: number }[] = [];
  for (const e of entries) {
    const path = normalizePath(e.path);
    if (!path || IGNORED_DIRS.test(path) || (e.size ?? 0) > MAX_BLOB_BYTES) { skipped++; continue; }
    if (wanted.length >= MAX_WS_FILES) { skipped++; continue; }
    wanted.push({ path, sha: String(e.sha), size: Number(e.size ?? 0) });
  }
  let done = 0;
  let textChars = 0;
  const now = Date.now();
  const got = await pool(wanted, CONCURRENCY, async w => {
    const b = await gh(token, `${r}/git/blobs/${enc(w.sha)}`, {}, fetcher);
    onProgress?.(++done, wanted.length);
    const bytes = b64ToBytes(String(b.content ?? ''));
    if (!isBinaryPath(w.path) && looksLikeText(bytes)) {
      const content = new TextDecoder().decode(bytes);
      if (content.length > MAX_FILE_CHARS) return null;
      return { path: w.path, content, encoding: 'utf8' as const, size: content.length, updatedAt: now, sha: w.sha };
    }
    return { path: w.path, content: bytesToB64(bytes), encoding: 'base64' as const, size: bytes.length, updatedAt: now, sha: w.sha };
  });
  const files: WsFile[] = [];
  const shas: Record<string, string> = {};
  for (const g of got) {
    if (!g) { skipped++; continue; }
    if (g.encoding === 'utf8') {
      if (textChars + g.content.length > MAX_WS_TEXT_CHARS) { skipped++; continue; }
      textChars += g.content.length;
    }
    const { sha, ...f } = g;
    files.push(f);
    shas[f.path] = sha;
  }
  return { files, skipped, truncated: !!t.truncated, link: { owner, repo, base, branch: base, commit, tree, shas } };
}

export interface WorkspaceDiff { changed: WsFile[]; added: WsFile[]; deleted: string[] }

export async function diffWorkspace(files: WsFile[], link: GitLink): Promise<WorkspaceDiff> {
  const changed: WsFile[] = [];
  const added: WsFile[] = [];
  const present = new Set<string>();
  for (const f of files) {
    present.add(f.path);
    const sha = await gitBlobSha(fileBytes(f));
    const was = link.shas[f.path];
    if (!was) added.push(f);
    else if (was !== sha) changed.push(f);
  }
  const deleted = Object.keys(link.shas).filter(p => !present.has(p));
  return { changed, added, deleted };
}

export interface PushOptions { message: string; newBranch?: string; prTitle?: string; prBody?: string }

/** Commit the differences; open a pull request the first time. Returns the updated link. */
export async function pushWorkspace(token: string, files: WsFile[], link: GitLink, opts: PushOptions, fetcher?: typeof fetch): Promise<{ link: GitLink; prUrl?: string; commit: string }> {
  const diff = await diffWorkspace(files, link);
  const writes = [...diff.changed, ...diff.added];
  if (!writes.length && !diff.deleted.length) throw new GitHubError(0, 'NO_CHANGES');
  const r = repoPath(link);
  const blobs = await pool(writes, CONCURRENCY, async f => {
    const b = await gh(token, `${r}/git/blobs`, { method: 'POST', body: JSON.stringify(f.encoding === 'base64' ? { content: f.content, encoding: 'base64' } : { content: f.content, encoding: 'utf-8' }) }, fetcher);
    return { path: f.path, sha: String(b.sha) };
  });
  const tree = await gh(token, `${r}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: link.tree,
      tree: [
        ...blobs.map(b => ({ path: b.path, mode: '100644', type: 'blob', sha: b.sha })),
        ...diff.deleted.map(path => ({ path, mode: '100644', type: 'blob', sha: null })),
      ],
    }),
  }, fetcher);
  const commit = await gh(token, `${r}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message: opts.message.slice(0, 5_000), tree: tree.sha, parents: [link.commit] }),
  }, fetcher);

  const shas = { ...link.shas };
  for (const b of blobs) shas[b.path] = b.sha;
  for (const p of diff.deleted) delete shas[p];

  if (link.pr && link.branch !== link.base) {
    // Fast-forward the pull request's branch.
    await gh(token, `${r}/git/refs/heads/${link.branch.split('/').map(enc).join('/')}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) }, fetcher);
    return { link: { ...link, commit: String(commit.sha), tree: String(tree.sha), shas }, prUrl: link.pr.url, commit: String(commit.sha) };
  }
  const branch = opts.newBranch?.trim() || `studio/${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}`;
  if (!isValidBranch(branch)) throw new GitHubError(422, 'INVALID_BRANCH');
  await gh(token, `${r}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }) }, fetcher);
  const pr = await gh(token, `${r}/pulls`, {
    method: 'POST',
    body: JSON.stringify({ title: (opts.prTitle || opts.message).slice(0, 250), head: branch, base: link.base, body: (opts.prBody ?? '').slice(0, 60_000) }),
  }, fetcher);
  const url = String(pr.html_url);
  return {
    link: { ...link, branch, commit: String(commit.sha), tree: String(tree.sha), shas, pr: { number: Number(pr.number), url } },
    prUrl: url,
    commit: String(commit.sha),
  };
}
