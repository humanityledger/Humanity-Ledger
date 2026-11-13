/**
 * Ledger Studio models and plans (shared by client and server).
 *
 * Provider: Groq (OpenAI-compatible Chat Completions, https://api.groq.com/openai/v1),
 * on its free tier. Migrated from Anthropic on 11 November 2026 (lib/studio/groq.ts).
 *
 * Groq's free tier costs the operator nothing, but its limits are per organisation,
 * shared by every Studio user, and per model (console.groq.com/docs/rate-limits,
 * checked 2026-11-11): for each model below, 30 requests/minute, 1,000 requests/day,
 * 8,000 tokens/minute and 200,000 tokens/day.
 *
 * So Studio still meters usage, in "capacity units": every token (prompt or output)
 * counts the same, at a nominal $1 per million tokens. Nobody is billed; the plans'
 * daily and monthly allowances below are therefore token allowances (0.05 = 50,000
 * tokens), and they exist so one wallet cannot use up the shared daily capacity.
 */

export type StudioModelId = 'openai/gpt-oss-120b' | 'openai/gpt-oss-20b' | 'qwen/qwen3.8-27b';

export interface TokenPrices {
  input: number;
  output: number;
  /** Groq has no separate cache pricing; kept for the shared usage shape. */
  cacheWrite: number;
  cacheRead: number;
}

export interface StudioModel {
  id: StudioModelId;
  label: string;
  blurb: { en: string; es: string };
  prices: TokenPrices;
  /** Kept for the shared shape; no Groq model is priced by prompt length. */
  longPrompt?: { overTokens: number; prices: TokenPrices };
  /** Minimum plan that may use it. */
  plan: StudioPlanId;
  /** The model's own completion limit. Each call is further capped by the tokens-per-minute limit. */
  maxOutputTokens: number;
  /** Reasoning efforts the model accepts (Groq `reasoning_effort`). */
  efforts: readonly ('low' | 'medium' | 'high')[];
  /** Groq lists it as a preview model ("may be discontinued at short notice"). */
  preview?: boolean;
}

/** Capacity units: every token counts the same, $1 per million (nominal, never billed). */
const UNIT: TokenPrices = { input: 1, output: 1, cacheWrite: 1, cacheRead: 1 };

export const STUDIO_MODELS: Record<StudioModelId, StudioModel> = {
  'openai/gpt-oss-120b': {
    id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B',
    blurb: { en: 'Most capable. Code, research and writing.', es: 'El más capaz. Código, investigación y escritura.' },
    prices: UNIT, plan: 'free', maxOutputTokens: 65_536, efforts: ['low', 'medium', 'high'],
  },
  'openai/gpt-oss-20b': {
    id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B',
    blurb: { en: 'Fastest. Quick questions and drafts.', es: 'El más rápido. Preguntas rápidas y borradores.' },
    prices: UNIT, plan: 'free', maxOutputTokens: 65_536, efforts: ['low', 'medium', 'high'],
  },
  'qwen/qwen3.8-27b': {
    id: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B',
    blurb: { en: 'Preview model on Groq. May be withdrawn at short notice.', es: 'Modelo en vista previa en Groq. Puede retirarse sin aviso.' },
    prices: UNIT, plan: 'free', maxOutputTokens: 16_384, efforts: ['low', 'medium', 'high'], preview: true,
  },
};

export const DEFAULT_MODEL: StudioModelId = 'openai/gpt-oss-120b';
export const TITLE_MODEL: StudioModelId = 'openai/gpt-oss-20b';

/**
 * Models tried, in order, when the chosen one is rate limited: each Groq model has its
 * own per-minute and per-day bucket, so falling back spreads the shared free capacity.
 */
export const MODEL_FALLBACKS: Record<StudioModelId, readonly StudioModelId[]> = {
  'openai/gpt-oss-120b': ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b'],
  'openai/gpt-oss-20b': ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b'],
  'qwen/qwen3.8-27b': ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'],
};

/** What Studio can do on this provider. The interface hides what is not available. */
export const STUDIO_CAPABILITIES = {
  /** Groq's built-in browser search is not documented together with function tools; off. */
  webSearch: false,
  /** Studio's code sandbox ran on Anthropic's containers; Groq has no equivalent file sandbox. */
  sandbox: false,
  /** MCP connectors were Anthropic's MCP connector; not available on this provider. */
  connectors: false,
  /** The Groq models above read text only: images and PDFs are described, not seen. */
  images: false,
} as const;

/**
 * Old ids saved on devices before the migration (claude-*), or a model Groq withdrew,
 * map to the default, so a stored chat or preference never breaks the picker.
 */
export function normalizeModel(v: unknown): StudioModelId {
  return isStudioModel(v) ? v : DEFAULT_MODEL;
}

/** Allowance units shown as tokens (1 unit = 1,000,000 tokens), e.g. "12K tokens". */
export function formatUnits(units: number, lang = 'en'): string {
  const tokens = Math.max(0, Math.round(units * 1_000_000));
  let n: string;
  try { n = new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 }).format(tokens); } catch { n = String(tokens); }
  return `${n} tokens`;
}

