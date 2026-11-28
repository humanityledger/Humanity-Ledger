/**
 * lib/community-apps/engine.ts — how a community app is written, from the cheapest path to the
 * most capable one.
 *
 *   free  (default)  Groq's free tier through Ledger Studio's client: one answer, one repair. It is
 *                    fitted to 8,000 tokens per minute, so nothing more can be asked of it.
 *   max              Any frontier model the operator pays for, chosen by environment variables:
 *                      COMMUNITY_APPS_MAX_PROVIDER   openai (any OpenAI-compatible endpoint: OpenAI,
 *                                                    xAI, Groq paid, Together, Fireworks, OpenRouter,
 *                                                    a local vLLM…) or anthropic. Default openai.
 *                      COMMUNITY_APPS_MAX_API_KEY    the provider key (server only)
 *                      COMMUNITY_APPS_MAX_MODEL      the provider's model id (the largest one you have)
 *                      COMMUNITY_APPS_MAX_BASE_URL   OpenAI-compatible base URL (default OpenAI)
 *                      COMMUNITY_APPS_MAX_EFFORT     low | medium | high, sent as reasoning_effort
 *                                                    (OpenAI-compatible reasoning models only)
 *                      COMMUNITY_APPS_MAX_OUTPUT_TOKENS  default 32000
 *                      COMMUNITY_APPS_CANDIDATES     drafts written in parallel, 1-5, default 3
 *                      COMMUNITY_APPS_BUDGET_MS      time for the whole job, default 270000
 *                    The max engine plans the app first (data model, screens, interactions, edge
 *                    cases), writes several drafts in parallel from that plan, checks each one
 *                    (safety rules, JavaScript that parses, the hl runtime used correctly, the
 *                    plan covered), keeps the best, and refines it once if a check still finds
 *                    something. Every step stays inside the route's 300 s limit.
 *
 * Model size is chosen by the operator; this file makes any model produce its best work: a plan
 * before code, several attempts, and checks that run on the server before a member sees anything.
 */

import { Script } from 'node:vm';
import { validateAppHtml } from './validate';

export type EngineTier = 'free' | 'max';
export type MaxProvider = 'openai' | 'anthropic';
export type Effort = 'low' | 'medium' | 'high';

export interface EngineConfig {
  tier: EngineTier;
  provider?: MaxProvider;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  effort?: Effort;
  maxOutputTokens: number;
  candidates: number;
  budgetMs: number;
  /** Plan before writing (max engine only). */
  plan: boolean;
  /** One refinement pass when a draft still has quality problems (max engine only). */
  refine: boolean;
}

