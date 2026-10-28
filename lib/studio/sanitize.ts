/**
 * Server-side checks on the conversation the browser sends.
 *
 * The history comes from the user's device, so it is untrusted input to OUR
 * API key. Anything that could make the API reach resources of Humanity
 * Ledger's Anthropic organization (uploaded files, containers), fetch URLs
 * on its behalf, or change how a request is billed (cache_control with a
 * 1-hour TTL) is rejected or stripped here. Assistant blocks that the API
 * itself produced (search results, thinking, MCP calls) pass through
 * unchanged, because the API requires them back verbatim.
 */

import type { StudioChatRequest } from './protocol';

const USER_BLOCKS = new Set(['text', 'image', 'document', 'tool_result', 'search_result']);
/**
 * Assistant turns are whatever the API produced, and new block types appear
 * over time; refusing unknown ones would make a conversation unusable. What
 * matters is that no block references server-side resources (checked below
 * for every block) and that inputs only come in through user turns.
 */
const ASSISTANT_FORBIDDEN_BLOCKS = new Set(['image', 'document', 'container_upload', 'tool_result', 'search_result']);
/** Keys that point at server-side resources of the API key's organization. */
const FORBIDDEN_KEYS = new Set(['file_id', 'container', 'container_id', 'container_upload', 'skill_id']);
/** Source types that make the API fetch something or read an uploaded file. */
const FORBIDDEN_SOURCE_TYPES = new Set(['file', 'url']);
const MAX_DEPTH = 12;

export type SanitizeResult = { ok: true; messages: StudioChatRequest['messages'] } | { ok: false; error: string };

interface CleanCtx {
  role: 'user' | 'assistant';
  /** Code execution output files this wallet's sandbox produced. */
  ownedFileIds?: Set<string>;
}

function clean(value: unknown, depth: number, path: string, ctx: CleanCtx): { ok: true; value: unknown } | { ok: false; error: string } {
  if (depth > MAX_DEPTH) return { ok: false, error: `Content is nested too deeply at ${path}.` };
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (let i = 0; i < value.length; i++) {
      const r = clean(value[i], depth + 1, `${path}[${i}]`, ctx);
      if (!r.ok) return r;
      out.push(r.value);
    }
    return { ok: true, value: out };
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    const obj = value as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'cache_control') continue; // Studio sets its own breakpoints
      // The one exception: a sandbox output the API produced for this wallet,
      // sent back verbatim as the API requires.
      if (k === 'file_id' && ctx.role === 'assistant' && obj.type === 'bash_code_execution_output' && typeof v === 'string' && ctx.ownedFileIds?.has(v)) {
        out[k] = v;
        continue;
      }
      if (FORBIDDEN_KEYS.has(k)) return { ok: false, error: `"${k}" is not allowed in Studio messages.` };
      if (k === 'source' && v && typeof v === 'object' && FORBIDDEN_SOURCE_TYPES.has(String((v as any).type))) {
        return { ok: false, error: `Attachments must be sent inline; "${(v as any).type}" sources are not allowed.` };
      }
      const r = clean(v, depth + 1, `${path}.${k}`, ctx);
      if (!r.ok) return r;
      out[k] = r.value;
    }
    return { ok: true, value: out };
  }
  return { ok: true, value };
}

export interface SanitizeOptions {
  ownedFileIds?: Set<string>;
}

/**
 * A turn may end waiting for the user (an approval, a plan or a question). The browser resumes it by sending the history ending with that
 * assistant message plus the user's decisions, which must answer exactly
 * the calls in it. Anything else must end with a user message.
 */
export function validateTurnShape(req: Pick<StudioChatRequest, 'messages' | 'resume' | 'mode'>): string | null {
  const last = req.messages[req.messages.length - 1];
  if (!req.resume) return last?.role === 'user' ? null : 'The last message must be from the user.';
  if (req.mode !== 'code') return 'Only Code mode turns can be resumed.';
  if (last?.role !== 'assistant' || !Array.isArray(last.content)) return 'Nothing is waiting for an answer.';
  const calls = new Set(last.content.filter((b: any) => b?.type === 'tool_use' && typeof b.id === 'string').map((b: any) => b.id as string));
  if (!calls.size) return 'Nothing is waiting for an answer.';
  const answered = new Set<string>();
  for (const r of req.resume.results) {
    if (!calls.has(r.tool_use_id)) return 'An answer does not match the waiting request.';
    if (answered.has(r.tool_use_id)) return 'An answer was sent twice.';
    answered.add(r.tool_use_id);
  }
  return null;
}

