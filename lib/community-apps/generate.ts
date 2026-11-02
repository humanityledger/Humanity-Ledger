/**
 * lib/community-apps/generate.ts
 *
 * Writes or revises a community app from a member's description, using a
 * language model on the server. The member's description (and, for a
 * revision, the app's current code) is sent to the configured provider.
 * Nothing else is: no messages, no member list, no addresses.
 *
 * Providers, first one configured wins:
 *   ANTHROPIC_API_KEY                         Anthropic Messages API
 *   OPENAI_API_KEY (+ OPENAI_BASE_URL)        any OpenAI-compatible endpoint,
 *                                             including a local model server
 * COMMUNITY_APPS_MODEL overrides the model name. It is required for the
 * OpenAI-compatible path, because model names differ per server.
 */

import { APP_TEMPLATES } from './templates';
import { validateAppHtml } from './validate';
import { studioWorkspaceHeaders } from '@/lib/studio/workspace';

export class GenerationUnavailableError extends Error {}
export class GenerationFailedError extends Error {
  constructor(message: string, public problems: string[] = []) { super(message); }
}

const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5-5';
const MAX_OUTPUT_TOKENS = 16000;
const TIMEOUT_MS = 150_000;

export function generationConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY || (!!process.env.OPENAI_API_KEY && !!process.env.COMMUNITY_APPS_MODEL);
}

const EXAMPLE = APP_TEMPLATES.find(t => t.id === 'list')!.html.trim();

const SYSTEM = `You build small apps that a community runs inside Ledger Chat, a private messaging app. A member describes what the community needs; you write the app.

# Where the app runs
- A sandboxed iframe with an opaque origin and NO network. fetch, XMLHttpRequest, WebSocket, external scripts, fonts, images and iframes are all blocked. localStorage and cookies are unavailable. Do not use them.
- alert, confirm and prompt do nothing in the sandbox. Use inline UI instead (for a destructive action, a second click that confirms).
- Never navigate: no location changes, no window.open, no forms that submit.
- The page already has a base stylesheet and the global \`hl\` object. Write only the body: markup, one <style> if needed, one <script>.

# Data: the hl object (the only way to save anything)
- await hl.ready() -> context: { me: { id, label, isAdmin, isCreator }, community: { name }, app: { id, title }, preview }
  Call nothing else before ready() resolves. me.label is a short wallet address; show it where you would show a name.
- Shared keys: any member can write them.
  hl.get(key, fallback) -> value | fallback          (synchronous)
  hl.set(key, value) -> Promise                     (value null deletes)
  hl.list(prefix) -> [{ key, value, by: { id, label }, at }]   sorted by key; "by" is who wrote it last, set by the server
- Member keys: each member has their own value under the same key, and only that member can write it. Use these for anything personal that others must not be able to change: votes, sign-ups, availability, scores, items someone owns.
  hl.mine(key, fallback) -> my value                (synchronous)
  hl.setMine(key, value) -> Promise                 (value null deletes)
  hl.everyone(key) -> [{ id, label, value, at, me }] every member's value, oldest first
- hl.onChange(fn) runs fn after any change, local or from another member. Re-render from hl.* inside it. Do not re-render while the person is typing in a field you would destroy: keep their input in a variable and restore focus, as the example does.
- hl.uid() returns a random id. hl.esc(text) escapes text for HTML.
- Keys: 1-80 characters of letters, digits and _ . : -  Values: JSON, at most 8 KB each. Split large data across keys (for example item:<id>).
- Writes are optimistic and synced to everyone within a few seconds. Two people can write the same shared key at the same time and the last write wins, so prefer one key per item, or member keys, over one big shared array.
- Settings that only the organiser should change: show those controls only when me.isCreator or me.isAdmin.

# Security
- Everything a member typed is untrusted. ALWAYS pass it through hl.esc before putting it in innerHTML, including in attributes.
- Never ask for passwords, recovery phrases, private keys, card numbers or any other secret. Never imitate a sign-in screen or a wallet. An automatic check rejects any app that contains the words "private key", "seed phrase", "recovery phrase", "mnemonic" or a password field, even inside a warning, so do not write them at all.
- Apps cannot move money. If someone asks for payments, build the tracking side (who owes what) and say in the app that payment happens outside it.

# Design
- Monochrome. Black ink on white, greys for secondary text. No colour, no gradients, no emoji, no decorative icons.
- Use the base stylesheet: wrap everything in <div class="app">. Classes available: .stack .row .between .grow .card .list .label .muted .faint .small .mono .num .chip .chip.on .bar>i .empty .field .scroll-x; button, button.primary, button.ghost, button.item; inputs, textareas and selects are styled already. CSS variables: --ink --ink-2 --ink-3 --ink-4 --bg --bg-subtle --bg-muted --bg-hover --border --border-strong --radius --radius-lg --mono.
- One clear title (h1) with a short .label above it. Calm spacing. Card styling only for the one thing that needs setting apart.
- Works at 320px wide. Every control is a real button or input with a label. Visible focus is already handled.
- Write the interface in the language the member used. Short, direct labels. A button says what it does.

# Quality
- Handle the empty state (no data yet) and the setup state (organiser has not configured it) explicitly.
- Must work when several members use it at the same time.
- No placeholder logic, no fake data, no "coming soon". Every control works.
- Keep it under 60 KB.

# Output format
Reply with exactly these three parts and nothing else:
<title>A short name, at most 40 characters</title>
<summary>One sentence saying what it does, at most 140 characters</summary>
<app>
...the HTML body fragment...
</app>

# Example of a finished app (a shared list)
<app>
${EXAMPLE}
</app>`;

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
  const title = pick('title').replace(/\s+/g, ' ').slice(0, 60) || 'Community app';
  const summary = pick('summary').replace(/\s+/g, ' ').slice(0, 200);
  return { title, summary, html };
}

