/**
 * Toasts become notices: the pure half of components/activities/ToastBridge.tsx.
 *
 * Every toast() call in Ledger Chat (about 390 of them, in settings, wallet, communities, Studio,
 * calls, linked devices, WalletConnect…) is drawn by the island instead of a corner stack. This
 * file turns one sonner toast into a notice's ContentState, decides how long it stays, and reads
 * progress out of its text. No React, no timers: every rule has a test
 * (test/unit/activities/notices.test.ts).
 */
import { toNoticeText } from './values';
import type { ContentState, NoticeText, NoticeTone } from './types';

/** The fields of a sonner ToastT this file reads. Anything else is ignored. */
export interface ToastLike {
  id: string | number;
  type?: string;
  title?: unknown;
  description?: unknown;
  duration?: number;
  action?: unknown;
  cancel?: unknown;
  jsx?: unknown;
  delete?: boolean;
}

/** sonner's own default, kept so every toast stays as long as it did before. */
export const NOTICE_DEFAULT_MS = 4000;
/** An error is read twice as often as it is written: it stays longer. */
export const NOTICE_ERROR_MS = 6000;

export const noticeId = (toastId: string | number) => `notice:${String(toastId)}`;

/** sonner's types folded into the island's tones. */
export function noticeTone(type: string | undefined): NoticeTone {
  switch (type) {
    case 'success': return 'success';
    case 'error': return 'error';
    case 'warning': return 'warning';
    case 'info': return 'info';
    case 'loading': return 'loading';
    default: return 'neutral'; // 'normal', 'default', 'action', toast.message()
  }
}

/**
 * The words in a toast's title or description. Strings and numbers as they are; a React element
 * by the text of its children (a toast written as <span>Saved <b>Ana</b></span>); a function or
 * anything else gives nothing. Depth-limited, so a cyclic object cannot hang it.
 */
export function textOf(node: unknown, depth = 0): string {
  if (node == null || typeof node === 'boolean' || depth > 6) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number' || typeof node === 'bigint') return String(node);
  if (Array.isArray(node)) return node.map((n) => textOf(n, depth + 1)).join('');
  if (typeof node === 'object' && 'props' in (node as object)) {
    const props = (node as { props?: { children?: unknown } }).props;
    return textOf(props?.children, depth + 1);
  }
  return '';
}

/**
 * How far along the text says it is, 0..1, or undefined. Reads "42%" (the last one) and "3/10"
 * ("Importing 3/10"). A percentage above 100 or a count of zero is not progress.
 */
export function progressOf(text: string): number | undefined {
  const pct = [...text.matchAll(/(\d{1,3}(?:\.\d+)?)\s?%/g)].pop();
  if (pct) {
    const v = Number(pct[1]);
    return v >= 0 && v <= 100 ? v / 100 : undefined;
  }
  const frac = text.match(/\b(\d{1,6})\s?\/\s?(\d{1,6})\b/);
  if (frac) {
    const done = Number(frac[1]);
    const total = Number(frac[2]);
    return total > 0 && done <= total ? done / total : undefined;
  }
  return undefined;
}

/** The label of a toast's action or cancel button, when it is one sonner can run. */
export function buttonLabel(button: unknown): NoticeText | undefined {
  if (!button || typeof button !== 'object' || !('onClick' in button)) return undefined;
  const fn = (button as { onClick?: unknown }).onClick;
  if (typeof fn !== 'function') return undefined;
  return toNoticeText(textOf((button as { label?: unknown }).label)) ?? undefined;
}

const FALLBACK: Record<NoticeTone, string> = {
  success: 'Done',
  error: 'That did not work',
  warning: 'Check this',
  info: 'Notice',
  loading: 'Working on it',
  neutral: 'Notice',
};

/**
 * The notice for a toast, or null for one that is being removed. A toast with no words of its own
 * (toast.success('')) still says something, by its tone.
 */
export function noticeState(t: ToastLike): ContentState['notice'] | null {
  if (t.delete) return null;
  const tone = noticeTone(t.type);
  const rawTitle = textOf(t.title) || textOf(t.jsx);
  const rawDetail = textOf(t.description);
  const title = toNoticeText(rawTitle) ?? toNoticeText(rawDetail) ?? (FALLBACK[tone] as NoticeText);
  const detailText = toNoticeText(rawDetail);
  const detail = detailText && detailText !== title ? detailText : undefined;
  const progress = tone === 'loading' ? progressOf(`${rawTitle} ${rawDetail}`) : undefined;
  return {
    tone,
    title,
    // Every field is written, so a loading toast that turns into a success loses its progress.
    detail,
    action: buttonLabel(t.action),
    cancel: buttonLabel(t.cancel),
    progress,
  };
}

/** How long it stays, in ms; Infinity for one that is still loading (it changes or is dismissed). */
export function noticeDuration(t: ToastLike, tone: NoticeTone): number {
  if (typeof t.duration === 'number' && t.duration > 0) return t.duration;
  if (tone === 'loading') return Infinity;
  return tone === 'error' ? NOTICE_ERROR_MS : NOTICE_DEFAULT_MS;
}

/** A short line that changes whenever anything the island draws changes. */
export function noticeSignature(s: ContentState['notice'], duration: number): string {
  return [s.tone, s.title, s.detail ?? '', s.action ?? '', s.cancel ?? '', s.progress ?? '', duration].join('\u0000');
}
