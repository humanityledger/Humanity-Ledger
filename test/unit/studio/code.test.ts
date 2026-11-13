import { runAgent } from '@/lib/studio/agent';
import { chatRequestSchema, type StudioEvent } from '@/lib/studio/protocol';
import { STUDIO_PLANS } from '@/lib/studio/models';
import { estimateInputTokens, sanitizeMessages, sinceLastCompaction, validateTurnShape } from '@/lib/studio/sanitize';
import { ProviderError } from '@/lib/studio/groq';
import { fakeClient } from './fake-client';

const toolUse = (id: string, name: string, input: any) => ({ type: 'tool_use', id, name, input });
const callTools = (...blocks: any[]) => ({ content: blocks, stop_reason: 'tool_use' as const, usage: { input_tokens: 1_000, output_tokens: 100 } });
const endWith = (text: string) => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn' as const, usage: { input_tokens: 1_000, output_tokens: 50 } });

const codeReq = (extra: Record<string, unknown> = {}) => chatRequestSchema.parse({
  model: 'openai/gpt-oss-120b',
  mode: 'code',
  permission: 'ask',
  messages: [{ role: 'user', content: 'Fix the bug' }],
  workspace: { files: [{ path: 'src/a.ts', content: 'export const a = 1;\n' }, { path: 'README.md', content: '# Demo' }] },
  ...extra,
});

const run = (client: any, req: any, extra: Record<string, unknown> = {}) => {
  const events: StudioEvent[] = [];
  const p = runAgent({ client, req, model: 'openai/gpt-oss-120b', plan: STUDIO_PLANS.pro, emit: e => events.push(e), budgetUsd: 10, ...extra });
  return { events, p };
};
const produced = (events: StudioEvent[]) => (events.find(e => e.type === 'messages') as any).messages as any[];
const toolNames = (params: any) => params.tools.map((t: any) => t.name);

describe('Code mode tools and request', () => {
  it('offers workspace tools by permission and effort, and no artifact or server tools', async () => {
    const ask = fakeClient([endWith('ok')]);
    await run(ask.client, codeReq({ effort: 'high' })).p;
    const names = toolNames(ask.calls[0]);
    expect(names).toEqual(['read_file', 'list_files', 'grep', 'write_file', 'edit_file', 'delete_file', 'move_file', 'todo_write', 'ask_user', 'task'].filter(n => names.includes(n)));
    expect(names).toEqual(expect.arrayContaining(['read_file', 'list_files', 'grep', 'write_file', 'edit_file', 'delete_file', 'move_file', 'todo_write', 'ask_user', 'task']));
    for (const gone of ['artifact', 'propose_plan', 'web_search', 'web_fetch', 'code_execution', 'sync_sandbox']) expect(names).not.toContain(gone);
    expect(ask.calls[0].reasoning_effort).toBe('high');
    const system = ask.calls[0].system.map((b: any) => b.text).join('\n');
    expect(system).toMatch(/<workspace_files>[\s\S]*a\.ts[\s\S]*<\/workspace_files>/);
    expect(system).toContain('You cannot run code in Studio');
    expect(system).not.toMatch(/sync_sandbox|code_execution|Claude/);

    // An old client asking for the sandbox gets the same tools.
    const plan = fakeClient([endWith('ok')]);
    await run(plan.client, codeReq({ permission: 'plan', sandbox: { enabled: true } })).p;
    const planNames = toolNames(plan.calls[0]);
    expect(planNames).toContain('propose_plan');
    expect(planNames).not.toContain('write_file');
    expect(planNames).not.toContain('code_execution');
  });

  it('maps xhigh and max (saved before the migration) to high', async () => {
    const free = fakeClient([endWith('ok')]);
    await runAgent({ client: free.client, req: codeReq({ effort: 'max' }), model: 'openai/gpt-oss-120b', plan: STUDIO_PLANS.free, emit: () => {}, budgetUsd: 1 });
    expect(free.calls[0].reasoning_effort).toBe('high');
  });

  it('keeps chat mode unchanged', async () => {
    const chat = fakeClient([endWith('ok')]);
    await run(chat.client, chatRequestSchema.parse({ model: 'openai/gpt-oss-120b', messages: [{ role: 'user', content: 'hi' }] })).p;
    expect(toolNames(chat.calls[0])).toEqual(['artifact']);
  });
});

