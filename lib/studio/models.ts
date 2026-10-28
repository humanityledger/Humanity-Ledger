/**
 * Ledger Studio models and plans (shared by client and server).
 *
 * Prices are Anthropic list prices per million tokens (platform.claude.com
 * pricing page, checked 2026-10-27). They are used only to meter usage
 * against a plan's budget, never to bill anyone directly.
 */

export type StudioModelId = 'claude-haiku-5-5' | 'claude-sonnet-5-5' | 'claude-opus-5-5';

export interface TokenPrices {
  input: number;
  output: number;
  /** 5-minute cache write (the only TTL Studio uses). */
  cacheWrite: number;
  cacheRead: number;
}

export interface StudioModel {
  id: StudioModelId;
  label: string;
  blurb: { en: string; es: string };
  prices: TokenPrices;
  /** Haiku 5.5 is priced higher when the whole prompt is over this many tokens. */
  longPrompt?: { overTokens: number; prices: TokenPrices };
  /** Minimum plan that may use it. */
  plan: StudioPlanId;
  /** Studio's cap per API call (the models allow 128K; thinking counts toward it). */
  maxOutputTokens: number;
}

export const STUDIO_MODELS: Record<StudioModelId, StudioModel> = {
  'claude-haiku-5-5': {
    id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5',
    blurb: { en: 'Fastest. Quick questions and drafts.', es: 'El más rápido. Preguntas rápidas y borradores.' },
    prices: { input: 0.10, output: 0.50, cacheWrite: 0.125, cacheRead: 0.01 },
    longPrompt: { overTokens: 100_000, prices: { input: 0.50, output: 2.50, cacheWrite: 0.625, cacheRead: 0.05 } },
    plan: 'free', maxOutputTokens: 16_000,
  },
  'claude-sonnet-5-5': {
    id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5',
    blurb: { en: 'Best balance for code, research and writing.', es: 'El mejor equilibrio para código, investigación y escritura.' },
    prices: { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.10 },
    plan: 'free', maxOutputTokens: 32_000,
  },
  'claude-opus-5-5': {
    id: 'claude-opus-5-5', label: 'Claude Opus 5.5',
    blurb: { en: 'Most capable, for hard engineering problems.', es: 'El más capaz, para problemas de ingeniería difíciles.' },
    prices: { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.20 },
    plan: 'pro', maxOutputTokens: 64_000,
  },
};

export const DEFAULT_MODEL: StudioModelId = 'claude-sonnet-5-5';
export const TITLE_MODEL: StudioModelId = 'claude-haiku-5-5';

/** $10 per 1,000 searches; web fetch has no extra fee beyond tokens. */
export const WEB_SEARCH_USD = 0.01;

export type StudioPlanId = 'free' | 'pro';

export interface StudioPlan {
  id: StudioPlanId;
  label: string;
  /** Metered budget, in USD of model usage. */
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
  /** Estimated prompt size (tokens) Studio accepts per request. */
  maxInputTokens: number;
  priceLabel: string;
}

export const STUDIO_PLANS: Record<StudioPlanId, StudioPlan> = {
  free: {
    id: 'free', label: 'Free', dailyBudgetUsd: 0.15, monthlyBudgetUsd: 2,
    maxWebSearchesPerRequest: 3, maxWebFetchesPerRequest: 2, maxFetchContentTokens: 20_000, requestsPerHourPerIp: 40,
    maxConnectors: 1, maxFileMb: 5, maxInputTokens: 150_000, priceLabel: '0 €',
  },
  pro: {
    id: 'pro', label: 'Pro', dailyBudgetUsd: 3, monthlyBudgetUsd: 15,
    maxWebSearchesPerRequest: 8, maxWebFetchesPerRequest: 5, maxFetchContentTokens: 60_000, requestsPerHourPerIp: 300,
    maxConnectors: 5, maxFileMb: 20, maxInputTokens: 600_000, priceLabel: '20 € / mes',
  },
};

