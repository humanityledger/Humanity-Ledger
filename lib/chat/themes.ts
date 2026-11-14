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
  /** Family shown as a section in the Appearance studio. */
  group: ChatThemeGroup;
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

/** Families the Appearance studio groups themes under, in this order. */
export const CHAT_THEME_GROUPS = ['Essentials', 'Cool', 'Nature', 'Warm', 'Vivid', 'Dark'] as const;
export type ChatThemeGroup = (typeof CHAT_THEME_GROUPS)[number];

export const CHAT_THEMES: readonly ChatTheme[] = [
  { id: 'default',        label: 'Classic',        group: 'Essentials', dark: false, accent: '#15171c', canvas: '#f7f8fa', received: '#ffffff', receivedText: '#15171c', receivedMuted: '#5b6271', border: '#e6e8ec', meta: '#666d7a', read: '#15171c' },
  { id: 'paper',          label: 'Paper',          group: 'Essentials', dark: false, accent: '#3d3a35', canvas: '#f6f3ee', received: '#ffffff', receivedText: '#171614', receivedMuted: '#5d616a', border: '#e0ddd8', meta: '#595c62', read: '#3d3a35' },
  { id: 'graphite',       label: 'Graphite',       group: 'Essentials', dark: false, accent: '#3f4654', canvas: '#eef0f3', received: '#ffffff', receivedText: '#181b20', receivedMuted: '#5e6573', border: '#d9dce0', meta: '#59606e', read: '#3f4654' },
  { id: 'snow',           label: 'Snow',           group: 'Essentials', dark: false, accent: '#1f2937', canvas: '#ffffff', received: '#ffffff', receivedText: '#0c1015', receivedMuted: '#545c6a', border: '#e4e5e7', meta: '#4d5563', read: '#1f2937' },
  { id: 'ocean',          label: 'Ocean',          group: 'Cool',      dark: false, accent: '#0369a1', canvas: '#eef7fc', received: '#ffffff', receivedText: '#0b3550', receivedMuted: '#456a82', border: '#cfe6f3', meta: '#4a6a7f', read: '#0369a1' },
  { id: 'sky',            label: 'Sky',            group: 'Cool',      dark: false, accent: '#1d6fd8', canvas: '#eef5ff', received: '#ffffff', receivedText: '#0b2a52', receivedMuted: '#54719a', border: '#d5e5fa', meta: '#4a6fa0', read: '#1d6fd8' },
  { id: 'denim',          label: 'Denim',          group: 'Cool',      dark: false, accent: '#2f4f86', canvas: '#eef2f9', received: '#ffffff', receivedText: '#121e33', receivedMuted: '#596882', border: '#d7deeb', meta: '#536482', read: '#2f4f86' },
  { id: 'indigo',         label: 'Indigo',         group: 'Cool',      dark: false, accent: '#4338ca', canvas: '#f0f1fe', received: '#ffffff', receivedText: '#19154d', receivedMuted: '#5f6196', border: '#dbdbf8', meta: '#5b5b9e', read: '#4338ca' },
  { id: 'lagoon',         label: 'Lagoon',         group: 'Cool',      dark: false, accent: '#0f766e', canvas: '#ecf8f6', received: '#ffffff', receivedText: '#062d2a', receivedMuted: '#4f737b', border: '#d1e8e6', meta: '#467479', read: '#0f766e' },
  { id: 'arctic',         label: 'Arctic',         group: 'Cool',      dark: false, accent: '#24607a', canvas: '#eef6f8', received: '#ffffff', receivedText: '#0e242e', receivedMuted: '#566d7e', border: '#d6e4e9', meta: '#4f6b7e', read: '#24607a' },
  { id: 'forest',         label: 'Forest',         group: 'Nature',    dark: false, accent: '#15803d', canvas: '#eff8f1', received: '#ffffff', receivedText: '#12361f', receivedMuted: '#45664f', border: '#cfe7d6', meta: '#4a6753', read: '#15803d' },
  { id: 'sage',           label: 'Sage',           group: 'Nature',    dark: false, accent: '#4d6b4f', canvas: '#f1f5ef', received: '#ffffff', receivedText: '#1d291e', receivedMuted: '#627071', border: '#dde4dc', meta: '#5f6f6c', read: '#4d6b4f' },
  { id: 'olive',          label: 'Olive',          group: 'Nature',    dark: false, accent: '#5f6b1f', canvas: '#f5f6ea', received: '#ffffff', receivedText: '#24290c', receivedMuted: '#677063', border: '#e3e5d2', meta: '#666f59', read: '#5f6b1f' },
  { id: 'mint',           label: 'Mint',           group: 'Nature',    dark: false, accent: '#047857', canvas: '#ecfbf4', received: '#ffffff', receivedText: '#022e21', receivedMuted: '#4c7474', border: '#d0ebe1', meta: '#427470', read: '#047857' },
  { id: 'moss',           label: 'Moss',           group: 'Nature',    dark: false, accent: '#3f6212', canvas: '#f3f8ea', received: '#ffffff', receivedText: '#182507', receivedMuted: '#5e6d5f', border: '#dde6d0', meta: '#596c54', read: '#3f6212' },
  { id: 'rose',           label: 'Rose',           group: 'Warm',      dark: false, accent: '#be123c', canvas: '#fdf1f3', received: '#ffffff', receivedText: '#4c0519', receivedMuted: '#7d4652', border: '#f6d3da', meta: '#7a515b', read: '#be123c' },
  { id: 'blush',          label: 'Blush',          group: 'Warm',      dark: false, accent: '#c2346b', canvas: '#fdf2f6', received: '#ffffff', receivedText: '#4a1429', receivedMuted: '#855f7a', border: '#f6dbe5', meta: '#8e5978', read: '#c2346b' },
  { id: 'coral',          label: 'Coral',          group: 'Warm',      dark: false, accent: '#c2410c', canvas: '#fff3ee', received: '#ffffff', receivedText: '#4a1905', receivedMuted: '#85635d', border: '#f8ded3', meta: '#8e5e52', read: '#c2410c' },
  { id: 'amber',          label: 'Amber',          group: 'Warm',      dark: false, accent: '#b45309', canvas: '#fdf7ea', received: '#ffffff', receivedText: '#422006', receivedMuted: '#6e5534', border: '#f1e2bf', meta: '#6b5636', read: '#b45309' },
  { id: 'cherry',         label: 'Cherry',         group: 'Warm',      dark: false, accent: '#b91c1c', canvas: '#fef2f2', received: '#ffffff', receivedText: '#460b0b', receivedMuted: '#825862', border: '#f6d8d8', meta: '#8a5058', read: '#b91c1c' },
  { id: 'mocha',          label: 'Mocha',          group: 'Warm',      dark: false, accent: '#7c4a2d', canvas: '#f8f2ec', received: '#ffffff', receivedText: '#2f1c11', receivedMuted: '#706667', border: '#e9ded5', meta: '#72625f', read: '#7c4a2d' },
  { id: 'terracotta',     label: 'Terracotta',     group: 'Warm',      dark: false, accent: '#a4462a', canvas: '#faf1ec', received: '#ffffff', receivedText: '#3e1b10', receivedMuted: '#7c6566', border: '#f0dcd5', meta: '#82605e', read: '#a4462a' },
  { id: 'violet',         label: 'Violet',         group: 'Vivid',     dark: false, accent: '#6d28d9', canvas: '#f5f3fe', received: '#ffffff', receivedText: '#2e1065', receivedMuted: '#5d4f86', border: '#e2dcfa', meta: '#5c547c', read: '#6d28d9' },
  { id: 'lavender',       label: 'Lavender',       group: 'Vivid',     dark: false, accent: '#7c4dbe', canvas: '#f7f4fc', received: '#ffffff', receivedText: '#2f1d48', receivedMuted: '#706793', border: '#e8e0f5', meta: '#726399', read: '#7c4dbe' },
  { id: 'fuchsia',        label: 'Fuchsia',        group: 'Vivid',     dark: false, accent: '#a21caf', canvas: '#fdf2fd', received: '#ffffff', receivedText: '#3e0b42', receivedMuted: '#7c588e', border: '#f2d8f4', meta: '#815093', read: '#a21caf' },
  { id: 'plum',           label: 'Plum',           group: 'Vivid',     dark: false, accent: '#86198f', canvas: '#faf2fa', received: '#ffffff', receivedText: '#330a36', receivedMuted: '#735784', border: '#ecd8ed', meta: '#764e86', read: '#86198f' },
  { id: 'electric',       label: 'Electric',       group: 'Vivid',     dark: false, accent: '#2546f0', canvas: '#f1f3ff', received: '#ffffff', receivedText: '#0e1b5b', receivedMuted: '#5665a2', border: '#d9defd', meta: '#4f60ad', read: '#2546f0' },
  { id: 'midnight',       label: 'Midnight',       group: 'Dark',      dark: true , accent: '#5b52e6', canvas: '#0f1020', received: '#1d1f33', receivedText: '#eceefb', receivedMuted: '#a7abc6', border: '#2b2e48', meta: '#9a9fbd', read: '#c7c3ff' },
  { id: 'amoled',         label: 'AMOLED',         group: 'Dark',      dark: true , accent: '#15803d', canvas: '#000000', received: '#141414', receivedText: '#f4f4f5', receivedMuted: '#a1a1aa', border: '#262626', meta: '#a1a1aa', read: '#4ade80' },
  { id: 'obsidian',       label: 'Obsidian',       group: 'Dark',      dark: true , accent: '#3472d8', canvas: '#0b0d12', received: '#202530', receivedText: '#f3f7fd', receivedMuted: '#a1aeca', border: '#323641', meta: '#96a2bf', read: '#8fb1ea' },
  { id: 'nightshade',     label: 'Nightshade',     group: 'Dark',      dark: true , accent: '#8b4fd9', canvas: '#16121f', received: '#2f283b', receivedText: '#f8f4fd', receivedMuted: '#aea8cb', border: '#40394b', meta: '#a09dbf', read: '#bf9eea' },
  { id: 'deep-sea',       label: 'Deep sea',       group: 'Dark',      dark: true , accent: '#0e7c86', canvas: '#071a1f', received: '#1a3136', receivedText: '#f1f7f8', receivedMuted: '#9bafbe', border: '#2c4146', meta: '#91a3b6', read: '#7ab7bc' },
  { id: 'ember',          label: 'Ember',          group: 'Dark',      dark: true , accent: '#c2410c', canvas: '#1a0f0b', received: '#35241e', receivedText: '#fbf4f0', receivedMuted: '#b6a6ac', border: '#453630', meta: '#a79ca7', read: '#dd9679' },
  { id: 'espresso',       label: 'Espresso',       group: 'Dark',      dark: true , accent: '#8a5a3b', canvas: '#17110d', received: '#302722', receivedText: '#f8f5f3', receivedMuted: '#aeaab3', border: '#413834', meta: '#a09fad', read: '#bfa493' },
  { id: 'emerald-night',  label: 'Emerald night',  group: 'Dark',      dark: true , accent: '#047857', canvas: '#08140f', received: '#1b2c25', receivedText: '#f0f7f5', receivedMuted: '#9aaeb7', border: '#2d3d36', meta: '#90a2b0', read: '#75b5a3' },
  { id: 'synthwave',      label: 'Synthwave',      group: 'Dark',      dark: true , accent: '#c026d3', canvas: '#140a1f', received: '#301e3b', receivedText: '#fbf2fc', receivedMuted: '#b6a2ca', border: '#41304b', meta: '#a698bf', read: '#dc88e7' },
  { id: 'slate-night',    label: 'Slate',          group: 'Dark',      dark: true , accent: '#475569', canvas: '#0f141b', received: '#242a31', receivedText: '#f4f5f6', receivedMuted: '#a4a9ba', border: '#363b41', meta: '#989eb2', read: '#9aa2ac' },
  { id: 'cosmos',         label: 'Cosmos',         group: 'Dark',      dark: true , accent: '#4f46e5', canvas: '#070a1c', received: '#1e2039', receivedText: '#f4f4fd', receivedMuted: '#a5a7cc', border: '#303249', meta: '#999cc1', read: '#9e99f1' },
  { id: 'noir-gold',      label: 'Noir gold',      group: 'Dark',      dark: true , accent: '#8a6512', canvas: '#0d0c0a', received: '#26231d', receivedText: '#f8f6f1', receivedMuted: '#aeacad', border: '#37352f', meta: '#a0a0a8', read: '#bfaa7d' },
  { id: 'crimson-night',  label: 'Crimson night',  group: 'Dark',      dark: true , accent: '#be123c', canvas: '#140809', received: '#301b1f', receivedText: '#fbf1f3', receivedMuted: '#b69fb3', border: '#412d31', meta: '#a696ad', read: '#db7d94' },
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
