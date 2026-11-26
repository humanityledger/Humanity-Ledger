"use client";

/**
 * Retired (IV.1 / Phase C, 26 Nov 2026).
 *
 * The old component hashed DOM nodes on every animation frame (60–120 Hz,
 * forever), watched every style/attribute change in <body>, signed people
 * out after three "violations" caused by ordinary React re-renders, and
 * blocked right-click and drag (breaking drag-to-upload and accessibility).
 * None of that stops an attacker: page integrity comes from the nonce-based
 * CSP and SRI (middleware.ts, next.config.js), HttpOnly session cookies and
 * signatures on every value-bearing action.
 *
 * Kept as a no-op export so stale imports compile; it is no longer mounted.
 */
export function AntiTamperCore(): null {
  return null;
}
