"use client";

import React, { useEffect } from "react";
import { HumanityLanding } from "./v2/Landing";

/**
 * ClientRootRouter — renders the public landing page at "/".
 *
 * Changes in this revision:
 *  - Renders the new landing (components/landing/v2/Landing.tsx). The previous
 *    ImmersiveManifestoLanding.tsx is left in the repository untouched so the
 *    change can be reverted by switching this import back.
 *  - The wrapper used to be a div with `overflow-y-auto` and a min height.
 *    Because it never had a fixed height it never scrolled, but it still
 *    counted as a scroll container, so every position:sticky element inside
 *    it stopped sticking. The landing now renders directly.
 *  - The session check that toggled `hasSession` was removed: its result was
 *    never read, and it ran on every visibility change and storage event.
 *
 * The Google OAuth session heal is kept as it was.
 */

function hasValidHandshakeCookie(): boolean {
  if (typeof document === "undefined") return false;
  try {
    return document.cookie
      .split("; ")
      .some((c) => c.startsWith("system_handshake=0x") || c.startsWith("system_handshake=email_"));
  } catch {
    return false;
  }
}

export function ClientRootRouter() {
  // After a Google OAuth callback NextAuth sets an httpOnly session cookie,
  // but the client gate reads `system_handshake`. Bridge the two once.
  useEffect(() => {
    if (hasValidHandshakeCookie()) return;
    fetch("/api/auth/session-heal", { credentials: "include", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.healed) {
          try {
            window.dispatchEvent(new Event("storage"));
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {
        /* non-blocking */
      });
  }, []);

  return <HumanityLanding />;
}

export default ClientRootRouter;
