import { vi } from 'vitest';

// metering.ts imports Prisma and Redis; the pure helpers under test need neither.
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/redis/client', () => ({ redisClient: {}, safeRedisGet: vi.fn(async () => null), safeRedisSet: vi.fn(async () => 'OK') }));

import { applyArtifactCommand, fileNameFor, normalizeArtifactId, sandboxDocument, toSnapshot, type Artifact, type ArtifactSnapshot } from '@/lib/studio/artifacts';
import { affordableOutputTokens, estimateCostUsd, isStudioModel, planAllowsModel, STUDIO_PLANS } from '@/lib/studio/models';
import { planForTier, tierFromCache, usageKeys } from '@/lib/studio/metering';
import { estimateInputTokens, sanitizeMessages } from '@/lib/studio/sanitize';
import { cleanTitle } from '@/lib/studio/prompt';
import { appendUserTurn, attachmentBlock, attachmentKind, compactHistory, plainText, trimHistory } from '@/lib/studio/history';
import { fold, searchStudio } from '@/lib/studio/search';
import { chatRequestSchema, createEventParser, encodeEvent, type StudioEvent } from '@/lib/studio/protocol';
import { buildSystemPrompt, STUDIO_IDENTITY } from '@/lib/studio/prompt';
import { AgentError, buildTools, describeApiError, markCacheBreakpoint, MCP_BETA, runAgent, sanitizeConnectors } from '@/lib/studio/agent';
import { skillsById, BUILTIN_SKILLS } from '@/lib/studio/skills';
import { parseCsv } from '@/lib/studio/csv';
import { resolveUiLang, STRINGS } from '@/lib/studio/i18n';

const map = (...a: ArtifactSnapshot[]) => new Map(a.map(x => [x.id, x]));
const page: ArtifactSnapshot = { id: 'landing', title: 'Landing', type: 'html', content: '<h1>Hello</h1><p>One</p>' };

