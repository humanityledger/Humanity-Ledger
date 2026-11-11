/**
 * The Studio API routes, end to end: real route handlers, real metering and
 * locking logic and the real Groq client, against a fake Redis, a scripted
 * Groq API (global fetch, OpenAI-compatible SSE), mocked auth, Prisma and Stripe.
 */
import { vi } from 'vitest';
import { NextRequest } from 'next/server';

const h = vi.hoisted(() => {
  class FakeRedis {
    store = new Map<string, string>();
    down = false;
    async get(k: string) { if (this.down) throw new Error('down'); return this.store.get(k) ?? null; }
    async set(k: string, v: string, ...args: any[]) {
      if (this.down) throw new Error('down');
      if (args.includes('NX') && this.store.has(k)) return null;
      this.store.set(k, String(v));
      return 'OK';
    }
    async setex(k: string, _s: number, v: string) { this.store.set(k, String(v)); return 'OK'; }
    async del(k: string) { return this.store.delete(k) ? 1 : 0; }
    async eval(_lua: string, _n: number, k: string, token: string) {
      if (this.store.get(k) === token) { this.store.delete(k); return 1; }
      return 0;
    }
    multi() {
      const ops: (() => void)[] = [];
      const self = this;
      const chain: any = {
        incrby(k: string, n: number) { ops.push(() => self.store.set(k, String(Number(self.store.get(k) ?? 0) + n))); return chain; },
        incr(k: string) { return chain.incrby(k, 1); },
        expire() { return chain; },
        async exec() { ops.forEach(f => f()); return []; },
      };
      return chain;
    }
  }
  const redis = new FakeRedis();
  return {
    redis,
    wallet: '0x1111111111111111111111111111111111111111',
    authFails: false,
    script: [] as any[],
    calls: [] as any[],
    rateAllowed: true,
    rateKeys: [] as string[],
    files: [] as [string, string][],
    user: { tier: 'FREE', isPro: false, stripeCustomerId: null as string | null, stripeSubscriptionId: null as string | null, email: null as string | null },
    stripeCreate: vi.fn(async (_p: any) => ({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' })),
  };
});

vi.mock('@/lib/redis/client', () => ({
  redisClient: h.redis,
  safeRedisGet: async (k: string) => { try { return await h.redis.get(k); } catch { return 'TIMEOUT'; } },
  safeRedisSet: async (k: string, v: string, ...a: any[]) => { try { await h.redis.set(k, v, ...a); } catch { /* ignore */ } },
}));
vi.mock('@/lib/security/requireWallet', async () => {
  const { NextResponse } = await import('next/server');
  return {
    requireWallet: async () => (h.authFails
      ? { errorResponse: NextResponse.json({ error: 'Unauthorized: Valid session required' }, { status: 401 }) }
      : { walletAddress: h.wallet, userId: h.wallet, isEmailUser: false }),
  };
});
vi.mock('@/lib/security/rateLimiter', () => ({
  getClientIP: (r: Request) => r.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'unknown',
  checkRateLimit: async (key: string, opts: { prefix?: string }) => {
    h.rateKeys.push(`${opts.prefix}:${key}`);
    return { allowed: h.rateAllowed, remaining: 0, resetAt: Math.floor(Date.now() / 1000) + 3600 };
  },
}));
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: async () => h.user, upsert: async () => h.user } },
}));
vi.mock('@/lib/payments/stripe', () => ({
  stripe: { checkout: { sessions: { create: h.stripeCreate } }, billingPortal: { sessions: { create: async () => ({ url: 'https://billing.stripe.com/p/session/x' }) } } },
}));

/**
 * Groq's API, scripted. A step is either an answer ({ text, response }) streamed as
 * chat.completion.chunk SSE, an HTTP error ({ status, body, headers }), or an answer that
 * fails part-way ({ text, streamError }). With no step left it answers a title.
 */
