/**
 * lib/chat/bubbleStyles.ts
 *
 * The shapes and colours of a text bubble for each `bubble_style` setting.
 * MessageBubble and the Appearance preview both read this, so the preview is
 * exactly what the conversation will show. `msg-bubble-sent` and
 * `msg-bubble-recv` are the hooks the chat themes recolour
 * (app/ledger-chat-settings.css).
 */

export const BUBBLE_STYLES = [
  { id: 'default',   label: 'Default' },
  { id: 'rounded',   label: 'Pill' },
  { id: 'minimal',   label: 'Minimal' },
  { id: 'glass',     label: 'Glass' },
  { id: 'gradient',  label: 'Gradient' },
  { id: 'brutalist', label: 'Brutalist' },
  { id: 'cyberpunk', label: 'Terminal' },
] as const;

export type BubbleStyleId = (typeof BUBBLE_STYLES)[number]['id'];

export function isBubbleStyleId(v: unknown): v is BubbleStyleId {
  return typeof v === 'string' && BUBBLE_STYLES.some(s => s.id === v);
}

/** Tailwind classes for a text bubble. Unknown styles fall back to default. */
export function bubbleClasses(style: string, isMe: boolean): string {
  switch (style) {
    case 'glass':
      return isMe
        ? 'msg-bubble-sent backdrop-blur-md bg-black/70 text-white rounded-[20px] rounded-br-[6px] border border-white/10 shadow-lg'
        : 'msg-bubble-recv backdrop-blur-md bg-white/80 text-[#15171c] border border-white/60 rounded-[20px] rounded-bl-[6px] shadow';
    case 'gradient':
      return isMe
        ? 'msg-bubble-sent bg-gradient-to-br from-[#1d1f24] via-[#15171c] to-[#2d2f36] text-white rounded-[20px] rounded-br-[6px] shadow-md'
        : 'msg-bubble-recv bg-white text-[#15171c] border border-[#e6e8ec] rounded-[20px] rounded-bl-[6px]';
    case 'rounded':
      return isMe
        ? 'msg-bubble-sent bg-[#15171c] text-white rounded-[24px]'
        : 'msg-bubble-recv bg-white text-[#15171c] border border-[#e6e8ec] rounded-[24px]';
    case 'minimal':
      return isMe
        ? 'msg-bubble-sent msg-bubble-plain bg-transparent text-[#15171c] border-b border-[#15171c]/20 rounded-none pb-1'
        : 'msg-bubble-recv msg-bubble-plain bg-transparent text-[#15171c] border-b border-[#e6e8ec] rounded-none pb-1';
    case 'brutalist':
      return isMe
        ? 'msg-bubble-sent bg-[#15171c] text-white rounded-none border-2 border-[#15171c] shadow-[3px_3px_0px_#000]'
        : 'msg-bubble-recv bg-white text-[#15171c] rounded-none border-2 border-[#15171c] shadow-[3px_3px_0px_#e4e7ec]';
    case 'cyberpunk':
      return isMe
        ? 'msg-bubble-sent msg-bubble-fixed bg-[#0a0a0a] text-[#39ff14] rounded-[4px] border border-[#39ff14]/60 shadow-[0_0_8px_rgba(57,255,20,0.25)]'
        : 'msg-bubble-recv msg-bubble-fixed bg-[#111] text-[#00d4ff] rounded-[4px] border border-[#00d4ff]/50 shadow-[0_0_8px_rgba(0,212,255,0.2)]';
    default:
      return isMe
        ? 'msg-bubble-sent bg-[#15171c] text-white rounded-[20px] rounded-br-[6px]'
        : 'msg-bubble-recv bg-white text-[#15171c] border border-[#e6e8ec] rounded-[20px] rounded-bl-[6px]';
  }
}
