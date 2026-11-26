/**
 * Chat typefaces: one list for the Settings picker, the chat thread
 * (LedgerChatV2) and the CSS variables (lib/hooks/useSettingsEffect.ts).
 * Every entry renders for real: Inter and IBM Plex Mono are self-hosted by
 * next/font in app/layout.tsx (no third-party request); the rest are native
 * system stacks. Ids from older builds map to the closest real face.
 */
export interface ChatFont {
  id: 'inter' | 'system' | 'mono' | 'serif' | 'rounded' | 'dyslexic';
  label: string;
  desc: string;
  stack: string;
  letterSpacing?: string;
}

export const CHAT_FONTS: readonly ChatFont[] = [
  { id: 'inter', label: 'Inter', desc: 'Modern, highly readable sans-serif', stack: 'var(--font-inter), "Inter", system-ui, sans-serif' },
  { id: 'system', label: 'System', desc: 'Your device font (San Francisco, Segoe UI, Roboto)', stack: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  { id: 'mono', label: 'IBM Plex Mono', desc: 'Fixed-width, good for addresses and code', stack: 'var(--font-aztec-mono), "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
  { id: 'serif', label: 'Serif', desc: 'Classic book serif from your device', stack: 'ui-serif, "Iowan Old Style", Charter, Georgia, "Times New Roman", serif' },
  { id: 'rounded', label: 'Rounded', desc: 'Soft rounded letters where your device has them', stack: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif' },
  { id: 'dyslexic', label: 'Easy reading', desc: 'Wide letters and extra spacing for easier reading', stack: 'Verdana, Tahoma, "Segoe UI", sans-serif', letterSpacing: '0.04em' },
];

const ALIASES: Record<string, ChatFont['id']> = {
  'space-mono': 'mono', satoshi: 'inter', humanist: 'rounded', comic: 'rounded',
};

export function resolveChatFont(id: unknown): ChatFont {
  const raw = typeof id === 'string' ? id : '';
  const key = (ALIASES[raw] ?? raw) as ChatFont['id'];
  return CHAT_FONTS.find(f => f.id === key) ?? CHAT_FONTS[0];
}
