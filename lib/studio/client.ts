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
  const k = (process.env.GROQ_API_KEY || '').trim();
  return k || undefined;
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

export function createStudioClient(apiKey: string, opts: { timeout?: number } = {}): StudioClient {
  return createGroqClient({ apiKey, tpmLimit: studioTpmLimit(), timeoutMs: opts.timeout });
}
