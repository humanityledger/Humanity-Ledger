'use client';

/**
 * Counts a visit for the live map (POST /api/stats/visit): one per page load, sent with only the
 * time zone the browser reports. Nothing is written to the browser (no localStorage, no cookie,
 * no id), so counting needs no consent under the ePrivacy rules on storing information on the
 * user's device (LSSI art. 22.2 in Spain). Calls `onCounted` when the visit was counted, so the
 * map can refresh. Until 19 November 2026 a random id kept in localStorage counted each browser
 * once a day; that id is no longer created, and an old one left in a browser is removed.
 */
import { useEffect } from 'react';

/** Once per page load, whatever remounts in between (in memory only). */
let sent = false;

export function useVisitBeacon(onCounted?: () => void) {
  useEffect(() => {
    // Remove what the previous version kept in this browser.
    try {
      localStorage.removeItem('hl.visit.id');
      localStorage.removeItem('hl.visit.day');
    } catch { /* storage blocked: nothing to remove */ }
    if (sent) return;
    sent = true;
    let tz = 'unknown';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'; } catch { /* unknown */ }
    fetch('/api/stats/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tz }),
      keepalive: true,
    })
      .then((r) => (r.ok ? r.json().catch(() => null) : null))
      .then((d) => { if (d?.counted) onCounted?.(); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
