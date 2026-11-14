/**
 * lib/chat/bubbleStyles.ts
 *
 * The bubble styles for the `bubble_style` setting. MessageBubble and the Appearance studio both
 * read this, so the preview is exactly what the conversation shows. The look of each style is in
 * app/ledger-chat-settings.css (`.bs-<id>`): lib/ is outside Tailwind's content paths, so classes
 * written here would not be generated.
 *
 *  - msg-bubble-sent / msg-bubble-recv: whose message it is; the colour themes recolour these.
 *  - msg-bubble-own: the style paints itself with the theme's variables (gradient, glass, glow…).
 *  - msg-bubble-plain: no box (Minimal); msg-bubble-fixed: fixed colours (Terminal).
 */

export const BUBBLE_STYLES = [
  { id: 'default',   label: 'Default',      description: 'Rounded, with a small corner on your side' },
  { id: 'tail',      label: 'Classic tail', description: 'A curved tail, like a speech bubble' },
  { id: 'rounded',   label: 'Pill',         description: 'Fully rounded' },
  { id: 'soft',      label: 'Soft',         description: 'Borderless with a gentle shadow' },
  { id: 'elevated',  label: 'Elevated',     description: 'Lifted off the background' },
  { id: 'sharp',     label: 'Sharp',        description: 'Crisp, small corners' },
  { id: 'gradient',  label: 'Gradient',     description: 'Your theme colour, deepening across the bubble' },
  { id: 'aurora',    label: 'Aurora',       description: 'A slow shimmer through your theme colour' },
  { id: 'glow',      label: 'Glow',         description: 'A soft halo in your theme colour' },
  { id: 'glass',     label: 'Glass',        description: 'Frosted, lets the wallpaper through' },
  { id: 'tinted',    label: 'Tinted',       description: 'Light bubbles tinted with your theme colour' },
  { id: 'minimal',   label: 'Minimal',      description: 'No box, just a line' },
  { id: 'brutalist', label: 'Brutalist',    description: 'Bold borders and a hard shadow' },
  { id: 'cyberpunk', label: 'Terminal',     description: 'Neon on black' },
] as const;

export type BubbleStyleId = (typeof BUBBLE_STYLES)[number]['id'];

const OWN = new Set<string>(['gradient', 'aurora', 'glow', 'glass', 'tinted']);

export function isBubbleStyleId(v: unknown): v is BubbleStyleId {
  return typeof v === 'string' && BUBBLE_STYLES.some(s => s.id === v);
}

/** Class names for a text bubble. Unknown styles fall back to default. */
export function bubbleClasses(style: string, isMe: boolean): string {
  const id: string = isBubbleStyleId(style) ? style : 'default';
  const who = isMe ? 'msg-bubble-sent' : 'msg-bubble-recv';
  const flags = [
    OWN.has(id) ? 'msg-bubble-own' : '',
    id === 'minimal' ? 'msg-bubble-plain' : '',
    id === 'cyberpunk' ? 'msg-bubble-fixed' : '',
  ].filter(Boolean);
  return ['bs', `bs-${id}`, who, ...flags].join(' ');
}