const EFFORTS: readonly Effort[] = ['low', 'medium', 'high'];
const int = (v: string | undefined, d: number, lo: number, hi: number) => {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

/** Reads the engine from the environment (a plain object in tests). */
/** The variables, read by name so scripts/env-inventory.mjs lists them in .env.example. */
function engineEnv(): Record<string, string | undefined> {
  return {
    COMMUNITY_APPS_MAX_API_KEY: process.env.COMMUNITY_APPS_MAX_API_KEY,
    COMMUNITY_APPS_MAX_MODEL: process.env.COMMUNITY_APPS_MAX_MODEL,
    COMMUNITY_APPS_MAX_PROVIDER: process.env.COMMUNITY_APPS_MAX_PROVIDER,
    COMMUNITY_APPS_MAX_BASE_URL: process.env.COMMUNITY_APPS_MAX_BASE_URL,
    COMMUNITY_APPS_MAX_EFFORT: process.env.COMMUNITY_APPS_MAX_EFFORT,
    COMMUNITY_APPS_MAX_OUTPUT_TOKENS: process.env.COMMUNITY_APPS_MAX_OUTPUT_TOKENS,
    COMMUNITY_APPS_CANDIDATES: process.env.COMMUNITY_APPS_CANDIDATES,
    COMMUNITY_APPS_BUDGET_MS: process.env.COMMUNITY_APPS_BUDGET_MS,
    COMMUNITY_APPS_EFFORT: process.env.COMMUNITY_APPS_EFFORT,
  };
}

export function resolveEngine(env: Record<string, string | undefined> = engineEnv()): EngineConfig {
  const key = env.COMMUNITY_APPS_MAX_API_KEY?.trim();
  const model = env.COMMUNITY_APPS_MAX_MODEL?.trim();
  const budgetMs = int(env.COMMUNITY_APPS_BUDGET_MS, 270_000, 30_000, 285_000);
  if (key && model) {
    const provider: MaxProvider = env.COMMUNITY_APPS_MAX_PROVIDER?.trim().toLowerCase() === 'anthropic' ? 'anthropic' : 'openai';
    const effort = EFFORTS.includes(env.COMMUNITY_APPS_MAX_EFFORT as Effort) ? (env.COMMUNITY_APPS_MAX_EFFORT as Effort) : undefined;
    return {
      tier: 'max',
      provider,
      model,
      apiKey: key,
      baseUrl: provider === 'openai' ? (env.COMMUNITY_APPS_MAX_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/$/, '') : 'https://api.anthropic.com/v1',
      effort,
      maxOutputTokens: int(env.COMMUNITY_APPS_MAX_OUTPUT_TOKENS, 32_000, 4_000, 128_000),
      candidates: int(env.COMMUNITY_APPS_CANDIDATES, 3, 1, 5),
      budgetMs,
      plan: true,
      refine: true,
    };
  }
  return {
    tier: 'free',
    effort: EFFORTS.includes(env.COMMUNITY_APPS_EFFORT as Effort) ? (env.COMMUNITY_APPS_EFFORT as Effort) : 'low',
    maxOutputTokens: 8_000,
    candidates: 1,
    budgetMs,
    plan: false,
    refine: false,
  };
}

// ── Checks that run on the server before anyone sees the app ──────────────────────────────────

/** The inline scripts of an app (the only scripts it may have). */
export function scriptsOf(html: string): string[] {
  const out: string[] = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

/**
 * JavaScript that does not parse never runs: compile each script without running it
 * (vm.Script only parses and compiles; nothing is executed).
 */
export function syntaxProblems(html: string): string[] {
  const problems: string[] = [];
  scriptsOf(html).forEach((code, i) => {
    try {
      new Script(code, { filename: `app-script-${i + 1}.js` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      problems.push(`Script ${i + 1} does not parse: ${msg.slice(0, 160)}`);
    }
  });
  return problems;
}

/** Problems that make an app unusable or unsafe: never shown to a member. */
export function hardProblems(html: string): string[] {
  return [...validateAppHtml(html).problems, ...syntaxProblems(html)];
}

/** Problems a working app can still have: they trigger a refinement pass when time allows. */
export function qualityProblems(html: string, plannedKeys: readonly string[] = []): string[] {
  const p: string[] = [];
  const js = scriptsOf(html).join('\n');
  if (!/hl\s*\.\s*ready\s*\(/.test(js)) p.push('It never waits for hl.ready() before using hl.');
  if (/hl\s*\.\s*(set|setMine|patch|remove)\s*\(/.test(js) && !/hl\s*\.\s*onChange\s*\(/.test(js)) {
    p.push('It saves data but never re-renders on hl.onChange, so other members do not see updates live.');
  }
  if (/\son[a-z]+\s*=\s*["']/i.test(html)) p.push('It uses inline on…= handlers; attach listeners with addEventListener.');
  if (!/addEventListener\s*\(/.test(js) && /<button\b/i.test(html)) p.push('Its buttons have no listeners.');
  if (!/hl\s*\.\s*esc\s*\(/.test(js) && /innerHTML/.test(js)) p.push('It writes member text with innerHTML without hl.esc().');
  if (!/class\s*=\s*["'][^"']*\bempty\b/.test(html) && !/['"]empty['"]|class="empty|\.empty\b/.test(html)) p.push('It has no empty state for when there is no data yet.');
  const missing = plannedKeys.filter((k) => !html.includes(k));
  if (plannedKeys.length && missing.length > plannedKeys.length / 2) p.push(`It leaves out most of the planned data (${missing.slice(0, 4).join(', ')}).`);
  return p;
}

/** A score to choose between drafts: hard problems disqualify, then quality and completeness. */
export function scoreApp(html: string, plannedKeys: readonly string[] = []): { score: number; hard: string[]; quality: string[] } {
  const hard = hardProblems(html);
  const quality = qualityProblems(html, plannedKeys);
  if (hard.length) return { score: -1000 - hard.length, hard, quality };
  let s = 100 - quality.length * 12;
  const js = scriptsOf(html).join('\n');
  if (/hl\s*\.\s*pick\s*\(/.test(js)) s += 5; // Spanish and English
  if (/app-header/.test(html)) s += 4; // the design system's header
  if (/hl\s*\.\s*(mine|setMine|everyone)\s*\(/.test(js)) s += 3; // per-member data where it fits
  if (/me\s*\.\s*isAdmin|isAdmin/.test(js)) s += 3; // admin controls considered
  if (plannedKeys.length) s += Math.round((plannedKeys.filter((k) => html.includes(k)).length / plannedKeys.length) * 10);
  s += Math.min(8, Math.floor(new TextEncoder().encode(html).length / 4000)); // completeness, capped
  return { score: s, hard, quality };
}

/** Key prefixes the plan names (e.g. "item:", "vote", "rsvp:"), to check the draft covers them. */
export function plannedKeysOf(plan: string): string[] {
  const keys = new Set<string>();
  for (const m of plan.matchAll(/`([A-Za-z][A-Za-z0-9_.-]{1,30}:?)(?:<[^>`]*>)?[^`]*`/g)) keys.add(m[1]);
  for (const m of plan.matchAll(/\b([a-z][a-z0-9_]{1,24}:)<[a-z_]+>/gi)) keys.add(m[1]);
  return [...keys].slice(0, 12);
}

/** Time left for the job, keeping a reserve for storing the result. */
export function timeLeft(deadline: number, reserveMs = 8_000): number {
  return Math.max(0, deadline - Date.now() - reserveMs);
}
