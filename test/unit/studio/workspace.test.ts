import { vi } from 'vitest';
import {
  applyWsTool, diffLines, diffStats, globToRegExp, matchGlob, normalizePath, unifiedDiff, unsafeRegex, workspaceTree, type WsFile,
} from '@/lib/studio/fs';
import { exportZip, importZip } from '@/lib/studio/zip';
import { zipSync, strToU8 } from 'fflate';

const ws = (entries: Record<string, string>) =>
  new Map<string, WsFile>(Object.entries(entries).map(([path, content]) => [path, { path, content, encoding: 'utf8', size: content.length, updatedAt: 0 }]));

describe('workspace paths', () => {
  it('normalizes and refuses escapes', () => {
    expect(normalizePath('./src//a.ts')).toBe('src/a.ts');
    expect(normalizePath('src\\b.ts')).toBe('src/b.ts');
    expect(normalizePath('../etc/passwd')).toBeNull();
    expect(normalizePath('a/../../b')).toBeNull();
    expect(normalizePath('/abs/path')).toBe('abs/path'); // always relative to the workspace
    expect(normalizePath('C:/x')).toBeNull();
    expect(normalizePath('a\u0000b')).toBeNull();
    expect(normalizePath('')).toBeNull();
    expect(normalizePath(42)).toBeNull();
  });

  it('matches globs like Claude Code', () => {
    expect(matchGlob('src/a/b.ts', '**/*.ts')).toBe(true);
    expect(matchGlob('b.ts', '**/*.ts')).toBe(true);
    expect(matchGlob('src/b.tsx', '*.ts')).toBe(false);
    expect(matchGlob('src/deep/b.ts', '*.ts')).toBe(true); // no slash: matches the file name
    expect(matchGlob('src/b.ts', 'src/*.{ts,js}')).toBe(true);
    expect(matchGlob('src/x/b.ts', 'src/*.ts')).toBe(false);
    expect(globToRegExp('a?.md').test('ab.md')).toBe(true);
  });

  it('builds a compact tree', () => {
    const t = workspaceTree(['src/a.ts', 'src/lib/b.ts', 'README.md']);
    expect(t).toContain('README.md');
    expect(t).toContain('src/');
    expect(t).toContain('b.ts');
  });
});