function groqFetch(url: string, init: any): Promise<Response> {
  const params = JSON.parse(init.body);
  h.calls.push({ url, params, headers: init.headers, signal: init.signal });
  const step = h.script.shift() ?? { text: ['"**Contrato** de escrow."'], response: { content: [{ type: 'text', text: '"**Contrato** de escrow."' }], stop_reason: 'end_turn', usage: { input_tokens: 40, output_tokens: 6 } } };
  if (step.status) return Promise.resolve(new Response(JSON.stringify(step.body ?? {}), { status: step.status, headers: { 'content-type': 'application/json', ...(step.headers ?? {}) } }));
  const chunks: any[] = [];
  for (const t of step.text ?? []) chunks.push({ choices: [{ index: 0, delta: { content: t } }] });
  if (step.streamError) chunks.push({ error: step.streamError });
  else {
    const r = step.response ?? { content: [], stop_reason: 'end_turn', usage: {} };
    (r.content ?? []).filter((b: any) => b.type === 'tool_use').forEach((b: any, index: number) => {
      chunks.push({ choices: [{ index: 0, delta: { tool_calls: [{ index, id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }] } }] });
    });
    const finish = r.stop_reason === 'tool_use' ? 'tool_calls' : r.stop_reason === 'max_tokens' ? 'length' : 'stop';
    chunks.push({ choices: [{ index: 0, delta: {}, finish_reason: finish }], x_groq: { usage: { prompt_tokens: r.usage?.input_tokens ?? 0, completion_tokens: r.usage?.output_tokens ?? 0 } } });
  }
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({ start(c) { for (const ch of chunks) c.enqueue(enc.encode(`data: ${JSON.stringify(ch)}\n\n`)); c.enqueue(enc.encode('data: [DONE]\n\n')); c.close(); } });
  return Promise.resolve(new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }));
}

import { POST as chat } from '@/app/api/studio/chat/route';
import { POST as title } from '@/app/api/studio/title/route';
import { POST as checkout } from '@/app/api/studio/checkout/route';
import { GET as usageRoute } from '@/app/api/studio/usage/route';
import { usageKeys } from '@/lib/studio/metering';

const req = (body: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) =>
  new NextRequest('http://localhost:3000/api/studio/chat', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });

const turn = (over: Record<string, unknown> = {}) => ({ model: 'openai/gpt-oss-120b', messages: [{ role: 'user', content: 'Hola' }], ...over });

async function events(res: Response) {
  const text = await res.text();
  return text.split('\n').filter(Boolean).map(l => JSON.parse(l));
}

const ok = (text: string, usage = { input_tokens: 1_000, output_tokens: 200 }) => ({
  text: [text],
  response: { content: [{ type: 'text', text }], stop_reason: 'end_turn', usage },
});

beforeEach(() => {
  h.redis.store.clear();
  h.redis.down = false;
  h.authFails = false;
  h.script.length = 0;
  h.calls.length = 0;
  h.rateAllowed = true;
  h.rateKeys.length = 0;
  h.files.length = 0;
  h.user = { tier: 'FREE', isPro: false, stripeCustomerId: null, stripeSubscriptionId: null, email: null };
  h.stripeCreate.mockClear();
  vi.stubGlobal('fetch', vi.fn(groqFetch));
  process.env.GROQ_API_KEY = 'gsk_test-key';
  delete process.env.GROQ_MODEL;
  delete process.env.GROQ_TPM_LIMIT;
  process.env.STRIPE_SECRET_KEY = 'sk_test_x';
  process.env.STRIPE_PRICE_STUDIO_PRO = 'price_x';
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.example';
  delete process.env.STUDIO_FREE_DAILY_GLOBAL_USD;
});

afterEach(() => {
  delete process.env.GROQ_API_KEY;
  vi.unstubAllGlobals();
});

