/**
 * lib/community-apps/generate.ts
 *
 * Writes or revises a community app from a member's description, using a
 * language model on the server. The member's description (and, for a
 * revision, the app's current code) is sent to the configured provider.
 * Nothing else is: no messages, no member list, no addresses.
 *
 * Providers, first one configured wins:
 *   GROQ_API_KEY                              Groq (the same client as Ledger Studio,
 *                                             lib/studio/groq.ts: free tier, fitted to
 *                                             its tokens-per-minute limit, model fallback)
 *   OPENAI_API_KEY (+ OPENAI_BASE_URL)        any OpenAI-compatible endpoint,
 *                                             including a local model server
 * COMMUNITY_APPS_MODEL overrides the model name. It is required for the
 * OpenAI-compatible path, because model names differ per server.
 * (Anthropic was removed from Studio on 11 November 2026.)
 *
 * Max engine (28 November 2026, lib/community-apps/engine.ts): when COMMUNITY_APPS_MAX_API_KEY and
 * COMMUNITY_APPS_MAX_MODEL are set, apps are written by that model (OpenAI-compatible, or Anthropic
 * when COMMUNITY_APPS_MAX_PROVIDER=anthropic) with a plan, parallel drafts, server-side checks and a
 * refinement pass. Without them, the free path below is unchanged except that JavaScript which does
 * not parse is now caught on the server too.
 */

import { createStudioClient, serverDefaultModel, studioApiKey } from '@/lib/studio/client';
import { ProviderError } from '@/lib/studio/groq';
import type { SystemBlock } from '@/lib/studio/prompt';
import { isStudioModel } from '@/lib/studio/models';
import { hardProblems, plannedKeysOf, qualityProblems, resolveEngine, scoreApp, timeLeft, type EngineConfig } from './engine';

export class GenerationUnavailableError extends Error {}
export class GenerationFailedError extends Error {
  constructor(message: string, public problems: string[] = []) { super(message); }
}

const TIMEOUT_MS = 150_000;

export function generationConfigured(): boolean {
  return resolveEngine().tier === 'max' || !!studioApiKey() || (!!process.env.OPENAI_API_KEY && !!process.env.COMMUNITY_APPS_MODEL);
}

/**
 * The system prompt as three blocks, most important first. Groq's free tier allows about 8,000
 * tokens per minute; lib/studio/groq.ts fitSystem() shortens the largest block after the first
 * when a call would not fit, so the rules (block 0) are never cut and the reference pattern
 * (block 2) goes first. One single block could not be shortened, and a revision ("Fix it"), which
 * also carries the current app, then failed on the server.
 */