describe('artifacts', () => {
  it('creates, then updates exactly one unique occurrence', () => {
    const c = applyArtifactCommand(new Map(), { command: 'create', id: 'My Page!', type: 'html', title: 'Page', content: '<p>a</p><p>b</p>' });
    expect(c.ok && c.created && c.artifact.id).toBe('my-page');
    const u = applyArtifactCommand(map(page), { command: 'update', id: 'landing', old_str: 'One', new_str: 'Two' });
    expect(u.ok && u.artifact.content).toBe('<h1>Hello</h1><p>Two</p>');
  });

  it('refuses ambiguous, missing and empty edits', () => {
    const twice: ArtifactSnapshot = { ...page, content: 'x x' };
    expect(applyArtifactCommand(map(twice), { command: 'update', id: 'landing', old_str: 'x', new_str: 'y' })).toMatchObject({ ok: false });
    expect(applyArtifactCommand(map(page), { command: 'update', id: 'landing', old_str: 'nope', new_str: 'y' })).toMatchObject({ ok: false });
    expect(applyArtifactCommand(map(page), { command: 'update', id: 'landing', old_str: '', new_str: 'y' })).toMatchObject({ ok: false });
    expect(applyArtifactCommand(new Map(), { command: 'update', id: 'ghost', old_str: 'a', new_str: 'b' })).toMatchObject({ ok: false });
    expect(applyArtifactCommand(new Map(), { command: 'rewrite', id: 'ghost', content: 'a' })).toMatchObject({ ok: false });
    expect(applyArtifactCommand(new Map(), { command: 'create', id: '', content: 'a' })).toMatchObject({ ok: false });
    expect(applyArtifactCommand(new Map(), { command: 'create', id: 'big', content: 'a'.repeat(400_001) })).toMatchObject({ ok: false });
  });

  it('rewrites and keeps the title unless a new one is given', () => {
    const r = applyArtifactCommand(map(page), { command: 'rewrite', id: 'landing', content: '<p>new</p>' });
    expect(r.ok && r.artifact).toMatchObject({ title: 'Landing', content: '<p>new</p>' });
  });

  it('unknown types fall back to code', () => {
    const c = applyArtifactCommand(new Map(), { command: 'create', id: 'x', type: 'exe' as any, content: 'a' });
    expect(c.ok && c.artifact.type).toBe('code');
  });

  it('names files by type and language', () => {
    expect(fileNameFor({ id: 'escrow', type: 'code', language: 'solidity' })).toBe('escrow.sol');
    expect(fileNameFor({ id: 'notes', type: 'markdown' })).toBe('notes.md');
    expect(fileNameFor({ id: 'x', type: 'code', language: 'klingon' })).toBe('x.txt');
    expect(normalizeArtifactId('  Hello World__2 ')).toBe('hello-world__2');
  });

  it('wraps previews in a CSP that blocks the network', () => {
    const frag = sandboxDocument({ type: 'html', content: '<p>hi</p>' });
    expect(frag).toContain("default-src 'none'");
    expect(frag).toContain("form-action 'none'");
    const full = sandboxDocument({ type: 'html', content: '<html><head><title>t</title></head><body>x</body></html>' });
    expect(full.indexOf('Content-Security-Policy')).toBeLessThan(full.indexOf('<title>'));
    const noHead = sandboxDocument({ type: 'html', content: '<html lang="en"><body>x</body></html>' });
    expect(noHead).toMatch(/<html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy"/);
    const header = sandboxDocument({ type: 'html', content: '<html><body><header>h</header></body></html>' });
    expect(header.indexOf('Content-Security-Policy')).toBeLessThan(header.indexOf('<body>'));
    expect(sandboxDocument({ type: 'svg', content: '<svg/>' })).toContain('<svg/>');
    const refresh = sandboxDocument({ type: 'html', content: '<html><head><META HTTP-EQUIV="Refresh" content="0;url=https://evil.example/?d=x"></head><body>x</body></html>' });
    expect(refresh).not.toMatch(/refresh/i);
  });

  it('snapshots the latest version', () => {
    const a: Artifact = { id: 'a', title: 'A', type: 'code', conversationId: 'c', versions: [{ content: '1', createdAt: 1, by: 'studio' }, { content: '2', createdAt: 2, by: 'user' }], createdAt: 1, updatedAt: 2 };
    expect(toSnapshot(a).content).toBe('2');
  });
});

describe('models and plans', () => {
  it('estimates cost with cache multipliers and searches', () => {
    const usd = estimateCostUsd('claude-sonnet-5-5', { input_tokens: 1_000_000, output_tokens: 100_000, cache_creation_input_tokens: 1_000_000, cache_read_input_tokens: 1_000_000, server_tool_use: { web_search_requests: 3 } });
    // Sonnet 5.5 list prices: 2 (input) + 1 (output) + 2.5 (5m write) + 0.10 (read) + 0.03 (searches)
    expect(usd).toBeCloseTo(5.63, 6);
    expect(estimateCostUsd('nope' as any, { input_tokens: 5 })).toBe(0);
  });

  it('prices Haiku prompts over 100K tokens at the higher tier', () => {
    expect(estimateCostUsd('claude-haiku-5-5', { input_tokens: 100_000, output_tokens: 1_000_000 })).toBeCloseTo(0.01 + 0.5, 6);
    // 60K new + 50K cached = 110K prompt tokens: the whole request uses the long-prompt prices.
    expect(estimateCostUsd('claude-haiku-5-5', { input_tokens: 60_000, cache_read_input_tokens: 50_000, output_tokens: 1_000 })).toBeCloseTo((60_000 * 0.5 + 50_000 * 0.05 + 1_000 * 2.5) / 1e6, 6);
  });

  it('works out how much output the budget pays for', () => {
    expect(affordableOutputTokens('claude-sonnet-5-5', 0.1)).toBe(10_000);
    expect(affordableOutputTokens('claude-sonnet-5-5', 0)).toBe(0);
    expect(affordableOutputTokens('claude-haiku-5-5', 0.025)).toBe(10_000); // long-prompt price, to be safe
  });

  it('gates Opus to Pro', () => {
    expect(planAllowsModel('free', 'claude-opus-5-5')).toBe(false);
    expect(planAllowsModel('pro', 'claude-opus-5-5')).toBe(true);
    expect(planAllowsModel('free', 'claude-haiku-5-5')).toBe(true);
    expect(isStudioModel('claude-sonnet-5-5')).toBe(true);
    expect(isStudioModel('gpt-4')).toBe(false);
    expect(isStudioModel('toString')).toBe(false);
  });

  it('maps tiers to plans', () => {
    expect(planForTier('STUDIO_PRO')).toBe('pro');
    expect(planForTier('enterprise')).toBe('pro');
    expect(planForTier('FREE')).toBe('free');
    expect(planForTier(null, true)).toBe('pro');
    expect(planForTier(undefined)).toBe('free');
  });

  it('reads the tier cache in both formats other services write', () => {
    expect(tierFromCache('PRO')).toBe('PRO');
    expect(tierFromCache('{"tier":"STUDIO_PRO","kycStatus":"UNVERIFIED"}')).toBe('STUDIO_PRO');
    expect(tierFromCache('{broken')).toBeNull();
    expect(tierFromCache('TIMEOUT')).toBeNull();
    expect(tierFromCache(null)).toBeNull();
  });

  it('builds UTC day and month keys per wallet', () => {
    const k = usageKeys('0xABC', new Date('2026-10-27T23:59:00Z'));
    expect(k.day).toBe('studio:usage:0xabc:d:2026-10-27');
    expect(k.month).toBe('studio:usage:0xabc:m:2026-10');
  });
});

describe('history', () => {
  it('classifies attachments', () => {
    expect(attachmentKind('a.png', 'image/png')).toBe('image');
    expect(attachmentKind('a.pdf', '')).toBe('pdf');
    expect(attachmentKind('Escrow.sol', '')).toBe('text');
    expect(attachmentKind('Dockerfile', '')).toBe('text');
    expect(attachmentKind('a.exe', 'application/octet-stream')).toBe('unsupported');
    expect(attachmentKind('a.heic', 'image/heic')).toBe('unsupported');
  });

  it('builds blocks and escapes file names', () => {
    expect(attachmentBlock('image', 'a.png', 'image/png', 'AAA')).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAA' } });
    expect(attachmentBlock('pdf', 'r.pdf', 'application/pdf', 'BBB').type).toBe('document');
    expect(attachmentBlock('text', 'x"y.ts', 'text/plain', 'code').text).toContain(`<file name="x'y.ts">`);
  });

  it('merges a new user turn into a trailing tool_result turn', () => {
    const h = [{ role: 'user' as const, content: 'hi' }, { role: 'assistant' as const, content: [{ type: 'text', text: 'ok' }] }, { role: 'user' as const, content: [{ type: 'tool_result', tool_use_id: 't', content: 'done' }] }];
    const out = appendUserTurn(h, [{ type: 'text', text: 'next' }]);
    expect(out).toHaveLength(3);
    expect(out[2].content).toHaveLength(2);
    expect(appendUserTurn(h.slice(0, 2), [{ type: 'text', text: 'n' }])).toHaveLength(3);
  });

  it('drops old images and PDFs but keeps recent ones and text', () => {
    const img = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'X' } };
    const h: any[] = [];
    for (let i = 0; i < 5; i++) {
      h.push({ role: 'user', content: [img, { type: 'text', text: `q${i}` }] });
      h.push({ role: 'assistant', content: [{ type: 'text', text: `a${i}` }] });
    }
    const out = compactHistory(h, 3);
    expect(out[0].content[0].type).toBe('text');
    expect(out[2].content[0].type).toBe('text');
    expect(out[4].content[0].type).toBe('image');
    expect(out[8].content[0].type).toBe('image');
    expect(out[0].content[1].text).toBe('q0');
    expect(h[0].content[0].type).toBe('image'); // input untouched
  });

  it('trims long histories so they still start with a real user turn', () => {
    const h: any[] = [
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'artifact', input: {} }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'a1' }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't0', content: 'x' }, { type: 'text', text: 'q2' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'a2' }] },
      { role: 'user', content: 'q3' },
    ];
    expect(trimHistory(h, 10)).toBe(h);
    const t5 = trimHistory(h, 5); // would start at the tool_result turn: skips to q2 and drops its orphan result
    expect(t5[0]).toEqual({ role: 'user', content: [{ type: 'text', text: 'q2' }] });
    expect(t5).toHaveLength(3);
    expect(trimHistory(h, 1)).toEqual([{ role: 'user', content: 'q3' }]);
  });

  it('extracts plain text', () => {
    expect(plainText([{ type: 'text', text: 'a' }, { type: 'image' }, { type: 'text', text: 'b' }])).toBe('a\nb');
    expect(plainText('s')).toBe('s');
  });
});