/** Effort levels per plan (higher effort thinks longer and costs more). */
export const PLAN_EFFORTS: Record<StudioPlanId, readonly string[]> = {
  free: ['low', 'medium', 'high'],
  pro: ['low', 'medium', 'high', 'xhigh', 'max'],
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
  /** With compaction on, each sampling step; compaction steps are not in the top-level counts. */
  iterations?: { type?: string; input_tokens?: number | null; output_tokens?: number | null; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }[] | null;
}

/**
 * Code execution is billed by container time (5-minute minimum at $0.05/h
 * once the organisation's free hours are used). Studio meters every run at
 * that minimum so the free hours are never counted on.
 */
export const CODE_EXECUTION_USD = 0.05 * (5 / 60);

/** Prices that apply to a prompt of this many tokens (input + cache writes + cache reads). */
export function pricesFor(model: StudioModelId, promptTokens: number): TokenPrices | null {
  const m = STUDIO_MODELS[model];
  if (!m) return null;
  return m.longPrompt && promptTokens > m.longPrompt.overTokens ? m.longPrompt.prices : m.prices;
}

/** Estimated USD cost of one API response. */
export function estimateCostUsd(model: StudioModelId, u: TokenUsage): number {
  const inTok = u.input_tokens ?? 0;
  const outTok = u.output_tokens ?? 0;
  const cw = u.cache_creation_input_tokens ?? 0;
  const cr = u.cache_read_input_tokens ?? 0;
  const p = pricesFor(model, inTok + cw + cr);
  if (!p) return 0;
  const searches = u.server_tool_use?.web_search_requests ?? 0;
  const runs = u.server_tool_use?.code_execution_requests ?? 0;
  let usd = (inTok * p.input + cw * p.cacheWrite + cr * p.cacheRead + outTok * p.output) / 1_000_000 + searches * WEB_SEARCH_USD + runs * CODE_EXECUTION_USD;
  // Compaction steps are billed on top of the top-level counts.
  for (const it of u.iterations ?? []) {
    if (it?.type !== 'compaction') continue;
    const ci = it.input_tokens ?? 0;
    const cp = pricesFor(model, ci + (it.cache_read_input_tokens ?? 0) + (it.cache_creation_input_tokens ?? 0)) ?? p;
    usd += (ci * cp.input + (it.cache_creation_input_tokens ?? 0) * cp.cacheWrite + (it.cache_read_input_tokens ?? 0) * cp.cacheRead + (it.output_tokens ?? 0) * cp.output) / 1_000_000;
  }
  return Math.round(usd * 1_000_000) / 1_000_000;
}

/**
 * The most one turn's first API call can cost, before anything is cached:
 * the whole prompt at the uncached price, the output it may write, and every
 * search and page read the plan allows (each page is input to later steps).
 */
export function worstCaseFirstCallUsd(model: StudioModelId, plan: StudioPlan, promptTokens: number, maxOutputTokens: number): number {
  const p = pricesFor(model, promptTokens);
  if (!p) return 0;
  const fetched = plan.maxWebFetchesPerRequest * plan.maxFetchContentTokens;
  const usd = (promptTokens * p.input + fetched * p.input * 2 + maxOutputTokens * p.output) / 1_000_000 + plan.maxWebSearchesPerRequest * WEB_SEARCH_USD;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

/** Cost of the prompt alone, uncached. */
export function promptCostUsd(model: StudioModelId, promptTokens: number): number {
  const p = pricesFor(model, promptTokens);
  return p ? (promptTokens * p.input) / 1_000_000 : 0;
}

/** The most output tokens the remaining budget pays for (at the long-prompt price, to be safe). */
export function affordableOutputTokens(model: StudioModelId, budgetUsd: number): number {
  const m = STUDIO_MODELS[model];
  if (!m || budgetUsd <= 0) return 0;
  const out = (m.longPrompt?.prices ?? m.prices).output;
  return Math.floor((budgetUsd / out) * 1_000_000);
}