describe('workspace tools', () => {
  it('reads with line numbers, offset and limit', () => {
    const files = ws({ 'a.txt': 'one\ntwo\nthree\nfour' });
    const r = applyWsTool(files, 'read_file', { path: 'a.txt', offset: 2, limit: 2 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text).toContain('2\ttwo');
      expect(r.text).toContain('3\tthree');
      expect(r.text).not.toContain('four');
    }
    expect(applyWsTool(files, 'read_file', { path: 'missing.txt' }).ok).toBe(false);
  });

  it('writes, edits (unique match), moves and deletes with change records', () => {
    const files = ws({ 'a.ts': 'let x = 1;\nlet y = 1;\n' });
    const w = applyWsTool(files, 'write_file', { path: 'src/new.ts', content: 'hi' });
    expect(w.ok && w.changes[0]).toMatchObject({ path: 'src/new.ts', content: 'hi', previous: null, op: 'create' });

    const ambiguous = applyWsTool(files, 'edit_file', { path: 'a.ts', old_string: '= 1', new_string: '= 2' });
    expect(ambiguous.ok).toBe(false);
    const all = applyWsTool(files, 'edit_file', { path: 'a.ts', old_string: '= 1', new_string: '= 2', replace_all: true });
    expect(all.ok).toBe(true);
    expect(files.get('a.ts')!.content).toBe('let x = 2;\nlet y = 2;\n');
    const missing = applyWsTool(files, 'edit_file', { path: 'a.ts', old_string: 'nope', new_string: 'x' });
    expect(missing.ok).toBe(false);

    const mv = applyWsTool(files, 'move_file', { from: 'src/new.ts', to: 'src/renamed.ts' });
    expect(mv.ok).toBe(true);
    expect(files.has('src/new.ts')).toBe(false);
    expect(files.get('src/renamed.ts')!.content).toBe('hi');

    const del = applyWsTool(files, 'delete_file', { path: 'src/renamed.ts' });
    expect(del.ok && del.changes[0]).toMatchObject({ path: 'src/renamed.ts', content: null, previous: 'hi', op: 'delete' });
    expect(files.has('src/renamed.ts')).toBe(false);
  });

  it('refuses unsafe paths in every tool', () => {
    const files = ws({});
    expect(applyWsTool(files, 'write_file', { path: '../x', content: 'a' }).ok).toBe(false);
    expect(applyWsTool(files, 'move_file', { from: 'a', to: '/etc/x' }).ok).toBe(false);
    expect(files.size).toBe(0);
  });

  it('lists and greps, and refuses catastrophic regexes', () => {
    const files = ws({ 'src/a.ts': 'const foo = 1;\nfoo();\n', 'src/b.md': 'no match', 'lib/c.ts': 'FOO' });
    const l = applyWsTool(files, 'list_files', { pattern: '**/*.ts' });
    expect(l.ok && l.text).toContain('src/a.ts');
    expect(l.ok && l.text).not.toContain('b.md');
    const g = applyWsTool(files, 'grep', { pattern: 'foo' });
    expect(g.ok && g.text).toContain('src/a.ts:1');
    expect(g.ok && g.text).toContain('src/a.ts:2');
    const gi = applyWsTool(files, 'grep', { pattern: 'foo', ignore_case: true, glob: 'lib/**' });
    expect(gi.ok && gi.text).toContain('lib/c.ts');
    expect(unsafeRegex('(a+)+$')).toBe(true);
    expect(unsafeRegex('foo.*bar')).toBe(false);
    expect(applyWsTool(files, 'grep', { pattern: '(a+)+$' }).ok).toBe(false);
  });
});

describe('diffs', () => {
  it('computes line diffs and stats', () => {
    const d = diffLines('a\nb\nc', 'a\nB\nc\nd');
    expect(d.filter(l => l.kind === '-').map(l => l.text)).toEqual(['b']);
    expect(d.filter(l => l.kind === '+').map(l => l.text)).toEqual(['B', 'd']);
    // A replaced line reads "-old" then "+new".
    expect(d.map(l => l.kind + l.text)).toEqual([' a', '-b', '+B', ' c', '+d']);
    expect(diffStats('a\nb', 'a\nc\nd')).toEqual({ added: 2, removed: 1 });
    expect(diffStats(null, 'x\ny')).toEqual({ added: 2, removed: 0 });
    const u = unifiedDiff('f.txt', 'a\nb', 'a\nc');
    expect(u).toContain('--- a/f.txt');
    expect(u).toContain('+++ b/f.txt');
    expect(u).toContain('-b');
    expect(u).toContain('+c');
  });
});

describe('zip import and export', () => {
  it('round-trips text files and strips a common root folder', () => {
    const data = zipSync({
      'project/src/a.ts': strToU8('export const a = 1;'),
      'project/README.md': strToU8('# Hi'),
      'project/node_modules/x/index.js': strToU8('ignored'),
      'project/img.png': new Uint8Array([137, 80, 78, 71, 0, 1, 2]),
    });
    const r = importZip(data);
    const paths = r.files.map(f => f.path).sort();
    expect(paths).toEqual(['README.md', 'img.png', 'src/a.ts']);
    expect(r.files.find(f => f.path === 'img.png')!.encoding).toBe('base64');

    const out = importZip(exportZip(r.files));
    expect(out.files.find(f => f.path === 'src/a.ts')!.content).toBe('export const a = 1;');
    const textOnly = importZip(exportZip(r.files, { textOnly: true }));
    expect(textOnly.files.some(f => f.path === 'img.png')).toBe(false);
  });

  it('skips paths that escape the workspace', () => {
    const data = zipSync({ '../evil.sh': strToU8('rm -rf /'), 'ok.txt': strToU8('fine') });
    const r = importZip(data);
    expect(r.files.map(f => f.path)).toEqual(['ok.txt']);
  });
});