describe('Code mode permissions', () => {
  it('ask: stops for approval, then applies an approved change on resume', async () => {
    const edit = toolUse('t1', 'edit_file', { path: 'src/a.ts', old_string: '= 1', new_string: '= 2' });
    const first = fakeClient([callTools(edit)]);
    const a = run(first.client, codeReq());
    const r1 = await a.p;
    expect(r1.stopReason).toBe('approval');
    const approval = a.events.find(e => e.type === 'approval') as any;
    expect(approval.calls).toEqual([{ id: 't1', name: 'edit_file', input: edit.input }]);
    expect(a.events.some(e => e.type === 'file')).toBe(false);
    // No made-up tool_result: the turn is waiting for the user.
    const hist = produced(a.events);
    expect(hist).toHaveLength(1);
    expect(hist[0].role).toBe('assistant');

    const messages = [{ role: 'user', content: 'Fix the bug' }, ...hist];
    const resumeReq = codeReq({ messages, resume: { results: [{ tool_use_id: 't1', decision: 'allow' }] } });
    expect(validateTurnShape(resumeReq)).toBeNull();
    const second = fakeClient([endWith('Done.')]);
    const b = run(second.client, resumeReq);
    const r2 = await b.p;
    expect(r2.stopReason).toBe('end_turn');
    const file = b.events.find(e => e.type === 'file') as any;
    expect(file.change).toMatchObject({ path: 'src/a.ts', content: 'export const a = 2;\n', previous: 'export const a = 1;\n', op: 'update' });
    const sent = second.calls[0].messages.at(-1);
    expect(sent.role).toBe('user');
    expect(sent.content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 't1' });
    expect(sent.content[0].is_error).toBeUndefined();
    const hist2 = produced(b.events);
    expect(hist2.map((m: any) => m.role)).toEqual(['user', 'assistant']);
  });

  it('ask: a denied change is reported to the model with the feedback', async () => {
    const msgs = [{ role: 'user', content: 'go' }, { role: 'assistant', content: [toolUse('t9', 'write_file', { path: 'x.txt', content: 'y' })] }];
    const c = fakeClient([endWith('ok')]);
    const r = run(c.client, codeReq({ messages: msgs, resume: { results: [{ tool_use_id: 't9', decision: 'deny', text: 'use y.txt' }] } }));
    await r.p;
    const res = c.calls[0].messages.at(-1).content[0];
    expect(res.is_error).toBe(true);
    expect(res.content).toContain('did not approve');
    expect(res.content).toContain('use y.txt');
    expect(r.events.some(e => e.type === 'file')).toBe(false);
  });

  it('auto: applies changes at once and keeps going', async () => {
    const c = fakeClient([callTools(toolUse('w1', 'write_file', { path: 'src/new.ts', content: 'hi' })), endWith('Created.')]);
    const r = run(c.client, codeReq({ permission: 'auto' }));
    const res = await r.p;
    expect(res.stopReason).toBe('end_turn');
    expect((r.events.find(e => e.type === 'file') as any).change).toMatchObject({ path: 'src/new.ts', op: 'create' });
    expect(c.calls).toHaveLength(2);
  });

  it('plan: refuses edits, stops for the plan, continues when approved', async () => {
    const c = fakeClient([callTools(toolUse('p1', 'propose_plan', { plan: '1. Edit a.ts' }))]);
    const r = run(c.client, codeReq({ permission: 'plan' }));
    expect((await r.p).stopReason).toBe('plan');
    expect(r.events.find(e => e.type === 'plan')).toMatchObject({ id: 'p1', plan: '1. Edit a.ts' });

    const msgs = [{ role: 'user', content: 'Fix the bug' }, ...produced(r.events)];
    const c2 = fakeClient([endWith('ok')]);
    await run(c2.client, codeReq({ permission: 'auto', messages: msgs, resume: { results: [{ tool_use_id: 'p1', decision: 'allow' }] } })).p;
    expect(c2.calls[0].messages.at(-1).content[0].content).toContain('approved');

    // A write attempted while still in plan mode is refused, not applied.
    const c3 = fakeClient([callTools(toolUse('w', 'write_file', { path: 'a', content: 'b' })), endWith('ok')]);
    const r3 = run(c3.client, codeReq({ permission: 'plan' }));
    await r3.p;
    expect(r3.events.some(e => e.type === 'file')).toBe(false);
    expect(c3.calls[1].messages.at(-1).content[0].is_error).toBe(true);
  });

  it('ask_user: stops with the question and passes the answer back', async () => {
    const c = fakeClient([callTools(toolUse('q1', 'ask_user', { question: 'Tabs or spaces?', options: ['Tabs', 'Spaces', 7] }))]);
    const r = run(c.client, codeReq());
    expect((await r.p).stopReason).toBe('question');
    expect(r.events.find(e => e.type === 'question')).toMatchObject({ id: 'q1', question: 'Tabs or spaces?', options: ['Tabs', 'Spaces'] });
    const msgs = [{ role: 'user', content: 'Fix the bug' }, ...produced(r.events)];
    const c2 = fakeClient([endWith('ok')]);
    await run(c2.client, codeReq({ messages: msgs, resume: { results: [{ tool_use_id: 'q1', decision: 'answer', text: 'Spaces' }] } })).p;
    expect(c2.calls[0].messages.at(-1).content[0].content).toContain('Spaces');
  });

  it('todo_write emits a cleaned todo list', async () => {
    const c = fakeClient([callTools(toolUse('td', 'todo_write', { todos: [{ content: 'Read code', status: 'completed' }, { content: 'Fix', status: 'weird' }, { content: '' }] })), endWith('ok')]);
    const r = run(c.client, codeReq());
    await r.p;
    expect((r.events.find(e => e.type === 'todos') as any).todos).toEqual([
      { content: 'Read code', status: 'completed', activeForm: undefined },
      { content: 'Fix', status: 'pending', activeForm: undefined },
    ]);
  });
});

