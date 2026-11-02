/**
 * Wire format between the Studio UI and /api/studio/chat.
 *
 * The browser owns the conversation (it is stored on the device, not on our
 * servers) and sends it with each turn. The server streams back events as
 * newline-delimited JSON and, at the end, the exact assistant/tool messages
 * the API produced, which the browser appends to the history unchanged
 * (web search results must be sent back verbatim on later turns).
 */

import { z } from 'zod';
import { ARTIFACT_TYPES, MAX_ARTIFACT_CHARS } from './artifacts';
import { MAX_SKILL_CHARS } from './skills';
import { MAX_FILE_CHARS, MAX_WS_FILES, type WsChange } from './fs';

/** How much Studio may do on its own in Code mode (like Claude Code's permission modes). */
export const PERMISSION_MODES = ['plan', 'ask', 'auto'] as const;
export type PermissionMode = (typeof PERMISSION_MODES)[number];
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = (typeof EFFORTS)[number];
export type StudioMode = 'chat' | 'code';

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm?: string;
}

export interface CustomAgent {
  id: string;
  name: string;
  description: string;
  instructions: string;
  /** readonly: read, search and the web. edit: may also change files (only when edits are auto-accepted). */
  tools: 'readonly' | 'edit';
  model?: string;
}

export interface ResumeResult {
  tool_use_id: string;
  /** allow / deny a proposed change or plan; answer a question. */
  decision: 'allow' | 'deny' | 'answer';
  text?: string;
}

const todoSchema = z.object({
  content: z.string().max(500),
  status: z.enum(['pending', 'in_progress', 'completed']),
  activeForm: z.string().max(500).optional(),
});
export { todoSchema };

export type StudioLanguage = 'auto' | 'es' | 'en' | 'pt' | 'fr' | 'de' | 'it' | 'ro';
export const STUDIO_LANGUAGES: StudioLanguage[] = ['auto', 'es', 'en', 'pt', 'fr', 'de', 'it', 'ro'];

export interface StudioPersonalization {
  /** How Studio should address the user. */
  callMe?: string;
  /** Free-form instructions applied to every chat. */
  instructions?: string;
  style?: 'concise' | 'balanced' | 'detailed';
  responseLanguage?: StudioLanguage;
}

export interface StudioConnectorConfig {
  id: string;
  name: string;
  url: string;
  token?: string;
  enabled: boolean;
}

/** Max request size we accept (base64 files included). */
export const MAX_REQUEST_BYTES = 30 * 1024 * 1024;
export const MAX_HISTORY_MESSAGES = 200;

const contentBlock = z.object({ type: z.string() }).passthrough();

export const chatRequestSchema = z.object({
  model: z.string().max(64),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.union([z.string().max(2_000_000), z.array(contentBlock).max(200)]),
  })).min(1).max(MAX_HISTORY_MESSAGES),
  personalization: z.object({
    callMe: z.string().max(80).optional(),
    instructions: z.string().max(8_000).optional(),
    style: z.enum(['concise', 'balanced', 'detailed']).optional(),
    responseLanguage: z.enum(STUDIO_LANGUAGES as [StudioLanguage, ...StudioLanguage[]]).optional(),
  }).optional(),
  project: z.object({
    name: z.string().max(120),
    instructions: z.string().max(20_000).optional(),
    /** Text knowledge (extracted from project files), cached on the API side. */
    knowledge: z.array(z.object({ name: z.string().max(200), text: z.string().max(400_000) })).max(30).optional(),
  }).optional(),
  skills: z.array(z.object({
    id: z.string().max(64), name: z.string().max(120), instructions: z.string().max(MAX_SKILL_CHARS),
  })).max(12).optional(),
  artifacts: z.array(z.object({
    id: z.string().max(64), title: z.string().max(200), type: z.enum(ARTIFACT_TYPES), language: z.string().max(32).optional(),
    content: z.string().max(MAX_ARTIFACT_CHARS),
  })).max(40).optional(),
  tools: z.object({
    webSearch: z.boolean().optional(),
    webFetch: z.boolean().optional(),
  }).optional(),
  connectors: z.array(z.object({
    id: z.string().max(64), name: z.string().max(64), url: z.string().url().max(500), token: z.string().max(4_000).optional(),
    enabled: z.boolean(),
  })).max(10).optional(),
  timezone: z.string().max(64).optional(),

  // ── Code mode ──
  mode: z.enum(['chat', 'code']).optional(),
  permission: z.enum(PERMISSION_MODES).optional(),
  effort: z.enum(EFFORTS).optional(),
  workspace: z.object({
    files: z.array(z.object({ path: z.string().max(300), content: z.string().max(MAX_FILE_CHARS) })).max(MAX_WS_FILES),
    binaries: z.array(z.object({ path: z.string().max(300), size: z.number().int().nonnegative() })).max(MAX_WS_FILES).optional(),
  }).optional(),
  /** STUDIO.md: what the project wants Studio to remember (like CLAUDE.md). */
  memory: z.string().max(40_000).optional(),
  todos: z.array(todoSchema).max(50).optional(),
  sandbox: z.object({ enabled: z.boolean(), containerId: z.string().max(128).optional() }).optional(),
  agents: z.array(z.object({
    id: z.string().max(64), name: z.string().max(80), description: z.string().max(500),
    instructions: z.string().max(12_000), tools: z.enum(['readonly', 'edit']), model: z.string().max(64).optional(),
  })).max(20).optional(),
  /**
   * Permission rules (globs on workspace paths, like Claude Code's allow/deny
   * rules). deny always wins, in every mode; allow skips the approval in "ask".
   */
  rules: z.object({
    allow: z.array(z.string().max(200)).max(50).optional(),
    deny: z.array(z.string().max(200)).max(50).optional(),
  }).optional(),
  /** Continue a turn that stopped for an approval, a plan or a question. */
  resume: z.object({
    results: z.array(z.object({
      tool_use_id: z.string().max(128),
      decision: z.enum(['allow', 'deny', 'answer']),
      text: z.string().max(20_000).optional(),
    })).max(50),
  }).optional(),
});

