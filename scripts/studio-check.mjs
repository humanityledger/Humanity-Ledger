#!/usr/bin/env node
/**
 * Checks that Ledger Studio is ready to run, without using any of the AI quota:
 *   npm run studio:check            (reads .env.local, then .env)
 *
 * - GROQ_API_KEY is set and accepted by Groq (GET /models: free, no tokens used);
 * - every model Studio offers is served for this key (and GROQ_MODEL, if set, is one of them);
 * - GROQ_TPM_LIMIT and STUDIO_FREE_DAILY_GLOBAL_USD are sensible;
 * - Stripe and Redis settings that Pro and metering need are present.
 *
 * Provider: Groq (OpenAI-compatible API), since November 2026; Studio no longer uses
 * Anthropic. The key itself is never printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

for (const f of ['.env.local', '.env']) {
  const p = path.resolve(process.cwd(), f);
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false, quiet: true });
}

// Keep in step with STUDIO_MODELS in lib/studio/models.ts.
const MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];
const BASE_URL = 'https://api.groq.com/openai/v1';
let failed = false;
const ok = (m) => console.log(`  ok    ${m}`);
const warn = (m) => console.log(`  warn  ${m}`);
const bad = (m) => { failed = true; console.log(`  FAIL  ${m}`); };

console.log('Ledger Studio check (provider: Groq)\n');

const key = (process.env.GROQ_API_KEY || '').trim();
if (!key) {
  bad('GROQ_API_KEY is not set. Create a free key at https://console.groq.com/keys and add it to .env.local and to the server (Railway) variables.');
} else {
  if (!key.startsWith('gsk_')) warn('GROQ_API_KEY does not start with "gsk_" (Groq keys usually do). Checking it anyway.');
  else ok('GROQ_API_KEY is set');
  try {
    const res = await fetch(`${BASE_URL}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20_000) });
    if (res.status === 401 || res.status === 403) {
      bad('Groq rejected the key (401/403). Check that it is active and copied without spaces.');
    } else if (!res.ok) {
      bad(`Groq answered ${res.status} to the model list. Try again later (https://groqstatus.com).`);
    } else {
      const ids = new Set(((await res.json())?.data ?? []).map((m) => m?.id));
      ok('Groq API reachable and the key is accepted');
      for (const id of MODELS) {
        if (ids.has(id)) ok(`model ${id} available`);
        else warn(`model ${id} is not served for this key: Studio falls back to the others automatically.`);
      }
      if (!MODELS.some((id) => ids.has(id))) bad('none of Studio\'s models is available for this key.');
    }
  } catch (e) {
    bad(`could not reach Groq: ${String(e?.message ?? e).slice(0, 160)}`);
  }
}

const model = (process.env.GROQ_MODEL || '').trim();
if (!model) ok('GROQ_MODEL not set: the default model is openai/gpt-oss-120b');
else if (MODELS.includes(model)) ok(`GROQ_MODEL = ${model}`);
else warn(`GROQ_MODEL = ${model} is not one of ${MODELS.join(', ')}: it is ignored and the default is used.`);

const tpm = process.env.GROQ_TPM_LIMIT;
if (!tpm) ok('GROQ_TPM_LIMIT not set: calls are sized for the free tier (8000 tokens per minute)');
else if (Number(tpm) >= 2000) ok(`GROQ_TPM_LIMIT = ${Math.floor(Number(tpm))} tokens per minute`);
else warn(`GROQ_TPM_LIMIT = ${tpm} is not a number of at least 2000: the free-tier value (8000) is used.`);

if (process.env.REDIS_URL) ok('REDIS_URL is set (allowances and limits are shared across instances)');
else warn('REDIS_URL is not set: Studio meters in memory only (fine locally, not for production).');

if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_STUDIO_PRO) ok('Stripe is configured for Studio Pro');
else warn('STRIPE_SECRET_KEY / STRIPE_PRICE_STUDIO_PRO missing: the "Upgrade to Pro" button stays off (Studio Free works without it).');

if (!process.env.NEXT_PUBLIC_APP_URL) warn('NEXT_PUBLIC_APP_URL is not set: checkout is refused in production without it.');

const cap = process.env.STUDIO_FREE_DAILY_GLOBAL_USD;
const capUnits = cap && Number.isFinite(Number(cap)) ? Number(cap) : 0.5;
console.log(`  info  Free plan shared daily ceiling: ${capUnits} units = ${Math.round(capUnits * 1_000_000).toLocaleString('en')} tokens (STUDIO_FREE_DAILY_GLOBAL_USD)`);
if (process.env.ANTHROPIC_API_KEY) warn('ANTHROPIC_API_KEY is still set: Studio no longer uses it, you can remove it.');

console.log(failed ? '\nNot ready.' : '\nReady.');
process.exit(failed ? 1 : 0);