describe('Resuming is validated', () => {
  it('only answers the waiting calls', () => {
    const msgs = [{ role: 'user', content: 'go' }, { role: 'assistant', content: [toolUse('t1', 'write_file', {})] }];
    expect(validateTurnShape(codeReq({ messages: msgs, resume: { results: [{ tool_use_id: 'other', decision: 'allow' }] } }))).toMatch(/does not match/);
    expect(validateTurnShape(codeReq({ messages: msgs, resume: { results: [{ tool_use_id: 't1', decision: 'allow' }, { tool_use_id: 't1', decision: 'allow' }] } }))).toMatch(/twice/);
    expect(validateTurnShape(codeReq({ messages: msgs }))).toMatch(/last message/);
    const chat = chatRequestSchema.parse({ model: 'x', messages: msgs, resume: { results: [{ tool_use_id: 't1', decision: 'allow' }] } });
    expect(validateTurnShape(chat)).toMatch(/Code mode/);
  });
});

describe('Subagents', () => {
  it('explore runs on the small model, read-only, tagged with its parent, and reports back', async () => {
    const c = fakeClient([
      callTools(toolUse('s1', 'task', { description: 'Find usages', prompt: 'Find where a is used', subagent_type: 'explore' })),
      // inside the subagent
      (params: any) => {
        expect(params.model).toBe('openai/gpt-oss-20b');
        expect(toolNames(params)).not.toContain('write_file');
        expect(toolNames(params)).not.toContain('task');
        return callTools(toolUse('g1', 'grep', { pattern: 'a' }));
      },
      endWith('a is defined in src/a.ts:1'),
      // back in the main agent
      (params: any) => {
        const res = params.messages.at(-1).content[0];
        expect(res).toMatchObject({ type: 'tool_result', tool_use_id: 's1' });
        expect(res.content).toContain('src/a.ts:1');
        return endWith('Found it.');
      },
    ]);
    const r = run(c.client, codeReq());
    const res = await r.p;
    expect(res.stopReason).toBe('end_turn');
    const sub = r.events.filter(e => e.type === 'subagent') as any[];
    expect(sub.map(s => s.phase)).toEqual(['start', 'end']);
    expect(r.events.find(e => e.type === 'tool' && (e as any).name === 'grep')).toMatchObject({ parent: 's1' });
    // The subagent's own text and history stay private.
    expect(r.events.filter(e => e.type === 'messages')).toHaveLength(1);
    expect(r.events.filter(e => e.type === 'text').map((e: any) => e.delta).join('')).toBe('Found it.');
    expect(c.calls).toHaveLength(4);
  });

  it('a general subagent may edit only when changes are auto-accepted', async () => {
    const script = (perm: string) => fakeClient([
      callTools(toolUse('s1', 'task', { description: 'Fix', prompt: 'Fix a', subagent_type: 'general' })),
      (params: any) => {
        if (perm === 'auto') expect(toolNames(params)).toContain('write_file');
        else expect(toolNames(params)).not.toContain('write_file');
        return endWith('done');
      },
      endWith('ok'),
    ]);
    await run(script('auto').client, codeReq({ permission: 'auto' })).p;
    await run(script('ask').client, codeReq({ permission: 'ask' })).p;
  });
});

