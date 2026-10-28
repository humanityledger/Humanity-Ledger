import { describe, expect, it } from 'vitest';
import {
  chatChanges, chatOriginal, mentionAtCaret, mentionBlocks, mentionedPaths, MAX_MENTIONS, rankPaths, searchWorkspace,
} from '@/lib/studio/ws-client';
import { conversationMarkdown, markdownFileName } from '@/lib/studio/export-md';
import { DEFAULT_DENY_RULES, DEFAULT_PREFS, type Conversation } from '@/lib/studio/store';
import { matchGlob } from '@/lib/studio/fs';
import { CODE_EN, CODE_ES } from '@/lib/studio/i18n-code';
import type { WsFile } from '@/lib/studio/fs';

const file = (path: string, content: string, encoding: 'utf8' | 'base64' = 'utf8'): WsFile => ({ path, content, encoding, size: content.length, updatedAt: 0 });

describe('@-mentions', () => {
  const paths = ['src/app.ts', 'src/lib/util.ts', 'README.md', 'docs/guide.md'];
  it('finds mentioned workspace files, ignoring e-mails, unknown paths and trailing punctuation', () => {
    expect(mentionedPaths('Fix @src/app.ts and look at @README.md.', paths)).toEqual(['src/app.ts', 'README.md']);
    expect(mentionedPaths('mail me at me@src/app.ts', paths)).toEqual([]);
    expect(mentionedPaths('@nope.ts (@docs/guide.md) @src/app.ts @src/app.ts', paths)).toEqual(['docs/guide.md', 'src/app.ts']);
  });

  it('caps how many files one prompt attaches', () => {
    const many = Array.from({ length: 20 }, (_, i) => `f${i}.ts`);
    expect(mentionedPaths(many.map(p => `@${p}`).join(' '), many)).toHaveLength(MAX_MENTIONS);
  });

  it('attaches contents within a budget and names binaries only', () => {
    const files = new Map([['a.ts', file('a.ts', 'x'.repeat(10))], ['b.ts', file('b.ts', 'y'.repeat(10))], ['logo.png', file('logo.png', 'AAAA', 'base64')]]);
    const blocks = mentionBlocks(files, ['a.ts', 'logo.png', 'b.ts', 'missing.ts'], 15);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].text).toBe(`<file path="a.ts">\n${'x'.repeat(10)}\n</file>`);
    expect(blocks[1].text).toContain('binary="true"');
    expect(blocks[2].text).toContain('y'.repeat(5));
    expect(blocks[2].text).toContain('truncated');
  });

  it('knows the fragment being typed at the caret', () => {
    expect(mentionAtCaret('look at @sr', 11)).toEqual({ start: 8, query: 'sr' });
    expect(mentionAtCaret('@', 1)).toEqual({ start: 0, query: '' });
    expect(mentionAtCaret('a@b', 3)).toBeNull();
    expect(mentionAtCaret('@src/app.ts done', 16)).toBeNull();
  });

  it('ranks file-name matches first', () => {
    expect(rankPaths(['docs/util-notes.md', 'src/lib/util.ts', 'src/app.ts'], 'util')).toEqual(['src/lib/util.ts', 'docs/util-notes.md']);
    expect(rankPaths(['a/b/c.ts', 'z.ts'], '')[0]).toBe('z.ts');
  });
});

describe('content search', () => {
  it('lists matching lines across text files, case-insensitive, with a cap', () => {
    const files = [file('a.ts', 'const Foo = 1;\nfoo();\nbar'), file('b.md', 'nothing'), file('c.bin', 'Zm9v', 'base64')];
    const r = searchWorkspace(files, 'FOO');
    expect(r.hits).toEqual([{ path: 'a.ts', line: 1, text: 'const Foo = 1;' }, { path: 'a.ts', line: 2, text: 'foo();' }]);
    expect(r.files).toBe(1);
    expect(searchWorkspace(files, 'foo', 1).truncated).toBe(true);
    expect(searchWorkspace(files, '').hits).toEqual([]);
  });
});

