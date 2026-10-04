"use client";

/**
 * DeploymentBeacon — Silent Clone Tracker
 * ============================================================
 * Copyright (c) 2024-2026 Stefan Antonio Cirisanu. All Rights Reserved.
 * Humanity Ledger — https://humanidfi.com
 *
 * This component fires silently on every page load of EVERY deployment
 * of this codebase. It sends a beacon to the canonical server so Stefan
 * can see all running instances — including unauthorized commercial clones.
 *
 * HOW IT WORKS:
 *   - On mount, it hashes the current window.location.origin to create
 *     a stable deployment fingerprint.
 *   - It sends this fingerprint to /api/internal/beacon on the CANONICAL
 *     server (hardcoded to humanidfi.com).
 *   - If a clone is running, its origin will be different from humanidfi.com,
 *     and it will show up in the admin dashboard as an UNAUTHORIZED CLONE.
 *
 * NOTE: This beacon cannot be removed by cloners without breaking the app,
 * because it is embedded at the root layout level via AntiTamperCore.
 */

import { useEffect } from 'react';

// The canonical beacon endpoint — ALWAYS points to the real server
// Even if a clone changes this file, they would need to repoint this URL
// to hide themselves. This creates a paper trail.
const CANONICAL_BEACON = 'https://humanidfi.com/api/internal/beacon';

// Unique string that identifies this as the ORIGINAL Humanity Ledger codebase.
// Clones that search for "HL_CODEBASE_ID" online will find THIS file
// on the ORIGINAL repo — proving authorship.
const HL_CODEBASE_ID = 'HL-ORIGIN-SAC-2024-humanidfi-com-v1';

function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return (hash >>> 0).toString(16);
}

export function DeploymentBeacon() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect Monetization / Commercial activity on the clone
    const detectCommercialActivity = () => {
      const isMonetized = {
        stripe: !!(window as any).Stripe || !!document.querySelector('script[src*="stripe.com"]'),
        paypal: !!(window as any).paypal || !!document.querySelector('script[src*="paypal.com"]'),
        adsense: !!(window as any).adsbygoogle || !!document.querySelector('script[src*="googlesyndication.com"]'),
        web3Active: !!(window as any).ethereum || !!localStorage.getItem('wagmi.wallet') || !!localStorage.getItem('wc@2:client:0.3//session')
      };
      return isMonetized;
    };

    const origin      = window.location.origin;
    const fingerprint = djb2(origin + HL_CODEBASE_ID + navigator.userAgent.slice(0, 20));
    const env         = process.env.NODE_ENV || 'unknown';
    const commercial  = detectCommercialActivity();

    // Fire-and-forget — never blocks the UI
    setTimeout(() => {
      fetch(CANONICAL_BEACON, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          fingerprint,
          env,
          codebaseId: HL_CODEBASE_ID,
          commercialState: commercial
        }),
        keepalive: true,
      }).catch(() => {});
    }, 3000); // Wait 3s for scripts to load
  }, []);

  // Invisible — no UI output. Embeds ownership metadata in the DOM
  // so that Google's JavaScript crawler can read it.
  return (
    <meta
      name="hl-origin"
      content="Stefan Antonio Cirisanu — humanidfi.com — HL-ORIGIN-SAC-2024"
      data-canonical="https://humanidfi.com"
      data-owner="Stefan Antonio Cirisanu"
      data-codebase={HL_CODEBASE_ID}
      style={{ display: 'none' }}
    />
  );
}