describe('Robustness', () => {
  it('turns provider failures into clear errors (the Groq client already retried)', async () => {
    const c = fakeClient([{ error: new ProviderError('PROVIDER_OVERLOADED', 'Overloaded', 503) }]);
    const r = run(c.client, codeReq());
    await expect(r.p).rejects.toMatchObject({ name: 'AgentError' });
    expect(c.calls).toHaveLength(1);
  });

  it('sends no cache markers to the provider and stores none in the history', async () => {
    const c = fakeClient([
      callTools(toolUse('r1', 'read_file', { path: 'README.md' })),
      callTools(toolUse('r2', 'read_file', { path: 'src/a.ts' })),
      endWith('done'),
    ]);
    const r = run(c.client, codeReq({ permission: 'auto' }));
    await r.p;
    expect(JSON.stringify(c.calls)).not.toContain('cache_control');
    expect(JSON.stringify(produced(r.events))).not.toContain('cache_control');
  });

  it('keeps the work done before a failure in the history', async () => {
    const boom = new ProviderError('BAD_REQUEST', 'bad request', 400);
    const c = fakeClient([callTools(toolUse('w1', 'write_file', { path: 'n.txt', content: 'x' })), { error: boom }]);
    const r = run(c.client, codeReq({ permission: 'auto' }));
    await expect(r.p).rejects.toBeTruthy();
    const hist = produced(r.events);
    expect(hist.map((m: any) => m.role)).toEqual(['assistant', 'user']);
    expect(hist[1].content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'w1' });
  });
});

describe('Reasoning, compaction and the history', () => {
  it('streams reasoning', async () => {
    const c = fakeClient([{ reasoning: ['Let me look', ' at the code.'], content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 1_000, output_tokens: 10 } }]);
    const r = run(c.client, codeReq());
    const res = await r.p;
    expect(r.events.filter(e => e.type === 'reasoning').map((e: any) => e.delta).join('')).toBe('Let me look at the code.');
    expect(res.usage).toMatchObject({ input_tokens: 1_000, output_tokens: 10 });
  });

  it('starts an old compacted history at its summary', async () => {
    const msgs: any[] = [
      { role: 'user', content: 'x'.repeat(5_000) },
      { role: 'assistant', content: [{ type: 'compaction', content: '<summary>earlier work</summary>' }, { type: 'text', text: 'ok' }] },
      { role: 'user', content: 'next' },
    ];
    const c = fakeClient([endWith('ok')]);
    await run(c.client, codeReq({ messages: msgs })).p;
    expect(c.calls[0].messages).toHaveLength(2);
    expect(c.calls[0].messages[0].content[0].type).toBe('compaction');
  });

  it('estimates only what follows the last compaction', () => {
    const long = { role: 'user', content: 'x'.repeat(300_000) };
    const msgs: any[] = [long, { role: 'assistant', content: [{ type: 'compaction', content: 'short' }] }, { role: 'user', content: 'next' }];
    expect(sinceLastCompaction(msgs)).toHaveLength(2);
    const est = estimateInputTokens({ messages: msgs } as any);
    expect(est).toBeLessThan(10_000);
  });

  it('drops resource references from old sandbox outputs, and rejects them in user turns', () => {
    const msgs: any[] = [
      { role: 'user', content: 'run' },
      { role: 'assistant', content: [{ type: 'bash_code_execution_tool_result', tool_use_id: 's', content: { type: 'bash_code_execution_result', content: [{ type: 'bash_code_execution_output', file_id: 'file_mine0000001' }] } }] },
      { role: 'user', content: 'more' },
    ];
    const r = sanitizeMessages(msgs);
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.stringify(r.messages)).not.toContain('file_id');
    const sneaky: any[] = [{ role: 'user', content: [{ type: 'text', text: 'x', file_id: 'file_mine0000001' }] }];
    expect(sanitizeMessages(sneaky).ok).toBe(false);
  });

  it('answers every call when stopped part-way so the history stays valid', async () => {
    const ctrl = new AbortController();
    const c = fakeClient([
      callTools(toolUse('a', 'read_file', { path: 'README.md' }), toolUse('b', 'task', { description: 'x', prompt: 'y' })),
      () => { ctrl.abort(); throw Object.assign(new Error('aborted'), { name: 'AbortError' }); },
    ]);
    const r = run(c.client, codeReq(), { signal: ctrl.signal });
    await r.p.catch(() => {});
    const hist = produced(r.events);
    const ids = hist.at(-1).content.map((b: any) => b.tool_use_id);
    expect(ids).toEqual(['a', 'b']);
  });
});