describe('what a chat changed', () => {
  const cps = [
    { before: { 'a.ts': { content: 'one\n', encoding: 'utf8' as const }, 'new.ts': null } },
    { before: { 'a.ts': { content: 'two\n', encoding: 'utf8' as const }, 'gone.ts': { content: 'bye', encoding: 'utf8' as const }, 'same.ts': { content: 's', encoding: 'utf8' as const } } },
  ];
  const now = new Map([['a.ts', file('a.ts', 'three\n')], ['new.ts', file('new.ts', 'hi')], ['same.ts', file('same.ts', 's')]]);
  it('compares each file with how it was before the chat first touched it', () => {
    expect(chatChanges(cps, now)).toEqual([
      { path: 'a.ts', op: 'update', added: 1, removed: 1 },
      { path: 'gone.ts', op: 'delete', added: 0, removed: 1 },
      { path: 'new.ts', op: 'create', added: 1, removed: 0 },
    ]);
    expect(chatOriginal(cps, 'a.ts')).toEqual({ content: 'one\n', encoding: 'utf8' });
    expect(chatOriginal(cps, 'new.ts')).toBeNull();
    expect(chatOriginal(cps, 'other.ts')).toBeUndefined();
  });
});

describe('Markdown export', () => {
  const conv: Conversation = {
    id: 'c1', projectId: null, title: 'Fix: the parser / bug', model: 'claude-sonnet-5-5', skillIds: [], createdAt: Date.UTC(2026, 9, 28), updatedAt: 0,
    totalCostUsd: 0, totalTokens: 0, apiMessages: [], mode: 'code',
    messages: [
      { id: 'u', role: 'user', text: 'Please fix it', createdAt: 0, attachments: [{ name: 'log.txt', mime: 'text/plain', size: 3 }] },
      { id: 'h', role: 'user', text: '', label: 'compact', createdAt: 0 },
      {
        id: 'a', role: 'assistant', text: 'Done. Use ```code``` blocks.', createdAt: 0,
        fileChanges: [{ path: 'src/p.ts', op: 'update', added: 3, removed: 1 }, { path: 'sub.ts', op: 'create', added: 1, removed: 0, parent: 't1' }],
        citations: [{ url: 'https://example.com/doc', title: 'Doc [v2]' }, { url: 'javascript:alert(1)', title: 'bad' }],
        error: { code: 'X', message: 'with ``` inside' },
      },
    ],
  };
  it('writes the conversation with changed files and safe links', () => {
    const md = conversationMarkdown(conv);
    expect(md.startsWith('# Fix: the parser / bug\n')).toBe(true);
    expect(md).toContain('2026-10-28 · Code · claude-sonnet-5-5');
    expect(md).toContain('## You\n\nPlease fix it');
    expect(md).toContain('📎 log.txt');
    expect(md).toContain('/compact');
    expect(md).toContain('- `src/p.ts` (update, +3 −1)');
    expect(md).not.toContain('sub.ts');
    expect(md).toContain('- [Doc v2](https://example.com/doc)');
    expect(md).not.toContain('javascript:');
    // The error fence is longer than the backticks inside it.
    expect(md).toContain('````text\nwith ``` inside\n````');
  });
  it('makes a safe file name', () => {
    expect(markdownFileName('Fix: the parser / bug')).toBe('Fix-the-parser-bug.md');
    expect(markdownFileName('///')).toBe('conversation.md');
  });
});

describe('defaults and strings', () => {
  it('keeps secrets out of reach by default', () => {
    expect(DEFAULT_PREFS.rules.deny).toEqual(DEFAULT_DENY_RULES);
    for (const p of ['.env', 'app/.env.local', 'certs/server.pem', 'deploy/prod.key', 'home/id_rsa.pub']) {
      expect(DEFAULT_DENY_RULES.some(r => matchGlob(p, r))).toBe(true);
    }
    expect(DEFAULT_DENY_RULES.some(r => matchGlob('src/env.ts', r))).toBe(false);
    expect(DEFAULT_PREFS.notify).toBe(false);
  });
  it('has every Code mode string in both languages', () => {
    expect(Object.keys(CODE_ES).sort()).toEqual(Object.keys(CODE_EN).sort());
    for (const v of Object.values(CODE_ES)) expect(String(v).trim()).not.toBe('');
  });
});
