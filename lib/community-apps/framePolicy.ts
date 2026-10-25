/**
 * lib/community-apps/framePolicy.ts
 *
 * The security boundary of a community app. Kept free of imports so the Edge
 * middleware can use it.
 *
 * An app is code written by a member (or by a model on a member's behalf), so
 * it is treated as hostile. It is served from its own URL with this policy:
 *
 *  - `sandbox allow-scripts` gives the document an opaque origin even when the
 *    URL is opened directly in a tab. It cannot read cookies, storage or the
 *    DOM of Ledger Chat, and cannot call our API with the member's session.
 *  - `connect-src 'none'`, `img-src data: blob:` and no external script, font
 *    or frame sources: the app has no network. Its only way out is the
 *    postMessage bridge in lib/community-apps/sdk.ts, which the parent page
 *    answers with a few narrow operations.
 *  - `frame-ancestors 'self'`: it can only be embedded by Ledger Chat.
 *
 * What this does not stop: an app can navigate its own frame to another URL
 * (no browser enforces navigate-to). lib/community-apps/validate.ts rejects
 * the obvious forms and the parent shows who made each app.
 */

export const APP_FRAME_CSP = [
  'sandbox allow-scripts',
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'font-src data:',
  'media-src data: blob:',
  "connect-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "object-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors 'self'",
].join('; ');

/** The iframe attribute that matches the policy above. */
export const APP_FRAME_SANDBOX = 'allow-scripts';

const FRAME_PATH = /^\/api\/chat\/communities\/[^/]+\/apps\/[^/]+\/frame\/?$/;

export function isAppFramePath(pathname: string): boolean {
  return FRAME_PATH.test(pathname);
}
