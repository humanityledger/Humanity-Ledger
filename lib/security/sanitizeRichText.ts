/**
 * lib/security/sanitizeRichText.ts
 *
 * One sanitizer for every place that renders HTML written by a member
 * (community posts, community chat, the post editor preview).
 *
 * What the three local copies allowed and this one does not:
 *  - `class` and `style`. With Tailwind on the page, a post could carry
 *    `class="fixed inset-0 z-50"` and cover the whole app with a fake screen.
 *  - Remote images. `<img src="https://attacker/pixel">` reports the IP
 *    address of everyone who reads the post to whoever runs that server; in a
 *    privacy product that is a leak. Images must be inline data or ours.
 *  - Links without `rel`. Every link opens in a new tab with
 *    `noopener noreferrer nofollow`.
 *
 * It also returned the raw HTML when called on the server. Now it returns
 * plain text there, so nothing unsanitized can ever reach the DOM.
 */

import DOMPurify from 'dompurify';

const TAGS = ['b', 'i', 'u', 's', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'h1', 'h2', 'h3', 'img', 'mark', 'span'];
const ATTRS = ['href', 'src', 'alt', 'title'];


// A private instance, so these hooks do not change how DOMPurify behaves
// anywhere else in the app.
let purifier: ReturnType<typeof DOMPurify> | null = null;

function instance() {
  if (purifier) return purifier;
  purifier = DOMPurify(window);
  purifier.addHook('afterSanitizeAttributes', node => {
    const el = node as Element;
    if (el.tagName === 'A') {
      // Browsers drop tabs and line breaks inside URLs and read "/\host" as
      // "//host" (another site): normalise first, then refuse a backslash
      // after the first slash like a second slash.
      const href = (el.getAttribute('href') || '').replace(/[\t\n\r]/g, '').trim();
      if (!/^(https?:|mailto:|\/(?![/\\])|#)/i.test(href)) el.removeAttribute('href');
      else el.setAttribute('href', href);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer nofollow');
    }
    if (el.tagName === 'IMG') {
      const src = (el.getAttribute('src') || '').replace(/[\t\n\r]/g, '').trim();
      const inline = /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(src);
      const ours = /^\/(?![/\\])/.test(src) || /^blob:/i.test(src);
      if (!inline && !ours) el.removeAttribute('src');
      else el.setAttribute('src', src);
      el.setAttribute('loading', 'lazy');
      el.setAttribute('referrerpolicy', 'no-referrer');
    }
  });
  return purifier;
}

function toText(raw: string): string {
  return raw.replace(/<[^>]*>/g, '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

export function sanitizeRichText(raw: string | null | undefined): string {
  if (!raw) return '';
  if (typeof window === 'undefined') return toText(raw);
  return instance().sanitize(raw, {
    ALLOWED_TAGS: TAGS,
    ALLOWED_ATTR: ATTRS,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target', 'rel', 'loading', 'referrerpolicy'],
  }) as unknown as string;
}
