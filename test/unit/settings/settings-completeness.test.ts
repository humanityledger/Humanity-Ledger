import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { CHAT_FONTS, resolveChatFont } from '@/lib/chat/fonts';
import { AUTO_DELETE_OPTIONS, sendBurnSeconds } from '@/lib/chat/autoDelete';
import { sanitizeSyncedSettings } from '@/lib/settings/sanitize';
import { TEXT_SIZE_PX } from '@/lib/chat/textSize';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');
const LOCALES = ['es', 'de', 'ru', 'zh'] as const;
const messages = Object.fromEntries(LOCALES.map(l => [l, JSON.parse(read(`lib/i18n/messages/${l}.json`).replace(/^﻿/, ''))])) as Record<string, Record<string, string>>;

const SETTINGS_FILES = [
  'components/chat/LedgerSettingsFull.tsx',
  ...readdirSync(path.join(root, 'components/chat/settings')).filter(f => f.endsWith('.tsx')).map(f => `components/chat/settings/${f}`),
  'components/chat/ContactInfoPanel.tsx', 'components/chat/profile/ProfileShare.tsx',
];

function keysIn(src: string): string[] {
  const out = new Set<string>();
  for (const m of src.matchAll(/\b(?:tr|t)\(\s*"((?:[^"\\]|\\.)*)"/g)) out.add(JSON.parse(`"${m[1]}"`));
  for (const m of src.matchAll(/\b(?:tr|t)\(\s*'((?:[^'\\]|\\.)*)'/g)) out.add(m[1].replace(/\\'/g, "'"));
  return [...out].filter(k => /[A-Za-z]/.test(k));
}

describe('Settings: fully native, fully localized', () => {
  it('no @ts-nocheck / @ts-ignore in Settings files', () => {
    for (const f of SETTINGS_FILES) expect(read(f)).not.toMatch(/@ts-nocheck|@ts-ignore/);
  });

  it('no unwrapped user-facing English in footers, toasts and scopes', () => {
    for (const f of SETTINGS_FILES) {
      const s = read(f);
      expect(s).not.toMatch(/\bfooter="[^"]*[A-Za-z]{3}/);
      expect(s).not.toMatch(/wallpaperScope="[^"]*[A-Za-z]{3}/);
      expect(s).not.toMatch(/toast(?:\.\w+)?\(\s*['"`][A-Za-z]/);
      expect(s).not.toMatch(/navigator\.clipboard\.writeText/);
      expect(s).not.toMatch(/item\{value\}/);
    }
  });

  it('every Settings key exists in es, de, ru and zh', () => {
    const keys = new Set<string>();
    for (const f of SETTINGS_FILES) keysIn(read(f)).forEach(k => keys.add(k));
    for (const f of CHAT_FONTS) { keys.add(f.label); keys.add(f.desc); }
    for (const o of AUTO_DELETE_OPTIONS) if (o !== 'off') keys.add(o);
    // Section titles rendered through tr(section.title / item.label / item.sublabel).
    for (const m of read('components/chat/LedgerSettingsFull.tsx').matchAll(/(?:title|label|sublabel):\s*'([^']+)'/g)) keys.add(m[1]);
    const missing: Record<string, string[]> = {};
    for (const l of LOCALES) missing[l] = [...keys].filter(k => !(k in messages[l]));
    expect(missing).toEqual({ es: [], de: [], ru: [], zh: [] });
  });

  it('global key gap only shrinks (ratchet)', () => {
    const union = new Set(LOCALES.flatMap(l => Object.keys(messages[l])));
    const gap = Object.fromEntries(LOCALES.map(l => [l, [...union].filter(k => !(k in messages[l])).length]));
    const BASELINE: Record<string, number> = { es: 172, de: 150, ru: 243, zh: 3 };
    for (const l of LOCALES) expect(gap[l] <= BASELINE[l]).toBe(true);
  });
});

describe('Settings: what you pick is what you get', () => {
  it('every font renders from a real face, and old ids map to one', () => {
    expect(CHAT_FONTS.map(f => f.id)).toEqual(['inter', 'system', 'mono', 'serif', 'rounded', 'dyslexic']);
    expect(resolveChatFont('space-mono').id).toBe('mono');
    expect(resolveChatFont('satoshi').id).toBe('inter');
    expect(resolveChatFont(undefined).id).toBe('inter');
    expect(read('lib/hooks/useSettingsEffect.ts')).toMatch(/resolveChatFont/);
    expect(read('components/terminal/LedgerChatV2.tsx')).toMatch(/resolveChatFont\(chatFont\)\.stack/);
    // The stacks only name faces that app/layout.tsx self-hosts or the OS ships.
    for (const f of CHAT_FONTS) expect(f.stack).not.toMatch(/JetBrains|Merriweather|OpenDyslexic|Space Mono|Satoshi/);
  });

  it('text size is one 0..4 scale everywhere', () => {
    expect(TEXT_SIZE_PX.length).toBe(5);
    expect(read('lib/hooks/useSettingsEffect.ts')).not.toMatch(/settings\.font_size/);
    expect(sanitizeSyncedSettings({ text_size: 4 }).text_size).toBe(4);
    expect(sanitizeSyncedSettings({ text_size: 9 })).toEqual({});
  });

  it('every disappearing timer offered is accepted and enforced', () => {
    for (const o of AUTO_DELETE_OPTIONS) expect(sanitizeSyncedSettings({ auto_delete_timer: o }).auto_delete_timer).toBe(o);
    expect(sanitizeSyncedSettings({ auto_delete_timer: '3 days' })).toEqual({});
    expect(sendBurnSeconds('off', '1 year')).toBe(31_536_000);
    expect(sendBurnSeconds('24h', '1 year')).toBe(86_400); // a chat timer wins
    expect(sendBurnSeconds('off', 'off')).toBe(0);
  });

  it('settings persistence has one typed pipeline and no client-header trust', () => {
    for (const f of ['app/api/chat/settings/route.ts', 'app/api/settings/route.ts', 'app/api/user/settings/apply/route.ts', 'app/api/user/settings/route.ts']) {
      const s = read(f);
      expect(s).toMatch(/requireWallet\(req\)/);
      expect(s).not.toMatch(/\(prisma as any\)|x-web3-address|validateSecureRequest/);
    }
    expect(read('app/api/settings/route.ts')).toMatch(/writeSettings\(auth\.walletAddress, body, 'merge'\)/);
    expect(read('app/api/chat/settings/route.ts')).toMatch(/'replace'/);
  });

  it('storage numbers are measured asynchronously, not in render', () => {
    const s = read('components/chat/LedgerSettingsFull.tsx');
    expect(s).toMatch(/measureStorage\(\)/);
    expect(s).not.toMatch(/let total = 0, count = 0;/);
    expect(s).toMatch(/purgeCachedMedia\(\)/);
  });
});