const RULES_BLOCK = `You build complete apps that a community runs inside Ledger Chat, a private messaging app. A member describes what the community needs; you write a finished, working tool, not a demo.

# Where the app runs (non-negotiable)
- A sandboxed iframe with an opaque origin and NO network. fetch, XMLHttpRequest, WebSocket, external scripts, CDNs, fonts, images and iframes are all blocked. localStorage, sessionStorage, indexedDB and cookies are unavailable. Do not use them.
- alert, confirm and prompt do nothing. Use inline UI (a destructive action asks for a second click that confirms).
- Never navigate: no location changes, no window.open, no <form> elements (use buttons and inputs).
- Never touch window.ethereum or any wallet. Apps cannot move money: build the tracking side and say in the app that payment happens in Ledger Chat, outside the app.
- The page already has a base stylesheet and the global hl object. Write only the body: markup, at most one <style>, one <script>. No inline onclick= attributes: attach listeners with addEventListener (event delegation on a root element).

# Data: the hl object (the only way to save anything)
- await hl.ready() -> context: { me: { id, label, isAdmin, isCreator }, community: { name }, app: { id, title }, preview }. Call nothing else before it resolves. me.label is a short wallet address; show it where you would show a name.
- Shared keys (any member writes): hl.get(key, fallback) sync; hl.set(key, value) -> Promise (null deletes); hl.patch(key, fn, fallback) read-modify-write; hl.remove(key); hl.list(prefix) -> [{ key, value, by: { id, label }, at }] sorted by key.
- Member keys (only that member writes; use for votes, sign-ups, scores, anything personal): hl.mine(key, fallback) sync; hl.setMine(key, value) -> Promise; hl.everyone(key) -> [{ id, label, value, at, me }].
- hl.onChange(fn) runs after any change, local or remote: re-render from hl.* inside it, but keep what the person is typing (store it in a variable and restore focus).
- Helpers: hl.uid(), hl.esc(text), hl.lang ('es' | 'en'), hl.pick(es, en), hl.formatDate(iso).
- Keys: 1-80 characters of letters, digits and _ . : -  Values: JSON, at most 8 KB. One key per item (item:<id>) instead of one big array: two members writing the same key at once means the last write wins.
- Organiser-only settings and destructive bulk actions: show them only when me.isCreator or me.isAdmin.

# Security
- Everything a member typed is untrusted: ALWAYS pass it through hl.esc before innerHTML, attributes included.
- Never ask for passwords, recovery phrases, private keys, card numbers or any secret; never imitate a sign-in or a wallet. An automatic check rejects any app containing the words "private key", "seed phrase", "recovery phrase", "mnemonic" or a password field, even in a warning: do not write them.

# Output format
Reply with exactly these three parts and nothing else:
<title>A short name, at most 40 characters</title>
<summary>One sentence saying what it does, at most 140 characters</summary>
<app>
...the HTML body fragment...
</app>`;

const DESIGN_BLOCK = `# Layout and design (Ledger Chat institutional style)
- The app fills the whole frame. Structure: <div class="app"><header class="app-header"><div><span class="label">KIND</span><h1>Title</h1></div>...primary action...</header><main class="app-body">...</main></div>. The header is sticky; the body scrolls.
- Light theme only. Ink on white, greys for secondary text, the accent blue (var(--accent)) only for the single primary action or a selected state. No gradients, no shadows beyond the base, no emoji, no decorative icons, no dark mode.
- Classes: .stack .row .between .grow .grid-2 .grid-auto .card .kpi .kpi-val .kpi-lbl .list .tabs .tab (aria-selected="true" marks the open tab) .badge .badge-accent .badge-ok .badge-warn .badge-danger .notice .banner .search-row .label .muted .faint .small .mono .num .chip .chip.on .bar>i .empty .field .scroll-x; button, button.primary, button.accent, button.danger, button.ghost, button.item. Inputs, selects and textareas are styled. Variables: --ink --ink-2 --ink-3 --accent --ok --warn --danger --bg --bg-subtle --bg-muted --border --border-strong --radius --radius-lg --mono.
- Touch targets are at least 44 px (the base does this). Works from 320 px to a full desktop window. Every control is a real button or input with a visible label or an aria-label.
- Interface language: follow the reader with hl.pick('Spanish', 'English') for every visible text.

# What a complete tool has
- Create, edit and delete for everything it stores, with validation and an inline error message next to the field.
- A KPI row (.grid-auto of .kpi) when the data has totals worth seeing at a glance.
- Lists sorted meaningfully; a search/filter .search-row when a list can pass 8 items; pagination (20 per page) when it can pass 20.
- Tabs (.tabs) when the tool has more than one view (for example Log / Standings / Settings).
- An explicit empty state (.empty with a small inline monochrome <svg>) and a setup state when the organiser has not configured it yet.
- Works when several members use it at the same time. No placeholder logic, no fake data, no "coming soon". Under 60 KB.`;

