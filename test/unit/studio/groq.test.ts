/**
 * lib/studio/groq.ts — the Groq client Ledger Studio runs on since the migration from
 * Anthropic (Nov 2026): message translation, fitting each call to the free tier's
 * tokens-per-minute limit, SSE parsing, error classification and model fallback.
 */
import {
  classifyGroqError, createGroqClient, fitSystem, fitToBudget, ProviderError, readChatStream, toChatMessages, toChatTools,
} from '@/lib/studio/groq';
import { jsonResponse, sseResponse } from './fake-client';

const sys = [{ type: 'text' as const, text: 'SYSTEM' }];

describe('toChatMessages', () => {
  it('turns Studio blocks into OpenAI chat messages, pairing every call with one result', () => {
    const out = toChatMessages(sys, [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: [{ type: 'text', text: 'on it' }, { type: 'tool_use', id: 't1', name: 'artifact', input: { a: 1 } }, { type: 'tool_use', id: 't2', name: 'artifact', input: {} }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'done' }, { type: 'text', text: 'thanks' }] },
    ]);
    expect(out[0]).toEqual({ role: 'system', content: 'SYSTEM' });
    expect(out[1]).toEqual({ role: 'user', content: 'hi' });
    expect(out[2]).toMatchObject({ role: 'assistant', content: 'on it', tool_calls: [{ id: 't1', function: { name: 'artifact', arguments: '{"a":1}' } }, { id: 't2' }] });
    expect(out[3]).toEqual({ role: 'tool', tool_call_id: 't1', content: 'done' });
    expect(out[4]).toEqual({ role: 'tool', tool_call_id: 't2', content: 'This tool call was not run.' }); // repaired
    expect(out[5]).toEqual({ role: 'user', content: 'thanks' });
  });

  it('describes media the models cannot read and keeps old compaction summaries', () => {
    const out = toChatMessages([], [
      { role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } }, { type: 'text', text: 'what is this' }] },
      { role: 'assistant', content: [{ type: 'compaction', content: 'we built a page' }, { type: 'text', text: 'ok' }] },
    ]);
    expect(String(out[0].content)).not.toContain('AAAA');
    expect(String(out[0].content)).toContain('what is this');
    expect(out[1].content).toContain('we built a page');
  });

  it('clips long tool results', () => {
    const out = toChatMessages([], [
      { role: 'user', content: 'read' },
      { role: 'assistant', content: [{ type: 'tool_use', id: 'r', name: 'read_file', input: {} }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'r', content: 'x'.repeat(50_000) }] },
    ]);
    expect((out[2] as any).content.length).toBeLessThan(13_000);
  });

  it('offers only function tools', () => {
    expect(toChatTools([{ name: 'artifact', description: 'd', input_schema: { type: 'object' } }, { type: 'web_search_20250305', name: 'web_search' } as any]))
      .toEqual([{ type: 'function', function: { name: 'artifact', description: 'd', parameters: { type: 'object' } } }]);
  });
});

describe('fitting a call to the tokens-per-minute limit', () => {
  it('leaves out the oldest messages, keeps the newest question, starts on a user turn', () => {
    const msgs: any[] = [{ role: 'system', content: 'S' }];
    for (let i = 0; i < 20; i++) msgs.push({ role: 'user', content: 'q'.repeat(3_000) }, { role: 'assistant', content: 'a'.repeat(3_000) });
    msgs.push({ role: 'user', content: 'latest' });
    const fit = fitToBudget(msgs, 0, 5_000);
    expect(fit.dropped).toBeGreaterThan(0);
    expect(fit.promptTokens).toBeLessThanOrEqual(5_000);
    expect(fit.messages[0].role).toBe('system');
    expect(fit.messages[1].role).toBe('user');
    expect(fit.messages.at(-1)).toEqual({ role: 'user', content: 'latest' });
  });

  it('shortens a system prompt that is too long by itself, keeping its first and last lines', () => {
    const r = fitSystem([{ type: 'text', text: 'IDENTITY' }, { type: 'text', text: `${'k'.repeat(50_000)}LAST-LINE` }], 2_000);
    expect(r.clipped).toBe(true);
    expect(r.system[0].text).toBe('IDENTITY');
    expect(r.system[1].text.length).toBeLessThan(8_000);
    expect(r.system[1].text.endsWith('LAST-LINE')).toBe(true);
    expect(fitSystem(sys, 2_000)).toEqual({ system: sys, clipped: false });
  });
});

