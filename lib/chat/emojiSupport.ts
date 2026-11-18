/**
 * lib/chat/emojiSupport.ts — the newest emoji version this device can actually draw.
 *
 * The emoji panel draws emojis with the system's own font. A device whose font is older than the
 * emoji data showed empty boxes for the newest emojis (18 November 2026, Windows: 🫠, 🥹, 🫡 …).
 * This draws one emoji of each version on a small canvas and keeps the newest one that comes out
 * in colour; the panel then hides every emoji newer than that (emoji-picker-react `emojiVersion`).
 */
const PROBES: Array<[version: string, emoji: string]> = [
  ['15.0', '\u{1FAE8}'], // shaking face
  ['14.0', '\u{1FAE0}'], // melting face
  ['13.0', '\u{1F972}'], // smiling face with tear
  ['12.0', '\u{1F971}'], // yawning face
  ['11.0', '\u{1F970}'], // smiling face with hearts
];

/** Whether the system font draws `emoji` as a colour glyph (an empty box is grey or black). */
export function drawsInColour(emoji: string, ctx?: CanvasRenderingContext2D | null): boolean {
  const c = ctx ?? document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!c) return true;
  const size = 24;
  c.canvas.width = size;
  c.canvas.height = size;
  c.clearRect(0, 0, size, size);
  c.textBaseline = 'top';
  c.font = `${size - 4}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  c.fillStyle = '#000';
  c.fillText(emoji, 0, 0);
  const d = c.getImageData(0, 0, size, size).data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 40) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) > 40) return true; // a coloured pixel
  }
  return false;
}

let cached: string | null = null;

/** The newest emoji version that draws in colour here, or '11.0' at least; '15.0' on the server. */
export function supportedEmojiVersion(): string {
  if (cached) return cached;
  if (typeof document === 'undefined') return '15.0';
  try {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    cached = PROBES.find(([, e]) => drawsInColour(e, ctx))?.[0] ?? '11.0';
  } catch {
    cached = '13.0';
  }
  return cached;
}