async function callAnthropic(system: string, user: string, signal: AbortSignal): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
      // Keys not limited to one workspace must name it (see lib/studio/client.ts).
      ...(studioWorkspaceHeaders() ?? {}),
    },
    body: JSON.stringify({
      model: process.env.COMMUNITY_APPS_MODEL || DEFAULT_ANTHROPIC_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new GenerationFailedError(`The model provider answered ${res.status}: ${body?.error?.message || 'no detail'}`);
  return (body.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
}

async function callOpenAICompatible(system: string, user: string, signal: AbortSignal): Promise<string> {
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.COMMUNITY_APPS_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new GenerationFailedError(`The model provider answered ${res.status}: ${body?.error?.message || 'no detail'}`);
  return body?.choices?.[0]?.message?.content || '';
}

async function complete(user: string): Promise<string> {
  if (!generationConfigured()) {
    throw new GenerationUnavailableError('No model is configured on this server. Set ANTHROPIC_API_KEY, or OPENAI_API_KEY with COMMUNITY_APPS_MODEL.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return process.env.ANTHROPIC_API_KEY
      ? await callAnthropic(SYSTEM, user, controller.signal)
      : await callOpenAICompatible(SYSTEM, user, controller.signal);
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new GenerationFailedError('The model took too long. Try a shorter description.');
    throw e;
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
    lines.push('', 'This is the current app. Change it as requested and return the whole app.', '<current>', input.current.html, '</current>');
    if (input.runtimeError) lines.push('', `It failed while running with this error: ${input.runtimeError.slice(0, 800)}`);
    lines.push('', `Requested change: ${input.request}`);
  } else {
    lines.push('', `What the community needs: ${input.request}`);
  }
  const user = lines.join('\n');

  let reply = parseReply(await complete(user));
  let check = validateAppHtml(reply.html);
  if (!check.ok) {
    const retry = `${user}\n\nYour previous answer was rejected for these reasons:\n- ${check.problems.join('\n- ')}\nFix them and return the whole app again in the same format.\n\n<previous>\n${reply.html.slice(0, 60_000)}\n</previous>`;
    reply = parseReply(await complete(retry));
    check = validateAppHtml(reply.html);
    if (!check.ok) throw new GenerationFailedError('The model could not produce an app that passes the safety checks.', check.problems);
  }
  return reply;
}
