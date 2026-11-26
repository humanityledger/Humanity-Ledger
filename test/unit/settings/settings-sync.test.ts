import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { DEFAULT_PXE_SETTINGS, SYNCED_SETTING_KEYS } from '@/lib/settings/schema';
import { sanitizeSyncedSettings } from '@/lib/settings/sanitize';
import { PUBLIC_TIP_TOKENS, resolveTipToken } from '@/lib/payments/publicTipTokens';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');

/** Every key the settings screens write with updateSetting/updateBatch. */
function keysWrittenByUi(): string[] {
  const dir = 'components/chat/settings';
  const files = ['components/chat/LedgerSettingsFull.tsx', 'components/terminal/LedgerChatSettings.tsx',
    ...readdirSync(path.join(root, dir)).filter(f => f.endsWith('.tsx')).map(f => `${dir}/${f}`)];
  const keys = new Set<string>();
  for (const f of files) {
    for (const m of read(f).matchAll(/update(?:Setting|Batch)\(\s*'([A-Za-z_0-9]+)'/g)) keys.add(m[1]);
  }
  return [...keys].sort();
}

describe('settings: every switch is wired end to end', () => {
  it('every key the settings UI writes has a default (so device sync and the server keep it)', () => {
    const missing = keysWrittenByUi().filter(k => !(k in DEFAULT_PXE_SETTINGS));
    expect(missing).toEqual([]);
  });

  it('the server keeps every key that has a default, and nothing else', () => {
    expect([...SYNCED_SETTING_KEYS].sort()).toEqual(Object.keys(DEFAULT_PXE_SETTINGS).sort());
  });

  it('public tip token survives the server round-trip with the sync clock', () => {
    const out = sanitizeSyncedSettings({ default_token: 'USDC', payments_enabled: false, last_synced_at: 123, schema_version: 4 });
    expect(out).toEqual({ default_token: 'USDC', payments_enabled: false, last_synced_at: 123, schema_version: 4 });
  });

  it('drops unknown keys, wrong types and unsafe values', () => {
    const out = sanitizeSyncedSettings({
      __proto__: { polluted: true }, evil: 'x', payments_enabled: 'yes', text_size: Number.NaN,
      avatar_url: 'javascript:alert(1)', custom_rpc_url: 'http://169.254.169.254/latest',
    });
    expect(out).toEqual({});
    expect(sanitizeSyncedSettings(null)).toEqual({});
    expect(sanitizeSyncedSettings(['default_token'])).toEqual({});
  });

  it('keeps https and local RPC URLs and clears to empty', () => {
    expect(sanitizeSyncedSettings({ custom_rpc_url: 'https://eth.example.org' }).custom_rpc_url).toBe('https://eth.example.org');
    expect(sanitizeSyncedSettings({ custom_rpc_url: 'http://localhost:8545' }).custom_rpc_url).toBe('http://localhost:8545');
    expect(sanitizeSyncedSettings({ custom_rpc_url: '' }).custom_rpc_url).toBe('');
  });
});

describe('public tip token', () => {
  it('offers the four coins the payment sheet can send, ETH first', () => {
    expect(PUBLIC_TIP_TOKENS.map(t => t.symbol)).toEqual(['ETH', 'USDC', 'USDT', 'DAI']);
    expect(DEFAULT_PXE_SETTINGS.default_token).toBe('ETH');
  });

  it('falls back to ETH for missing or retired values', () => {
    expect(resolveTipToken(undefined).symbol).toBe('ETH');
    expect(resolveTipToken('QDS').symbol).toBe('ETH');
    expect(resolveTipToken('DAI').symbol).toBe('DAI');
  });

  it('the payment sheet and the settings picker read the same list', () => {
    expect(read('components/chat/NativeCryptoSendModal.tsx')).toMatch(/PUBLIC_TIP_TOKENS\.map/);
    const picker = read('components/chat/settings/PublicTipTokenPicker.tsx');
    expect(picker).toMatch(/PUBLIC_TIP_TOKENS/);
    expect(picker).toMatch(/role="radio"/);
    expect(read('components/chat/LedgerSettingsFull.tsx')).toMatch(/<PublicTipTokenPicker/);
  });
});
