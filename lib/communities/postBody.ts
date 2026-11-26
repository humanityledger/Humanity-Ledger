import { escapeHtml } from '@/lib/security/escapeHtml';

/**
 * Community posts are plain text. Client-sent HTML is never stored: the
 * contentHtml column only ever holds the HTML-escaped text, so no reader, SSR
 * feed or mobile client can turn a stored post into markup (stored XSS).
 * Any tags a client typed are kept as visible, inert text.
 */
export function postBodyColumns(content: unknown): { content: string; contentHtml: string } | null {
  const text = typeof content === 'string' ? content : '';
  if (!text.trim()) return null;
  return { content: text, contentHtml: escapeHtml(text) };
}