export function sanitizeMessages(messages: StudioChatRequest['messages'], opts: SanitizeOptions = {}): SanitizeResult {
  if (!messages.length || messages[0].role !== 'user') return { ok: false, error: 'The conversation must start with a user message.' };
  const out: StudioChatRequest['messages'] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (typeof m.content === 'string') { out.push({ role: m.role, content: m.content }); continue; }
    for (const b of m.content) {
      const type = String((b as any)?.type);
      const allowed = m.role === 'user' ? USER_BLOCKS.has(type) : !ASSISTANT_FORBIDDEN_BLOCKS.has(type);
      if (!allowed) return { ok: false, error: `Block type "${type.slice(0, 40)}" is not allowed in a ${m.role} message.` };
      if (m.role === 'user' && ((b as any).type === 'image' || (b as any).type === 'document')) {
        const st = (b as any).source?.type;
        const okSource = (b as any).type === 'image' ? st === 'base64' : st === 'base64' || st === 'text';
        if (!okSource) return { ok: false, error: 'Attachments must be sent inline (base64).' };
      }
    }
    const r = clean(m.content, 0, `messages[${i}]`, { role: m.role, ownedFileIds: opts.ownedFileIds });
    if (!r.ok) return r;
    out.push({ role: m.role, content: r.value as any });
  }
  return { ok: true, messages: out };
}

/** The part of a history the API reads: from the latest compaction block on. */
export function sinceLastCompaction<T extends { role: string; content: unknown }>(messages: T[]): T[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const c = messages[i].content;
    if (!Array.isArray(c)) continue;
    for (let j = c.length - 1; j >= 0; j--) {
      if ((c[j] as any)?.type === 'compaction') return [{ ...messages[i], content: c.slice(j) }, ...messages.slice(i + 1)];
    }
  }
  return messages;
}

const IMAGE_TOKENS = 1_600; // the API resizes large images to about this
const CHARS_PER_TOKEN = 3; // conservative for code and non-English text

/**
 * A deliberately pessimistic estimate of the prompt size, used to refuse
 * requests that would blow through a plan's budget in a single call.
 */
export function estimateInputTokens(req: Pick<StudioChatRequest, 'messages' | 'project' | 'skills' | 'artifacts' | 'personalization'> & Partial<Pick<StudioChatRequest, 'workspace' | 'memory' | 'todos' | 'agents' | 'mode'>>): number {
  let chars = 0;
  let media = 0;
  const walk = (v: unknown, depth = 0): void => {
    if (depth > MAX_DEPTH || v == null) return;
    if (typeof v === 'string') { chars += v.length; return; }
    if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1); return; }
    if (typeof v === 'object') {
      const o = v as any;
      if ((o.type === 'image' || o.type === 'document') && o.source?.type === 'base64' && typeof o.source.data === 'string') {
        if (o.type === 'image') media += IMAGE_TOKENS;
        else media += Math.min(100 * 3_000, Math.max(3_000, Math.ceil((o.source.data.length * 0.75) / 60)));
        return;
      }
      for (const [k, x] of Object.entries(o)) {
        if (k === 'signature' || (k === 'data' && o.type === 'redacted_thinking')) continue;
        // Encrypted search results do count as input, at well under one token per character.
        if ((k === 'encrypted_content' || k === 'encrypted_index') && typeof x === 'string') { chars += Math.ceil(x.length / 2); continue; }
        walk(x, depth + 1);
      }
    }
  };
  // The API ignores everything before the latest compaction summary.
  walk(sinceLastCompaction(req.messages));
  walk(req.project);
  walk(req.skills);
  walk(req.artifacts);
  walk(req.personalization);
  walk(req.memory);
  walk(req.todos);
  walk(req.agents);
  // The workspace is not sent to the model, only its file tree (and the
  // files it reads, which are counted as tool results next turn).
  const tree = req.workspace ? req.workspace.files.length + (req.workspace.binaries?.length ?? 0) : 0;
  chars += Math.min(tree, 400) * 40;
  // System prompt and tool definitions (Code mode has more tools).
  return Math.ceil(chars / CHARS_PER_TOKEN) + media + (req.mode === 'code' ? 7_000 : 3_000);
}