describe('classifyGroqError', () => {
  it('tells minute limits, day limits, oversize requests, bad keys and retired models apart', () => {
    const h = new Headers({ 'retry-after': '7' });
    expect(classifyGroqError(429, { error: { message: 'Rate limit reached ... tokens per minute (TPM): Limit 8000, Used 7000, Requested 2000.' } }, h)).toMatchObject({ code: 'RATE_MINUTE', retryAfterSec: 7 });
    expect(classifyGroqError(429, { error: { message: 'Rate limit reached ... requests per day (RPD): Limit 1000, Used 1000' } }).code).toBe('RATE_DAY');
    expect(classifyGroqError(413, { error: { message: 'Request too large for model on tokens per minute (TPM): Limit 8000, Requested 9500' } })).toMatchObject({ code: 'TPM_TOO_LARGE', limit: 8000, requested: 9500 });
    expect(classifyGroqError(401, { error: { message: 'Invalid API Key' } }).code).toBe('PROVIDER_AUTH');
    expect(classifyGroqError(404, { error: { message: 'The model `x` does not exist', code: 'model_not_found' } }).code).toBe('MODEL_UNAVAILABLE');
    expect(classifyGroqError(400, { error: { message: 'Failed to call a function', code: 'tool_use_failed' } }).code).toBe('TOOL_CALL_FAILED');
    expect(classifyGroqError(503, {}).code).toBe('PROVIDER_OVERLOADED');
    expect(classifyGroqError(400, { error: { message: 'bad' } }).code).toBe('BAD_REQUEST');
  });
});

describe('readChatStream', () => {
  it('assembles text, reasoning, tool calls split across chunks, and usage', async () => {
    const events: any[] = [];
    const res = sseResponse([
      { choices: [{ delta: { reasoning: 'hmm ' } }] },
      { choices: [{ delta: { content: 'Hi ' } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'artifact', arguments: '{"a":' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '1}' } }] }, finish_reason: 'tool_calls' }] },
      { choices: [], x_groq: { usage: { prompt_tokens: 10, completion_tokens: 5 } } },
    ]);
    const s = await readChatStream(res.body!, e => events.push(e));
    expect(s.text).toBe('Hi ');
    expect(s.calls).toEqual([{ id: 'c1', name: 'artifact', args: '{"a":1}', announced: true }]);
    expect(s.finish).toBe('tool_calls');
    expect(s.usage).toEqual({ prompt_tokens: 10, completion_tokens: 5 });
    expect(events.map(e => e.type)).toEqual(['reasoning', 'text', 'tool_call']);
  });
});

