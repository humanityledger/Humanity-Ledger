/**
 * Pages anyone can open without signing in: the documentation, company and
 * legal pages. The terms and the privacy policy in particular must be
 * readable before someone agrees to them.
 *
 * The client gates (TitaniumGate, and ClientLayout deciding whether to wrap a
 * page in LinkedGate) read this list. middleware.ts keeps its own copy in
 * PUBLIC_PATHS because it runs on the Edge runtime; keep the two in step.
 */
export const PUBLIC_CONTENT_PAGES = [
  '/docs',
  '/developers',
  '/blog',
  '/changelog',
  '/status',
  '/contact',
  '/company',
  '/privacy',
  '/terms',
  '/whitepaper',
  '/security/audits',
  '/network/status',
] as const;

/** True for a public content page or anything beneath it. */
export function isPublicContentPage(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return PUBLIC_CONTENT_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