describe('search', () => {
  const conv = (id: string, title: string, text: string, updatedAt = 1): any => ({ id, title, messages: [{ id: 'm', role: 'user', text, createdAt: 1 }], updatedAt });
  it('matches accents and case across chats, projects and artifacts', () => {
    expect(fold('Canción ÁRBOL')).toBe('cancion arbol');
    const hits = searchStudio('cancion', {
      conversations: [conv('c1', 'Mi canción', 'hola'), conv('c2', 'Otro', 'una CANCIÓN larga')],
      projects: [{ id: 'p', name: 'Canciones', description: '', instructions: '', skillIds: [], createdAt: 1, updatedAt: 1 }],
      artifacts: [{ id: 'lyrics', title: 'Letra', type: 'markdown', conversationId: 'c2', versions: [{ content: 'una canción', createdAt: 1, by: 'studio' }], createdAt: 1, updatedAt: 1 }],
    });
    expect(hits.map(h => h.kind).sort()).toEqual(['artifact', 'conversation', 'conversation', 'project']);
    expect(hits[0].score).toBeGreaterThanOrEqual(hits[hits.length - 1].score);
    expect(searchStudio('a', { conversations: [conv('c', 'a', 'a')], projects: [], artifacts: [] })).toEqual([]);
  });
});

