/**
 * lib/chat/themes.ts
 *
 * Colour themes for the conversation canvas: the chat background, the two
 * kinds of bubble, the time under a message and the read tick. The app's own
 * chrome (sidebar, headers, composer) stays in the light world of
 * app/ledger-tokens.css whichever theme is picked.
 *
 * Every pair below is checked in test/unit/chat/theme-contrast.test.ts:
 *   - text on its bubble, and white on the sent bubble: at least 4.5:1 (WCAG AA)
 *   - muted text on the received bubble, time on the canvas: at least 4.5:1
 *   - read tick on the canvas: at least 3:1 (a non-text graphic)
 *
 * The selected id is the `chat_theme` setting, so it follows the account to
 * every device through the settings sync (pxeEngine).
 */

export interface ChatTheme {
  id: string;
  label: string;
  dark: boolean;
  /** Sent bubble. White text sits on it. */
  accent: string;
  /** Chat canvas. */
  canvas: string;
  /** Received bubble, its text, its secondary text and its edge. */
  received: string;
  receivedText: string;
  receivedMuted: string;
  border: string;
  /** Time and status under a message, drawn on the canvas. */
  meta: string;
  /** The read tick, drawn on the canvas. */
  read: string;
}

export const ON_ACCENT = '#ffffff';

export const CHAT_THEMES: readonly ChatTheme[] = [
  { id: 'default',  label: 'Classic',  dark: false, accent: '#15171c', canvas: '#f7f8fa', received: '#ffffff', receivedText: '#15171c', receivedMuted: '#5b6271', border: '#e6e8ec', meta: '#666d7a', read: '#15171c' },
  { id: 'midnight', label: 'Midnight', dark: true,  accent: '#5b52e6', canvas: '#0f1020', received: '#1d1f33', receivedText: '#eceefb', receivedMuted: '#a7abc6', border: '#2b2e48', meta: '#9a9fbd', read: '#c7c3ff' },
  { id: 'ocean',    label: 'Ocean',    dark: false, accent: '#0369a1', canvas: '#eef7fc', received: '#ffffff', receivedText: '#0b3550', receivedMuted: '#456a82', border: '#cfe6f3', meta: '#4a6a7f', read: '#0369a1' },
  { id: 'forest',   label: 'Forest',   dark: false, accent: '#15803d', canvas: '#eff8f1', received: '#ffffff', receivedText: '#12361f', receivedMuted: '#45664f', border: '#cfe7d6', meta: '#4a6753', read: '#15803d' },
  { id: 'rose',     label: 'Rose',     dark: false, accent: '#be123c', canvas: '#fdf1f3', received: '#ffffff', receivedText: '#4c0519', receivedMuted: '#7d4652', border: '#f6d3da', meta: '#7a515b', read: '#be123c' },
  { id: 'amber',    label: 'Amber',    dark: false, accent: '#b45309', canvas: '#fdf7ea', received: '#ffffff', receivedText: '#422006', receivedMuted: '#6e5534', border: '#f1e2bf', meta: '#6b5636', read: '#b45309' },
  { id: 'violet',   label: 'Violet',   dark: false, accent: '#6d28d9', canvas: '#f5f3fe', received: '#ffffff', receivedText: '#2e1065', receivedMuted: '#5d4f86', border: '#e2dcfa', meta: '#5c547c', read: '#6d28d9' },
  { id: 'amoled',   label: 'AMOLED',   dark: true,  accent: '#15803d', canvas: '#000000', received: '#141414', receivedText: '#f4f4f5', receivedMuted: '#a1a1aa', border: '#262626', meta: '#a1a1aa', read: '#4ade80' },
];

export const DEFAULT_CHAT_THEME_ID = 'default';

export function findChatTheme(id: string | null | undefined): ChatTheme {
  return CHAT_THEMES.find(t => t.id === id) ?? CHAT_THEMES[0];
}

export function isChatThemeId(id: unknown): id is string {
  return typeof id === 'string' && CHAT_THEMES.some(t => t.id === id);
}

/** CSS custom properties for a theme, set on the conversation container. */
export function chatThemeVars(theme: ChatTheme): Record<string, string> {
  return {
    '--lc-accent': theme.accent,
    '--lc-on-accent': ON_ACCENT,
    '--lc-bg-chat': theme.canvas,
    '--lc-bubble-received': theme.received,
    '--lc-text-primary': theme.receivedText,
    '--lc-text-muted': theme.receivedMuted,
    '--lc-border': theme.border,
    '--lc-meta': theme.meta,
    '--lc-read': theme.read,
  };
}

// ── Contrast (WCAG 2.x relative luminance) ──────────────────────────────────

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a 6-digit hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