export type StudioChatRequest = z.infer<typeof chatRequestSchema>;

/** Events streamed by /api/studio/chat, one JSON object per line. */
export type StudioEvent =
  | { type: 'start'; model: string }
  | { type: 'text'; delta: string }
  | { type: 'thinking'; label: string }
  | { type: 'tool'; id: string; name: string; server?: string; status: 'running' | 'done' | 'error'; detail?: string; parent?: string }
  /** Summarised reasoning, streamed while the model thinks. */
  | { type: 'reasoning'; delta: string }
  /** A workspace file changed (applied by the browser and checkpointed). */
  | { type: 'file'; change: WsChange; parent?: string }
  | { type: 'todos'; todos: TodoItem[] }
  /** The turn stopped: these changes wait for the user's decision (permission "ask"). */
  | { type: 'approval'; calls: { id: string; name: string; input: any }[] }
  | { type: 'plan'; id: string; plan: string }
  | { type: 'question'; id: string; question: string; options?: string[] }
  | { type: 'subagent'; id: string; name: string; description: string; phase: 'start' | 'end'; summary?: string }
  | { type: 'container'; id: string; expiresAt?: string }
  | { type: 'compacted' }
  | { type: 'citation'; url: string; title?: string; citedText?: string }
  | { type: 'artifact'; artifact: { id: string; title: string; type: string; language?: string; content: string }; created: boolean }
  | { type: 'messages'; messages: { role: 'assistant' | 'user'; content: unknown[] }[] }
  | { type: 'usage'; inputTokens: number; outputTokens: number; costUsd: number; webSearches: number; remainingTodayUsd: number; contextTokens?: number }
  | { type: 'error'; code: string; message: string }
  /** Why an answer ended early: cut off by length, refused, budget, time or step limit. */
  | { type: 'notice'; code: 'MAX_TOKENS' | 'REFUSAL' | 'BUDGET' | 'TIME_LIMIT' | 'STEP_LIMIT' | 'SYNC_FAILED' }
  | { type: 'done'; stopReason: string | null };

export function encodeEvent(e: StudioEvent): string {
  return JSON.stringify(e) + '\n';
}

/** Incremental NDJSON parser for the browser side. */
export function createEventParser(onEvent: (e: StudioEvent) => void) {
  let buf = '';
  return {
    push(chunk: string) {
      buf += chunk;
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try { onEvent(JSON.parse(line) as StudioEvent); } catch { /* ignore a malformed line */ }
      }
    },
    flush() {
      const line = buf.trim();
      buf = '';
      if (line) { try { onEvent(JSON.parse(line) as StudioEvent); } catch { /* ignore */ } }
    },
  };
}
