import { NextRequest, NextResponse } from 'next/server';
import { BYOK_TPM_LIMIT, byokFromHeaders, createStudioClient, serverDefaultModel, studioApiKey, studioTpmLimit } from '@/lib/studio/client';
import { requireWallet } from '@/lib/security/requireWallet';
import { chatRequestSchema, encodeEvent, MAX_REQUEST_BYTES, type StudioEvent } from '@/lib/studio/protocol';
import { UNLIMITED_PRO, affordableOutputTokens, isStudioModel, planAllowsModel, promptCostUsd, STUDIO_MODELS, worstCaseFirstCallUsd } from '@/lib/studio/models';
import { acquireTurnLock, readUsage, recordUsage, releaseFreeCapacity, releaseTurnLock, reserveFreeCapacity, resolvePlan, type FreeReservation } from '@/lib/studio/metering';
import { AgentError, describeApiError, MIN_OUTPUT_TOKENS, runAgent, type AgentResult } from '@/lib/studio/agent';
import { checkRateLimit, getClientIP } from '@/lib/security/rateLimiter';
import { estimateInputTokens, sanitizeMessages, validateTurnShape } from '@/lib/studio/sanitize';
import { MAX_WS_TEXT_CHARS } from '@/lib/studio/fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Stop starting new API calls after this, well inside maxDuration. */
const TURN_DEADLINE_MS = 270_000;