/** No web search on this provider; kept so usage records keep their shape. */
export const WEB_SEARCH_USD = 0;

export type StudioPlanId = 'free' | 'pro';

export interface StudioPlan {
  id: StudioPlanId;
  label: string;
  /** Allowance in capacity units ($1 = 1,000,000 tokens, nominal). */
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  maxWebSearchesPerRequest: number;
  /** Web pages read per request, and the most tokens each page may add to the prompt. */
  maxWebFetchesPerRequest: number;
  maxFetchContentTokens: number;
  /** Studio requests per hour from one IP address (wallets are free to create). */
  requestsPerHourPerIp: number;
  maxConnectors: number;
  maxFileMb: number;
  /** Estimated size (tokens) of what the browser may send per request. Older messages are
   *  then left out of each call as needed to fit the provider's tokens-per-minute limit. */
  maxInputTokens: number;
  priceLabel: string;
}

export const STUDIO_PLANS: Record<StudioPlanId, StudioPlan> = {
  free: {
    id: 'free', label: 'Free', dailyBudgetUsd: 0.05, monthlyBudgetUsd: 0.6,
    maxWebSearchesPerRequest: 0, maxWebFetchesPerRequest: 0, maxFetchContentTokens: 0, requestsPerHourPerIp: 40,
    maxConnectors: 0, maxFileMb: 5, maxInputTokens: 150_000, priceLabel: '0 €',
  },
  pro: {
    id: 'pro', label: 'Pro', dailyBudgetUsd: 0.15, monthlyBudgetUsd: 2,
    maxWebSearchesPerRequest: 0, maxWebFetchesPerRequest: 0, maxFetchContentTokens: 0, requestsPerHourPerIp: 120,
    maxConnectors: 0, maxFileMb: 20, maxInputTokens: 300_000, priceLabel: '$20 / month',
  },
};

/**
 * Pro without allowance limits: the founder's wallets (STUDIO_FOUNDER_WALLETS, checked in
 * metering.resolvePlan) and anyone using their own provider key (BYOK). The id stays 'pro' so
 * every Pro check applies unchanged.
 */
export const UNLIMITED_PRO: StudioPlan = {
  ...STUDIO_PLANS.pro,
  label: 'Pro, no limits',
  dailyBudgetUsd: 1_000_000,
  monthlyBudgetUsd: 1_000_000,
  requestsPerHourPerIp: 2_000,
  priceLabel: 'Free for life',
};

/** Server only (the variable is not public). Wallets with lifetime, no-cost Studio access (comma-separated addresses, set in the server environment). */
export function isFounderWallet(wallet: string): boolean {
  const list = (process.env.STUDIO_FOUNDER_WALLETS || '').toLowerCase().split(',').map((a) => a.trim()).filter(Boolean);
  return list.includes(wallet.toLowerCase());
}

/** Reasoning efforts per plan (Groq `reasoning_effort`: low, medium, high). */
export const PLAN_EFFORTS: Record<StudioPlanId, readonly string[]> = {
  free: ['low', 'medium', 'high'],
  pro: ['low', 'medium', 'high'],
};

export function planAllowsModel(plan: StudioPlanId, model: StudioModelId): boolean {
  const need = STUDIO_MODELS[model]?.plan;
  if (!need) return false;
  return need === 'free' || plan === 'pro';
}

export function isStudioModel(v: unknown): v is StudioModelId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(STUDIO_MODELS, v);
}

export interface TokenUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null; web_fetch_requests?: number | null; code_execution_requests?: number | null } | null;
  iterations?: { type?: string; input_tokens?: number | null; output_tokens?: number | null; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }[] | null;
}

/** Prices (capacity units) for a model. */
export function pricesFor(model: StudioModelId, _promptTokens: number): TokenPrices | null {
  return STUDIO_MODELS[model]?.prices ?? null;
}

/** Capacity units used by one response (every token counts the same). */
export function estimateCostUsd(model: StudioModelId, u: TokenUsage): number {
  const p = pricesFor(model, 0);
  if (!p) return 0;
  const tokens = (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  return Math.round(((tokens * p.input) / 1_000_000) * 1_000_000) / 1_000_000;
}

/** The most one turn's first call can use: the prompt plus the output it may write. */
export function worstCaseFirstCallUsd(model: StudioModelId, _plan: StudioPlan, promptTokens: number, maxOutputTokens: number): number {
  const p = pricesFor(model, promptTokens);
  if (!p) return 0;
  return Math.round(((promptTokens * p.input + maxOutputTokens * p.output) / 1_000_000) * 1_000_000) / 1_000_000;
}

/** Capacity units of the prompt alone. */
export function promptCostUsd(model: StudioModelId, promptTokens: number): number {
  const p = pricesFor(model, promptTokens);
  return p ? (promptTokens * p.input) / 1_000_000 : 0;
}

/** The most output tokens the remaining allowance pays for. */
export function affordableOutputTokens(model: StudioModelId, budgetUsd: number): number {
  const m = STUDIO_MODELS[model];
  if (!m || budgetUsd <= 0) return 0;
  return Math.floor((budgetUsd / m.prices.output) * 1_000_000);
}
