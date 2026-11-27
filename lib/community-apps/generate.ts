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
 * (Anthropic was removed on 11 November 2026.)
 */

import { validateAppHtml } from './validate';
import { createStudioClient, serverDefaultModel, studioApiKey } from '@/lib/studio/client';
import { ProviderError } from '@/lib/studio/groq';
import type { SystemBlock } from '@/lib/studio/prompt';
import { isStudioModel } from '@/lib/studio/models';

export class GenerationUnavailableError extends Error {}
export class GenerationFailedError extends Error {
  constructor(message: string, public problems: string[] = []) { super(message); }
}

const MAX_OUTPUT_TOKENS = 8000;
const TIMEOUT_MS = 150_000;

export function generationConfigured(): boolean {
  return !!studioApiKey() || (!!process.env.OPENAI_API_KEY && !!process.env.COMMUNITY_APPS_MODEL);
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

async function callGroq(system: SystemBlock[], user: string, signal: AbortSignal): Promise<string> {
  const override = process.env.COMMUNITY_APPS_MODEL;
  const model = isStudioModel(override) ? override : serverDefaultModel();
  try {
    const r = await createStudioClient(studioApiKey() as string, { timeout: TIMEOUT_MS }).complete(
      { model, max_tokens: MAX_OUTPUT_TOKENS, system, messages: [{ role: 'user', content: user }], tools: [], reasoning_effort: 'low' },
      { signal },
    );
    return r.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  } catch (e) {
    if (e instanceof ProviderError) throw new GenerationFailedError(e.message);
    throw e;
  }
}

async function callOpenAICompatible(system: SystemBlock[], user: string, signal: AbortSignal): Promise<string> {
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.COMMUNITY_APPS_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: 'system', content: system.map((b) => b.text).join('\n\n') }, { role: 'user', content: user }],
    }),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new GenerationFailedError(`The model provider answered ${res.status}: ${body?.error?.message || 'no detail'}`);
  return body?.choices?.[0]?.message?.content || '';
}

async function complete(user: string): Promise<string> {
  if (!generationConfigured()) {
    throw new GenerationUnavailableError('No model is configured on this server. Set GROQ_API_KEY, or OPENAI_API_KEY with COMMUNITY_APPS_MODEL.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return studioApiKey()
      ? await callGroq(SYSTEM_BLOCKS, user, controller.signal)
      : await callOpenAICompatible(SYSTEM_BLOCKS, user, controller.signal);
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new GenerationFailedError('The model took too long. Try a shorter description.');
    if (e instanceof GenerationFailedError || e instanceof GenerationUnavailableError) throw e;
    // Network failures and unexpected provider answers are a failed generation, not a server error.
    console.error('[community apps generate] provider call failed:', e?.name || 'Error', String(e?.message || '').slice(0, 200));
    throw new GenerationFailedError('The model service could not be reached. Try again in a minute.');
  } finally {
    clearTimeout(timer);
  }
}

export interface GenerateInput {
  request: string;
  communityName: string;
  current?: { title: string; html: string };
  runtimeError?: string;
}

/**
 * One attempt, and if the result fails validation, one repair attempt that
 * shows the model exactly what was rejected.
 */
export async function generateApp(input: GenerateInput): Promise<ModelReply> {
  const lines: string[] = [`Community: ${input.communityName.slice(0, 80)}`];
  if (input.current) {
    lines.push('', 'This is the current app. Change it as requested and return the whole app.', '<current>', compactSource(input.current.html), '</current>');
    if (input.runtimeError) lines.push('', `It failed while running with this error: ${input.runtimeError.slice(0, 800)}`);
    lines.push('', `Requested change: ${input.request}`);
  } else {
    lines.push('', `What the community needs: ${input.request}`);
  }
  const user = lines.join('\n');

  let reply = parseReply(await complete(user));
  let check = validateAppHtml(reply.html);
  if (!check.ok) {
    // The rejected answer is not sent back: with the current app it would not fit the free tier.
    // The reasons are enough for the model to write it again without them.
    const retry = `${user}\n\nYour previous answer was rejected for these reasons:\n- ${check.problems.join('\n- ')}\nWrite the whole app again in the same format, without those problems.`;
    reply = parseReply(await complete(retry));
    check = validateAppHtml(reply.html);
    if (!check.ok) throw new GenerationFailedError('The model could not produce an app that passes the safety checks.', check.problems);
  }
  return reply;
}
