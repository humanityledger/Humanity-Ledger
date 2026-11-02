#!/usr/bin/env node
/**
 * Checks that Ledger Studio is ready to run, without spending anything:
 *   node scripts/studio-check.mjs            (reads .env.local, then .env)
 *
 * - ANTHROPIC_API_KEY is set and accepted by the API;
 * - every model Studio offers exists for this key (models.retrieve, free);
 * - a token count works (free), so the Messages API is reachable;
 * - Stripe and Redis settings that Pro and metering need are present.
 *
 * The key itself is never printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

for (const f of ['.env.local', '.env']) {
  const p = path.resolve(process.cwd(), f);
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false, quiet: true });
}

const MODELS = ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'];
let failed = false;
const ok = (m) => console.log(`  ok    ${m}`);
const warn = (m) => console.log(`  warn  ${m}`);
const bad = (m) => { failed = true; console.log(`  FAIL  ${m}`); };

console.log('Ledger Studio check\n');

const key = (process.env.ANTHROPIC_API_KEY || '').trim();
if (!key) {
  bad('ANTHROPIC_API_KEY is not set. Create one at https://platform.claude.com/settings/keys and add it to .env.local and to the server (Railway) variables.');
} else if (!key.startsWith('sk-ant-')) {
  bad('ANTHROPIC_API_KEY does not look like a Claude API key (it should start with "sk-ant-").');
} else {
  ok('ANTHROPIC_API_KEY is set');
  const ws = (process.env.ANTHROPIC_WORKSPACE_ID || '').trim();
  if (ws && !/^wrkspc_[A-Za-z0-9]{10,64}$/.test(ws)) bad('ANTHROPIC_WORKSPACE_ID does not look like a workspace ID (wrkspc_...).');
  else if (ws) ok(`requests name workspace ${ws}`);
  const client = new Anthropic({ apiKey: key, maxRetries: 0, timeout: 20_000, ...(ws ? { defaultHeaders: { 'anthropic-workspace-id': ws } } : {}) });
  for (const id of MODELS) {
    try {
      const m = await client.models.retrieve(id);
      ok(`model ${id} available (${m.display_name ?? m.id})`);
    } catch (e) {
      const s = e?.status;
      if (s === 401 || s === 403) { bad('the API rejected the key (401/403). Check that it is active and not revoked.'); break; }
      if (s === 400 && /workspace/i.test(String(e?.message))) { bad('this key is not limited to one workspace: set ANTHROPIC_WORKSPACE_ID (wrkspc_..., from platform.claude.com/settings/workspaces).'); break; }
      if (s === 404) bad(`model ${id} is not available for this key`);
      else bad(`could not check ${id}: ${s ?? ''} ${String(e?.message ?? e).slice(0, 160)}`);
    }
  }
  try {
    const c = await client.messages.countTokens({ model: 'claude-haiku-5-5', messages: [{ role: 'user', content: 'ping' }] });
    ok(`Messages API reachable (token count: ${c.input_tokens})`);
  } catch (e) {
    if (/credit balance/i.test(String(e?.message))) bad('the key works, but the account has no API credit. Add credit at https://platform.claude.com/settings/billing (Plans & Billing).');
    else bad(`Messages API not reachable: ${e?.status ?? ''} ${String(e?.message ?? e).slice(0, 160)}`);
  }
}

if (process.env.REDIS_URL) ok('REDIS_URL is set (metering and limits are shared across instances)');
else warn('REDIS_URL is not set: Studio meters in memory only (fine locally, not for production).');

if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_STUDIO_PRO) ok('Stripe is configured for Studio Pro');
else warn('STRIPE_SECRET_KEY / STRIPE_PRICE_STUDIO_PRO missing: the "Upgrade to Pro" button stays off.');

if (!process.env.NEXT_PUBLIC_APP_URL) warn('NEXT_PUBLIC_APP_URL is not set: checkout is refused in production without it.');

const cap = process.env.STUDIO_FREE_DAILY_GLOBAL_USD;
console.log(`  info  Free plan shared daily ceiling: $${cap && Number.isFinite(Number(cap)) ? Number(cap) : 25} (STUDIO_FREE_DAILY_GLOBAL_USD)`);

console.log(failed ? '\nNot ready.' : '\nReady.');
process.exit(failed ? 1 : 0);