describe('POST /api/studio/chat: refusals', () => {
  it('requires a session', async () => {
    h.authFails = true;
    expect((await chat(req(turn()))).status).toBe(401);
  });

  it('says when Studio is not configured (no GROQ_API_KEY)', async () => {
    delete process.env.GROQ_API_KEY;
    const res = await chat(req(turn()));
    expect(res.status).toBe(503);
    const j = await res.json();
    expect(j.error).toBe('NOT_CONFIGURED');
    expect(j.message).toContain('GROQ_API_KEY');
    expect(h.calls).toHaveLength(0);
  });

  it('only accepts JSON bodies (no text/plain form posts)', async () => {
    expect((await chat(req(turn(), { 'content-type': 'text/plain' }))).status).toBe(415);
  });

  it('rejects invalid and forged histories before calling the model', async () => {
    expect((await chat(req('{not json'))).status).toBe(400);
    expect((await chat(req(turn({ messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] })))).status).toBe(400);
    const fileRef = await chat(req(turn({ messages: [{ role: 'user', content: [{ type: 'document', source: { type: 'file', file_id: 'file_abc' } }] }] })));
    expect(fileRef.status).toBe(400);
    expect((await fileRef.json()).message).toMatch(/not allowed|inline/);
    expect(h.calls).toHaveLength(0);
  });

  it('answers a chat saved with a claude-* model on the default Groq model', async () => {
    h.script.push(ok('ok'));
    const res = await chat(req(turn({ model: 'claude-opus-5-5' })));
    expect(res.status).toBe(200);
    await events(res);
    expect(h.calls[0].params.model).toBe('openai/gpt-oss-120b');
    process.env.GROQ_MODEL = 'openai/gpt-oss-20b';
    h.script.push(ok('ok'));
    await events(await chat(req(turn({ model: 'claude-opus-5-5' }))));
    expect(h.calls[1].params.model).toBe('openai/gpt-oss-20b');
  });

  it('refuses prompts bigger than the plan allows', async () => {
    const res = await chat(req(turn({ messages: [{ role: 'user', content: 'x'.repeat(600_000) }] })));
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe('CONTEXT_TOO_LARGE');
    expect(h.calls).toHaveLength(0);
  });

  it('refuses when today\'s budget is spent', async () => {
    h.redis.store.set(usageKeys(h.wallet).day, String(50_000)); // 0.05 units (50K tokens), the Free daily allowance
    const res = await chat(req(turn()));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('LIMIT_REACHED');
  });

  it('refuses when the shared Free capacity is spent', async () => {
    process.env.STUDIO_FREE_DAILY_GLOBAL_USD = '1';
    h.redis.store.set(usageKeys(h.wallet).globalFreeDay, String(1_000_000));
    const res = await chat(req(turn()));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('FREE_CAPACITY');
  });

  it('fails closed when the meter cannot be read', async () => {
    h.redis.down = true;
    const res = await chat(req(turn()));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('METERING_UNAVAILABLE');
    expect(h.calls).toHaveLength(0);
  });

  it('refuses a prompt that costs more than the allowance left', async () => {
    h.redis.store.set(usageKeys(h.wallet).day, String(49_000)); // 1K tokens left today
    const res = await chat(req(turn({ messages: [{ role: 'user', content: 'x'.repeat(30_000) }] })));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('OVER_BUDGET');
    expect(h.calls).toHaveLength(0);
    expect(h.redis.store.has(`studio:lock:${h.wallet}`)).toBe(false);
  });

  it('limits requests per network address, by plan', async () => {
    h.rateAllowed = false;
    const res = await chat(req(turn(), { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('RATE_LIMITED');
    expect(h.rateKeys).toEqual(['rl:studio:free:10.0.0.1']); // the hop our proxy added, not the client's
    expect(h.calls).toHaveLength(0);
  });

  it('holds the worst case of a Free turn against the shared ceiling before calling the model', async () => {
    // 5K tokens left in the shared pool, less than one Free call's worst case
    // (one call is up to the 8K tokens-per-minute limit), so it must not start.
    process.env.STUDIO_FREE_DAILY_GLOBAL_USD = '0.005';
    const res = await chat(req(turn()));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('FREE_CAPACITY');
    expect(h.calls).toHaveLength(0);
    expect(Number(h.redis.store.get(usageKeys(h.wallet).globalFreeDay) ?? 0)).toBe(0); // nothing left held
    expect(h.redis.store.has(`studio:lock:${h.wallet}`)).toBe(false);
  });

  it('allows one turn at a time per wallet', async () => {
    h.redis.store.set(`studio:lock:${h.wallet}`, 'someone-else');
    const res = await chat(req(turn()));
    expect(res.status).toBe(409);
  });
});

describe('POST /api/studio/chat: a turn', () => {
  it('streams the answer, meters it and releases the lock', async () => {
    h.script.push(ok('¡Hola!'));
    const res = await chat(req(turn()));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/x-ndjson');
    const ev = await events(res);
    expect(ev.map(e => e.type)).toEqual(['start', 'text', 'messages', 'usage', 'done']);
    expect(ev.find(e => e.type === 'text').delta).toBe('¡Hola!');
    // 1,000 in + 200 out = 1,200 tokens = 0.0012 units
    expect(ev.find(e => e.type === 'usage').costUsd).toBeCloseTo(0.0012, 6);
    const k = usageKeys(h.wallet);
    expect(Number(h.redis.store.get(k.day))).toBe(1_200);
    expect(Number(h.redis.store.get(k.globalFreeDay))).toBe(1_200);
    expect(Number(h.redis.store.get(k.requests))).toBe(1);
    expect(h.redis.store.has(`studio:lock:${h.wallet}`)).toBe(false);
  });

  it('sends Groq what it needs and nothing the client tried to add', async () => {
    h.script.push(ok('ok'));
    await events(await chat(req(turn({
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi', cache_control: { type: 'ephemeral', ttl: '1h' } }] }],
      connectors: [{ id: '1', name: 'gh', url: 'https://mcp.example/mcp', enabled: true, token: 'secret' }],
      tools: { webSearch: true, webFetch: true },
    }))));
    const c = h.calls[0];
    expect(c.url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(c.headers.Authorization).toBe('Bearer gsk_test-key');
    const p = c.params;
    expect(p.model).toBe('openai/gpt-oss-120b');
    expect(p.stream).toBe(true);
    expect(p.messages[0].role).toBe('system');
    expect(p.messages[0].content).toContain('Groq');
    expect(p.messages.at(-1)).toEqual({ role: 'user', content: 'hi' });
    expect(p.tools.map((t: any) => t.function.name)).toEqual(['artifact']);
    expect(p.reasoning_format).toBeUndefined(); // GPT-OSS does not take it
    const body = JSON.stringify(p);
    for (const gone of ['cache_control', 'mcp', 'secret', 'web_search']) expect(body).not.toContain(gone);
    // The whole call fits the free tier's 8,000 tokens per minute.
    expect(p.max_completion_tokens).toBeGreaterThanOrEqual(1_024);
    expect(p.max_completion_tokens).toBeLessThanOrEqual(7_360);
    expect(c.signal).toBeDefined();
  });

  it('answers with another model when the chosen one is rate limited, and says which', async () => {
    h.script.push({ status: 429, body: { error: { message: 'Rate limit reached for model `openai/gpt-oss-120b` on tokens per minute (TPM): Limit 8000, Used 7900, Requested 900.' } }, headers: { 'retry-after': '7' } });
    h.script.push(ok('Hola desde 20B'));
    const ev = await events(await chat(req(turn())));
    expect(h.calls.map(c => c.params.model)).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
    expect(ev.find(e => e.type === 'text').delta).toBe('Hola desde 20B');
    expect(ev.at(-1)).toEqual({ type: 'done', stopReason: 'end_turn' });
  });

  it('gives a clear error when every model is out of today\'s free capacity', async () => {
    for (let i = 0; i < 3; i++) h.script.push({ status: 429, body: { error: { message: 'Rate limit reached on tokens per day (TPD): Limit 200000, Used 200000.' } } });
    const ev = await events(await chat(req(turn())));
    expect(ev.find(e => e.type === 'error')).toMatchObject({ code: 'PROVIDER_DAILY_LIMIT' });
    expect(h.calls).toHaveLength(3);
    expect(h.redis.store.has(`studio:lock:${h.wallet}`)).toBe(false);
  });

  it('tells the operator to check GROQ_API_KEY when Groq rejects it', async () => {
    h.script.push({ status: 401, body: { error: { message: 'Invalid API Key', code: 'invalid_api_key' } } });
    const ev = await events(await chat(req(turn())));
    const err = ev.find(e => e.type === 'error');
    expect(err.code).toBe('PROVIDER_AUTH');
    expect(err.message).toContain('GROQ_API_KEY');
    expect(h.calls).toHaveLength(1); // a bad key is not retried on other models
  });

  it('meters a turn that fails part-way and still releases the lock', async () => {
    h.script.push({ text: ['x'.repeat(300)], streamError: { message: 'internal error', type: 'internal_server_error', status: 500 } });
    const ev = await events(await chat(req(turn())));
    expect(ev.find(e => e.type === 'error').code).toBe('PROVIDER_OVERLOADED');
    expect(ev.at(-1)).toEqual({ type: 'done', stopReason: 'error' });
    // The prompt it sent plus the 300 characters it streamed (100 tokens) are counted.
    expect(Number(h.redis.store.get(usageKeys(h.wallet).day))).toBeGreaterThan(100);
    expect(h.redis.store.has(`studio:lock:${h.wallet}`)).toBe(false);
  });

  it('shortens a long conversation to fit and tells the user', async () => {
    const long: any[] = [];
    for (let i = 0; i < 30; i++) long.push({ role: 'user', content: `q${i} ${'x'.repeat(2_000)}` }, { role: 'assistant', content: [{ type: 'text', text: 'y'.repeat(2_000) }] });
    long.push({ role: 'user', content: 'and now?' });
    h.script.push(ok('ok'));
    const ev = await events(await chat(req(turn({ messages: long }))));
    expect(ev.filter(e => e.type === 'notice').map(e => e.code)).toContain('TRIMMED');
    const sent = h.calls[0].params.messages;
    expect(sent.length).toBeLessThan(long.length);
    expect(sent.at(-1)).toEqual({ role: 'user', content: 'and now?' });
    expect(sent[1].role).toBe('user');
  });

  it('reads a Pro tier from the JSON tier cache, and Qwen asks for parsed reasoning', async () => {
    h.redis.store.set(`tier:${h.wallet}`, JSON.stringify({ tier: 'STUDIO_PRO', kycStatus: 'UNVERIFIED' }));
    h.script.push(ok('ok'));
    const res = await chat(req(turn({ model: 'qwen/qwen3.8-27b' })));
    expect(res.status).toBe(200);
    await events(res);
    expect(h.calls[0].params.model).toBe('qwen/qwen3.8-27b');
    expect(h.calls[0].params.reasoning_format).toBe('parsed');
    expect(h.redis.store.has(usageKeys(h.wallet).globalFreeDay)).toBe(false); // Pro does not use the free pool
  });
});

describe('POST /api/studio/title', () => {
  it('returns a clean, metered title from the small model', async () => {
    const res = await title(new NextRequest('http://localhost:3000/api/studio/title', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'quiero un contrato de escrow' }) }));
    expect(await res.json()).toEqual({ title: 'Contrato de escrow' });
    expect(h.calls[0].params.model).toBe('openai/gpt-oss-20b');
    expect(h.calls[0].params.reasoning_effort).toBe('low');
    expect(Number(h.redis.store.get(usageKeys(h.wallet).day))).toBeGreaterThan(0);
  });

  it('fails closed when the meter is down', async () => {
    h.redis.down = true;
    const res = await title(new NextRequest('http://localhost:3000/api/studio/title', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'x' }) }));
    expect(res.status).toBe(503);
  });
});

