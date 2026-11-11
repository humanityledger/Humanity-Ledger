/**
 * lib/studio/groq.ts — Ledger Studio's AI provider: Groq, through its OpenAI-compatible
 * Chat Completions API (https://api.groq.com/openai/v1). Server only.
 *
 * Migrated from Anthropic on 11 November 2026 so Studio runs on Groq's free tier at no cost
 * to the operator. Plain fetch, no SDK: this environment could not add a package, and the
 * endpoint is the documented OpenAI-compatible one.
 *
 * Studio keeps its own message format (content blocks: text, tool_use, tool_result…),
 * which the browser stores and sends back each turn. This module translates it to Groq's
 * chat messages, streams the answer, and translates the result back, so the agent loop,
 * the history on users' devices and the interface do not depend on the provider.
 *
 * Free-tier limits are per organisation and per model (console.groq.com/docs/rate-limits):
 * 8,000 tokens per minute is the binding one. So each call:
 *   - is sized to fit that limit: the prompt (system + tools + history) plus the output
 *     it may write; older messages are left out, oldest first, when the history does not
 *     fit (the caller is told, and tells the user);
 *   - falls back to another model when the chosen one is rate limited (each model has
 *     its own bucket), waits briefly when all are, and otherwise fails with a clear code.
 */

import { MODEL_FALLBACKS, STUDIO_MODELS, type StudioModelId } from './models';
import type { SystemBlock } from './prompt';

export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
/** Groq free tier, per model (console.groq.com/docs/rate-limits, 2026-11-11). */
export const DEFAULT_TPM_LIMIT = 8_000;
/** Never ask for fewer output tokens than this (reasoning models think before they answer). */
export const MIN_CALL_OUTPUT = 1_024;
/** Each tool result sent back to the model is cut to this many characters. */
export const MAX_TOOL_RESULT_CHARS = 12_000;
/** Pessimistic: tokenizers average 3.5 to 4 characters per token for English and code. */
const CHARS_PER_TOKEN = 3.2;
/** Headroom under the tokens-per-minute limit for our own estimation error. */
const TPM_SAFETY = 0.92;
/** Wait at most this long for a per-minute limit to reset before giving up. */
const MAX_RATE_WAIT_MS = 20_000;

export interface InternalTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ProviderParams {
  model: StudioModelId;
  /** The most output the caller wants (allowance, model limit); the TPM limit may lower it. */
  max_tokens: number;
  system: SystemBlock[];
  /** Studio's message format (content blocks), oldest first. */
  messages: any[];
  tools: InternalTool[];
  reasoning_effort?: 'low' | 'medium' | 'high';
  /** Try other models when this one is rate limited (default true). */
  fallback?: boolean;
}

export type ProviderEvent =
  | { type: 'text'; delta: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'tool_call'; id: string; name: string }
  | { type: 'model'; model: StudioModelId }
  | { type: 'trimmed'; dropped: number };

export interface ProviderResult {
  content: any[];
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'refusal';
  usage: { input_tokens: number; output_tokens: number };
  model: StudioModelId;
  /** Messages left out of this call to fit the tokens-per-minute limit. */
  trimmed: number;
}

export type ProviderErrorCode =
  | 'PROVIDER_AUTH'
  | 'PROVIDER_BUSY'
  | 'PROVIDER_DAILY_LIMIT'
  | 'PROVIDER_OVERLOADED'
  | 'CONTEXT_TOO_LARGE'
  | 'TOOL_CALL_FAILED'
  | 'BAD_REQUEST'
  | 'PROVIDER_ERROR';

/** A provider failure, classified. `outputChars`/`promptTokens` say what the failed call used. */
export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly status: number,
    public readonly retryAfterSec?: number,
    public readonly outputChars = 0,
    public readonly promptTokens = 0,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface StudioClient {
  complete(
    params: ProviderParams,
    opts?: { signal?: AbortSignal; onEvent?: (e: ProviderEvent) => void; deadlineAt?: number; now?: () => number },
  ): Promise<ProviderResult>;
}