describe('protocol', () => {
  it('parses NDJSON across chunk boundaries and ignores bad lines', () => {
    const got: StudioEvent[] = [];
    const p = createEventParser(e => got.push(e));
    const a = encodeEvent({ type: 'text', delta: 'Hola' });
    const b = encodeEvent({ type: 'done', stopReason: 'end_turn' });
    p.push(a.slice(0, 5));
    p.push(a.slice(5) + 'not json\n' + b.slice(0, 3));
    p.push(b.slice(3, -1));
    p.flush();
    expect(got).toEqual([{ type: 'text', delta: 'Hola' }, { type: 'done', stopReason: 'end_turn' }]);
  });

  it('validates requests', () => {
    const ok = chatRequestSchema.safeParse({ model: 'claude-sonnet-5-5', messages: [{ role: 'user', content: 'hi' }], connectors: [{ id: 'k', name: 'gh', url: 'https://mcp.example.com/mcp', enabled: true }] });
    expect(ok.success).toBe(true);
    expect(chatRequestSchema.safeParse({ model: 'x', messages: [] }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ model: 'x', messages: [{ role: 'system', content: 'x' }] }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ model: 'x', messages: [{ role: 'user', content: 'x' }], artifacts: [{ id: 'a', title: 't', type: 'exe', content: '' }] }).success).toBe(false);
  });
});

describe('system prompt', () => {
  it('caches the stable prefix and adds per-request context after it', () => {
    const blocks = buildSystemPrompt({ timezone: 'Europe/Madrid', personalization: { callMe: 'Ana', style: 'concise', responseLanguage: 'es', instructions: 'Use TypeScript.' }, skills: [{ id: 's', name: 'Review', instructions: 'Worst first.' }], artifacts: [{ id: 'a', title: 'A "x"', type: 'code', language: 'ts', content: 'let a' }] }, new Date('2026-10-27T10:00:00Z'));
    expect(blocks[0].text).toBe(STUDIO_IDENTITY);
    expect(blocks[0].cache_control).toEqual({ type: 'ephemeral' });
    const dyn = blocks[blocks.length - 1].text;
    expect(blocks[blocks.length - 1].cache_control).toBeUndefined();
    expect(dyn).toContain('Europe/Madrid');
    expect(dyn).toContain('Always answer in Spanish');
    expect(dyn).toContain('called Ana');
    expect(dyn).toContain('<skill name="Review">');
    expect(dyn).toContain('title="A &quot;x&quot;"');
    expect(dyn).toContain('<user_preferences>');
  });

  it('puts project knowledge in the cached block and rejects odd time zones', () => {
    const blocks = buildSystemPrompt({ timezone: '"><script>', project: { name: 'P<1>', instructions: 'Be brief', knowledge: [{ name: 'spec.md', text: 'SPEC' }] } });
    expect(blocks).toHaveLength(3);
    expect(blocks[1].cache_control).toEqual({ type: 'ephemeral' });
    expect(blocks[1].text).toContain('<project name="P&lt;1&gt;">');
    expect(blocks[1].text).toContain('SPEC');
    expect(blocks[2].text).toContain('(UTC)');
  });
});

