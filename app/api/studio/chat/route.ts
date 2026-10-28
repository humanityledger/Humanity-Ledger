import { NextRequest, NextResponse } from 'next/server';
import { createStudioClient } from '@/lib/studio/client';
import { requireWallet } from '@/lib/security/requireWallet';
import { chatRequestSchema, encodeEvent, MAX_REQUEST_BYTES, type StudioEvent } from '@/lib/studio/protocol';
import { affordableOutputTokens, DEFAULT_MODEL, isStudioModel, planAllowsModel, promptCostUsd, STUDIO_MODELS, worstCaseFirstCallUsd } from '@/lib/studio/models';
import { acquireTurnLock, readUsage, recordUsage, releaseFreeCapacity, releaseTurnLock, reserveFreeCapacity, resolvePlan, type FreeReservation } from '@/lib/studio/metering';
import { AgentError, describeApiError, MIN_OUTPUT_TOKENS, runAgent, type AgentResult } from '@/lib/studio/agent';
import { checkRateLimit, getClientIP } from '@/lib/security/rateLimiter';
import { estimateInputTokens, sanitizeMessages, validateTurnShape } from '@/lib/studio/sanitize';
import { createSandboxIo, deleteUploads, outputFileIdsIn, ownedIds, rememberOwned } from '@/lib/studio/sandbox';
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
 * plan (models, budget, prompt size, connectors) and runs the agent loop.
 * CSRF is enforced by the middleware for every API mutation.
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const auth = await requireWallet(req);
  if (auth.errorResponse) return auth.errorResponse;
  const wallet = auth.walletAddress;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return json(503, { error: 'NOT_CONFIGURED', message: 'Ledger Studio is not configured on this server yet (ANTHROPIC_API_KEY).' });

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

  // Sandbox outputs in the history must be files this wallet's sandbox made.
  let ownedFileIds: Set<string> | undefined;
  if (outputFileIdsIn(request.messages).length) {
    const owned = await ownedIds('files', wallet);
    if (!owned) return json(503, { error: 'METERING_UNAVAILABLE', message: 'Studio cannot check this conversation right now. Try again in a minute.' });
    ownedFileIds = owned;
  }
  const clean = sanitizeMessages(request.messages, { ownedFileIds });
  if (!clean.ok) return json(400, { error: 'BAD_REQUEST', message: clean.error });
  request.messages = clean.messages;

  // Code execution: only in Code mode, and only this wallet's own container.
  const sandboxOn = request.mode === 'code' && !!request.sandbox?.enabled && request.permission !== 'plan';
  if (!sandboxOn) request.sandbox = undefined;
  else if (request.sandbox?.containerId) {
    const owned = await ownedIds('containers', wallet);
    if (!owned?.has(request.sandbox.containerId)) request.sandbox = { enabled: true };
  }

  const plan = await resolvePlan(wallet);
  const model = isStudioModel(request.model) ? request.model : DEFAULT_MODEL;
  if (!planAllowsModel(plan.id, model)) {
    return json(402, { error: 'PLAN_REQUIRED', message: `${STUDIO_MODELS[model].label} is part of Studio Pro.` });
  }

  // Wallets cost nothing to create, so also limit by network address.
  const rl = await checkRateLimit(`${plan.id}:${getClientIP(req)}`, { max: plan.requestsPerHourPerIp, windowSec: 3600, prefix: 'rl:studio' });
  if (!rl.allowed) {
    return json(429, { error: 'RATE_LIMITED', message: 'Too many Studio requests from this network. Try again later.', resetsAt: new Date(rl.resetAt * 1000).toISOString() });
  }

  const estimated = estimateInputTokens(request);
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
  const firstPromptUsd = promptCostUsd(model, estimated);
  if (firstPromptUsd > budgetUsd) {
    return json(429, {
      error: 'OVER_BUDGET',
      message: 'This conversation is longer than what is left of your Studio allowance. Start a new chat, remove files, pick a lighter model, or wait for the allowance to renew.',
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
    reservation = await reserveFreeCapacity(worstCaseFirstCallUsd(model, plan, estimated, maxOut));
    if (!reservation) {
      await releaseTurnLock(wallet, lock);
      return freeCapacityResponse();
    }
  }

  const client = createStudioClient(apiKey, { maxRetries: 2, timeout: TURN_DEADLINE_MS });
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
      const keep = async (r: AgentResult) => {
        // Remember what this wallet's sandbox owns; drop the workspace copies.
        if (r.containerId) await rememberOwned('containers', wallet, [r.containerId]).catch(() => {});
        if (r.outputFileIds.length) await rememberOwned('files', wallet, r.outputFileIds).catch(() => {});
        if (r.uploadedFileIds.length) await deleteUploads(client, r.uploadedFileIds);
      };
      const record = async (r: AgentResult) => {
        const u = r.usage;
        const tokens = u.input_tokens + u.output_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens;
        await recordUsage(wallet, r.costUsd, tokens, u.webSearches, plan.id);
        emit({
          type: 'usage',
          inputTokens: u.input_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens,
          outputTokens: u.output_tokens,
          costUsd: r.costUsd,
          webSearches: u.webSearches,
          remainingTodayUsd: Math.max(0, usage.remainingTodayUsd - r.costUsd),
        });
      };
      try {
        const result = await runAgent({
          client, req: request, model, plan, emit, signal: abort.signal, budgetUsd, firstPromptUsd, deadlineAt: startedAt + TURN_DEADLINE_MS,
          sandboxIo: sandboxOn ? createSandboxIo(client) : undefined,
        });
        await record(result);
        await keep(result);
        emit({ type: 'done', stopReason: result.stopReason });
      } catch (e) {
        // Usage up to the failure (or the Stop button) is still metered.
        if (e instanceof AgentError) {
          await record(e.partial).catch(() => {});
          await keep(e.partial).catch(() => {});
        }
        const d = describeApiError(e);
        // Never log the request: it holds the user's conversation and connector tokens.
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
