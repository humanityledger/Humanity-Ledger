/**
 * lib/i18n/deep.ts — translates every visible text inside a data object (the landing chapters,
 * the sign-in page's points), so a component cannot forget one. 25 November 2026: the landing's
 * hero line, its points and the sign-in page's three promises stayed English in every language
 * because the data was printed without t().
 *
 * Strings under keys that are not text (links, ids, screen and glyph names, claims) stay as
 * they are; anything else goes through `t`, which returns the English text when a dictionary
 * has no entry, so non-text values are left unchanged in any case.
 */
export const NOT_TEXT_KEYS = new Set([
  'href', 'id', 'key', 'screen', 'claim', 'glyph', 'icon', 'kind', 'src', 'url', 'slug', 'anchor',
  'className', 'tone', 'state', 'image', 'mockup', 'variant', 'route', 'path', 'file', 'repo', 'from', 'people',
]);

export function translateDeep<T>(value: T, t: (text: string) => string, key?: string): T {
  if (typeof value === 'string') return (key && NOT_TEXT_KEYS.has(key) ? value : t(value)) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => translateDeep(v, t, key)) as unknown as T;
  if (value && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    // Plain objects and module namespaces only: React elements, dates and class instances pass through.
    if (proto !== Object.prototype && proto !== null) return value;
    if ((value as any).$$typeof) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = NOT_TEXT_KEYS.has(k) ? v : translateDeep(v, t, k);
    return out as T;
  }
  return value;
}

/** Every text `translateDeep` would look up, for the dictionaries and their coverage test. */
export function textsDeep(value: unknown, key?: string, out: Set<string> = new Set()): Set<string> {
  if (typeof value === 'string') {
    if (!(key && NOT_TEXT_KEYS.has(key)) && /\p{L}/u.test(value)) out.add(value);
  } else if (Array.isArray(value)) value.forEach((v) => textsDeep(v, key, out));
  else if (value && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if ((proto === Object.prototype || proto === null) && !(value as any).$$typeof) {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) if (!NOT_TEXT_KEYS.has(k)) textsDeep(v, k, out);
    }
  }
  return out;
}
