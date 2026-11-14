/**
 * Whether the device may be scaled with CSS zoom (sharp text) instead of a transform.
 *
 * Not on WebKit: Safari, and every browser on iPhone and iPad (Chrome, Firefox and the wallets' own
 * browsers all run WebKit there). WebKit sized the text inside the zoomed screen differently from the
 * frame, so on iPhone the bubbles and the composer of /connect and the landing page overflowed the
 * phone (reported 14 Nov 2026). The transform scales everything as one picture on every engine.
 */
export function canUseCssZoom(userAgent: string, supportsZoom: boolean): boolean {
  if (!supportsZoom) return false;
  const webkit = /AppleWebKit\//.test(userAgent) && !/(Chrome|Chromium|Edg|OPR|SamsungBrowser)\//.test(userAgent);
  return !webkit;
}