export interface GroqConfig {
  apiKey: string;
  baseUrl?: string;
  /** Tokens per minute per model (GROQ_TPM_LIMIT; 8,000 on the free tier). */
  tpmLimit?: number;
  /** Per call, in ms. */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

/* ── message translation ─────────────────────────────────────────────── */

type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[] }
  | { role: 'tool'; tool_call_id: string; content: string };

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}\n[… ${s.length - n} more characters left out]` : s);

/** Text of a tool_result's content (string or blocks). */
function toolResultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(c => (c?.type === 'text' ? String(c.text ?? '') : c?.type === 'image' ? '[image]' : '')).join('\n');
  return '';
}

/** One user block as text; images and PDFs are described, since these models read text only. */
function userBlockText(b: any): string {
  if (!b || typeof b !== 'object') return '';
  switch (b.type) {
    case 'text': return String(b.text ?? '');
    case 'image': return '[The user attached an image. This model reads text only and cannot see it; say so if the image matters.]';
    case 'document':
      if (b.source?.type === 'text' && typeof b.source.data === 'string') return `<document${b.title ? ` name="${String(b.title).replace(/"/g, "'")}"` : ''}>\n${b.source.data}\n</document>`;
      return `[The user attached a document${b.title ? ` (${String(b.title)})` : ''}. This model reads text only and cannot open it; ask for the text if it matters.]`;
    case 'search_result': return `${b.title ?? ''}\n${toolResultText(b.content)}`;
    default: return '';
  }
}

/**
 * Studio messages → Groq chat messages. Every tool call is answered (a call without a
 * result, or a result without its call, is rejected by the API), and blocks from the
 * Anthropic era (server tools, thinking, compaction) are dropped or summarised.
 */
export function toChatMessages(system: SystemBlock[], messages: any[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  const sys = system.map(b => b.text).filter(Boolean).join('\n\n');
  if (sys) out.push({ role: 'system', content: sys });

  for (const m of messages) {
    const blocks: any[] = typeof m?.content === 'string' ? [{ type: 'text', text: m.content }] : Array.isArray(m?.content) ? m.content : [];
    if (m?.role === 'assistant') {
      // A legacy compaction block (Anthropic context management) carries a summary of what came before.
      const text = blocks
        .map(b => b?.type === 'text' ? String(b.text ?? '') : b?.type === 'compaction' && typeof b.content === 'string' && b.content ? `[Summary of the earlier conversation]\n${b.content}\n\n` : '')
        .join('');
      const calls = blocks
        .filter(b => b?.type === 'tool_use' && typeof b.id === 'string' && typeof b.name === 'string')
        .map(b => ({ id: b.id, type: 'function' as const, function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }));
      // Earlier web searches (Anthropic server tools) leave a short trace so the model keeps the thread.
      const searched = blocks.filter(b => b?.type === 'server_tool_use' && b.input?.query).map(b => String(b.input.query));
      const note = searched.length ? `\n[Earlier web searches: ${searched.slice(0, 5).join('; ')}]` : '';
      if (!text && !calls.length && !note) continue;
      out.push({ role: 'assistant', content: text || note ? `${text}${note}` : null, ...(calls.length ? { tool_calls: calls } : {}) });
    } else if (m?.role === 'user') {
      for (const b of blocks) {
        if (b?.type === 'tool_result' && typeof b.tool_use_id === 'string') {
          const t = toolResultText(b.content);
          out.push({ role: 'tool', tool_call_id: b.tool_use_id, content: clip(b.is_error ? `Error: ${t}` : t || '(no output)', MAX_TOOL_RESULT_CHARS) });
        }
      }
      const text = blocks.filter(b => b?.type !== 'tool_result').map(userBlockText).filter(Boolean).join('\n\n');
      if (text) out.push({ role: 'user', content: text });
    }
  }
  return repairToolPairs(out);
}

/** Every assistant tool call gets exactly one tool message right after it; strays are dropped. */
function repairToolPairs(msgs: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role === 'tool') continue; // handled with its assistant message
    out.push(m);
    if (m.role !== 'assistant' || !m.tool_calls?.length) continue;
    const results = new Map<string, ChatMessage>();
    let j = i + 1;
    while (j < msgs.length && msgs[j].role === 'tool') {
      const t = msgs[j] as Extract<ChatMessage, { role: 'tool' }>;
      if (!results.has(t.tool_call_id)) results.set(t.tool_call_id, t);
      j++;
    }
    for (const c of m.tool_calls) {
      out.push(results.get(c.id) ?? { role: 'tool', tool_call_id: c.id, content: 'This tool call was not run.' });
    }
    i = j - 1;
  }
  return out;
}

export function toChatTools(tools: InternalTool[]) {
  return tools
    .filter(t => t && typeof t.name === 'string' && !('type' in (t as any)))
    .map(t => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.input_schema } }));
}

/* ── sizing to the tokens-per-minute limit ───────────────────────────── */

export function estimateTokens(value: unknown): number {
  const s = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return Math.ceil(s.length / CHARS_PER_TOKEN);
}

const messageTokens = (m: ChatMessage) => 6 + estimateTokens((m as any).content ?? '') + ((m as any).tool_calls ? estimateTokens((m as any).tool_calls) : 0);

/**
 * Leaves out the oldest messages until the prompt fits `promptBudget` tokens. The system
 * message and the latest user turn are always kept; the result starts with a user message
 * and never splits a tool call from its results. Returns how many messages were left out.
 */
export function fitToBudget(msgs: ChatMessage[], toolsTokens: number, promptBudget: number): { messages: ChatMessage[]; dropped: number; promptTokens: number } {
  const sys = msgs[0]?.role === 'system' ? [msgs[0]] : [];
  let rest = msgs.slice(sys.length);
  const total = (list: ChatMessage[]) => toolsTokens + [...sys, ...list].reduce((n, m) => n + messageTokens(m), 0);
  let dropped = 0;
  // The last user message (with whatever follows it in this turn) is never dropped.
  let lastUser = -1;
  for (let i = rest.length - 1; i >= 0; i--) if (rest[i].role === 'user') { lastUser = i; break; }
  while (total(rest) > promptBudget && lastUser > 0) {
    rest = rest.slice(1);
    dropped++;
    lastUser--;
    // Start on a user message: drop the assistant/tool messages that would now lead.
    while (rest.length && rest[0].role !== 'user' && lastUser > 0) { rest = rest.slice(1); dropped++; lastUser--; }
  }
  // Still too long inside the current turn (a tool loop that read many files): shorten the
  // older tool results, oldest first, keeping the newest two in full.
  if (total(rest) > promptBudget) {
    const toolIdx = rest.map((m, i) => (m.role === 'tool' ? i : -1)).filter(i => i >= 0);
    for (const i of toolIdx.slice(0, Math.max(0, toolIdx.length - 2))) {
      if (total(rest) <= promptBudget) break;
      const t = rest[i] as Extract<ChatMessage, { role: 'tool' }>;
      if (t.content.length > 600) rest = [...rest.slice(0, i), { ...t, content: clip(t.content, 600) }, ...rest.slice(i + 1)];
    }
  }
  return { messages: [...sys, ...rest], dropped, promptTokens: total(rest) };
}

/**
 * Shortens the system prompt to `maxTokens` when it is too long by itself (large
 * project documents or artifacts). The first block (identity and rules) is kept whole;
 * the others are cut in the middle, largest first, so their opening and their last
 * lines (personalization, answer language) survive. Returns the blocks and whether
 * anything was cut.
 */
export function fitSystem(system: SystemBlock[], maxTokens: number): { system: SystemBlock[]; clipped: boolean } {
  const size = (list: SystemBlock[]) => list.reduce((n, b) => n + estimateTokens(b.text) + 2, 0);
  if (size(system) <= maxTokens || system.length < 2) return { system, clipped: false };
  const out = system.map(b => ({ ...b }));
  const MARK = "\n[… shortened to fit Studio's free AI limits …]\n";
  for (let guard = 0; guard < 20 && size(out) > maxTokens; guard++) {
    let k = 1;
    for (let i = 2; i < out.length; i++) if (out[i].text.length > out[k].text.length) k = i;
    const over = Math.ceil((size(out) - maxTokens) * CHARS_PER_TOKEN) + MARK.length + 64;
    const t = out[k].text;
    if (t.length <= 400) break; // nothing sensible left to cut
    const keep = Math.max(200, t.length - over);
    const head = Math.ceil(keep * 0.7);
    out[k] = { ...out[k], text: `${t.slice(0, head)}${MARK}${t.slice(t.length - (keep - head))}` };
  }
  return { system: out, clipped: true };
}

/* ── the call ────────────────────────────────────────────────────────── */

const defaultSleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>(res => {
    const t = setTimeout(res, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); res(); }, { once: true });
  });

const isAbort = (e: unknown) => (e as any)?.name === 'AbortError' || /aborted/i.test(String((e as any)?.message ?? ''));

/** Classifies a non-2xx answer from Groq. */
export function classifyGroqError(status: number, body: any, headers?: Headers): { code: ProviderErrorCode | 'MODEL_UNAVAILABLE' | 'TPM_TOO_LARGE' | 'RATE_MINUTE' | 'RATE_DAY'; message: string; retryAfterSec?: number; limit?: number; requested?: number } {
  const err = body?.error ?? {};
  const message = String(err.message ?? body?.message ?? `HTTP ${status}`);
  const code = String(err.code ?? '');
  const retryAfter = Number(headers?.get('retry-after'));
  const retryAfterSec = Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter : undefined;
  const tpm = /Limit\s+(\d+),\s*Requested\s+(\d+)/i.exec(message);
  if (status === 401 || status === 403) return { code: 'PROVIDER_AUTH', message };
  if (status === 404 || code === 'model_not_found' || /model .*(does not exist|decommissioned|not found|not supported)/i.test(message)) return { code: 'MODEL_UNAVAILABLE', message };
  if (status === 413 || (/request too large/i.test(message) && tpm)) {
    return { code: 'TPM_TOO_LARGE', message, limit: tpm ? Number(tpm[1]) : undefined, requested: tpm ? Number(tpm[2]) : undefined };
  }
  if (status === 429) {
    if (/per day|\(RPD\)|\(TPD\)|daily/i.test(message)) return { code: 'RATE_DAY', message, retryAfterSec };
    return { code: 'RATE_MINUTE', message, retryAfterSec };
  }
  if (status === 400 && (code === 'tool_use_failed' || /failed to call a function|tool call validation|tool_use_failed/i.test(message))) return { code: 'TOOL_CALL_FAILED', message };
  if (status === 498 || status === 503 || status === 502 || status === 500 || status === 504) return { code: 'PROVIDER_OVERLOADED', message, retryAfterSec };
  if (status === 400 || status === 422) return { code: 'BAD_REQUEST', message };
  return { code: 'PROVIDER_ERROR', message };
}

interface StreamOutcome {
  text: string;
  reasoningChars: number;
  calls: { id: string; name: string; args: string }[];
  finish: string | null;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** Reads Groq's SSE stream (OpenAI chat.completion.chunk objects). */
export async function readChatStream(body: ReadableStream<Uint8Array>, onEvent?: (e: ProviderEvent) => void, onChars?: (n: number) => void): Promise<StreamOutcome> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const out: StreamOutcome = { text: '', reasoningChars: 0, calls: [], finish: null };
  const byIndex = new Map<number, { id: string; name: string; args: string; announced: boolean }>();
  let buf = '';
  const handle = (data: string) => {
    if (data === '[DONE]') return;
    let chunk: any;
    try { chunk = JSON.parse(data); } catch { return; }
    if (chunk?.error) {
      const e = classifyGroqError(Number(chunk.error.status) || 500, chunk);
      throw new ProviderError(e.code === 'MODEL_UNAVAILABLE' || e.code === 'TPM_TOO_LARGE' || e.code === 'RATE_DAY' || e.code === 'RATE_MINUTE' ? 'PROVIDER_ERROR' : e.code, e.message, 502);
    }
    const usage = chunk?.x_groq?.usage ?? chunk?.usage;
    if (usage) out.usage = usage;
    for (const choice of chunk?.choices ?? []) {
      const d = choice?.delta ?? {};
      if (typeof d.content === 'string' && d.content) { out.text += d.content; onChars?.(d.content.length); onEvent?.({ type: 'text', delta: d.content }); }
      const r = typeof d.reasoning === 'string' ? d.reasoning : typeof d.reasoning_content === 'string' ? d.reasoning_content : '';
      if (r) { out.reasoningChars += r.length; onChars?.(r.length); onEvent?.({ type: 'reasoning', delta: r }); }
      for (const tc of Array.isArray(d.tool_calls) ? d.tool_calls : []) {
        const idx = Number.isInteger(tc?.index) ? tc.index : byIndex.size;
        const cur = byIndex.get(idx) ?? { id: '', name: '', args: '', announced: false };
        if (typeof tc?.id === 'string' && tc.id) cur.id = tc.id;
        if (typeof tc?.function?.name === 'string' && tc.function.name) cur.name = cur.name || tc.function.name;
        if (typeof tc?.function?.arguments === 'string') { cur.args += tc.function.arguments; onChars?.(tc.function.arguments.length); }
        byIndex.set(idx, cur);
        if (!cur.announced && cur.name) { cur.announced = true; onEvent?.({ type: 'tool_call', id: cur.id, name: cur.name }); }
      }
      if (choice?.finish_reason) out.finish = String(choice.finish_reason);
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line.startsWith('data:')) handle(line.slice(5).trim());
    }
  }
  const tail = buf.trim();
  if (tail.startsWith('data:')) handle(tail.slice(5).trim());
  out.calls = [...byIndex.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c).filter(c => c.name);
  return out;
}

let callSeq = 0;
const newCallId = () => `call_${Date.now().toString(36)}${(callSeq++).toString(36)}`;

/** Studio blocks from a finished stream. */
export function toResult(s: StreamOutcome, model: StudioModelId, promptTokens: number, trimmed: number): ProviderResult {
  const content: any[] = [];
  if (s.text) content.push({ type: 'text', text: s.text });
  for (const c of s.calls) {
    let input: any = {};
    try { input = c.args.trim() ? JSON.parse(c.args) : {}; } catch { input = { __invalid_arguments: c.args.slice(0, 2_000) }; }
    if (!input || typeof input !== 'object' || Array.isArray(input)) input = { value: input };
    content.push({ type: 'tool_use', id: c.id || newCallId(), name: c.name, input });
  }
  // Cut off by the output limit wins over tool calls: a call cut off mid-arguments is not run.
  const stop: ProviderResult['stop_reason'] =
    s.finish === 'length' ? 'max_tokens' : s.calls.length ? 'tool_use' : s.finish === 'content_filter' ? 'refusal' : 'end_turn';
  const input_tokens = Number(s.usage?.prompt_tokens) || promptTokens;
  const output_tokens = Number(s.usage?.completion_tokens) || Math.ceil((s.text.length + s.reasoningChars + s.calls.reduce((n, c) => n + c.args.length, 0)) / 3);
  return { content, stop_reason: stop, usage: { input_tokens, output_tokens }, model, trimmed };
}

export function createGroqClient(cfg: GroqConfig): StudioClient {
  const baseUrl = (cfg.baseUrl || GROQ_BASE_URL).replace(/\/+$/, '');
  const tpm = cfg.tpmLimit && cfg.tpmLimit >= 2_000 ? cfg.tpmLimit : DEFAULT_TPM_LIMIT;
  const doFetch = cfg.fetchImpl ?? fetch;
  const sleep = cfg.sleep ?? defaultSleep;
  const timeoutMs = cfg.timeoutMs ?? 120_000;

  return {
    async complete(params, opts = {}) {
      const { signal, onEvent } = opts;
      const now = opts.now ?? Date.now;
      const deadlineAt = opts.deadlineAt ?? Infinity;
      const order: StudioModelId[] = [params.model, ...(params.fallback === false ? [] : MODEL_FALLBACKS[params.model] ?? [])];
      const exhaustedToday = new Set<StudioModelId>();
      const tools = toChatTools(params.tools);
      const toolsTokens = tools.length ? estimateTokens(tools) : 0;
      // The newest user turn must fit next to the system prompt; budget for at least this much of it.
      const lastUserTokens = (() => {
        const all = toChatMessages([], params.messages);
        for (let i = all.length - 1; i >= 0; i--) if (all[i].role === 'user') return Math.min(2_000, 6 + estimateTokens((all[i] as any).content ?? ''));
        return 0;
      })();
      let shrink = 0; // extra tokens to leave out after Groq said a request was too large
      let toolRetry = false;
      let waitedForMinute = false;
      let transient = 0;
      const busy = new Set<StudioModelId>(); // rate limited this minute
      let retryAfterSec: number | undefined;
      const busyError = () => new ProviderError('PROVIDER_BUSY', "Studio's free AI capacity is busy right now. Try again in a minute.", 429, retryAfterSec);

      for (let attempt = 0; attempt < 12; attempt++) {
        if (signal?.aborted) throw Object.assign(new Error('Request was aborted.'), { name: 'AbortError' });
        const model = order.find(m => !exhaustedToday.has(m) && !busy.has(m));
        if (!model) {
          if (order.every(m => exhaustedToday.has(m))) {
            throw new ProviderError('PROVIDER_DAILY_LIMIT', "Studio's free AI capacity for today is used up. It renews within 24 hours.", 429);
          }
          // Every model left is busy this minute: wait once if the limit resets soon, then go round again.
          const waitMs = Math.min(MAX_RATE_WAIT_MS, Math.max(1_000, ((retryAfterSec ?? 10) + 1) * 1_000));
          if (!waitedForMinute && now() + waitMs + 15_000 < deadlineAt) {
            waitedForMinute = true;
            await sleep(waitMs, signal);
            busy.clear();
            continue;
          }
          throw busyError();
        }

        const spec = STUDIO_MODELS[model];
        const budget = Math.floor(tpm * TPM_SAFETY) - shrink;
        const sys = fitSystem(params.system, budget - MIN_CALL_OUTPUT - toolsTokens - lastUserTokens);
        const fit = fitToBudget(toChatMessages(sys.system, params.messages), toolsTokens, budget - MIN_CALL_OUTPUT);
        const trimmed = fit.dropped + (sys.clipped ? 1 : 0);
        if (fit.promptTokens > budget - MIN_CALL_OUTPUT) {
          throw new ProviderError(
            'CONTEXT_TOO_LARGE',
            "This message, its files or the project's documents are too long for Studio's free capacity (about 8,000 tokens per request). Shorten them or start a new chat.",
            413, undefined, 0, fit.promptTokens,
          );
        }
        const maxOut = Math.max(MIN_CALL_OUTPUT, Math.min(params.max_tokens, spec.maxOutputTokens, budget - fit.promptTokens));
        const isGptOss = model.startsWith('openai/gpt-oss');
        const body: Record<string, unknown> = {
          model,
          messages: fit.messages,
          stream: true,
          max_completion_tokens: maxOut,
          ...(tools.length ? { tools, tool_choice: 'auto' } : {}),
          ...(params.reasoning_effort ? { reasoning_effort: params.reasoning_effort } : {}),
          // Qwen: with tools, reasoning must be "parsed" (separate field) or "hidden"; GPT-OSS does not take this option.
          ...(!isGptOss ? { reasoning_format: 'parsed' } : {}),
        };

        const ctrl = new AbortController();
        const onAbort = () => ctrl.abort();
        signal?.addEventListener('abort', onAbort, { once: true });
        const timer = setTimeout(() => ctrl.abort(), Math.max(5_000, Math.min(timeoutMs, deadlineAt - now())));
        let outChars = 0;
        try {
          const res = await doFetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
            body: JSON.stringify(body),
            signal: ctrl.signal,
          });
          if (!res.ok || !res.body) {
            const errBody = await res.json().catch(() => ({}));
            const c = classifyGroqError(res.status, errBody, res.headers);
            switch (c.code) {
              case 'MODEL_UNAVAILABLE':
              case 'RATE_DAY':
                exhaustedToday.add(model);
                continue;
              case 'RATE_MINUTE':
                busy.add(model);
                if (c.retryAfterSec !== undefined) retryAfterSec = c.retryAfterSec;
                continue;
              case 'TPM_TOO_LARGE':
                // Our estimate was low: leave out what Groq says was over, plus a margin, and retry.
                shrink += Math.max(500, (c.requested ?? 0) - (c.limit ?? 0) + 300);
                if (shrink > tpm / 2) throw new ProviderError('CONTEXT_TOO_LARGE', "This message, its files or the project's documents are too long for Studio's free capacity. Shorten them or start a new chat.", 413);
                continue;
              case 'TOOL_CALL_FAILED':
                if (!toolRetry) { toolRetry = true; continue; }
                throw new ProviderError('TOOL_CALL_FAILED', 'The model produced a tool call it could not complete. Try again, or rephrase the request.', 502);
              case 'PROVIDER_OVERLOADED':
                if (transient++ < 2 && now() + 5_000 < deadlineAt) { await sleep(1_500 * 2 ** (transient - 1), signal); continue; }
                throw new ProviderError('PROVIDER_OVERLOADED', 'The AI provider is overloaded. Try again in a moment.', 503, c.retryAfterSec);
              default:
                throw new ProviderError(c.code, c.message.slice(0, 300), res.status, c.retryAfterSec);
            }
          }
          if (model !== params.model) onEvent?.({ type: 'model', model });
          if (trimmed) onEvent?.({ type: 'trimmed', dropped: trimmed });
          const s = await readChatStream(res.body, onEvent, n => { outChars += n; });
          return toResult(s, model, fit.promptTokens, trimmed);
        } catch (e) {
          if (e instanceof ProviderError) throw new ProviderError(e.code, e.message, e.status, e.retryAfterSec, outChars, fit.promptTokens);
          if (isAbort(e)) {
            if (signal?.aborted) throw Object.assign(new Error('Request was aborted.'), { name: 'AbortError', outputChars: outChars, promptTokens: fit.promptTokens });
            throw new ProviderError('PROVIDER_ERROR', 'The AI provider took too long to answer. Try again.', 504, undefined, outChars, fit.promptTokens);
          }
          // A dropped connection before anything was shown: try again (briefly).
          if (outChars === 0 && transient++ < 2 && now() + 5_000 < deadlineAt) { await sleep(1_500 * 2 ** (transient - 1), signal); continue; }
          throw new ProviderError('PROVIDER_ERROR', 'Studio could not reach the AI provider. Try again.', 502, undefined, outChars, fit.promptTokens);
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
        }
      }
      throw busy.size ? busyError() : new ProviderError('PROVIDER_ERROR', 'Studio could not finish this answer. Try again.', 502);
    },
  };
}