const REFERENCE_BLOCK = `# Reference pattern (shape only; write your own app)
<app>
<div class="app" id="root" aria-live="polite"><p class="muted">…</p></div>
<script>
(function () {
  var root = document.getElementById('root'), me = null, typed = '', armed = '';
  function items() { return hl.list('item:').map(function (e) { return { id: e.key.slice(5), v: e.value, by: e.by }; }); }
  function render() {
    var h = '<header class="app-header"><div><span class="label">' + hl.pick('Lista', 'List') + '</span><h1>' + hl.esc(hl.get('title', hl.pick('Lista compartida', 'Shared list'))) + '</h1></div></header><main class="app-body">';
    h += '<div class="search-row"><input id="new" aria-label="' + hl.pick('Nuevo elemento', 'New item') + '" value="' + hl.esc(typed) + '"><button class="accent" data-act="add">' + hl.pick('Añadir', 'Add') + '</button></div>';
    var list = items();
    if (!list.length) h += '<div class="empty">' + hl.pick('Todavía no hay nada.', 'Nothing here yet.') + '</div>';
    else h += '<div class="list">' + list.map(function (i) { return '<div class="row between"><span class="grow">' + hl.esc(i.v.text) + '</span><button class="ghost" data-act="del" data-id="' + hl.esc(i.id) + '">' + (armed === i.id ? hl.pick('Confirmar', 'Confirm') : hl.pick('Borrar', 'Delete')) + '</button></div>'; }).join('') + '</div>';
    root.innerHTML = h + '</main>';
  }
  root.addEventListener('input', function (e) { if (e.target.id === 'new') typed = e.target.value; });
  root.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'add' && typed.trim()) { hl.set('item:' + hl.uid(), { text: typed.trim().slice(0, 200) }); typed = ''; }
    if (b.dataset.act === 'del') { if (armed === b.dataset.id) { hl.remove('item:' + b.dataset.id); armed = ''; } else { armed = b.dataset.id; render(); } }
  });
  hl.ready().then(function (c) { me = c.me; render(); hl.onChange(render); });
})();
</script>
</app>`;

/** The blocks sent as the system prompt, in priority order (see RULES_BLOCK above). */
export const SYSTEM_BLOCKS: SystemBlock[] = [
  { type: 'text', text: RULES_BLOCK },
  { type: 'text', text: DESIGN_BLOCK },
  { type: 'text', text: REFERENCE_BLOCK },
];

/**
 * The current app as sent with a revision: no indentation, no trailing spaces, no runs of blank
 * lines. The model returns the whole app again, so nothing it needs is dropped; tokens are.
 */
export function compactSource(html: string): string {
  return html
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/^[ \t]+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface ModelReply { title: string; summary: string; html: string }

function parseReply(text: string): ModelReply {
  const pick = (tag: string) => {
    const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
    return m ? m[1].trim() : '';
  };
  let html = pick('app');
  if (!html) {
    const fence = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
    html = fence ? fence[1].trim() : '';
  }
  if (!html) {
    // An answer cut off before </app>: keep what follows <app>, the validator decides if it is usable.
    const open = text.search(/<app>/i);
    if (open >= 0) html = text.slice(open + 5).trim();
  }
  const title = pick('title').replace(/\s+/g, ' ').slice(0, 60) || 'Community app';
  const summary = pick('summary').replace(/\s+/g, ' ').slice(0, 200);
  return { title, summary, html };
}

/** One model call. Everything above it (plan, drafts, checks) is provider-independent. */
export type Transport = (call: { system: SystemBlock[]; user: string; maxTokens: number; timeoutMs: number }) => Promise<string>;

function withTimeout<T>(timeoutMs: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1_000, timeoutMs));
  return run(controller.signal).finally(() => clearTimeout(timer));
}

