import { afterEach, describe, expect, it } from 'vitest';
import { byokFromHeaders, BYOK_PROVIDERS, studioApiKey, studioBaseUrl } from '@/lib/studio/client';
import { isFounderWallet } from '@/lib/studio/models';
import { STUDIO_PLANS, UNLIMITED_PRO } from '@/lib/studio/models';

const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });

describe('Ledger Studio: founder, self-hosting, bring your own key', () => {
  it('Pro costs $20 a month; the founder plan is Pro with no allowance limits', () => {
    expect(STUDIO_PLANS.pro.priceLabel).toBe('$20 / month');
    expect(UNLIMITED_PRO.id).toBe('pro');
    expect(UNLIMITED_PRO.dailyBudgetUsd).toBeGreaterThanOrEqual(1_000_000);
  });

  it('founder wallets come from STUDIO_FOUNDER_WALLETS, case-insensitive', () => {
    process.env.STUDIO_FOUNDER_WALLETS = '0xAbC0000000000000000000000000000000000001, 0xdef0000000000000000000000000000000000002';
    expect(isFounderWallet('0xabc0000000000000000000000000000000000001')).toBe(true);
    expect(isFounderWallet('0xDEF0000000000000000000000000000000000002')).toBe(true);
    expect(isFounderWallet('0x1110000000000000000000000000000000000003')).toBe(false);
    delete process.env.STUDIO_FOUNDER_WALLETS;
    expect(isFounderWallet('0xabc0000000000000000000000000000000000001')).toBe(false);
  });

  it('a self-hosted OpenAI-compatible server works without a key', () => {
    delete process.env.GROQ_API_KEY; delete process.env.STUDIO_LLM_API_KEY;
    process.env.STUDIO_LLM_BASE_URL = 'http://vllm.railway.internal:8000/v1';
    expect(studioBaseUrl()).toBe('http://vllm.railway.internal:8000/v1');
    expect(studioApiKey()).toBe('none');
    process.env.STUDIO_LLM_BASE_URL = 'file:///etc/passwd';
    expect(studioBaseUrl()).toBeUndefined();
  });

  it('BYOK accepts only known providers and plausible keys (no arbitrary URLs)', () => {
    const h = (p: string, k: string) => new Headers({ 'x-studio-provider': p, 'x-studio-provider-key': k });
    expect(byokFromHeaders(h('openrouter', 'sk-or-v1-0123456789abcdef'))).toEqual({ provider: 'openrouter', key: 'sk-or-v1-0123456789abcdef', baseUrl: BYOK_PROVIDERS.openrouter });
    expect(byokFromHeaders(h('https://evil.example', 'sk-0123456789abcdef'))).toBeNull();
    expect(byokFromHeaders(h('groq', 'short'))).toBeNull();
    expect(byokFromHeaders(h('groq', 'key with spaces 0123456789'))).toBeNull();
    expect(byokFromHeaders(new Headers())).toBeNull();
  });
});
