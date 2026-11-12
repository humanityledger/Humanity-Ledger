/**
 * The AI client Ledger Studio uses (server only): Groq, OpenAI-compatible
 * (lib/studio/groq.ts). Replaces the Anthropic SDK client (11 November 2026).
 *
 * Environment:
 *   GROQ_API_KEY    required. Without it Studio answers NOT_CONFIGURED.
 *   GROQ_MODEL      optional default model (one of STUDIO_MODELS; otherwise ignored).
 *   GROQ_TPM_LIMIT  optional tokens-per-minute limit per model (8000 on the free tier).
 */

import { createGroqClient, DEFAULT_TPM_LIMIT, type StudioClient } from './groq';
import { DEFAULT_MODEL, isStudioModel, type StudioModelId } from './models';

export type { StudioClient } from './groq';

export function studioApiKey(): string | undefined {
  const k = (process.env.STUDIO_LLM_API_KEY || process.env.GROQ_API_KEY || '').trim();
  if (k) return k;
  // A self-hosted server (vLLM, Ollama, llama.cpp) may need no key at all.
  return studioBaseUrl() ? 'none' : undefined;
}

/**
 * Self-hosting: any OpenAI-compatible Chat Completions server (vLLM, SGLang, Ollama, llama.cpp,
 * TGI) serving the same model ids (openai/gpt-oss-120b, openai/gpt-oss-20b, qwen/qwen3.8-27b).
 * Unset, Studio uses Groq. Set GROQ_TPM_LIMIT to the server's real tokens-per-minute capacity.
 */
export function studioBaseUrl(): string | undefined {
  const u = (process.env.STUDIO_LLM_BASE_URL || '').trim();
  return /^https?:\/\//.test(u) ? u : undefined;
}

/**
 * Bring your own key: a user may pay their own provider instead of using Studio's allowance.
 * Only these hosts are accepted (no arbitrary URLs: the server would otherwise fetch anything a
 * user names). Each serves the same open model ids Studio uses. The key travels in a request
 * header, is used for that request only and is never stored or logged on the server.
 */
export const BYOK_PROVIDERS = {
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  together: 'https://api.together.xyz/v1',
} as const;
export type ByokProvider = keyof typeof BYOK_PROVIDERS;
/** Generous: the user's own provider limits apply, not Studio's shared free tier. */
export const BYOK_TPM_LIMIT = 60_000;

export function byokFromHeaders(h: Headers): { provider: ByokProvider; key: string; baseUrl: string } | null {
  const provider = (h.get('x-studio-provider') || '').trim().toLowerCase();
  const key = (h.get('x-studio-provider-key') || '').trim();
  if (!provider || !key) return null;
  if (!Object.prototype.hasOwnProperty.call(BYOK_PROVIDERS, provider)) return null;
  if (!/^[\x21-\x7e]{16,256}$/.test(key)) return null;
  return { provider: provider as ByokProvider, key, baseUrl: BYOK_PROVIDERS[provider as ByokProvider] };
}

/** The default model: GROQ_MODEL when it names a model Studio offers, otherwise DEFAULT_MODEL. */
export function serverDefaultModel(): StudioModelId {
  const m = (process.env.GROQ_MODEL || '').trim();
  return isStudioModel(m) ? m : DEFAULT_MODEL;
}

export function studioTpmLimit(): number {
  const v = Number(process.env.GROQ_TPM_LIMIT);
  return Number.isFinite(v) && v >= 2_000 ? Math.floor(v) : DEFAULT_TPM_LIMIT;
}

export function createStudioClient(apiKey: string, opts: { timeout?: number; baseUrl?: string; tpmLimit?: number } = {}): StudioClient {
  return createGroqClient({ apiKey, baseUrl: opts.baseUrl ?? studioBaseUrl(), tpmLimit: opts.tpmLimit ?? studioTpmLimit(), timeoutMs: opts.timeout });
}