function groqTransport(engine: EngineConfig): Transport {
  const override = process.env.COMMUNITY_APPS_MODEL;
  const model = isStudioModel(override) ? override : serverDefaultModel();
  return ({ system, user, maxTokens, timeoutMs }) => withTimeout(timeoutMs, async (signal) => {
    try {
      const r = await createStudioClient(studioApiKey() as string, { timeout: timeoutMs }).complete(
        { model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }], tools: [], reasoning_effort: engine.effort ?? 'low' },
        { signal },
      );
      return r.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    } catch (e) {
      if (e instanceof ProviderError) throw new GenerationFailedError(e.message);
      throw e;
    }
  });
}

/** Any OpenAI-compatible Chat Completions endpoint. */
function openAITransport(base: string, key: string, model: string, effort?: string): Transport {
  return ({ system, user, maxTokens, timeoutMs }) => withTimeout(timeoutMs, async (signal) => {
    const send = async (tokenParam: 'max_tokens' | 'max_completion_tokens') => fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        [tokenParam]: maxTokens,
        ...(effort ? { reasoning_effort: effort } : {}),
        messages: [{ role: 'system', content: system.map((b) => b.text).join('\n\n') }, { role: 'user', content: user }],
      }),
    });
    let res = await send('max_tokens');
    let body: any = await res.json().catch(() => ({}));
    // Newer reasoning models take max_completion_tokens instead of max_tokens.
    if (res.status === 400 && /max_tokens|max_completion_tokens/i.test(String(body?.error?.message ?? ''))) {
      res = await send('max_completion_tokens');
      body = await res.json().catch(() => ({}));
    }
    if (!res.ok) throw new GenerationFailedError(`The model provider answered ${res.status}: ${String(body?.error?.message || 'no detail').slice(0, 300)}`);
    return body?.choices?.[0]?.message?.content || '';
  });
}

/** Anthropic Messages API. */
function anthropicTransport(base: string, key: string, model: string): Transport {
  return ({ system, user, maxTokens, timeoutMs }) => withTimeout(timeoutMs, async (signal) => {
    const res = await fetch(`${base}/messages`, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system: system.map((b) => b.text).join('\n\n'), messages: [{ role: 'user', content: user }] }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new GenerationFailedError(`The model provider answered ${res.status}: ${String(body?.error?.message || 'no detail').slice(0, 300)}`);
    return (Array.isArray(body?.content) ? body.content : []).filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('');
  });
}

export function transportFor(engine: EngineConfig): Transport {
  if (engine.tier === 'max') {
    return engine.provider === 'anthropic'
      ? anthropicTransport(engine.baseUrl as string, engine.apiKey as string, engine.model as string)
      : openAITransport(engine.baseUrl as string, engine.apiKey as string, engine.model as string, engine.effort);
  }
  if (studioApiKey()) return groqTransport(engine);
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  return openAITransport(base, process.env.OPENAI_API_KEY as string, process.env.COMMUNITY_APPS_MODEL as string);
}

/** A call with the provider's failures turned into messages a member can act on. */
async function call(transport: Transport, args: Parameters<Transport>[0]): Promise<string> {
  try {
    return await transport(args);
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new GenerationFailedError('The model took too long. Try a shorter description.');
    if (e instanceof GenerationFailedError || e instanceof GenerationUnavailableError) throw e;
    // Network failures and unexpected provider answers are a failed generation, not a server error.
    console.error('[community apps generate] provider call failed:', e?.name || 'Error', String(e?.message || '').slice(0, 200));
    throw new GenerationFailedError('The model service could not be reached. Try again in a minute.');
  }
}

export interface GenerateInput {
  request: string;
  communityName: string;
  current?: { title: string; html: string };
  runtimeError?: string;
}

function userMessage(input: GenerateInput): string {
  const lines: string[] = [`Community: ${input.communityName.slice(0, 80)}`];
  if (input.current) {
    lines.push('', 'This is the current app. Change it as requested and return the whole app.', '<current>', compactSource(input.current.html), '</current>');
    if (input.runtimeError) lines.push('', `It failed while running with this error: ${input.runtimeError.slice(0, 800)}`);
    lines.push('', `Requested change: ${input.request}`);
  } else {
    lines.push('', `What the community needs: ${input.request}`);
  }
  return lines.join('\n');
}

