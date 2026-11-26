import { DEFAULT_PXE_SETTINGS, SYNCED_SETTING_KEYS } from '@/lib/settings/schema';
import { isAutoDeleteTimer } from '@/lib/chat/autoDelete';
import { CHAT_FONTS } from '@/lib/chat/fonts';
import { PUBLIC_TIP_TOKENS } from '@/lib/payments/publicTipTokens';

/** Settings with a closed set of values: anything else is dropped. */
const ENUMS: Record<string, (v: unknown) => boolean> = {
  auto_delete_timer: isAutoDeleteTimer,
  font_family: v => CHAT_FONTS.some(f => f.id === v) || v === 'space-mono' || v === 'satoshi',
  default_token: v => PUBLIC_TIP_TOKENS.some(t => t.symbol === v),
  text_size: v => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 4,
};

/** Long enough for a downscaled avatar data URL; the route caps the body at 50 KB anyway. */
const MAX_AVATAR_CHARS = 40_000;
const MAX_STRING_CHARS = 4_096;

function safeRpcUrl(v: string): string | null {
  try {
    const u = new URL(v);
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (u.protocol === 'https:' || (u.protocol === 'http:' && local)) return v.slice(0, 512);
  } catch {}
  return null;
}

/**
 * Keep only known settings whose value has the same type as the default.
 * The key list comes from lib/settings/schema.ts, so a new setting syncs as
 * soon as it has a default there (no second list to forget).
 */
export function sanitizeSyncedSettings(input: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!SYNCED_SETTING_KEYS.has(k)) continue;
    const def = (DEFAULT_PXE_SETTINGS as unknown as Record<string, unknown>)[k];
    if (typeof v !== typeof def) continue;
    if (ENUMS[k] && !ENUMS[k](v)) continue;
    if (typeof v === 'number') {
      if (Number.isFinite(v)) out[k] = v;
    } else if (typeof v === 'boolean') {
      out[k] = v;
    } else if (typeof v === 'string') {
      if (k === 'custom_rpc_url') {
        if (v === '') out[k] = '';
        else { const ok = safeRpcUrl(v); if (ok) out[k] = ok; }
      } else if (k === 'avatar_url') {
        if (v.length <= MAX_AVATAR_CHARS && (v === '' || v.startsWith('data:image/') || v.startsWith('https://') || (v.startsWith('/') && !v.startsWith('//')))) out[k] = v;
      } else {
        out[k] = v.slice(0, MAX_STRING_CHARS);
      }
    }
  }
  return out;
}