describe('agent helpers', () => {
  const req = (over: any = {}) => chatRequestSchema.parse({ model: 'claude-sonnet-5-5', messages: [{ role: 'user', content: 'hi' }], ...over });

  it('keeps only enabled https connectors, unique names, capped by plan', () => {
    const r = req({ connectors: [
      { id: '1', name: 'GitHub', url: 'https://a.example.com/mcp', enabled: true },
      { id: '2', name: 'github', url: 'https://b.example.com/mcp', enabled: true, token: ' t ' },
      { id: '3', name: 'plain', url: 'http://c.example.com/mcp', enabled: true },
      { id: '4', name: 'off', url: 'https://d.example.com/mcp', enabled: false },
    ] });
    const pro = sanitizeConnectors(r, STUDIO_PLANS.pro);
    expect(pro.map(c => c.name)).toEqual(['github', 'github-x']);
    expect(pro[1].token).toBe('t');
    expect(sanitizeConnectors(r, STUDIO_PLANS.free)).toHaveLength(1);
  });

  it('builds tools from the toggles', () => {
    const all = buildTools(req(), STUDIO_PLANS.free, [{ name: 'gh' }]);
    expect(all.map(t => t.name ?? t.type)).toEqual(['artifact', 'web_search', 'web_fetch', 'mcp_toolset']);
    expect(all[1].max_uses).toBe(STUDIO_PLANS.free.maxWebSearchesPerRequest);
    const none = buildTools(req({ tools: { webSearch: false, webFetch: false } }), STUDIO_PLANS.free, []);
    expect(none.map(t => t.name)).toEqual(['artifact']);
  });

  it('marks the last user block for caching', () => {
    const m: any[] = [{ role: 'user', content: 'hello' }];
    markCacheBreakpoint(m);
    expect(m[0].content[0]).toEqual({ type: 'text', text: 'hello', cache_control: { type: 'ephemeral' } });
    const a: any[] = [{ role: 'assistant', content: [{ type: 'text', text: 'x' }] }];
    markCacheBreakpoint(a);
    expect(a[0].content[0].cache_control).toBeUndefined();
  });

  it('maps provider errors', () => {
    expect(describeApiError({ status: 401 }).code).toBe('PROVIDER_AUTH');
    expect(describeApiError({ status: 429 }).code).toBe('PROVIDER_BUSY');
    expect(describeApiError({ status: 529 }).code).toBe('PROVIDER_OVERLOADED');
    expect(describeApiError({ name: 'AbortError' }).code).toBe('ABORTED');
    expect(describeApiError({ status: 400, message: 'bad' })).toMatchObject({ code: 'BAD_REQUEST', status: 400 });
    // Operator billing/setup errors never reach users verbatim.
    const credit = describeApiError({ status: 400, message: '400 {"error":{"message":"Your credit balance is too low to access the Anthropic API."}}' });
    expect(credit).toMatchObject({ code: 'PROVIDER_SETUP', status: 503 });
    expect(credit.message).not.toMatch(/credit/i);
    expect(describeApiError({ status: 400, message: 'This API key is not scoped to a workspace' }).code).toBe('PROVIDER_SETUP');
    expect(describeApiError(new Error('x')).code).toBe('PROVIDER_ERROR');
  });
});

/** A fake SDK client that replays scripted responses through the stream API. */
function fakeClient(responses: any[]) {
  const calls: any[] = [];
  const client = {
    beta: {
      messages: {
        stream(params: any) {
          calls.push(JSON.parse(JSON.stringify(params)));
          const res = responses.shift();
          let handler: ((e: any) => void) | null = null;
          return {
            on(_name: string, fn: (e: any) => void) { handler = fn; return this; },
            async finalMessage() {
              if (res.started) handler?.({ type: 'message_start', message: { usage: res.started } });
              if (res.error) {
                for (const t of res.partialText ?? []) handler?.({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } });
                throw res.error;
              }
              res.content.forEach((b: any, index: number) => {
                handler?.({ type: 'content_block_start', index, content_block: b.type === 'text' ? { type: 'text', text: '' } : b });
                if (b.type === 'text') handler?.({ type: 'content_block_delta', index, delta: { type: 'text_delta', text: b.text } });
              });
              return res;
            },
          };
        },
      },
    },
  };
  return { client: client as any, calls };
}

