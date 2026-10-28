import { describe, expect, it } from 'vitest';
import { BUILTIN_COMMANDS, expandTemplate, matchCommands, modelFromArg, parseCommand, splitCommand } from '@/lib/studio/commands';
import { diffWorkspace, gitBlobSha, importRepo, isValidBranch, parseRepo, pushWorkspace, type GitLink } from '@/lib/studio/github';
import { fileAfterChange, inlineWorkspaceAssets, projectMemoryFile, resolveRelative } from '@/lib/studio/ws-client';
import { dropBeforeCompaction, unansweredToolUses } from '@/lib/studio/history';
import { STRINGS } from '@/lib/studio/i18n';
import type { WsFile } from '@/lib/studio/fs';

const file = (path: string, content: string, encoding: 'utf8' | 'base64' = 'utf8'): WsFile => ({ path, content, encoding, size: content.length, updatedAt: 0 });

describe('slash commands', () => {
  const custom = [{ name: 'test', description: 'Run tests', template: 'Write tests for $ARGUMENTS and run them.' }, { name: 'help', description: 'shadow', template: 'x' }];
  it('parses built-ins, custom commands and unknown ones', () => {
    expect(splitCommand('/compact  keep the API notes ')).toEqual({ name: 'compact', args: 'keep the API notes' });
    expect(splitCommand('not a command')).toBeNull();
    expect(parseCommand('/plan', custom)).toEqual({ kind: 'builtin', id: 'plan', args: '' });
    // A custom command cannot shadow a built-in.
    expect(parseCommand('/help', custom)).toMatchObject({ kind: 'builtin', id: 'help' });
    expect(parseCommand('/test the parser', custom)).toMatchObject({ kind: 'custom', prompt: 'Write tests for the parser and run them.' });
    expect(parseCommand('/nope', custom)).toEqual({ kind: 'unknown', name: 'nope' });
    expect(expandTemplate('Review the code', 'carefully')).toBe('Review the code\n\ncarefully');
    expect(modelFromArg('Opus')).toBe('claude-opus-5-5');
    expect(modelFromArg('gpt')).toBeNull();
  });
  it('suggests commands as you type', () => {
    expect(matchCommands('/', custom).length).toBe(BUILTIN_COMMANDS.length + 1);
    expect(matchCommands('/te', custom).map(c => c.name)).toEqual(['test']);
    expect(matchCommands('/plan now', custom)).toEqual([]);
  });
  it('has a description for every built-in in both languages', () => {
    for (const lang of ['en', 'es'] as const) {
      for (const c of BUILTIN_COMMANDS) expect((STRINGS[lang] as any)[`cmd_${c.id}`], `${lang} cmd_${c.id}`).toBeTruthy();
    }
  });
});

