import { vi } from 'vitest';

vi.mock('@/lib/core/SecureVault', () => {
  const store = new Map<string, string>();
  return {
    vault: {
      getItem: async (k: string) => store.get(k) ?? null,
      setItem: async (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
      clearMemoryCache: () => {},
    },
  };
});

import { chatTextPx, textSizeLabel, textSizeLevel, TEXT_SIZE_PX } from '@/lib/chat/textSize';
import { isExportSafeKey, exportableLocalStorage } from '@/lib/settings/exportSafety';
import { shouldWipeLocalKey, wipeLocalKeys } from '@/lib/settings/localWipe';
import { normalizeAudience, encodePresence, decodePresence, visibleLastActive } from '@/lib/chat/presencePolicy';
import { normalizeBlockList } from '@/lib/chat/blockList';

function memoryStorage(entries: Record<string, string>) {
  const m = new Map(Object.entries(entries));
  return {
    get length() { return m.size; },
    key: (i: number) => Array.from(m.keys())[i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    removeItem: (k: string) => { m.delete(k); },
    keys: () => Array.from(m.keys()),
  };
}

describe('text size: one scale for preview and chat', () => {
  it('maps every level to the size the preview shows', () => {
    expect([0, 1, 2, 3, 4].map(chatTextPx)).toEqual([...TEXT_SIZE_PX]);
    expect(textSizeLabel(2)).toBe('M');
  });
  it('clamps junk instead of rendering 8px or NaN', () => {
    expect(textSizeLevel(-5)).toBe(0);
    expect(textSizeLevel(99)).toBe(4);
    expect(chatTextPx(undefined)).toBe(15);
    expect(chatTextPx('abc')).toBe(15);
  });
});

describe('export never carries secrets', () => {
  it.each([
    'ledger_xmtp_db_key_0xabc', 'ledger_session', 'ledger_chat_pin_0xabc', 'ledger_hw_session_token',
    'ledger_vault_master', 'ledger_api_key', 'ledger_auth_token', 'ledger_seed_backup', 'ledger_privateKey',
  ])('excludes %s', k => expect(isExportSafeKey(k)).toBe(false));
  it.each(['ledger_haptics', 'ledger_pinned_chats', 'ledger_muted_0xabc', 'ledger_auto_delete', 'ledger_displayName'])(
    'keeps %s', k => expect(isExportSafeKey(k)).toBe(true),
  );
  it('ignores keys from other apps', () => {
    const s = memoryStorage({ ledger_haptics: '1', ledger_xmtp_db_key_x: 'SECRET', other_app: 'x' });
    expect(exportableLocalStorage(s)).toEqual({ ledger_haptics: '1' });
  });
});

describe('delete all data', () => {
  it('wipes chat data but keeps the XMTP installation key', () => {
    const s = memoryStorage({
      ledger_haptics: '1', ledger_blocked_users: '[]', hl_devsync_state: '{}',
      ledger_xmtp_db_key_0xabc: 'k', hl_vault_master_v2: 'm', system_session_v2: 's',
    });
    expect(wipeLocalKeys(s)).toBe(3);
    expect(s.keys().sort()).toEqual(['hl_vault_master_v2', 'ledger_xmtp_db_key_0xabc', 'system_session_v2']);
  });
  it('never touches the vault master (it guards wallet material)', () => {
    expect(shouldWipeLocalKey('hl_vault_master_v2')).toBe(false);
    expect(shouldWipeLocalKey('hl_' + 'a'.repeat(64))).toBe(false);
  });
});

describe('last seen privacy', () => {
  const now = 1_700_000_000_000;
  it('round-trips and reads the legacy plain timestamp', () => {
    expect(decodePresence(encodePresence(now, 'nobody'))).toEqual({ at: now, audience: 'nobody' });
    expect(decodePresence(String(now))).toEqual({ at: now, audience: 'contacts' });
    expect(decodePresence('TIMEOUT')).toBeNull();
  });
  it('hides a peer who chose Nobody', () => {
    expect(visibleLastActive(encodePresence(now, 'nobody'), 'contacts')).toBeNull();
    expect(visibleLastActive(encodePresence(now, 'contacts'), 'contacts')).toBe(now);
  });
  it('is reciprocal: choosing Nobody hides everyone from you', () => {
    expect(visibleLastActive(encodePresence(now, 'everybody'), 'nobody')).toBeNull();
  });
  it('normalizes unknown values to contacts', () => {
    expect(normalizeAudience(undefined)).toBe('contacts');
    expect(normalizeAudience('ALL')).toBe('everybody');
    expect(normalizeAudience('<script>')).toBe('contacts');
  });
});

describe('block list', () => {
  it('lower-cases, trims and de-duplicates', () => {
    expect(normalizeBlockList(['0xABC', ' 0xabc ', '', 5, null, '0xDef'])).toEqual(['0xabc', '0xdef']);
    expect(normalizeBlockList('nope')).toEqual([]);
  });
});