describe('createGroqClient', () => {
  const params = (over: any = {}) => ({ model: 'openai/gpt-oss-120b' as const, max_tokens: 4_000, system: sys, messages: [{ role: 'user', content: 'hi' }], tools: [], ...over });
  const answer = (text: string, finish = 'stop') => sseResponse([{ choices: [{ delta: { content: text }, finish_reason: finish }], usage: { prompt_tokens: 20, completion_tokens: 3 } }]);
  const script = (...responses: (Response | Error)[]) => {
    const bodies: any[] = [];
    const fetchImpl = vi.fn(async (_url: string, init: any) => {
      bodies.push(JSON.parse(init.body));
      const r = responses.shift();
      if (!r) throw new Error('no response left');
      if (r instanceof Error) throw r;
      return r;
    });
    return { client: createGroqClient({ apiKey: 'gsk_x', fetchImpl: fetchImpl as any, sleep: async () => {} }), bodies, fetchImpl };
  };

  it('streams an answer and sizes the output to the per-minute limit', async () => {
    const { client, bodies } = script(answer('Hola'));
    const r = await client.complete(params({ reasoning_effort: 'medium' }));
    expect(r).toMatchObject({ content: [{ type: 'text', text: 'Hola' }], stop_reason: 'end_turn', usage: { input_tokens: 20, output_tokens: 3 }, model: 'openai/gpt-oss-120b', trimmed: 0 });
    expect(bodies[0]).toMatchObject({ model: 'openai/gpt-oss-120b', stream: true, reasoning_effort: 'medium', max_completion_tokens: 4_000 });
    expect(bodies[0].tools).toBeUndefined();
    expect(bodies[0].reasoning_format).toBeUndefined();
  });

  it('asks Qwen for parsed reasoning', async () => {
    const { client, bodies } = script(answer('ok'));
    await client.complete(params({ model: 'qwen/qwen3.8-27b' }));
    expect(bodies[0].reasoning_format).toBe('parsed');
  });

  it('falls back to another model when one is rate limited, and reports it', async () => {
    const { client, bodies } = script(jsonResponse(429, { error: { message: 'tokens per minute (TPM)' } }, { 'retry-after': '5' }), answer('ok'));
    const events: any[] = [];
    const r = await client.complete(params(), { onEvent: e => events.push(e) });
    expect(bodies.map(b => b.model)).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
    expect(r.model).toBe('openai/gpt-oss-20b');
    expect(events).toContainEqual({ type: 'model', model: 'openai/gpt-oss-20b' });
  });

  it('waits once when every model is busy, then says so clearly', async () => {
    const busy = () => jsonResponse(429, { error: { message: 'requests per minute (RPM)' } }, { 'retry-after': '3' });
    const { client, bodies } = script(busy(), busy(), busy(), busy(), busy(), busy());
    const err = await client.complete(params()).catch(e => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.code).toBe('PROVIDER_BUSY');
    expect(err.retryAfterSec).toBe(3);
    expect(bodies).toHaveLength(6); // three models, twice
  });

  it('does not retry a bad key', async () => {
    const { client, bodies } = script(jsonResponse(401, { error: { message: 'Invalid API Key' } }));
    await expect(client.complete(params())).rejects.toMatchObject({ code: 'PROVIDER_AUTH' });
    expect(bodies).toHaveLength(1);
  });

  it('retries smaller when Groq says the request is over the per-minute limit', async () => {
    const { client, bodies } = script(jsonResponse(413, { error: { message: 'Request too large for model on tokens per minute (TPM): Limit 8000, Requested 8600' } }), answer('ok'));
    await client.complete(params({ max_tokens: 60_000 }));
    expect(bodies[1].max_completion_tokens).toBeLessThan(bodies[0].max_completion_tokens);
  });

  it('refuses a single message that can never fit, before calling Groq', async () => {
    const { client, fetchImpl } = script();
    await expect(client.complete(params({ messages: [{ role: 'user', content: 'x'.repeat(60_000) }] }))).rejects.toMatchObject({ code: 'CONTEXT_TOO_LARGE' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('retries a failed tool call once', async () => {
    const { client, bodies } = script(jsonResponse(400, { error: { message: 'Failed to call a function', code: 'tool_use_failed' } }), answer('ok'));
    await client.complete(params());
    expect(bodies).toHaveLength(2);
  });

  it('maps a cut-off answer to max_tokens even with a half-written call', async () => {
    const { client } = script(sseResponse([{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c', function: { name: 'artifact', arguments: '{"con' } }] }, finish_reason: 'length' }] }]));
    const r = await client.complete(params());
    expect(r.stop_reason).toBe('max_tokens');
  });
});