describe('workspace changes on the device', () => {
  it('applies streamed changes, copying moved binaries from the device', () => {
    const files = new Map([['img/a.png', file('img/a.png', 'iVBORw0KGgo=', 'base64')]]);
    expect(fileAfterChange(files, { path: 'x.ts', content: 'hi', previous: null, op: 'create' })).toMatchObject({ path: 'x.ts', content: 'hi', encoding: 'utf8' });
    expect(fileAfterChange(files, { path: 'x.ts', content: null, previous: 'hi', op: 'delete' })).toBeNull();
    const moved = fileAfterChange(files, { path: 'img/b.png', content: '', previous: null, op: 'create', encoding: 'base64', from: 'img/a.png' });
    expect(moved).toMatchObject({ path: 'img/b.png', content: 'iVBORw0KGgo=', encoding: 'base64' });
  });

  it('inlines local assets for the page preview', () => {
    const files = new Map([
      ['site/index.html', file('site/index.html', '')],
      ['site/style.css', file('site/style.css', 'body{color:red}')],
      ['site/js/app.js', file('site/js/app.js', 'console.log("</script>")')],
      ['site/img/logo.png', file('site/img/logo.png', 'AAAA', 'base64')],
    ]);
    const html = '<link rel="stylesheet" href="style.css"><script src="./js/app.js"></script><img src="img/logo.png"><img src="https://example.com/x.png">';
    const out = inlineWorkspaceAssets(html, 'site/index.html', files);
    expect(out).toContain('<style>body{color:red}</style>');
    expect(out).toContain('console.log("<\\/script>")');
    expect(out).toContain('src="data:image/png;base64,AAAA"');
    expect(out).toContain('https://example.com/x.png');
    expect(resolveRelative('a/b/c.html', '../d.css')).toBe('a/d.css');
    expect(resolveRelative('a/b.html', '../../../etc/passwd')).toBe('etc/passwd');
    expect(resolveRelative('a.html', 'javascript:alert(1)')).toBeNull();
  });

  it('finds the project memory file', () => {
    expect(projectMemoryFile([file('CLAUDE.md', 'c'), file('src/STUDIO.md', 'x')])?.path).toBe('CLAUDE.md');
    expect(projectMemoryFile([file('CLAUDE.md', 'c'), file('STUDIO.md', 's')])?.path).toBe('STUDIO.md');
    expect(projectMemoryFile([file('a.ts', '')])).toBeNull();
  });

  it('keeps the history valid after compaction and with waiting calls', () => {
    const h: any[] = [
      { role: 'user', content: 'a'.repeat(1000) },
      { role: 'assistant', content: [{ type: 'text', text: 'old' }] },
      { role: 'user', content: 'more' },
      { role: 'assistant', content: [{ type: 'compaction', content: 'summary' }, { type: 'text', text: 'ok' }] },
      { role: 'user', content: 'next' },
      { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'edit_file', input: {} }] },
    ];
    const d = dropBeforeCompaction(h);
    expect(d[0].role).toBe('user');
    expect(d[1].content[0].type).toBe('compaction');
    expect(d).toHaveLength(4);
    expect(dropBeforeCompaction(d)).toBe(d);
    expect(unansweredToolUses(h)).toEqual(['t1']);
    expect(unansweredToolUses(h.slice(0, 5))).toEqual([]);
  });
});

/** A fake api.github.com that keeps a tiny repository in memory. */
function fakeGitHub() {
  const blobs = new Map<string, string>();
  const calls: { method: string; path: string; body?: any; auth?: string }[] = [];
  const b64 = (s: string) => Buffer.from(s).toString('base64');
  const seed = async (path: string, content: string) => {
    const sha = await gitBlobSha(new TextEncoder().encode(content));
    blobs.set(sha, b64(content));
    return { path, sha, size: content.length, type: 'blob', mode: '100644' };
  };
  let tree: any[] = [];
  const ready = (async () => { tree = [await seed('README.md', '# Hi\n'), await seed('src/a.ts', 'export const a = 1;\n'), await seed('node_modules/x.js', 'nope')]; })();
  const fetcher = (async (url: string, init: any = {}) => {
    await ready;
    const u = new URL(url);
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path: u.pathname + u.search, body, auth: init.headers?.Authorization });
    const ok = (j: any, status = 200) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } });
    const p = u.pathname;
    if (p === '/repos/acme/app') return ok({ default_branch: 'main' });
    if (p === '/repos/acme/app/branches/main') return ok({ commit: { sha: 'c0', commit: { tree: { sha: 't0' } } } });
    if (p === '/repos/acme/app/git/trees/t0') return ok({ tree, truncated: false });
    if (p.startsWith('/repos/acme/app/git/blobs/') && method === 'GET') return ok({ content: blobs.get(p.split('/').pop()!) });
    if (p === '/repos/acme/app/git/blobs' && method === 'POST') return ok({ sha: `b${calls.length}` });
    if (p === '/repos/acme/app/git/trees' && method === 'POST') return ok({ sha: 't1' });
    if (p === '/repos/acme/app/git/commits') return ok({ sha: 'c1' });
    if (p === '/repos/acme/app/git/refs') return ok({ ref: body.ref }, 201);
    if (p.startsWith('/repos/acme/app/git/refs/heads/') && method === 'PATCH') return ok({});
    if (p === '/repos/acme/app/pulls') return ok({ number: 7, html_url: 'https://github.com/acme/app/pull/7' }, 201);
    return ok({ message: 'Not Found' }, 404);
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