describe('GET /api/studio/usage', () => {
  it('reports the plan and configuration', async () => {
    const res = await usageRoute(new NextRequest('http://localhost:3000/api/studio/usage'));
    const j = await res.json();
    expect(j).toMatchObject({ configured: true, checkoutAvailable: true, provider: 'groq', defaultModel: 'openai/gpt-oss-120b', tpmLimit: 8_000 });
    expect(j.capabilities).toEqual({ webSearch: false, sandbox: false, connectors: false, images: false });
    expect(j.usage.plan.id).toBe('free');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('POST /api/studio/checkout', () => {
  const post = (body: unknown = {}) => checkout(new NextRequest('http://evil.example/api/studio/checkout', { method: 'POST', headers: { 'content-type': 'application/json', host: 'evil.example' }, body: JSON.stringify(body) }));

  it('creates a Studio Pro subscription with redirects from configuration, not the Host header', async () => {
    const res = await post();
    expect(await res.json()).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
    const p = h.stripeCreate.mock.calls[0][0];
    expect(p.mode).toBe('subscription');
    expect(p.metadata).toMatchObject({ userId: h.wallet, tier: 'STUDIO_PRO' });
    expect(p.success_url).toBe('https://app.example/studio?upgrade=success');
    expect(p.cancel_url).toBe('https://app.example/studio?upgrade=cancelled');
  });

  it('does not sell Pro twice or overwrite another subscription', async () => {
    h.user = { ...h.user, tier: 'STUDIO_PRO' };
    expect((await post()).status).toBe(409);
    h.redis.store.clear();
    h.user = { ...h.user, tier: 'SOVEREIGN', stripeSubscriptionId: 'sub_123' };
    const res = await post();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('OTHER_SUBSCRIPTION');
    expect(h.stripeCreate).not.toHaveBeenCalled();
  });

  it('opens the billing portal only for customers', async () => {
    expect((await post({ action: 'portal' })).status).toBe(404);
    h.user = { ...h.user, stripeCustomerId: 'cus_1' };
    expect(await (await post({ action: 'portal' })).json()).toEqual({ url: 'https://billing.stripe.com/p/session/x' });
  });
});

describe('POST /api/studio/chat: Code mode', () => {
  const code = (over: Record<string, unknown> = {}) => turn({
    mode: 'code', permission: 'auto',
    workspace: { files: [{ path: 'a.txt', content: 'hello' }] },
    ...over,
  });

  it('only resumes a turn that is waiting, with answers for its own calls', async () => {
    const waiting = [{ role: 'user', content: 'go' }, { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name: 'write_file', input: { path: 'b.txt', content: 'x' } }] }];
    expect((await chat(req(code({ messages: waiting })))).status).toBe(400);
    expect((await chat(req(code({ messages: waiting, resume: { results: [{ tool_use_id: 'toolu_other', decision: 'allow' }] } })))).status).toBe(400);
    expect((await chat(req(turn({ messages: waiting, resume: { results: [{ tool_use_id: 'toolu_1', decision: 'allow' }] } })))).status).toBe(400);
    h.script.push(ok('Done.'));
    const res = await chat(req(code({ permission: 'ask', messages: waiting, resume: { results: [{ tool_use_id: 'toolu_1', decision: 'allow' }] } })));
    expect(res.status).toBe(200);
    const ev = await events(res);
    expect(ev.find(e => e.type === 'file')?.change).toMatchObject({ path: 'b.txt', content: 'x', op: 'create' });
    // Groq gets the call and its result as OpenAI tool messages.
    const sent = h.calls[0].params.messages;
    expect(sent.at(-2)).toMatchObject({ role: 'assistant', tool_calls: [{ id: 'toolu_1', type: 'function', function: { name: 'write_file' } }] });
    expect(sent.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'toolu_1' });
  });

  it('keeps Code chats from before the migration working, without a sandbox', async () => {
    const out = [
      { role: 'user', content: [{ type: 'text', text: 'run' }, { type: 'container_upload', file_id: 'file_old' }] },
      { role: 'assistant', content: [{ type: 'bash_code_execution_tool_result', tool_use_id: 'srvtoolu_1', content: { type: 'bash_code_execution_result', stdout: '', stderr: '', return_code: 0, content: [{ type: 'bash_code_execution_output', file_id: 'file_someoneelse1' }] } }, { type: 'text', text: 'ran' }] },
      { role: 'user', content: 'again' },
    ];
    h.script.push(ok('ok'));
    const res = await chat(req(code({ messages: out, sandbox: { enabled: true, containerId: 'cntr_old' } })));
    expect(res.status).toBe(200);
    await events(res);
    const body = JSON.stringify(h.calls[0].params);
    expect(body).not.toMatch(/file_old|file_someoneelse1|cntr_old|container|code_execution/);
    expect(h.calls[0].params.tools.map((t: any) => t.function.name)).not.toContain('sync_sandbox');
  });

  it('refuses a workspace over the size limit', async () => {
    const big = Array.from({ length: 21 }, (_, i) => ({ path: `f${i}.txt`, content: 'x'.repeat(399_000) }));
    const res = await chat(req(code({ workspace: { files: big } })));
    expect(res.status).toBe(413);
  });
});