const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * POST /api/studio/chat — one Ledger Studio turn, streamed as NDJSON.
 *
 * The conversation lives on the user's device and is sent with each turn;
 * this route stores none of it. It meters usage per wallet, enforces the
 * plan (models, budget, prompt size) and runs the agent loop.
 * CSRF is enforced by the middleware for every API mutation.
 *
 * Provider: Groq (GROQ_API_KEY), since November 2026. Each model call is
 * fitted to the free tier's tokens-per-minute limit by lib/studio/groq.ts,
 * so a long conversation still gets an answer: its oldest messages are left
 * out of that call (the browser keeps the full history).
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  const wallet = auth.walletAddress;

  // Bring your own key: the user's provider pays, Studio's allowance is not touched.
  const byok = byokFromHeaders(req.headers);
  const apiKey = byok?.key ?? studioApiKey();
  if (!apiKey) return json(503, { error: 'NOT_CONFIGURED', message: 'Ledger Studio is not configured on this server yet: the operator needs to set GROQ_API_KEY.' });

  if (!(req.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return json(415, { error: 'BAD_REQUEST', message: 'Send JSON.' });
  }
  const len = Number(req.headers.get('content-length') || 0);
  if (len > MAX_REQUEST_BYTES) return json(413, { error: 'TOO_LARGE', message: 'This message and its files are too large. Remove some files.' });

  let raw: string;
  try { raw = await req.text(); } catch { return json(400, { error: 'BAD_REQUEST', message: 'Could not read the request.' }); }
  if (raw.length > MAX_REQUEST_BYTES) return json(413, { error: 'TOO_LARGE', message: 'This message and its files are too large.' });

  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json(400, { error: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return json(400, { error: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid request.' });
  const request = parsed.data;
  const shapeError = validateTurnShape(request);
  if (shapeError) return json(400, { error: 'BAD_REQUEST', message: shapeError });
  if (request.workspace && request.workspace.files.reduce((n, f) => n + f.content.length, 0) > MAX_WS_TEXT_CHARS) {
    return json(413, { error: 'TOO_LARGE', message: 'The workspace is too large. Remove some files.' });
  }

  const clean = sanitizeMessages(request.messages);
  if (!clean.ok) return json(400, { error: 'BAD_REQUEST', message: clean.error });
  request.messages = clean.messages;
  // Not available on this provider; older clients may still send them.
  request.sandbox = undefined;
  request.connectors = undefined;
  request.tools = undefined;

  const plan = byok ? UNLIMITED_PRO : await resolvePlan(wallet);
  // Unknown ids (for example a claude-* model saved before the migration) fall back to the server default.
  const model = isStudioModel(request.model) ? request.model : serverDefaultModel();
  if (!planAllowsModel(plan.id, model)) {
    return json(402, { error: 'PLAN_REQUIRED', message: `${STUDIO_MODELS[model].label} is part of Studio Pro.` });
  }

  // Wallets cost nothing to create, so also limit by network address.
  const rl = await checkRateLimit(`${plan.id}:${getClientIP(req)}`, { max: plan.requestsPerHourPerIp, windowSec: 3600, prefix: 'rl:studio' });
  if (!rl.allowed) {
    return json(429, { error: 'RATE_LIMITED', message: 'Too many Studio requests from this network. Try again later.', resetsAt: new Date(rl.resetAt * 1000).toISOString() });
  }

  const estimated = estimateInputTokens(request);
  // What one call can actually send: each call is fitted to the per-minute limit.
  const tpmLimit = byok ? BYOK_TPM_LIMIT : studioTpmLimit();
  const perCallPrompt = Math.min(estimated, tpmLimit);
  if (estimated > plan.maxInputTokens) {
    return json(413, {
      error: 'CONTEXT_TOO_LARGE',
      message: plan.id === 'free'
        ? 'This conversation and its files are too long for the Free plan. Start a new chat, remove files, or upgrade to Pro.'
        : 'This conversation and its files are too long. Start a new chat or remove some files.',
    });
  }

  const usage = await readUsage(wallet, plan);
  if (!usage.meteringAvailable) {
    return json(503, { error: 'METERING_UNAVAILABLE', message: 'Studio cannot check your allowance right now. Try again in a minute.' });
  }
  if (usage.remainingTodayUsd <= 0 || usage.remainingMonthUsd <= 0) {
    return json(429, {
      error: 'LIMIT_REACHED',
      message: usage.remainingMonthUsd <= 0 ? 'You have used this month\'s Studio allowance.' : 'You have used today\'s Studio allowance.',
      resetsAt: usage.remainingMonthUsd <= 0 ? usage.resetsMonthAt : usage.resetsDayAt,
      plan: plan.id,
    });
  }
  const freeCapacityResponse = () =>
    json(429, { error: 'FREE_CAPACITY', message: 'The Free plan has reached today\'s shared capacity. It resets at midnight UTC, or upgrade to Pro.', resetsAt: usage.resetsDayAt, plan: plan.id });
  if (usage.freeCapacityReached) return freeCapacityResponse();

  // A single call must be affordable: the prompt alone, uncached, may not
  // cost more than what is left (otherwise one request could spend many days
  // of allowance at once).
  const budgetUsd = Math.min(usage.remainingTodayUsd, usage.remainingMonthUsd);
  const firstPromptUsd = promptCostUsd(model, perCallPrompt);
  if (firstPromptUsd > budgetUsd) {
    return json(429, {
      error: 'OVER_BUDGET',
      message: 'What is left of today\'s Studio allowance is not enough for this conversation. Start a new chat, remove files, or wait for the allowance to renew.',
      resetsAt: usage.remainingMonthUsd < usage.remainingTodayUsd ? usage.resetsMonthAt : usage.resetsDayAt,
      plan: plan.id,
    });
  }

  const lock = await acquireTurnLock(wallet);
  if (!lock) return json(409, { error: 'BUSY', message: 'Studio is already answering in another tab. Wait for it to finish.' });

  // Free plan: hold this turn's worst case against the shared daily ceiling
  // before it starts, so a burst of new wallets cannot overrun it.
  let reservation: FreeReservation | null = null;
  if (plan.id === 'free') {
    const maxOut = Math.max(MIN_OUTPUT_TOKENS, Math.min(STUDIO_MODELS[model].maxOutputTokens, affordableOutputTokens(model, budgetUsd - firstPromptUsd)));
    reservation = await reserveFreeCapacity(worstCaseFirstCallUsd(model, plan, perCallPrompt, Math.min(maxOut, studioTpmLimit())));
    if (!reservation) {
      await releaseTurnLock(wallet, lock);
      return freeCapacityResponse();
    }
  }

  const client = createStudioClient(apiKey, byok ? { timeout: TURN_DEADLINE_MS, baseUrl: byok.baseUrl, tpmLimit } : { timeout: TURN_DEADLINE_MS });
  const abort = new AbortController();
  req.signal.addEventListener('abort', () => abort.abort());

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (e: StudioEvent) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(encodeEvent(e))); } catch { closed = true; }
      };
      const record = async (r: AgentResult) => {
        const u = r.usage;
        const tokens = u.input_tokens + u.output_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens;
        // With the user's own key nothing is charged to their Studio allowance.
        await recordUsage(wallet, byok ? 0 : r.costUsd, tokens, u.webSearches, plan.id);
        emit({
          type: 'usage',
          inputTokens: u.input_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens,
          outputTokens: u.output_tokens,
          costUsd: r.costUsd,
          webSearches: u.webSearches,
          ...(r.contextTokens ? { contextTokens: r.contextTokens } : {}),
          remainingTodayUsd: Math.max(0, usage.remainingTodayUsd - r.costUsd),
        });
      };
      try {
        const result = await runAgent({
          client, req: request, model, plan, emit, signal: abort.signal, budgetUsd, firstPromptUsd, deadlineAt: startedAt + TURN_DEADLINE_MS,
        });
        await record(result);
        emit({ type: 'done', stopReason: result.stopReason });
      } catch (e) {
        // Usage up to the failure (or the Stop button) is still metered.
        if (e instanceof AgentError) {
          await record(e.partial).catch(() => {});
        }
        const d = describeApiError(e);
        // Never log the request: it holds the user's conversation.
        if (d.code !== 'ABORTED') console.error('[studio/chat]', d.code, (e instanceof AgentError ? (e.original as any)?.status : (e as any)?.status) ?? '');
        emit({ type: 'error', code: d.code, message: d.message });
        emit({ type: 'done', stopReason: 'error' });
      } finally {
        // recordUsage has added the real cost; drop the hold.
        await releaseFreeCapacity(reservation);
        await releaseTurnLock(wallet, lock);
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