// ── Max engine prompts (not sent on the free tier: they would not fit its token limit) ─────────

/** Extra standards for the max engine: what separates a finished tool from a demo. */
export const QUALITY_BLOCK = `# Quality bar (max engine)
Before you write, think the app through like a senior product engineer:
- The real job: who uses it, how often, what they must see first, what an admin needs that a member does not (me.isAdmin).
- Data model: one key per item (item:<id>), member keys for anything personal (votes, RSVPs, scores), totals computed at render, never stored. Concurrent edits use hl.patch or member keys so nobody overwrites anyone.
- Every state: empty, one item, many items (sorting, grouping, search or filters when lists can grow), errors from hl.set (show them inline), long text (wrap, clamp), and the preview context.
- Interaction: clear primary action, keyboard friendly (Enter submits, focus kept while typing across hl.onChange re-renders), destructive actions confirm with a second click, undo where cheap.
- Language: every visible string through hl.pick(es, en). Dates through hl.formatDate. Numbers with toLocaleString.
- Layout: mobile first (360 px wide), no horizontal scroll, touch targets of 40 px or more, the design system classes.
- Code: small named functions, one render() from state, event delegation on the root, no global leaks beyond one IIFE, no dead code, no console noise.
Then write the complete app. Never leave TODOs, placeholders or "add more here".`;

const PLAN_INSTRUCTIONS = `Plan the app before anyone writes code. Answer only with:
<plan>
Purpose: one sentence.
Users and roles: members, admins (me.isAdmin), creator.
Data (keys in backticks, e.g. \`item:<id>\` {title, by, at}, \`vote\` member key): every key, its value shape, who writes it.
Screens and sections, in order of importance.
Interactions: each action, what it writes, what re-renders.
Edge cases and limits.
</plan>
Be concrete and complete; no code.`;

const VARIANTS = [
  'Follow the plan exactly.',
  'Follow the plan, and favour the most robust, simplest interaction for each action.',
  'Follow the plan, and favour the richest useful views (summaries, sorting, filters, admin tools).',
  'Follow the plan, and polish the details: empty states, inline errors, keyboard flow, focus.',
  'Follow the plan, and favour clarity for first-time members: short help text and obvious next steps.',
];

/**
 * Writes or revises an app.
 *  free: one attempt, and if it fails the checks, one repair that shows the model what was rejected.
 *  max:  plan → parallel drafts from the plan → server-side checks and scoring → repair or refine.
 */
export async function generateApp(input: GenerateInput): Promise<ModelReply> {
  if (!generationConfigured()) {
    throw new GenerationUnavailableError('No model is configured on this server. Set GROQ_API_KEY, or OPENAI_API_KEY with COMMUNITY_APPS_MODEL, or COMMUNITY_APPS_MAX_API_KEY with COMMUNITY_APPS_MAX_MODEL.');
  }
  const engine = resolveEngine();
  return generateWith(input, engine, transportFor(engine));
}

