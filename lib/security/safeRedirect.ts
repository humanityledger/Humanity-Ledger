/**
 * lib/security/safeRedirect.ts — where a page may send someone after sign-in.
 *
 * Return paths arrive in the query string (?redirect=, ?returnUrl=, ?next=),
 * so anyone can write them into a link. Only a path on this site is allowed.
 *
 * Refused, and why:
 *  - "https://evil.example", "javascript:…", "data:…": another site, or code
 *    run on ours when passed to location.replace();
 *  - "//evil.example": a protocol-relative URL, i.e. another site;
 *  - "/\evil.example": browsers read a backslash as a slash, so this is
 *    "//evil.example" too;
 *  - control characters and whitespace: browsers strip tabs and newlines
 *    from URLs, which turns "/\t/evil.example" into "//evil.example".
 */
export function safeReturnPath(raw: string | null | undefined, fallback = '/chat'): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  if (/[\\\u0000-\u001f\u007f\s]/.test(raw)) return fallback;
  try {
    const base = 'https://return-path.invalid';
    const u = new URL(raw, base);
    if (u.origin !== base) return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