describe('runAgent', () => {
  const base = { model: 'claude-sonnet-5-5', messages: [{ role: 'user', content: 'Build a page' }] };

  it('applies artifact tool calls, answers them and continues to the final answer', async () => {
    const { client, calls } = fakeClient([
      { content: [{ type: 'text', text: 'Creating it.' }, { type: 'tool_use', id: 'tu1', name: 'artifact', input: { command: 'create', id: 'page', type: 'html', title: 'Page', content: '<p>x</p>' } }], stop_reason: 'tool_use', usage: { input_tokens: 100, output_tokens: 50 } },
      { content: [{ type: 'text', text: 'Done.' }], stop_reason: 'end_turn', usage: { input_tokens: 120, output_tokens: 10, cache_read_input_tokens: 100 } },
    ]);
    const events: StudioEvent[] = [];
    const res = await runAgent({ client, req: chatRequestSchema.parse(base), model: 'claude-sonnet-5-5', plan: STUDIO_PLANS.free, emit: e => events.push(e) });

    expect(calls).toHaveLength(2);
    expect(calls[0].betas).toBeUndefined();
    expect(calls[1].messages.at(-1).content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'tu1' });
    const art = events.find(e => e.type === 'artifact') as any;
    expect(art.artifact).toMatchObject({ id: 'page', content: '<p>x</p>' });
    expect(events.filter(e => e.type === 'text').map((e: any) => e.delta).join('')).toBe('Creating it.Done.');
    const produced = (events.find(e => e.type === 'messages') as any).messages;
    expect(produced.map((m: any) => m.role)).toEqual(['assistant', 'user', 'assistant']);
    expect(res.usage.input_tokens).toBe(220);
    expect(res.stopReason).toBe('end_turn');
    expect(res.costUsd).toBeGreaterThan(0);
  });

  it('returns tool errors to the model instead of failing', async () => {
    const { client, calls } = fakeClient([
      { content: [{ type: 'tool_use', id: 'tu1', name: 'artifact', input: { command: 'update', id: 'ghost', old_str: 'a', new_str: 'b' } }], stop_reason: 'tool_use', usage: {} },
      { content: [{ type: 'text', text: 'Sorry.' }], stop_reason: 'end_turn', usage: {} },
    ]);
    await runAgent({ client, req: chatRequestSchema.parse(base), model: 'claude-sonnet-5-5', plan: STUDIO_PLANS.free, emit: () => {} });
    expect(calls[1].messages.at(-1).content[0]).toMatchObject({ type: 'tool_result', is_error: true });
  });

  it('sends a paused turn back unchanged and merges the continuation', async () => {
    const search = { type: 'server_tool_use', id: 'st1', name: 'web_search', input: { query: 'aztec v6' } };
    const { client, calls } = fakeClient([
      { content: [search], stop_reason: 'pause_turn', usage: { server_tool_use: { web_search_requests: 1 } } },
      { content: [{ type: 'text', text: 'Found it.' }], stop_reason: 'end_turn', usage: {} },
    ]);
    const events: StudioEvent[] = [];
    const res = await runAgent({ client, req: chatRequestSchema.parse(base), model: 'claude-sonnet-5-5', plan: STUDIO_PLANS.free, emit: e => events.push(e) });
    expect(calls[1].messages.at(-1)).toEqual({ role: 'assistant', content: [search] });
    const produced = (events.find(e => e.type === 'messages') as any).messages;
    expect(produced).toHaveLength(1);
    expect(produced[0].content).toHaveLength(2);
    expect(res.usage.webSearches).toBe(1);
    expect(events.some(e => e.type === 'tool' && (e as any).detail === 'aztec v6')).toBe(true);
  });

  it('enables the MCP beta only with connectors', async () => {
    const { client, calls } = fakeClient([{ content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', usage: {} }]);
    await runAgent({ client, req: chatRequestSchema.parse({ ...base, connectors: [{ id: '1', name: 'gh', url: 'https://mcp.example.com/mcp', token: 'secret', enabled: true }] }), model: 'claude-sonnet-5-5', plan: STUDIO_PLANS.free, emit: () => {} });
    expect(calls[0].betas).toEqual([MCP_BETA]);
    expect(calls[0].mcp_servers).toEqual([{ type: 'url', url: 'https://mcp.example.com/mcp', name: 'gh', authorization_token: 'secret' }]);
  });

  const artifactCall = (id: string) => ({ content: [{ type: 'tool_use', id, name: 'artifact', input: { command: 'create', id: `a-${id}`, type: 'code', content: 'x' } }], stop_reason: 'tool_use', usage: { input_tokens: 10_000, output_tokens: 10_000 } });

  it('stops when the budget is spent and says so', async () => {
    // Each call costs 0.02 + 0.10 = $0.12 on Sonnet; a $0.15 budget allows two.
    const { client, calls } = fakeClient([artifactCall('t1'), artifactCall('t2'), artifactCall('t3')]);
    const events: StudioEvent[] = [];
    const res = await runAgent({ client, req: chatRequestSchema.parse(base), model: 'claude-sonnet-5-5', plan: STUDIO_PLANS.free, emit: e => events.push(e), budgetUsd: 0.15 });
    expect(calls).toHaveLength(2);
    expect(res.stopReason).toBe('budget');
    expect(events.some(e => e.type === 'notice' && (e as any).code === 'BUDGET')).toBe(true);
    // The history still ends with the answered tool call, so the next turn is valid.
    const produced = (events.find(e => e.type === 'messages') as any).messages;
    expect(produced.at(-1).role).toBe('user');
    expect(produced.at(-1).content[0].type).toBe('tool_result');
  });

  it('caps max_tokens by the remaining budget, but never below the floor', async () => {
    const { client, calls } = fakeClient([{ content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', usage: {} }]);
    await runAgent({ client, req: chatRequestSchema.parse(base), model: 'claude-sonnet-5-5', plan: STUDIO_PLANS.free, emit: () => {}, budgetUsd: 0.1 });
    expect(calls[0].max_tokens).toBe(10_000);
    const tiny = fakeClient([{ content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', usage: {} }]);
    await runAgent({ client: tiny.client, req: chatRequestSchema.parse(base), model: 'claude-sonnet-5-5', plan: STUDIO_PLANS.free, emit: () => {}, budgetUsd: 0.001 });
    expect(tiny.calls[0].max_tokens).toBe(4_096);
    const rich = fakeClient([{ content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', usage: {} }]);
    await runAgent({ client: rich.client, req: chatRequestSchema.parse(base), model: 'claude-sonnet-5-5', plan: STUDIO_PLANS.pro, emit: () => {}, budgetUsd: 100 });
    expect(rich.calls[0].max_tokens).toBe(32_000);
  });

  it('does not start a call past the deadline', async () => {
    let t = 0;
    const { client, calls } = fakeClient([artifactCall('t1'), artifactCall('t2')]);
    const events: StudioEvent[] = [];
    const res = await runAgent({ client, req: chatRequestSchema.parse(base), model: 'claude-sonnet-5-5', plan: STUDIO_PLANS.pro, emit: e => events.push(e), deadlineAt: 100_000, now: () => (t += 60_000) });
    expect(calls).toHaveLength(1);
    expect(res.stopReason).toBe('time_limit');
    expect(events.some(e => e.type === 'notice' && (e as any).code === 'TIME_LIMIT')).toBe(true);
  });

  it('still reports what a stopped or failed call used', async () => {
    const abort = Object.assign(new Error('Request was aborted.'), { name: 'AbortError' });
    const { client } = fakeClient([{ started: { input_tokens: 50_000, cache_read_input_tokens: 0 }, partialText: ['x'.repeat(3_000)], error: abort }]);
    const err = await runAgent({ client, req: chatRequestSchema.parse(base), model: 'claude-sonnet-5-5', plan: STUDIO_PLANS.free, emit: () => {} }).catch(e => e);
    expect(err).toBeInstanceOf(AgentError);
    expect(err.partial.usage.input_tokens).toBe(50_000);
    expect(err.partial.usage.output_tokens).toBe(1_000);
    // 50K * $2/M + 1K * $10/M
    expect(err.partial.costUsd).toBeCloseTo(0.11, 6);
    expect(describeApiError(err).code).toBe('ABORTED');
  });

  it('answers a tool call that was cut off, so the next turn is accepted', async () => {
    const { client } = fakeClient([{ content: [{ type: 'text', text: 'Writing' }, { type: 'tool_use', id: 'tu9', name: 'artifact', input: {} }], stop_reason: 'max_tokens', usage: {} }]);
    const events: StudioEvent[] = [];
    await runAgent({ client, req: chatRequestSchema.parse(base), model: 'claude-sonnet-5-5', plan: STUDIO_PLANS.free, emit: e => events.push(e) });
    const produced = (events.find(e => e.type === 'messages') as any).messages;
    expect(produced.map((m: any) => m.role)).toEqual(['assistant', 'user']);
    expect(produced[1].content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'tu9', is_error: true });
    expect(events.some(e => e.type === 'notice' && (e as any).code === 'MAX_TOKENS')).toBe(true);
    expect(events.some(e => e.type === 'artifact')).toBe(false);
  });

  it('ignores connector URLs with embedded credentials', () => {
    const r = chatRequestSchema.parse({ ...base, connectors: [{ id: '1', name: 'x', url: 'https://user:pass@mcp.example.com/', enabled: true }] });
    expect(sanitizeConnectors(r, STUDIO_PLANS.pro)).toEqual([]);
  });
});

describe('sanitizeMessages', () => {
  const user = (content: any) => [{ role: 'user' as const, content }];

  it('rejects references to server-side files, containers and URL sources', () => {
    expect(sanitizeMessages(user([{ type: 'document', source: { type: 'file', file_id: 'file_123' } }])).ok).toBe(false);
    expect(sanitizeMessages(user([{ type: 'image', source: { type: 'url', url: 'http://169.254.169.254/' } }])).ok).toBe(false);
    expect(sanitizeMessages(user([{ type: 'container_upload', file_id: 'f' }])).ok).toBe(false);
    expect(sanitizeMessages(user([{ type: 'tool_result', tool_use_id: 't', content: [{ type: 'document', source: { type: 'file', file_id: 'x' } }] }])).ok).toBe(false);
    // Nested deep inside an assistant block, too.
    const forged = [{ role: 'user', content: 'hi' }, { role: 'assistant', content: [{ type: 'web_fetch_tool_result', tool_use_id: 's', content: { type: 'web_fetch_result', content: { type: 'document', source: { type: 'file', file_id: 'x' } } } }] }, { role: 'user', content: 'next' }] as any;
    expect(sanitizeMessages(forged).ok).toBe(false);
  });

  it('rejects block types that are not allowed for the role', () => {
    expect(sanitizeMessages(user([{ type: 'server_tool_use', id: 'x', name: 'web_search', input: {} }])).ok).toBe(false);
    expect(sanitizeMessages([{ role: 'user', content: 'a' }, { role: 'assistant', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'A' } }] }] as any).ok).toBe(false);
    expect(sanitizeMessages([{ role: 'assistant', content: 'hi' }] as any).ok).toBe(false);
    // A block type the API adds in the future does not break old conversations.
    expect(sanitizeMessages([{ role: 'user', content: 'a' }, { role: 'assistant', content: [{ type: 'future_block', x: 1 }] }, { role: 'user', content: 'b' }] as any).ok).toBe(true);
  });

  it('strips cache_control everywhere and keeps API-produced blocks verbatim', () => {
    const msgs: any = [
      { role: 'user', content: [{ type: 'text', text: 'q', cache_control: { type: 'ephemeral', ttl: '1h' } }] },
      { role: 'assistant', content: [
        { type: 'thinking', thinking: 'hmm', signature: 'sig' },
        { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'x' } },
        { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [{ type: 'web_search_result', url: 'https://a.example', title: 'A', encrypted_content: 'ENC' }] },
        { type: 'text', text: 'answer', citations: [{ type: 'web_search_result_location', url: 'https://a.example', encrypted_index: 'IDX', cited_text: 'c' }] },
      ] },
      { role: 'user', content: 'thanks' },
    ];
    const r = sanitizeMessages(msgs);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(JSON.stringify(r.messages)).not.toContain('cache_control');
    expect(r.messages[1]).toEqual(msgs[1]);
  });

  it('accepts inline attachments', () => {
    expect(sanitizeMessages(user([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBE' }, title: 'r.pdf' },
      { type: 'text', text: 'what is this' },
    ])).ok).toBe(true);
  });
});

describe('estimateInputTokens', () => {
  it('is pessimistic for text and counts media per item', () => {
    const base = estimateInputTokens({ messages: [{ role: 'user', content: 'x'.repeat(30_000) }] } as any);
    expect(base).toBeGreaterThanOrEqual(10_000);
    const withImage = estimateInputTokens({ messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'A'.repeat(4_000_000) } }] }] } as any);
    expect(withImage).toBeLessThan(10_000); // an image is ~1.6K tokens, not its byte size
    const withKnowledge = estimateInputTokens({ messages: [{ role: 'user', content: 'q' }], project: { name: 'p', knowledge: [{ name: 'k', text: 'y'.repeat(600_000) }] } } as any);
    expect(withKnowledge).toBeGreaterThan(STUDIO_PLANS.free.maxInputTokens);
  });
});

describe('cleanTitle', () => {
  it('keeps one plain line', () => {
    expect(cleanTitle('"**Escrow** en Solidity."')).toBe('Escrow en Solidity');
    expect(cleanTitle('Line one\nline two' + String.fromCharCode(0x2028) + 'three')).toBe('Line one line two three');
    expect(cleanTitle('x'.repeat(200))).toHaveLength(80);
  });
});

describe('workspace header', () => {
  it('is sent only for a valid workspace ID', async () => {
    const { studioWorkspaceHeaders } = await import('@/lib/studio/workspace');
    const prev = process.env.ANTHROPIC_WORKSPACE_ID;
    try {
      delete process.env.ANTHROPIC_WORKSPACE_ID;
      expect(studioWorkspaceHeaders()).toBeUndefined();
      process.env.ANTHROPIC_WORKSPACE_ID = ' wrkspc_01TestWorkspace0000000 ';
      expect(studioWorkspaceHeaders()).toEqual({ 'anthropic-workspace-id': 'wrkspc_01TestWorkspace0000000' });
      process.env.ANTHROPIC_WORKSPACE_ID = 'wrkspc_x\r\nX-Injected: 1';
      expect(studioWorkspaceHeaders()).toBeUndefined();
    } finally {
      if (prev === undefined) delete process.env.ANTHROPIC_WORKSPACE_ID; else process.env.ANTHROPIC_WORKSPACE_ID = prev;
    }
  });
});

describe('skills, csv and i18n', () => {
  it('built-ins win over custom skills with the same id', () => {
    const m = skillsById([{ id: BUILTIN_SKILLS[0].id, name: 'evil', description: '', instructions: 'x' }, { id: 'mine', name: 'Mine', description: '', instructions: 'y' }]);
    expect(m.get(BUILTIN_SKILLS[0].id)?.name).toBe(BUILTIN_SKILLS[0].name);
    expect(m.get('mine')?.name).toBe('Mine');
  });

  it('parses quoted CSV', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\n3,')).toEqual([['a', 'b'], ['x, y', 'say "hi"'], ['3', '']]);
  });

  it('has the same keys in Spanish and English', () => {
    expect(Object.keys(STRINGS.es).sort()).toEqual(Object.keys(STRINGS.en).sort());
    expect(resolveUiLang('es')).toBe('es');
    expect(resolveUiLang('en')).toBe('en');
  });
});
