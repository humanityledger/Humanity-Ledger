/**
 * The Studio API routes, end to end: real route handlers, real metering and
 * locking logic, against a fake Redis, a scripted Anthropic SDK, mocked auth,
 * Prisma and Stripe.
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
vi.mock('@anthropic-ai/sdk', () => {
  class Anthropic {
    beta = {
      messages: {
        stream(params: any, options: any) {
          h.calls.push({ params: JSON.parse(JSON.stringify(params)), options });
          const step = h.script.shift();
          let handler: ((e: any) => void) | null = null;
          return {
            on(_n: string, fn: (e: any) => void) { handler = fn; return this; },
            async finalMessage() {
              if (step.started) handler?.({ type: 'message_start', message: { usage: step.started } });
              for (const t of step.text ?? []) handler?.({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } });
              if (step.error) throw step.error;
              return step.response;
            },
          };
        },
      },
    };
    messages = {
      create: async () => ({ content: [{ type: 'text', text: '"**Contrato** de escrow."' }], usage: { input_tokens: 40, output_tokens: 6 } }),
    };
    constructor() {
      (this.beta as any).files = {
        upload: async (p: any) => { h.files.push(['upload', p.file?.name]); return { id: 'file_upload00001' }; },
        delete: async (id: string) => { h.files.push(['delete', id]); return { id }; },
        retrieveMetadata: async (id: string) => ({ id, filename: 'out.txt', size_bytes: 5, downloadable: true }),
        download: async () => new Response('hello'),
      };
    }
  }
  return { default: Anthropic, toFile: async (data: any, name: string) => ({ name, data }) };
});

import { POST as chat } from '@/app/api/studio/chat/route';
import { POST as title } from '@/app/api/studio/title/route';
import { POST as checkout } from '@/app/api/studio/checkout/route';
import { GET as usageRoute } from '@/app/api/studio/usage/route';
import { usageKeys } from '@/lib/studio/metering';

const req = (body: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) =>
  new NextRequest('http://localhost:3000/api/studio/chat', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });

const turn = (over: Record<string, unknown> = {}) => ({ model: 'claude-sonnet-5-5', messages: [{ role: 'user', content: 'Hola' }], ...over });

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
  process.env.ANTHROPIC_API_KEY = 'test-key';
  process.env.STRIPE_SECRET_KEY = 'sk_test_x';
  process.env.STRIPE_PRICE_STUDIO_PRO = 'price_x';
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.example';
  delete process.env.STUDIO_FREE_DAILY_GLOBAL_USD;
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

describe('POST /api/studio/chat: refusals', () => {
  it('requires a session', async () => {
    h.authFails = true;
    expect((await chat(req(turn()))).status).toBe(401);
  });

  it('says when Studio is not configured', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await chat(req(turn()));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('NOT_CONFIGURED');
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

  it('keeps Opus for Pro', async () => {
    const res = await chat(req(turn({ model: 'claude-opus-5-5' })));
    expect(res.status).toBe(402);
  });

  it('refuses prompts bigger than the plan allows', async () => {
    const res = await chat(req(turn({ messages: [{ role: 'user', content: 'x'.repeat(600_000) }] })));
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe('CONTEXT_TOO_LARGE');
    expect(h.calls).toHaveLength(0);
  });

  it('refuses when today\'s budget is spent', async () => {
    h.redis.store.set(usageKeys(h.wallet).day, String(150_000)); // $0.15 in micro-dollars
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
    h.redis.store.set(usageKeys(h.wallet).day, String(149_000)); // $0.001 left today
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
    // $0.20 left in the shared pool, less than one Free turn's worst case
    // (prompt + 2 page reads + output + 3 searches), so it must not start.
    process.env.STUDIO_FREE_DAILY_GLOBAL_USD = '0.2';
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
    // 1,000 in * $2/M + 200 out * $10/M = $0.004
    expect(ev.find(e => e.type === 'usage').costUsd).toBeCloseTo(0.004, 6);
    const k = usageKeys(h.wallet);
    expect(Number(h.redis.store.get(k.day))).toBe(4_000);
    expect(Number(h.redis.store.get(k.globalFreeDay))).toBe(4_000);
    expect(Number(h.redis.store.get(k.requests))).toBe(1);
    expect(h.redis.store.has(`studio:lock:${h.wallet}`)).toBe(false);
  });

  it('sends what the API needs and nothing the client tried to add', async () => {
    h.script.push(ok('ok'));
    await events(await chat(req(turn({
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi', cache_control: { type: 'ephemeral', ttl: '1h' } }] }],
      connectors: [{ id: '1', name: 'gh', url: 'http://insecure.example/mcp', enabled: true }],
    }))));
    const p = h.calls[0].params;
    expect(p.model).toBe('claude-sonnet-5-5');
    expect(p.betas).toBeUndefined(); // the http connector was dropped
    expect(p.mcp_servers).toBeUndefined();
    // Our own breakpoint only (no 1-hour TTL from the client).
    expect(p.messages[0].content[0].cache_control).toEqual({ type: 'ephemeral' });
    // Limited by what today's budget leaves after the prompt: ($0.15 - 3,004 est. tokens
    // at $2/M) / $10 per M = 14,399 tokens.
    expect(p.max_tokens).toBe(14_399);
    expect(h.calls[0].options.signal).toBeDefined();
  });

  it('meters a turn that fails part-way and still releases the lock', async () => {
    h.script.push({ started: { input_tokens: 20_000 }, text: ['x'.repeat(300)], error: Object.assign(new Error('boom'), { status: 500 }) });
    const ev = await events(await chat(req(turn())));
    expect(ev.find(e => e.type === 'error').code).toBe('PROVIDER_ERROR');
    expect(ev.at(-1)).toEqual({ type: 'done', stopReason: 'error' });
    // 20,000 * $2/M + 100 * $10/M = $0.041
    expect(Number(h.redis.store.get(usageKeys(h.wallet).day))).toBe(41_000);
    expect(h.redis.store.has(`studio:lock:${h.wallet}`)).toBe(false);
  });

  it('meters a turn the user stopped', async () => {
    h.script.push({ started: { input_tokens: 10_000 }, text: ['abc'], error: Object.assign(new Error('Request was aborted.'), { name: 'AbortError' }) });
    const ev = await events(await chat(req(turn())));
    expect(ev.find(e => e.type === 'error').code).toBe('ABORTED');
    expect(Number(h.redis.store.get(usageKeys(h.wallet).day))).toBe(20_010);
  });

  it('reads a Pro tier from the JSON tier cache and allows Opus', async () => {
    h.redis.store.set(`tier:${h.wallet}`, JSON.stringify({ tier: 'STUDIO_PRO', kycStatus: 'UNVERIFIED' }));
    h.script.push(ok('ok'));
    const res = await chat(req(turn({ model: 'claude-opus-5-5' })));
    expect(res.status).toBe(200);
    await events(res);
    expect(h.calls[0].params.model).toBe('claude-opus-5-5');
    expect(h.redis.store.has(usageKeys(h.wallet).globalFreeDay)).toBe(false); // Pro does not use the free pool
  });
});

describe('POST /api/studio/title', () => {
  it('returns a clean, metered title', async () => {
    const res = await title(new NextRequest('http://localhost:3000/api/studio/title', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'quiero un contrato de escrow' }) }));
    expect(await res.json()).toEqual({ title: 'Contrato de escrow' });
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
    expect(j).toMatchObject({ configured: true, checkoutAvailable: true });
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
  const owned = (kind: 'containers' | 'files', ids: string[]) => h.redis.store.set(`studio:${kind}:${h.wallet}`, JSON.stringify(ids));

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
    expect(h.calls[0].params.messages.at(-1).content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'toolu_1' });
  });

  it('refuses sandbox outputs and containers this wallet did not create', async () => {
    const out = [
      { role: 'user', content: 'run' },
      { role: 'assistant', content: [{ type: 'bash_code_execution_tool_result', tool_use_id: 'srvtoolu_1', content: { type: 'bash_code_execution_result', stdout: '', stderr: '', return_code: 0, content: [{ type: 'bash_code_execution_output', file_id: 'file_someoneelse1' }] } }] },
      { role: 'user', content: 'again' },
    ];
    expect((await chat(req(code({ messages: out })))).status).toBe(400);
    owned('files', ['file_someoneelse1']);
    h.script.push(ok('ok'));
    expect((await chat(req(code({ messages: out })))).status).toBe(200);

    // Someone else's container is dropped, not used.
    h.script.push(ok('ok'));
    await events(await chat(req(code({ sandbox: { enabled: true, containerId: 'cntr_notmine0001' } }))));
    expect(h.calls.at(-1).params.container).toBeUndefined();
    expect(h.calls.at(-1).params.tools.map((x: any) => x.name)).toContain('code_execution');
    owned('containers', ['cntr_mine00000001']);
    h.script.push(ok('ok'));
    await events(await chat(req(code({ sandbox: { enabled: true, containerId: 'cntr_mine00000001' } }))));
    expect(h.calls.at(-1).params.container).toBe('cntr_mine00000001');
  });

  it('remembers the new container and deletes the uploaded workspace copy', async () => {
    h.script.push({ response: { content: [{ type: 'tool_use', id: 'toolu_s', name: 'sync_sandbox', input: {} }], stop_reason: 'tool_use', usage: { input_tokens: 500, output_tokens: 20 } } });
    h.script.push({ response: { content: [{ type: 'text', text: 'ran' }], stop_reason: 'end_turn', container: { id: 'cntr_fresh000001' }, usage: { input_tokens: 600, output_tokens: 20 } } });
    const ev = await events(await chat(req(code({ sandbox: { enabled: true } }))));
    expect(ev.find(e => e.type === 'container')).toMatchObject({ id: 'cntr_fresh000001' });
    expect(h.calls[1].params.messages.at(-1).content.some((b: any) => b.type === 'container_upload')).toBe(true);
    expect(h.files).toEqual([['upload', expect.stringMatching(/^ledger-workspace-.*\.zip$/)], ['delete', 'file_upload00001']]);
    expect(JSON.parse(h.redis.store.get(`studio:containers:${h.wallet}`)!)).toEqual(['cntr_fresh000001']);
    // The stored history has no reference to the uploaded file.
    expect(JSON.stringify(ev.find(e => e.type === 'messages'))).not.toContain('file_upload00001');
  });

  it('does not offer the sandbox in Chat mode or while planning', async () => {
    h.script.push(ok('ok'));
    await events(await chat(req(turn({ sandbox: { enabled: true } }))));
    expect(h.calls.at(-1).params.tools.map((x: any) => x.name ?? x.type)).not.toContain('code_execution');
    h.script.push(ok('ok'));
    await events(await chat(req(code({ permission: 'plan', sandbox: { enabled: true } }))));
    expect(h.calls.at(-1).params.tools.map((x: any) => x.name ?? x.type)).not.toContain('code_execution');
  });

  it('refuses a workspace over the size limit', async () => {
    const big = Array.from({ length: 21 }, (_, i) => ({ path: `f${i}.txt`, content: 'x'.repeat(399_000) }));
    const res = await chat(req(code({ workspace: { files: big } })));
    expect(res.status).toBe(413);
  });
});
