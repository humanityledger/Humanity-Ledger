/**
 * A scripted StudioClient (lib/studio/groq.ts) for the agent and route tests.
 *
 * Each response is what one model call returns: content blocks in Studio's format, a stop
 * reason and usage. `error` makes the call fail after streaming `partialText`, carrying the
 * prompt size and streamed characters the way the Groq client's ProviderError does.
 */
import { ProviderError, type ProviderParams, type StudioClient } from '@/lib/studio/groq';

export interface ScriptedResponse {
  content?: any[];
  stop_reason?: 'end_turn' | 'tool_use' | 'max_tokens' | 'refusal';
  usage?: { input_tokens?: number; output_tokens?: number };
  /** The model that answered (a fallback), if not the one asked for. */
  model?: string;
  trimmed?: number;
  partialText?: string[];
  /** Reasoning deltas streamed before the answer. */
  reasoning?: string[];
  error?: unknown;
  /** Prompt tokens the failed call had sent. */
  promptTokens?: number;
}

/** A response, or a function of the call's params that returns one (and may assert on them). */
export type Scripted = ScriptedResponse | ((params: ProviderParams & { messages: any[] }) => ScriptedResponse);

export function fakeClient(responses: Scripted[]) {
  const calls: (ProviderParams & { messages: any[] })[] = [];
  const client: StudioClient = {
    async complete(params, opts = {}) {
      calls.push(JSON.parse(JSON.stringify(params)));
      const next = responses.shift();
      if (!next) throw new Error('fakeClient: no scripted response left');
      const res = typeof next === 'function' ? next(params as any) : next;
      if (res.model && res.model !== params.model) opts.onEvent?.({ type: 'model', model: res.model as any });
      if (res.trimmed) opts.onEvent?.({ type: 'trimmed', dropped: res.trimmed });
      if (res.error) {
        let chars = 0;
        for (const t of res.partialText ?? []) { chars += t.length; opts.onEvent?.({ type: 'text', delta: t }); }
        const e: any = res.error;
        if (e instanceof ProviderError) throw new ProviderError(e.code, e.message, e.status, e.retryAfterSec, chars, res.promptTokens ?? 0);
        throw Object.assign(e, { outputChars: chars, promptTokens: res.promptTokens ?? 0 });
      }
      for (const r of res.reasoning ?? []) opts.onEvent?.({ type: 'reasoning', delta: r });
      const content = res.content ?? [];
      for (const b of content) {
        if (b.type === 'text') opts.onEvent?.({ type: 'text', delta: b.text });
        if (b.type === 'tool_use') opts.onEvent?.({ type: 'tool_call', id: b.id, name: b.name });
      }
      return {
        content,
        stop_reason: res.stop_reason ?? (content.some((b: any) => b.type === 'tool_use') ? 'tool_use' : 'end_turn'),
        usage: { input_tokens: res.usage?.input_tokens ?? 0, output_tokens: res.usage?.output_tokens ?? 0 },
        model: (res.model ?? params.model) as any,
        trimmed: res.trimmed ?? 0,
      };
    },
  };
  return { client, calls };
}

/** A Response carrying an SSE stream of OpenAI chat.completion.chunk objects. */
export function sseResponse(chunks: unknown[], init: ResponseInit = {}): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(`data: ${JSON.stringify(ch)}\n\n`));
      c.enqueue(enc.encode('data: [DONE]\n\n'));
      c.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' }, ...init });
}

export const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