describe('GitHub', () => {
  it('parses repositories and branch names safely', () => {
    expect(parseRepo('acme/app')).toEqual({ owner: 'acme', repo: 'app' });
    expect(parseRepo('https://github.com/acme/app.git')).toEqual({ owner: 'acme', repo: 'app' });
    expect(parseRepo('https://github.com/acme/app/tree/feature/x')).toEqual({ owner: 'acme', repo: 'app', branch: 'feature/x' });
    expect(parseRepo('https://evil.com/acme/app')).toBeNull();
    expect(parseRepo('../../etc')).toBeNull();
    expect(isValidBranch('studio/fix-1')).toBe(true);
    expect(isValidBranch('a..b')).toBe(false);
    expect(isValidBranch('bad name')).toBe(false);
    expect(isValidBranch('x.lock')).toBe(false);
  });

  it('computes git blob ids like git does', async () => {
    // git hash-object of "hello\n"
    expect(await gitBlobSha(new TextEncoder().encode('hello\n'))).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
  });

  it('imports a branch, then pushes only the changes as a pull request', async () => {
    const gh = fakeGitHub();
    const r = await importRepo('tok', 'acme', 'app', undefined, undefined, gh.fetcher);
    expect(r.files.map(f => f.path).sort()).toEqual(['README.md', 'src/a.ts']);
    expect(r.skipped).toBe(1);
    expect(gh.calls.every(c => c.auth === 'Bearer tok')).toBe(true);

    const files = [file('README.md', '# Hi\n'), file('src/a.ts', 'export const a = 2;\n'), file('src/b.ts', 'new')];
    const diff = await diffWorkspace(files, r.link);
    expect(diff.changed.map(f => f.path)).toEqual(['src/a.ts']);
    expect(diff.added.map(f => f.path)).toEqual(['src/b.ts']);
    expect(diff.deleted).toEqual([]);

    const pushed = await pushWorkspace('tok', files.filter(f => f.path !== 'README.md'), r.link, { message: 'Fix a', newBranch: 'studio/fix-a' }, gh.fetcher);
    expect(pushed.prUrl).toBe('https://github.com/acme/app/pull/7');
    const treeCall = gh.calls.find(c => c.method === 'POST' && c.path === '/repos/acme/app/git/trees')!;
    expect(treeCall.body.base_tree).toBe('t0');
    expect(treeCall.body.tree.find((e: any) => e.path === 'README.md')).toMatchObject({ sha: null });
    expect(gh.calls.find(c => c.path === '/repos/acme/app/git/commits')!.body.parents).toEqual(['c0']);
    expect(gh.calls.find(c => c.path === '/repos/acme/app/pulls')!.body).toMatchObject({ head: 'studio/fix-a', base: 'main' });
    const link: GitLink = pushed.link;
    expect(link).toMatchObject({ branch: 'studio/fix-a', base: 'main', commit: 'c1', pr: { number: 7 } });
    expect(link.shas['README.md']).toBeUndefined();

    // A second push adds a commit to the same pull request's branch.
    const again = await pushWorkspace('tok', [file('src/a.ts', 'export const a = 3;\n')], link, { message: 'More' }, gh.fetcher);
    expect(gh.calls.some(c => c.method === 'PATCH' && c.path === '/repos/acme/app/git/refs/heads/studio/fix-a')).toBe(true);
    expect(again.link.pr?.number).toBe(7);
    await expect(pushWorkspace('tok', [], { ...again.link, shas: {} }, { message: 'x' }, gh.fetcher)).rejects.toThrow('NO_CHANGES');
  });
});