/** The pipeline with an injectable transport (tests use a fake one). */
export async function generateWith(input: GenerateInput, engine: EngineConfig, transport: Transport, now: number = Date.now()): Promise<ModelReply> {
  const deadline = now + engine.budgetMs;
  const user = userMessage(input);
  const perCall = (share = 1) => Math.min(TIMEOUT_MS * (engine.tier === 'max' ? 1.6 : 1), Math.floor(timeLeft(deadline) * share));

  if (engine.tier === 'free') {
    let reply = parseReply(await call(transport, { system: SYSTEM_BLOCKS, user, maxTokens: engine.maxOutputTokens, timeoutMs: perCall() }));
    let problems = hardProblems(reply.html);
    if (problems.length) {
      // The rejected answer is not sent back: with the current app it would not fit the free tier.
      // The reasons are enough for the model to write it again without them.
      const retry = `${user}\n\nYour previous answer was rejected for these reasons:\n- ${problems.join('\n- ')}\nWrite the whole app again in the same format, without those problems.`;
      if (timeLeft(deadline) < 15_000) throw new GenerationFailedError('The model could not produce an app that passes the safety checks.', problems);
      reply = parseReply(await call(transport, { system: SYSTEM_BLOCKS, user: retry, maxTokens: engine.maxOutputTokens, timeoutMs: perCall() }));
      problems = hardProblems(reply.html);
      if (problems.length) throw new GenerationFailedError('The model could not produce an app that passes the safety checks.', problems);
    }
    return reply;
  }

  // ── max ──
  const system: SystemBlock[] = [...SYSTEM_BLOCKS, { type: 'text', text: QUALITY_BLOCK }];

  // 1. Plan (skipped when time is short; a revision plans the change against the current app).
  let plan = '';
  if (engine.plan && timeLeft(deadline) > 120_000) {
    try {
      const raw = await call(transport, {
        system,
        user: `${user}\n\n${input.current ? 'Plan the requested change to the current app (what stays, what changes, any new data).\n' : ''}${PLAN_INSTRUCTIONS}`,
        maxTokens: Math.min(6_000, engine.maxOutputTokens),
        timeoutMs: perCall(0.3),
      });
      plan = (raw.match(/<plan>([\s\S]*?)<\/plan>/i)?.[1] ?? raw).trim().slice(0, 6_000);
    } catch { /* a plan helps; without it the drafts still follow the rules */ }
  }
  const keys = plannedKeysOf(plan);
  const build = (variant: string) =>
    `${user}${plan ? `\n\nThe agreed plan:\n<plan>\n${plan}\n</plan>` : ''}\n\n${variant} Answer in the required format: <title>, <summary>, <app>.`;

  // 2. Drafts in parallel.
  const n = Math.max(1, engine.candidates);
  const settled = await Promise.allSettled(
    Array.from({ length: n }, (_, i) => call(transport, { system, user: build(VARIANTS[i % VARIANTS.length]), maxTokens: engine.maxOutputTokens, timeoutMs: perCall(0.75) })),
  );
  const drafts = settled
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
    .map((r) => parseReply(r.value))
    .map((reply) => ({ reply, ...scoreApp(reply.html, keys) }))
    .sort((a, b) => b.score - a.score);
  if (!drafts.length) {
    const why = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected')?.reason;
    throw why instanceof GenerationFailedError ? why : new GenerationFailedError('The model service could not be reached. Try again in a minute.');
  }
  let best = drafts[0];

  // 3. Repair (hard problems) or refine (quality problems), once, when time allows.
  const issues = best.hard.length ? best.hard : engine.refine ? best.quality : [];
  if (issues.length && timeLeft(deadline) > 25_000) {
    const fix = `${build('Fix the draft below.')}\n\nYour draft:\n<draft>\n${compactSource(best.reply.html)}\n</draft>\n\nThe server checks found:\n- ${issues.join('\n- ')}\nReturn the whole corrected app in the required format.`;
    try {
      const reply = parseReply(await call(transport, { system, user: fix, maxTokens: engine.maxOutputTokens, timeoutMs: perCall() }));
      if (!reply.title || reply.title === 'Community app') reply.title = best.reply.title;
      if (!reply.summary) reply.summary = best.reply.summary;
      const scored = { reply, ...scoreApp(reply.html, keys) };
      if (scored.score >= best.score) best = scored;
    } catch (e) {
      if (best.hard.length) throw e;
    }
  }
  if (best.hard.length) throw new GenerationFailedError('The model could not produce an app that passes the safety checks.', best.hard);
  return best.reply;
}

/** Quality findings for an app (exposed for tests and diagnostics). */
export { qualityProblems };