describe('Permission rules', () => {
  it('deny blocks a change in every mode, even when changes are auto-accepted', async () => {
    const c = fakeClient([callTools(toolUse('d1', 'write_file', { path: 'config/.env', content: 'SECRET=1' })), endWith('ok')]);
    const r = run(c.client, codeReq({ permission: 'auto', rules: { deny: ['.env', '.env.*'] } }));
    await r.p;
    expect(r.events.some(e => e.type === 'file')).toBe(false);
    const res = c.calls[1].messages.at(-1).content[0];
    expect(res.is_error).toBe(true);
    expect(res.content).toMatch(/permission rule/);
  });

  it('deny also covers the destination of a move and is not sent for approval', async () => {
    const mv = toolUse('m1', 'move_file', { from: 'src/a.ts', to: 'keys/server.pem' });
    const c = fakeClient([callTools(mv), endWith('ok')]);
    const r = run(c.client, codeReq({ rules: { deny: ['**/*.pem'] } }));
    const res = await r.p;
    expect(res.stopReason).toBe('end_turn');
    expect(r.events.some(e => e.type === 'approval')).toBe(false);
    expect(r.events.some(e => e.type === 'file')).toBe(false);
  });

  it('allow skips the approval in ask mode, only for the paths it covers', async () => {
    const ok = toolUse('a1', 'edit_file', { path: 'src/a.ts', old_string: '= 1', new_string: '= 3' });
    const other = toolUse('a2', 'write_file', { path: 'README.md', content: '# New' });
    // The allowed change runs at once and the model keeps going.
    const c2 = fakeClient([callTools(ok), endWith('done')]);
    const r2 = run(c2.client, codeReq({ rules: { allow: ['src/**'] } }));
    const res2 = await r2.p;
    expect(res2.stopReason).toBe('end_turn');
    expect(r2.events.some(e => e.type === 'approval')).toBe(false);
    expect((r2.events.find(e => e.type === 'file') as any).change).toMatchObject({ path: 'src/a.ts', content: 'export const a = 3;\n' });

    // A mixed step still asks, but only about the change no rule covers.
    const c3 = fakeClient([callTools(ok, other)]);
    const r3 = run(c3.client, codeReq({ rules: { allow: ['src/**'] } }));
    expect((await r3.p).stopReason).toBe('approval');
    expect((r3.events.find(e => e.type === 'approval') as any).calls.map((x: any) => x.id)).toEqual(['a2']);
  });

  it('plan mode still refuses an allowed path', async () => {
    const c = fakeClient([callTools(toolUse('p1', 'write_file', { path: 'src/z.ts', content: 'x' })), endWith('ok')]);
    const r = run(c.client, codeReq({ permission: 'plan', rules: { allow: ['src/**'] } }));
    await r.p;
    expect(r.events.some(e => e.type === 'file')).toBe(false);
  });

  it('caps how many rules a request may carry', () => {
    expect(() => codeReq({ rules: { allow: Array.from({ length: 51 }, (_, i) => `a${i}`) } })).toThrow();
  });

  it('on resume, an allowed path needs no decision but an explicit "no" still wins', async () => {
    const msgs = [
      { role: 'user', content: 'go' },
      { role: 'assistant', content: [toolUse('t1', 'write_file', { path: 'src/b.ts', content: 'b' }), toolUse('t2', 'write_file', { path: 'src/c.ts', content: 'c' }), toolUse('t3', 'write_file', { path: 'notes.txt', content: 'n' })] },
    ];
    const c = fakeClient([endWith('ok')]);
    const r = run(c.client, codeReq({ messages: msgs, rules: { allow: ['src/*.ts'] }, resume: { results: [{ tool_use_id: 't3', decision: 'allow' }, { tool_use_id: 't2', decision: 'deny' }] } }));
    await r.p;
    const written = r.events.filter(e => e.type === 'file').map(e => (e as any).change.path);
    expect(written).toEqual(['src/b.ts', 'notes.txt']);
  });
});

describe('Context meter', () => {
  it('reports how full the context was on the last call', async () => {
    const c = fakeClient([
      { ...callTools(toolUse('r', 'read_file', { path: 'README.md' })), usage: { input_tokens: 3_000, output_tokens: 50 } },
      { ...endWith('ok'), usage: { input_tokens: 3_500, output_tokens: 40 } },
    ]);
    const res = await run(c.client, codeReq({ permission: 'auto' })).p;
    expect(res.contextTokens).toBe(3_500 + 40);
  });
});
