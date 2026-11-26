/**
 * The text of an XMTP message, computed once per message object. Non-string
 * contents used to be JSON.stringify'd again on every pass (poll, stream,
 * history, filters); the result is now memoized in a WeakMap keyed by the
 * message, so it is freed with the message and never recomputed.
 */
const memo = new WeakMap<object, string>();

export function contentText(m: { content?: unknown } | null | undefined, fallback = ''): string {
  if (!m) return fallback;
  const c = m.content;
  if (typeof c === 'string') return c;
  if (c === null || c === undefined || c === '') return fallback;
  const hit = memo.get(m);
  if (hit !== undefined) return hit;
  let out: string;
  try { out = JSON.stringify(c) ?? fallback; } catch { out = fallback; }
  memo.set(m, out);
  return out;
}
